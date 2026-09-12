package ru.hackathon.airballoon.config;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import ru.hackathon.airballoon.common.BusinessException;

@Component
public class ConfigValidator {
    private final boolean allowFixedSeed;
    public ConfigValidator(@Value("${app.allow-fixed-seed:false}") boolean allowFixedSeed) {
        this.allowFixedSeed = allowFixedSeed;
    }
    public void validate(GameConfig c) {
        check(c != null, "config обязателен");
        check(c.gameId() != null && c.gameId().matches("[a-z0-9-]{1,64}"), "gameId: 1–64 латинских символа/цифр/дефисов");
        check(c.gameName() != null && !c.gameName().isBlank() && c.gameName().length() <= 100, "gameName: 1–100 символов");
        check("CRASH".equals(c.gameType()), "gameType должен быть CRASH");
        check(c.greenLevelCount() == 9 && c.redLevelCount() == 12, "greenLevelCount=9, redLevelCount=12 согласно ТЗ");
        check(c.minCrashMultiplier() != null && c.minCrashMultiplier().signum() > 0,
            "minCrashMultiplier должен быть > 0");
        check(c.maxCrashMultiplier() != null && c.maxCrashMultiplier().compareTo(c.minCrashMultiplier()) >= 0
            && c.maxCrashMultiplier().compareTo(new BigDecimal("1000000")) <= 0, "maxCrashMultiplier должен быть >= min и <= 1000000");
        check(c.minCrashMultiplier().scale() <= 4 && c.maxCrashMultiplier().scale() <= 4, "multiplier: максимум 4 знака после запятой");
        check(c.minCrashMultiplier().compareTo(BigDecimal.ONE) <= 0
                || c.minCrashMultiplier().compareTo(c.maxCrashMultiplier()) == 0,
            "piecewise crash formula требует minCrashMultiplier <= 1, кроме фиксированного диапазона min=max");
        check(Double.isFinite(c.growthRate()) && c.growthRate() >= 0.0001 && c.growthRate() <= 10
            && BigDecimal.valueOf(c.growthRate()).stripTrailingZeros().scale() <= 4,
            "growthRate: [0.0001,10], максимум 4 знака после запятой");
        check(c.alpha() != null && c.alpha().signum() >= 0 && c.alpha().compareTo(BigDecimal.ONE) < 0,
            "alpha: 0 <= alpha < 1");
        check(c.updateIntervalMs() >= 16 && c.updateIntervalMs() <= 1000, "updateIntervalMs: 16–1000");
        check(c.minBet()!=null && c.maxBet()!=null && c.minBet().signum()>0
            && c.maxBet().compareTo(c.minBet())>=0 && c.maxBet().compareTo(new BigDecimal("1000000000"))<=0,
            "minBet/maxBet: 0 < minBet <= maxBet <= 1000000000");
        check(c.minBet().scale()<=2 && c.maxBet().scale()<=2, "minBet/maxBet: максимум 2 знака после запятой");
        check(List.of(1,2,3,4).equals(c.boosterValues()),
            "boosterValues должны быть ровно [1,2,3,4]");
        weights(c.greenBoosterWeights(), 9, "greenBoosterWeights");
        weights(c.redBoosterWeights(), 12, "redBoosterWeights");
        points(c.pointsPerLevel(), "pointsPerLevel"); points(c.pointsCashoutBonus(), "pointsCashoutBonus");
        points(c.pointsX2Bonus(), "pointsX2Bonus"); points(c.pointsX3Bonus(), "pointsX3Bonus"); points(c.pointsX4Bonus(), "pointsX4Bonus");
        check(!c.fixedSeedEnabled() || (allowFixedSeed && c.fixedSeed() != null), "fixedSeedEnabled требует demo profile и fixedSeed");
    }
    private void weights(List<Integer> values, int size, String field) {
        check(values != null && values.size() == size, field + ": ожидается " + size + " весов");
        check(values.stream().allMatch(v -> v != null && v >= 0 && v <= 10000)
            && values.stream().mapToLong(Integer::longValue).sum() == 10000, field + ": неотрицательные веса с суммой 10000");
    }
    private void points(long p, String field) { check(p >= 0 && p <= 1000000, field + ": 0–1000000"); }
    private void check(boolean valid, String message) {
        if (!valid) throw BusinessException.invalid("INVALID_GAME_CONFIG", message);
    }
}
