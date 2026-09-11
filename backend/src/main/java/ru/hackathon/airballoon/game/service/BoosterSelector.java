package ru.hackathon.airballoon.game.service;

import org.springframework.stereotype.Component;
import ru.hackathon.airballoon.config.domain.GameTheme;
import ru.hackathon.airballoon.config.entity.BoosterLevelProbabilityEntity;
import ru.hackathon.airballoon.config.entity.GameConfigurationVersionEntity;

import java.util.Comparator;
import java.util.List;

@Component
public class BoosterSelector {
    private final GameRandomSource random;

    public BoosterSelector(GameRandomSource random) {
        this.random = random;
    }

    public Integer selectLevel(GameConfigurationVersionEntity config, GameTheme theme, int boosterTier) {
        if (boosterTier <= 1) return null;
        List<BoosterLevelProbabilityEntity> options = config.getProbabilities().stream()
                .filter(p -> p.getTheme() == theme)
                .sorted(Comparator.comparingInt(BoosterLevelProbabilityEntity::getLevelNumber))
                .toList();
        if (options.size() != theme.levelCount()) {
            throw new IllegalStateException("Active configuration has invalid booster distribution for " + theme);
        }
        double draw = random.nextDouble() * 100.0;
        double cumulative = 0.0;
        for (BoosterLevelProbabilityEntity option : options) {
            cumulative += option.getProbability();
            if (draw < cumulative) return option.getLevelNumber();
        }
        return options.get(options.size() - 1).getLevelNumber();
    }
}
