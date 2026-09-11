package ru.airballoon.game.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import ru.airballoon.game.application.port.*;
import ru.airballoon.game.domain.*;
import ru.airballoon.game.infrastructure.memory.InMemoryActiveRoundStateStore;
import ru.airballoon.game.infrastructure.memory.InMemoryRoundEventStore;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.BiConsumer;

/** One authoritative process. Each round owns its lock and retry queue. */
public final class GameService {
    private static final Logger log = LoggerFactory.getLogger(GameService.class);
    private final RoundEngine engine;
    private final GameConfigProvider configs;
    private final RoundRepository repository;
    private final BalanceService balances;
    private final RewardService rewards;
    private final GameEventPublisher events;
    private final SeedSource seeds;
    private final Clock clock;
    private final RoundEventStore eventStore;
    private final ActiveRoundStateStore checkpoints;
    private final Map<UUID, Session> sessions = new ConcurrentHashMap<>();
    private final Map<String, ReentrantLock> startLocks = new ConcurrentHashMap<>();

    /** Compatibility constructor; server wiring injects replaceable store ports. */
    public GameService(RoundEngine engine, GameConfigProvider configs, RoundRepository repository,
                       BalanceService balances, RewardService rewards, GameEventPublisher events,
                       SeedSource seeds, Clock clock) {
        this(engine, configs, repository, balances, rewards, events, seeds, clock,
                new InMemoryRoundEventStore(256, Duration.ofMinutes(15)),
                new InMemoryActiveRoundStateStore(Duration.ofHours(24)));
    }

    public GameService(RoundEngine engine, GameConfigProvider configs, RoundRepository repository,
                       BalanceService balances, RewardService rewards, GameEventPublisher events,
                       SeedSource seeds, Clock clock, RoundEventStore eventStore, ActiveRoundStateStore checkpoints) {
        this.engine = engine; this.configs = configs; this.repository = repository;
        this.balances = balances; this.rewards = rewards; this.events = events; this.seeds = seeds; this.clock = clock;
        this.eventStore = eventStore; this.checkpoints = checkpoints;
    }

    public GameRound start(UUID userId, Theme theme, BigDecimal bet, int booster) {
        return start(userId, theme, bet, booster, null);
    }

    public GameRound start(UUID userId, Theme theme, BigDecimal bet, int booster, UUID startKey) {
        requireUser(userId);
        if (startKey == null) return startNew(userId, theme, bet, booster, null);
        String lockId = userId + ":" + startKey;
        ReentrantLock lock = startLocks.computeIfAbsent(lockId, ignored -> new ReentrantLock());
        lock.lock();
        try {
            Optional<GameRound> existing = repository.findByStartKey(userId, startKey);
            if (existing.isPresent()) {
                GameRound round = existing.get();
                if (round.theme() != theme || round.betAmount().compareTo(bet) != 0
                        || round.boosterMultiplier() != booster)
                    throw new GameException(GameError.INVALID_REQUEST, "Idempotency-Key was already used with another start request");
                return round;
            }
            return startNew(userId, theme, bet, booster, startKey);
        } finally {
            lock.unlock();
            startLocks.remove(lockId, lock);
        }
    }

    private GameRound startNew(UUID userId, Theme theme, BigDecimal bet, int booster, UUID startKey) {
        GameConfig config = configs.getCurrentConfig();
        engine.validateStart(theme, bet, booster, config);
        UUID id = UUID.randomUUID();
        long seed = seeds.nextSeed();
        RoundTransition start = engine.start(id, userId, theme, bet, booster, seed, config, clock.instant());
        RoundCheckpoint initial = new RoundCheckpoint(RoundCheckpoint.VERSION, start.round(),
                start.events(), null, null);
        GameRound durableStart = repository.createAndDebit(start.round(), balances, initial, startKey);
        Session s = new Session(durableStart);
        s.lock.lock();
        try {
            sessions.put(id, s);
            commit(s, start);
            flush(s);
            return s.round;
        } finally { s.lock.unlock(); }
    }

