package ru.airballoon.game.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;

public final class MultiplierCalculator {
    public BigDecimal at(Instant startedAt, Instant now, GameConfig config) {
        long millis = Math.max(0, Duration.between(startedAt, now).toMillis());
        return BigDecimal.ONE.add(config.growthPerSecond().multiply(BigDecimal.valueOf(millis, 3)))
                .setScale(4, RoundingMode.DOWN);
    }

    /** First server millisecond at which the given boundary is reachable. */
    public Instant crossing(Instant start, BigDecimal boundary, GameConfig config) {
        long millis = boundary.subtract(BigDecimal.ONE).max(BigDecimal.ZERO).multiply(BigDecimal.valueOf(1000))
                .divide(config.growthPerSecond(), 0, RoundingMode.CEILING).longValueExact();
        return start.plusMillis(millis);
    }
}
