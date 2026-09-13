package ru.airballoon.game.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Pure lifecycle and math. All input times come from the application clock. */
public final class RoundEngine {
    private final CrashPointGenerator crash = new CrashPointGenerator();
    private final BoosterGenerator boosters = new BoosterGenerator();
    private final MultiplierCalculator multipliers = new MultiplierCalculator();
    private final LevelCalculator levels = new LevelCalculator();
    private final RoundStateMachine states = new RoundStateMachine();

    public void validateStart(Theme theme, BigDecimal bet, int booster, GameConfig config) {
        if (theme == null) throw new GameException(GameError.INVALID_THEME, "Theme must be GREEN or RED");
        if (booster < 1 || booster > 4) throw new GameException(GameError.INVALID_BOOSTER, "Booster must be 1, 2, 3 or 4");
        if (config == null) throw new GameException(GameError.INVALID_GAME_CONFIG, "Game config is unavailable");
        if (bet == null || bet.scale() > config.effectiveEconomyScale()
                || bet.compareTo(config.minBet()) < 0 || bet.compareTo(config.maxBet()) > 0)
            throw new GameException(GameError.INVALID_BET, "Bet is outside configured bounds or has unsupported precision");
    }

    public RoundTransition start(UUID id, UUID userId, Theme theme, BigDecimal bet, int booster,
                                 long seed, GameConfig config, Instant now) {
        validateStart(theme, bet, booster, config);
        Instant start = now.truncatedTo(ChronoUnit.MILLIS);
        Integer boosterLevel = boosters.generate(config, theme, booster, seed);
        BigDecimal crashMultiplier = crash.generate(config, theme, booster, seed);
        String commitment = RoundFairness.commitment(id, seed, crashMultiplier, boosterLevel);
        Frame f = new Frame(new GameRound(id, userId, theme, bet.setScale(2), booster,
                boosterLevel, false, crashMultiplier, new BigDecimal("1.0000"), new BigDecimal("1.0000"), 0, null,
                new BigDecimal("0.00"), 0, start, null, null, null, seed,
                RoundStatus.CREATED, start, 0, config, commitment));
        f.status = states.transition(f.status, RoundStatus.RUNNING);
        f.emit(GameEvent.Type.ROUND_STARTED, Map.of());
        return f.result();
    }

    public RoundTransition advance(GameRound round, Instant now) {
        if (!round.status().flying()) return new RoundTransition(round, List.of());
        Frame f = new Frame(round);
        Instant target = later(round.updatedAt(), now.truncatedTo(ChronoUnit.MILLIS));
        // Visit boundaries, rather than sampling the latest tick: no skipped levels or boosters.
        while (true) {
            BigDecimal next = levels.next(round.config(), round.theme(), f.level);
            BigDecimal atTarget = multipliers.at(round.startedAt(), target, round.config());
            // At a tie the crash wins; no level or booster can rescue a crashed round.
            if (next == null || next.compareTo(round.crashMultiplier()) >= 0 || next.compareTo(atTarget) > 0) break;
            f.updated = later(f.updated, multipliers.crossing(round.startedAt(), next, round.config()));
            f.flightMultiplier = f.flightMultiplier.max(next);
            f.multiplier = f.effectiveMultiplier();
            f.level++;
            long points = f.status == RoundStatus.RUNNING ? levels.points(round.config(), round.theme(), f.level) : 0;
            f.score += points;
            f.emit(GameEvent.Type.LEVEL_REACHED, Map.of("level", f.level, "points", points,
                    "pointsToAward", points, "multiplier", f.multiplier,
                    "flightMultiplier", f.flightMultiplier, "effectiveMultiplier", f.multiplier));
            if (f.status == RoundStatus.RUNNING && !f.boosted && round.boosterLevel() != null
                    && f.level == round.boosterLevel()) {
                BigDecimal before = f.multiplier;
                f.boosted = true;
                f.multiplier = f.effectiveMultiplier();
                long extra = round.config().boosterPoints(round.boosterMultiplier());
                f.score += extra;
                f.emit(GameEvent.Type.BOOSTER_ACTIVATED, Map.of("booster", round.boosterMultiplier(),
                        "level", f.level, "beforeMultiplier", before, "afterMultiplier", f.multiplier,
                        "flightMultiplier", f.flightMultiplier, "effectiveMultiplier", f.multiplier,
                        "points", extra, "pointsToAward", extra));
            }
        }
        BigDecimal currentFlight = multipliers.at(round.startedAt(), target, round.config());
        if (currentFlight.compareTo(round.crashMultiplier()) >= 0) {
            f.updated = later(f.updated, multipliers.crossing(round.startedAt(), round.crashMultiplier(), round.config()));
            f.flightMultiplier = round.crashMultiplier();
            f.multiplier = f.effectiveMultiplier();
            f.crashedAt = f.updated;
            f.status = states.transition(f.status, RoundStatus.CRASHED);
            f.emit(GameEvent.Type.CRASH, Map.of("crashMultiplier", round.crashMultiplier(),
                    "flightMultiplier", f.flightMultiplier, "effectiveMultiplier", f.multiplier));
            f.finishedAt = f.updated;
            f.status = states.transition(f.status, RoundStatus.FINISHED);
            f.emit(GameEvent.Type.ROUND_FINISHED, Map.of());
        } else if (currentFlight.compareTo(round.flightMultiplier()) != 0 || !f.events.isEmpty()) {
            f.flightMultiplier = currentFlight;
            f.multiplier = f.effectiveMultiplier();
            f.updated = target;
            f.emit(GameEvent.Type.MULTIPLIER_UPDATE, Map.of("multiplier", f.multiplier, "level", f.level,
                    "flightMultiplier", f.flightMultiplier, "effectiveMultiplier", f.multiplier));
        }
        return f.events.isEmpty() ? new RoundTransition(round, List.of()) : f.result();
    }

