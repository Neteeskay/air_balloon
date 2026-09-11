package ru.airballoon.game.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Internal immutable persistence snapshot. Never serialize directly to clients. */
public record GameRound(
        UUID id, UUID userId, Theme theme, BigDecimal betAmount, int boosterMultiplier,
        Integer boosterLevel, boolean boosterActivated, BigDecimal crashMultiplier,
        BigDecimal currentMultiplier, int currentLevel, BigDecimal cashoutMultiplier,
        BigDecimal winAmount, long roundScore, Instant startedAt, Instant cashoutAt,
        Instant crashedAt, Instant finishedAt, long seed, RoundStatus status,
        Instant updatedAt, long sequence, GameConfig config) {
}
