package ru.airballoon.game.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.SplittableRandom;

public final class CrashPointGenerator {
    static final int RESULT_SCALE = 4;
    static final RoundingMode RESULT_ROUNDING = RoundingMode.DOWN;
    /** The highest floor4 band flips up to the ceiling so that max can be reached. */
    private static final BigDecimal TOP_BAND = new BigDecimal("0.0001");

    public BigDecimal generate(GameConfig config, Theme theme, int booster, long seed) {
        return generate(config, uniform(theme, booster, seed));
    }

    static BigDecimal uniform(Theme theme, int booster, long seed) {
        return BigDecimal.valueOf(new SplittableRandom(
                seed ^ 0x43524153484CL ^ ((long) theme.levels() << 32) ^ booster).nextDouble());
    }

    /** Visible to deterministic domain tests; production U is always generated server-side above. */
    BigDecimal generate(GameConfig config, BigDecimal u) {
        if (config == null || config.crashMathModel() != GameConfig.CrashMathModel.HOUSE_EDGE_V2)
            throw new GameException(GameError.INVALID_GAME_CONFIG,
                    "New rounds require the HOUSE_EDGE_V2 crash model");
        if (u == null || u.signum() < 0 || u.compareTo(BigDecimal.ONE) >= 0)
            throw new GameException(GameError.INVALID_GAME_CONFIG, "Uniform sample U must satisfy 0 <= U < 1");

        // A fixed range is an existing deterministic test/demo facility. It has no distribution to sample.
        if (config.minCrashMultiplier().compareTo(config.maxCrashMultiplier()) == 0)
            return config.minCrashMultiplier().setScale(RESULT_SCALE, RESULT_ROUNDING);

        // Continuous truncated Pareto on [min, max] with no probability atoms at the bounds.
        //   p = 1 / (1 - alpha) is the shape/skew parameter.
        //   X = [ U * max^-p + (1 - U) * min^-p ] ^ (-1 / p)
        // Maps [0,1) monotonically onto [min, max): U=0 -> min, U->1 -> max.
        // Java lacks a fractional BigDecimal.pow, so IEEE doubles (>= 15 significant
        // digits) carry the computation; the 4th decimal protects the floor precision.
        double min = config.minCrashMultiplier().doubleValue();
        double max = config.maxCrashMultiplier().doubleValue();
        double sample = u.doubleValue();
        double p = 1.0 / (1.0 - config.alpha().doubleValue());
        double x = Math.pow(sample * Math.pow(max, -p) + (1.0 - sample) * Math.pow(min, -p), -1.0 / p);
        BigDecimal result = BigDecimal.valueOf(x).setScale(RESULT_SCALE, RESULT_ROUNDING);
        // The top floor4 band [max - 0.0001, max) rounds up to the ceiling, so the
        // configured maximum multiplier is a reachable outcome (tiny continuous mass).
        BigDecimal maxValue = config.maxCrashMultiplier().setScale(RESULT_SCALE, RESULT_ROUNDING);
        if (result.compareTo(maxValue.subtract(TOP_BAND)) == 0)
            result = maxValue;
        return result;
    }
}
