package ru.hackathon.airballoon.game.service;

import org.springframework.stereotype.Component;
import ru.hackathon.airballoon.config.entity.GameConfigurationVersionEntity;

import java.time.Duration;
import java.time.Instant;

@Component
public class CrashMathEngine {
    private final GameRandomSource random;

    public CrashMathEngine(GameRandomSource random) {
        this.random = random;
    }

    public double generateCrashPoint(GameConfigurationVersionEntity config) {
        double u = Math.max(1.0e-12, Math.min(1.0 - 1.0e-12, random.nextDouble()));
        double tail = -Math.log(1.0 - u) / config.getAlpha();
        double value = config.getMinCrashMultiplier() + tail;
        return clamp(value, config.getMinCrashMultiplier(), config.getMaxMultiplier());
    }

    public double currentMultiplier(GameConfigurationVersionEntity config, Instant startedAt, boolean boosterActivated, int boosterTier) {
        double seconds = Math.max(0.0, Duration.between(startedAt, Instant.now()).toNanos() / 1_000_000_000.0);
        double multiplier = Math.exp(config.getMultiplierGrowthRate() * seconds);
        if (boosterActivated) multiplier *= boosterValue(config, boosterTier);
        return Math.min(multiplier, config.getMaxMultiplier());
    }

    public double levelThreshold(int level) {
        return 1.0 + level * 0.20;
    }

    public double boosterValue(GameConfigurationVersionEntity config, int tier) {
        return switch (tier) {
            case 1 -> config.getMultiplierTier1Value();
            case 2 -> config.getMultiplierTier2Value();
            case 3 -> config.getMultiplierTier3Value();
            case 4 -> config.getMultiplierTier4Value();
            default -> throw new IllegalArgumentException("Unsupported booster tier: " + tier);
        };
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }
}
