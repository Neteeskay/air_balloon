package ru.airballoon.game.domain;

import java.math.BigDecimal;

public final class LevelCalculator {
    public BigDecimal next(GameConfig config, Theme theme, int reached) {
        return reached == theme.levels() ? null : config.forTheme(theme).thresholds().get(reached);
    }

    public long points(GameConfig config, Theme theme, int level) {
        return config.forTheme(theme).points().get(level - 1);
    }
}
