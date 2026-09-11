package ru.hackathon.airballoon.config;

import java.math.BigDecimal;
import java.util.List;

/** Immutable configuration; probability weights are basis points (sum = 10,000). */
public record GameConfig(
    String gameId, String gameName, String gameType, boolean active,
    int greenLevelCount, int redLevelCount,
    BigDecimal minCrashMultiplier, BigDecimal maxCrashMultiplier, double growthRate, double alpha,
    int updateIntervalMs, BigDecimal minBet, BigDecimal maxBet, List<Integer> boosterValues,
    List<Integer> greenBoosterWeights, List<Integer> redBoosterWeights,
    long pointsPerLevel, long pointsCashoutBonus, long pointsX2Bonus, long pointsX3Bonus, long pointsX4Bonus,
    boolean fixedSeedEnabled, Long fixedSeed
) {
    public GameConfig {
        boosterValues = boosterValues == null ? null : List.copyOf(boosterValues);
        greenBoosterWeights = greenBoosterWeights == null ? null : List.copyOf(greenBoosterWeights);
        redBoosterWeights = redBoosterWeights == null ? null : List.copyOf(redBoosterWeights);
    }
    public long boosterPoints(int tier) {
        return switch (tier) { case 2 -> pointsX2Bonus; case 3 -> pointsX3Bonus; case 4 -> pointsX4Bonus; default -> 0; };
    }
}
