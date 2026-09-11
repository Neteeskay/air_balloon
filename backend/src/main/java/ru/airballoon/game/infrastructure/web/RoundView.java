package ru.airballoon.game.infrastructure.web;

import ru.airballoon.game.domain.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Explicit allow-list: seed and the future crash point cannot leak via REST or WebSocket. */
public record RoundView(UUID id, Theme theme, BigDecimal betAmount, int boosterMultiplier,
                        Integer boosterLevel, boolean boosterActivated, BigDecimal currentMultiplier,
                        int currentLevel, int totalLevels, List<BigDecimal> levelThresholds,
                        boolean cashoutAvailable, BigDecimal cashoutMultiplier, BigDecimal winAmount,
                        long roundScore, RoundStatus status, String outcome, BigDecimal crashMultiplier,
                        Instant startedAt, Instant cashoutAt, Instant crashedAt, Instant finishedAt,
                        Instant timestamp, long sequence) {
    public static RoundView from(GameRound r) {
        boolean finished = r.status() == RoundStatus.FINISHED;
        return new RoundView(r.id(), r.theme(), r.betAmount(), r.boosterMultiplier(), r.boosterLevel(),
                r.boosterActivated(), r.currentMultiplier(), r.currentLevel(), r.theme().levels(),
                r.config().forTheme(r.theme()).thresholds(), r.status() == RoundStatus.RUNNING && r.currentLevel() > 0,
                r.cashoutMultiplier(), r.winAmount(), r.roundScore(), r.status(),
                finished ? (r.cashoutAt() == null ? "LOSS" : "CASHED_OUT") : null,
                finished || r.status() == RoundStatus.CRASHED ? r.crashMultiplier() : null,
                r.startedAt(), r.cashoutAt(), r.crashedAt(), r.finishedAt(), r.updatedAt(), r.sequence());
    }
}