    public GameRound cashout(UUID userId, UUID roundId) { return cashout(userId, roundId, null); }
    public GameRound cashout(UUID userId, UUID roundId, UUID key) {
        Session s = owned(userId, roundId);
        s.lock.lock();
        try {
            flush(s);
            if (key != null && key.equals(s.cashoutKey)) return s.cashoutResult;
            var handledAt = clock.instant();
            commit(s, engine.advance(s.round, handledAt));
            try {
                RoundTransition cashout = engine.cashout(s.round, handledAt);
                s.cashoutKey = key; s.cashoutResult = cashout.round();
                commit(s, cashout);
            } catch (GameException rejection) {
                log.info("event=CASHOUT_REJECTED roundId={} code={}", roundId, rejection.code());
                flush(s);
                throw rejection;
            }
            flush(s);
            return s.round;
        } finally { s.lock.unlock(); }
    }

    /** Reconnect reads existing authority; it never starts a round or debits another bet. */
    public GameRound get(UUID userId, UUID roundId) {
        Session s = owned(userId, roundId);
        s.lock.lock();
        try { advance(s); return s.round; } finally { s.lock.unlock(); }
    }

    public RoundEventPage replay(UUID userId, UUID roundId, long afterSequence) {
        if (afterSequence < 0) throw new GameException(GameError.INVALID_REQUEST, "afterSequence must be nonnegative");
        Session s = owned(userId, roundId);
        s.lock.lock();
        try {
            advance(s);
            RoundEventPage page = eventStore.findAfter(roundId, afterSequence);
            return new RoundEventPage(page.events(), page.oldestAvailableSequence(), s.round.sequence(),
                    page.snapshotRequired() || page.latestSequence() != s.round.sequence());
        } finally { s.lock.unlock(); }
    }

    /** Owner-process startup may enumerate durable checkpoint IDs and call this method. */
    public GameRound recover(UUID userId, UUID roundId) { return get(userId, roundId); }
    public void recoverActiveRounds(BiConsumer<UUID, RuntimeException> onFailure) {
        for (UUID id : checkpoints.activeRoundIds()) {
            try {
                RoundCheckpoint cp = checkpoints.load(id).orElse(null);
                if (cp != null && cp.round().status() != RoundStatus.FINISHED)
                    recover(cp.round().userId(), id);
            } catch (RuntimeException ex) {
                onFailure.accept(id, ex);
            }
        }
    }
    public void tick(UUID roundId) {
        Session s = sessions.get(roundId);
        if (s == null) return;
        s.lock.lock();
        try { advance(s); } finally { s.lock.unlock(); }
    }
    private void advance(Session s) {
        flush(s);
        commit(s, engine.advance(s.round, clock.instant()));
        flush(s);
    }

    /** Synchronous hook for controlled clocks/tests. Production dispatches rounds independently. */
    public void tickAll(BiConsumer<UUID, RuntimeException> onFailure) { tickAll(onFailure, Runnable::run); }
    public void tickAll(BiConsumer<UUID, RuntimeException> onFailure, Executor executor) {
        sessions.forEach((id, s) -> {
            if (!s.scheduled.compareAndSet(false, true)) return;
            try {
                executor.execute(() -> {
                    try { tick(id); }
                    catch (RuntimeException e) { onFailure.accept(id, e); }
                    finally { s.scheduled.set(false); }
                });
            } catch (RuntimeException e) { s.scheduled.set(false); onFailure.accept(id, e); }
        });
    }
    public int activeRoundCount() { return sessions.size(); }
    public void cleanup() {
        var now = clock.instant();
        eventStore.cleanup(now); checkpoints.cleanup(now); repository.cleanup(now);
    }

