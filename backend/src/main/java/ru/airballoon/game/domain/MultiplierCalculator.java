package ru.airballoon.game.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;

public final class MultiplierCalculator {
    public BigDecimal at(Instant startedAt, Instant now, GameConfig config, int factor) {
        long millis = Math.max(0, Duration.between(startedAt, now).toMillis());
        return BigDecimal.ONE.add(config.growthPerSecond().multiply(BigDecimal.valueOf(millis, 3)))
                .multiply(BigDecimal.valueOf(factor)).setScale(4, RoundingMode.DOWN);
    }

    /** First server millisecond at which the given boundary is reachable. */
    public Instant crossing(Instant start, BigDecimal boundary, GameConfig config, int factor) {
        BigDecimal f = BigDecimal.valueOf(factor);
        long millis = boundary.subtract(f).max(BigDecimal.ZERO).multiply(BigDecimal.valueOf(1000))
                .divide(config.growthPerSecond().multiply(f), 0, RoundingMode.CEILING).longValueExact();
        return start.plusMillis(millis);
    }
}
