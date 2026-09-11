package ru.airballoon.game.domain;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.boot.context.properties.bind.ConstructorBinding;

/** Immutable snapshot; changes from a provider only affect new rounds. */
public record GameConfig(
        BigDecimal minCrashMultiplier, BigDecimal maxCrashMultiplier,
        double distributionParameter, BigDecimal growthPerSecond,
        BigDecimal minBet, BigDecimal maxBet, long boosterPointsPerMultiplier,
        Long boosterPointsX2, Long boosterPointsX3, Long boosterPointsX4,
        long cashoutPoints, Integer economyScale,
        ThemeConfig green, ThemeConfig red) {

    /** Backward-compatible form used by the standalone engine configuration. */
    public GameConfig(BigDecimal minCrashMultiplier, BigDecimal maxCrashMultiplier,
                      double distributionParameter, BigDecimal growthPerSecond,
                      BigDecimal minBet, BigDecimal maxBet, long boosterPointsPerMultiplier,
                      ThemeConfig green, ThemeConfig red) {
        this(minCrashMultiplier, maxCrashMultiplier, distributionParameter, growthPerSecond,
                minBet, maxBet, boosterPointsPerMultiplier, null, null, null, 0, null, green, red);
    }

    @ConstructorBinding
    public GameConfig {
        require(minCrashMultiplier != null && maxCrashMultiplier != null
                && minCrashMultiplier.compareTo(BigDecimal.ONE) >= 0
                && maxCrashMultiplier.compareTo(minCrashMultiplier) >= 0
                && maxCrashMultiplier.compareTo(new BigDecimal("1000000")) <= 0,
                "Crash bounds must satisfy 1 <= min <= max <= 1000000");
        require(minCrashMultiplier.scale() <= 4 && maxCrashMultiplier.scale() <= 4,
                "Crash precision is at most four decimal places");
        require(Double.isFinite(distributionParameter) && distributionParameter >= 0.01
                && distributionParameter <= 100, "Distribution parameter must be in [0.01,100]");
        require(growthPerSecond != null && growthPerSecond.compareTo(new BigDecimal("0.0001")) >= 0
                && growthPerSecond.compareTo(BigDecimal.TEN) <= 0 && growthPerSecond.scale() <= 4,
                "Growth per second must be in [0.0001,10], up to four decimals");
        require(minBet != null && maxBet != null && minBet.signum() > 0
                && maxBet.compareTo(minBet) >= 0 && maxBet.compareTo(new BigDecimal("1000000000")) <= 0
                && minBet.scale() <= 2 && maxBet.scale() <= 2, "Invalid bet bounds or money precision");
        require(boosterPointsPerMultiplier >= 0 && boosterPointsPerMultiplier <= 1000000000,
                "Invalid booster points");
        require(cashoutPoints >= 0 && cashoutPoints <= 1000000000, "Invalid cashout points");
        require((boosterPointsX2 == null && boosterPointsX3 == null && boosterPointsX4 == null)
                        || (validPoints(boosterPointsX2) && validPoints(boosterPointsX3)
                        && validPoints(boosterPointsX4)),
                "Explicit x2/x3/x4 booster points must be provided together and be valid");
        require(economyScale == null || economyScale >= 0 && economyScale <= 2,
                "Economy scale must be between zero and two");
        require(green != null && red != null, "Both theme configs are required");
        require(green.thresholds().size() == Theme.GREEN.levels(), "GREEN needs exactly 9 levels");
        require(red.thresholds().size() == Theme.RED.levels(), "RED needs exactly 12 levels");
    }

    public ThemeConfig forTheme(Theme theme) { return theme == Theme.GREEN ? green : red; }

    /** Explicit database values win; legacy configs retain their original extra-points formula. */
    public long boosterPoints(int multiplier) {
        if (boosterPointsX2 != null) {
            return switch (multiplier) {
                case 2 -> boosterPointsX2;
                case 3 -> boosterPointsX3;
                case 4 -> boosterPointsX4;
                default -> 0;
            };
        }
        return boosterPointsPerMultiplier * (multiplier - 1L);
    }

    public int effectiveEconomyScale() { return economyScale == null ? 2 : economyScale; }

    private static boolean validPoints(Long value) {
        return value != null && value >= 0 && value <= 1000000000;
    }

    static void require(boolean valid, String message) {
        if (!valid) throw new GameException(GameError.INVALID_GAME_CONFIG, message);
    }

    public record ThemeConfig(List<BigDecimal> thresholds, List<Long> points,
                              List<BigDecimal> boosterWeights) {
        public ThemeConfig {
            require(thresholds != null && points != null && boosterWeights != null,
                    "Thresholds, points and weights are required");
            require(!thresholds.isEmpty() && thresholds.size() == points.size()
                    && thresholds.size() == boosterWeights.size(), "Theme array lengths must match");
            BigDecimal previous = BigDecimal.ONE;
            BigDecimal total = BigDecimal.ZERO;
            for (int i = 0; i < thresholds.size(); i++) {
                BigDecimal threshold = thresholds.get(i);
                BigDecimal weight = boosterWeights.get(i);
                Long score = points.get(i);
                require(threshold != null && threshold.compareTo(previous) > 0
                        && threshold.scale() <= 4 && threshold.compareTo(new BigDecimal("1000000")) <= 0,
                        "Level thresholds must increase strictly above 1, with up to four decimals");
                require(score != null && score >= 0 && score <= 1000000000, "Invalid level points");
                require(weight != null && weight.signum() >= 0
                        && weight.compareTo(new BigDecimal("1000000000")) <= 0
                        && weight.scale() <= 8, "Invalid booster weight");
                total = total.add(weight);
                previous = threshold;
            }
            require(total.signum() > 0, "Booster weights must have positive total mass");
            thresholds = List.copyOf(thresholds);
            points = List.copyOf(points);
            boosterWeights = List.copyOf(boosterWeights);
        }
    }
}
