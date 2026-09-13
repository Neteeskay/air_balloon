package ru.airballoon.game.infrastructure.web;

import ru.airballoon.game.domain.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Explicit allow-list: seed and the future crash point cannot leak via REST or WebSocket.
 * The booster position is intentionally public for x2/x3/x4: it is selected and
 * committed before ROUND_STARTED, so the client can render the promised marker
 * without gaining any information about the future crash.
 */
public record RoundView(UUID id, Theme theme, BigDecimal betAmount, int boosterMultiplier,
                        Integer boosterLevel, boolean boosterActivated, BigDecimal currentMultiplier,
                        BigDecimal flightMultiplier, BigDecimal effectiveMultiplier,
                        int currentLevel, int totalLevels, List<BigDecimal> levelThresholds,
                        boolean cashoutAvailable, BigDecimal cashoutPreviewAmount,
                        BigDecimal cashoutMultiplier, BigDecimal winAmount,
                        long roundScore, RoundStatus status, String outcome, BigDecimal crashMultiplier,
                        Instant startedAt, Instant cashoutAt, Instant crashedAt, Instant finishedAt,
                        Instant timestamp, long sequence, UUID roundId, Instant serverTime,
                        boolean cashoutPerformed, String fairnessCommitment, FairnessView fairnessReveal) {
    public static RoundView from(GameRound r) {
        return from(r, r.updatedAt());
    }
    public static RoundView from(GameRound r, Instant serverTime) {
        boolean finished = r.status() == RoundStatus.FINISHED;
        boolean revealed = finished || r.status() == RoundStatus.CRASHED;
        BigDecimal cashoutPreviewAmount = r.status() == RoundStatus.RUNNING
                ? PayoutCalculator.calculate(r) : null;
        return new RoundView(r.id(), r.theme(), r.betAmount(), r.boosterMultiplier(),
                r.boosterLevel(),
                r.boosterActivated(), r.currentMultiplier(), r.flightMultiplier(), r.currentMultiplier(), r.currentLevel(), r.theme().levels(),
                r.config().forTheme(r.theme()).thresholds(), r.status() == RoundStatus.RUNNING && r.currentLevel() > 0,
                cashoutPreviewAmount, r.cashoutMultiplier(), r.winAmount(), r.roundScore(), r.status(),
                finished ? (r.cashoutAt() == null ? "LOSS" : "CASHED_OUT") : null,
                finished || r.status() == RoundStatus.CRASHED ? r.crashMultiplier() : null,
                r.startedAt(), r.cashoutAt(), r.crashedAt(), r.finishedAt(), r.updatedAt(), r.sequence(),
                r.id(), serverTime, r.cashoutAt() != null, r.fairnessCommitment(), revealed ? FairnessView.from(r) : null);
    }
}
