package ru.airballoon.game.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Internal immutable persistence snapshot. Never serialize directly to clients. */
public record GameRound(
        UUID id, UUID userId, Theme theme, BigDecimal betAmount, int boosterMultiplier,
        Integer boosterLevel, boolean boosterActivated, BigDecimal crashMultiplier,
        BigDecimal currentMultiplier, BigDecimal flightMultiplier, int currentLevel, BigDecimal cashoutMultiplier,
        BigDecimal winAmount, long roundScore, Instant startedAt, Instant cashoutAt,
        Instant crashedAt, Instant finishedAt, long seed, RoundStatus status,
        Instant updatedAt, long sequence, GameConfig config, String fairnessCommitment) {
    /**
     * Snapshots written before flightMultiplier was introduced are still readable.
     * In those snapshots currentMultiplier was the effective value, so recover the
     * underlying flight value using the already persisted booster state.
     */
    public GameRound {
        if (flightMultiplier == null) {
            int factor = boosterActivated && boosterMultiplier > 1 ? boosterMultiplier : 1;
            flightMultiplier = currentMultiplier == null
                    ? BigDecimal.ONE
                    : currentMultiplier.divide(BigDecimal.valueOf(factor), 4, java.math.RoundingMode.DOWN);
        }
    }
}
