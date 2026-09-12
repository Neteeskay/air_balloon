package ru.airballoon.game.domain;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.SplittableRandom;

public final class CrashPointGenerator {
    static final int RESULT_SCALE = 4;
    static final RoundingMode RESULT_ROUNDING = RoundingMode.DOWN;
    private static final MathContext INTERNAL_PRECISION = MathContext.DECIMAL128;

    public BigDecimal generate(GameConfig config, Theme theme, int booster, long seed) {
        return generate(config, uniform(theme, booster, seed));
    }

    static BigDecimal uniform(Theme theme, int booster, long seed) {
        return BigDecimal.valueOf(new SplittableRandom(
                seed ^ 0x43524153484CL ^ ((long) theme.levels() << 32) ^ booster).nextDouble());
    }

    /** Visible to deterministic domain tests; production U is always generated server-side above. */
    BigDecimal generate(GameConfig config, BigDecimal u) {
        if (config == null || config.crashMathModel() != GameConfig.CrashMathModel.HOUSE_EDGE_V1)
            throw new GameException(GameError.INVALID_GAME_CONFIG,
                    "New rounds require the HOUSE_EDGE_V1 crash model");
        if (u == null || u.signum() < 0 || u.compareTo(BigDecimal.ONE) >= 0)
            throw new GameException(GameError.INVALID_GAME_CONFIG, "Uniform sample U must satisfy 0 <= U < 1");

        // A fixed range is an existing deterministic test/demo facility. It has no distribution to sample.
        if (config.minCrashMultiplier().compareTo(config.maxCrashMultiplier()) == 0)
            return config.minCrashMultiplier().setScale(RESULT_SCALE, RESULT_ROUNDING);

        BigDecimal raw = u.compareTo(config.alpha()) < 0
                ? config.minCrashMultiplier()
                : BigDecimal.ONE.subtract(config.alpha())
                    .divide(BigDecimal.ONE.subtract(u), INTERNAL_PRECISION);
        return raw.min(config.maxCrashMultiplier()).setScale(RESULT_SCALE, RESULT_ROUNDING);
    }
}
