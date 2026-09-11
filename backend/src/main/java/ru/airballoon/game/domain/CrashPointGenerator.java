package ru.airballoon.game.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.SplittableRandom;

public final class CrashPointGenerator {
    public BigDecimal generate(GameConfig config, Theme theme, int booster, long seed) {
        double u = new SplittableRandom(seed ^ 0x43524153484CL ^ ((long) theme.levels() << 32) ^ booster)
                .nextDouble();
        BigDecimal fraction = BigDecimal.valueOf(StrictMath.pow(u, config.distributionParameter()));
        return config.minCrashMultiplier().add(config.maxCrashMultiplier()
                        .subtract(config.minCrashMultiplier()).multiply(fraction))
                .setScale(4, RoundingMode.DOWN).max(config.minCrashMultiplier()).min(config.maxCrashMultiplier());
    }
}