    /** Caller must advance to its current clock time under the same round lock first. */
    public RoundTransition cashout(GameRound round, Instant now) {
        if (round.status() == RoundStatus.FINISHED || round.status() == RoundStatus.CRASHED)
            throw new GameException(GameError.ROUND_ALREADY_CRASHED, "Crash has already occurred");
        if (round.cashoutAt() != null)
            throw new GameException(GameError.ALREADY_CASHED_OUT, "Cashout is already fixed");
        if (round.status() != RoundStatus.RUNNING)
            throw new GameException(GameError.ROUND_NOT_RUNNING, "Round is not running");
        if (round.currentLevel() == 0)
            throw new GameException(GameError.CASHOUT_NOT_AVAILABLE_YET, "Reach the first level before cashout");
        Frame f = new Frame(round);
        f.updated = later(f.updated, now.truncatedTo(ChronoUnit.MILLIS));
        f.status = states.transition(f.status, RoundStatus.CASHED_OUT);
        f.cashoutMultiplier = f.multiplier;
        f.win = PayoutCalculator.calculate(round, f.cashoutMultiplier);
        f.cashoutAt = f.updated;
        f.score += round.config().cashoutPoints();
        f.emit(GameEvent.Type.CASHOUT_SUCCESS, Map.of("cashoutMultiplier", f.cashoutMultiplier,
                "multiplier", f.cashoutMultiplier, "winAmount", f.win,
                "points", round.config().cashoutPoints(), "pointsToAward", round.config().cashoutPoints()));
        return f.result();
    }

    private static Instant later(Instant a, Instant b) { return a.isAfter(b) ? a : b; }

    private static final class Frame {
        final GameRound original;
        final List<GameEvent> events = new ArrayList<>();
        BigDecimal multiplier, flightMultiplier, cashoutMultiplier, win;
        int level;
        boolean boosted;
        long score, sequence;
        RoundStatus status;
        Instant updated, cashoutAt, crashedAt, finishedAt;

        Frame(GameRound r) {
            original = r;
            multiplier = r.currentMultiplier(); flightMultiplier = r.flightMultiplier(); cashoutMultiplier = r.cashoutMultiplier(); win = r.winAmount();
            level = r.currentLevel(); boosted = r.boosterActivated(); score = r.roundScore(); sequence = r.sequence();
            status = r.status(); updated = r.updatedAt(); cashoutAt = r.cashoutAt();
            crashedAt = r.crashedAt(); finishedAt = r.finishedAt();
        }

        BigDecimal effectiveMultiplier() {
            return flightMultiplier.multiply(BigDecimal.valueOf(boosted ? original.boosterMultiplier() : 1))
                    .setScale(4, java.math.RoundingMode.DOWN);
        }

        GameRound snapshot() {
            return new GameRound(original.id(), original.userId(), original.theme(), original.betAmount(),
                    original.boosterMultiplier(), original.boosterLevel(), boosted, original.crashMultiplier(),
                    multiplier, flightMultiplier, level, cashoutMultiplier, win, score, original.startedAt(), cashoutAt,
                    crashedAt, finishedAt, original.seed(), status, updated, sequence, original.config(),
                    original.fairnessCommitment());
        }

        void emit(GameEvent.Type type, Map<String, Object> data) {
            sequence++;
            events.add(new GameEvent(type, original.id(), original.userId(), sequence, updated, data, snapshot()));
        }

        RoundTransition result() { return new RoundTransition(snapshot(), events); }
    }
}
