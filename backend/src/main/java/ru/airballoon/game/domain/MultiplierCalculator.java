package ru.airballoon.game.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;

public final class MultiplierCalculator {
    private static final int MULTIPLIER_SCALE = 4;

    public BigDecimal at(Instant startedAt, Instant now, GameConfig config) {
        long millis = Math.max(0, Duration.between(startedAt, now).toMillis());
        double exponent = config.growthPerSecond().doubleValue() * millis / 1000.0d;

        // A live round can never progress beyond its configured crash ceiling. Avoid
        // converting an overflowing double when a very old snapshot is recovered;
        // reaching the ceiling is sufficient for the engine's exact crash crossing.
        BigDecimal ceiling = config.maxCrashMultiplier().max(BigDecimal.ONE);
        double ceilingExponent = StrictMath.log(ceiling.doubleValue());
        if (exponent >= ceilingExponent) {
            return ceiling.setScale(MULTIPLIER_SCALE, RoundingMode.DOWN);
        }
        return BigDecimal.valueOf(StrictMath.exp(exponent)).setScale(MULTIPLIER_SCALE, RoundingMode.DOWN);
    }

    /** First server millisecond at which the given boundary is reachable. */
    public Instant crossing(Instant start, BigDecimal boundary, GameConfig config) {
        if (boundary.compareTo(BigDecimal.ONE) <= 0) return start;
        double exactMillis = StrictMath.log(boundary.doubleValue())
                / config.growthPerSecond().doubleValue() * 1000.0d;
        long millis = (long) StrictMath.ceil(exactMillis);

        // Align the analytical inverse with the authoritative millisecond/scale-4
        // representation. These guards also absorb harmless floating-point error
        // around an exact boundary without introducing tick-cadence dependence.
        while (millis > 0 && at(start, start.plusMillis(millis - 1), config).compareTo(boundary) >= 0) millis--;
        while (at(start, start.plusMillis(millis), config).compareTo(boundary) < 0) millis++;
        return start.plusMillis(millis);
    }
}
