package ru.airballoon.game.domain;

import java.math.BigDecimal;
import java.util.SplittableRandom;

public final class BoosterGenerator {
    public Integer generate(GameConfig config, Theme theme, int booster, long seed) {
        if (booster < 1 || booster > 4) throw new GameException(GameError.INVALID_BOOSTER, "Booster must be 1, 2, 3 or 4");
        if (booster == 1) return null;
        var weights = config.forTheme(theme).boosterWeights();
        BigDecimal total = weights.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        double u = new SplittableRandom(seed ^ 0x424F4F53544552L ^ ((long) theme.levels() << 32) ^ booster).nextDouble();
        BigDecimal sample = total.multiply(BigDecimal.valueOf(u));
        BigDecimal cumulative = BigDecimal.ZERO;
        for (int i = 0; i < weights.size(); i++) {
            cumulative = cumulative.add(weights.get(i));
            if (sample.compareTo(cumulative) < 0) return i + 1;
        }
        throw new GameException(GameError.INVALID_GAME_CONFIG, "Unable to select booster level");
    }
}