    private Session owned(UUID user, UUID id) {
        requireUser(user);
        Session current = sessions.get(id);
        if (current != null) { checkOwner(user, current.round); return current; }
        // Reconstruction inside compute prevents two recovery queues for the same round.
        Session restored = sessions.computeIfAbsent(id, ignored -> {
            var checkpoint = checkpoints.load(id);
            if (checkpoint.isPresent()) {
                RoundCheckpoint cp = checkpoint.get();
                checkOwner(user, cp.round());
                Session s = new Session(cp.round());
                s.cashoutKey = cp.cashoutKey(); s.cashoutResult = cp.cashoutResult();
                if (!cp.pendingEvents().isEmpty()) {
                    s.checkpointDue = true;
                    enqueueEffects(s, cp.round(), cp.pendingEvents());
                } else {
                    // Pure ticks have no business effects; preserve their published high-water sequence.
                    eventStore.latest(id).filter(e -> e.sequence() > s.round.sequence()).ifPresent(e -> {
                        if (!e.snapshot().fairnessCommitment().equals(s.round.fairnessCommitment())
                                || !RoundFairness.verify(e.snapshot())) throw new IllegalStateException("Invalid replay checkpoint");
                        s.round = e.snapshot();
                    });
                }
                return s;
            }
            GameRound saved = repository.findById(id).orElseThrow(() ->
                    new GameException(GameError.ROUND_NOT_FOUND, "Round does not exist"));
            checkOwner(user, saved);
            if (saved.status() != RoundStatus.FINISHED)
                throw new GameException(GameError.INTEGRATION_UNAVAILABLE, "Round requires owner-process recovery checkpoint");
            return new Session(saved);
        });
        checkOwner(user, restored.round);
        return restored;
    }
    private static void requireUser(UUID user) {
        if (user == null) throw new GameException(GameError.UNAUTHENTICATED, "Authenticated user is required");
    }
    private static void checkOwner(UUID user, GameRound round) {
        if (!user.equals(round.userId())) throw new GameException(GameError.FORBIDDEN_ROUND_ACCESS, "Round belongs to another user");
    }

    private void commit(Session s, RoundTransition transition) {
        if (transition.events().isEmpty()) return;
        var observedAt = clock.instant();
        transition = new RoundTransition(transition.round(), transition.events().stream().map(e ->
                new GameEvent(e.type(), e.roundId(), e.userId(), e.sequence(), e.timestamp(), e.data(), e.snapshot(), observedAt)).toList());
        s.round = transition.round();
        if (transition.events().stream().anyMatch(GameEvent::checkpointRequired)) {
            RoundCheckpoint cp = new RoundCheckpoint(RoundCheckpoint.VERSION, transition.round(),
                    transition.events(), s.cashoutKey, s.cashoutResult);
            // Write ahead: no payout or published boundary without its recovery record.
            s.pending.add(() -> checkpoints.saveCheckpoint(cp));
            s.checkpointDue = true;
        }
        enqueueEffects(s, transition.round(), transition.events());
    }
    private void enqueueEffects(Session s, GameRound round, List<GameEvent> batch) {
        s.pending.add(() -> repository.save(round));
        for (GameEvent event : batch) {
            s.pending.add(() -> eventStore.append(event));
            if (event.type() == GameEvent.Type.CASHOUT_SUCCESS)
                s.pending.add(() -> balances.creditWin(event.userId(), event.roundId(), event.snapshot().winAmount()));
            if (event.type() == GameEvent.Type.ROUND_FINISHED)
                s.pending.add(() -> rewards.onRoundFinished(event.snapshot()));
            s.pending.add(() -> events.publish(event));
            if (event.checkpointRequired() && event.type() != GameEvent.Type.LEVEL_REACHED)
                s.pending.add(() -> log.info("event={} roundId={} sequence={} status={}",
                        event.type(), event.roundId(), event.sequence(), event.snapshot().status()));
        }
    }
    private void flush(Session s) {
        try {
            while (!s.pending.isEmpty()) {
                s.pending.getFirst().run(); s.pending.removeFirst();
            }
            if (s.checkpointDue) {
                checkpoints.saveCheckpoint(new RoundCheckpoint(RoundCheckpoint.VERSION, s.round, List.of(),
                        s.cashoutKey, s.cashoutResult));
                s.checkpointDue = false;
            }
            if (s.round.status() == RoundStatus.FINISHED) {
                eventStore.markFinished(s.round.id(), clock.instant());
                checkpoints.markFinished(s.round.id(), clock.instant());
                sessions.remove(s.round.id(), s);
            }
        } catch (RuntimeException ex) {
            throw new GameException(GameError.INTEGRATION_UNAVAILABLE,
                    "Round " + s.round.id() + " has pending integration work; retry or reconnect", ex);
        }
    }
    private static final class Session {
        final ReentrantLock lock = new ReentrantLock();
        final AtomicBoolean scheduled = new AtomicBoolean();
        final ArrayDeque<Runnable> pending = new ArrayDeque<>();
        volatile GameRound round;
        boolean checkpointDue;
        UUID cashoutKey;
        GameRound cashoutResult;
        Session(GameRound round) { this.round = round; }
    }
}
