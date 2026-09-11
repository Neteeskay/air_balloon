package ru.hackathon.airballoon.config.service;

import org.springframework.stereotype.Component;
import ru.hackathon.airballoon.common.error.ConfigValidationException;
import ru.hackathon.airballoon.common.error.FieldViolation;
import ru.hackathon.airballoon.config.domain.GameTheme;
import ru.hackathon.airballoon.config.dto.GameConfigurationWriteRequest;
import ru.hackathon.airballoon.config.dto.ThemeProbabilitiesDto;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Component
public class ConfigValidator {
    public static final double PROBABILITY_TOTAL = 100.0;
    public static final double PROBABILITY_TOLERANCE = 1.0e-6;

    public void validate(GameConfigurationWriteRequest request, String expectedGameId) {
        List<FieldViolation> errors = new ArrayList<>();

        if (request == null) {
            throw new ConfigValidationException(List.of(new FieldViolation("configuration", "Configuration is required")));
        }

        if (expectedGameId != null && request.gameId() != null && !expectedGameId.equals(request.gameId())) {
            errors.add(new FieldViolation("gameId", "gameId is immutable and must equal " + expectedGameId));
        }
        if (request.gameType() != null && !"CRASH".equals(request.gameType())) {
            errors.add(new FieldViolation("gameType", "Only CRASH game type is supported by this engine"));
        }

        if (request.crash() != null) {
            finitePositive(errors, "crash.alpha", request.crash().alpha());
            finitePositive(errors, "crash.maxMultiplier", request.crash().maxMultiplier());
            finitePositive(errors, "crash.minCrashMultiplier", request.crash().minCrashMultiplier());
            finitePositive(errors, "crash.multiplierGrowthRate", request.crash().multiplierGrowthRate());
            finitePositive(errors, "crash.fps", request.crash().fps());
            finitePositive(errors, "crash.delta", request.crash().delta());
            if (request.crash().maxMultiplier() != null && request.crash().minCrashMultiplier() != null
                    && Double.isFinite(request.crash().maxMultiplier())
                    && Double.isFinite(request.crash().minCrashMultiplier())
                    && request.crash().maxMultiplier() <= request.crash().minCrashMultiplier()) {
                errors.add(new FieldViolation("crash.maxMultiplier",
                        "maxMultiplier must be greater than minCrashMultiplier"));
            }
        }

        if (request.boosters() != null) {
            finitePositive(errors, "boosters.multiplierTier1Value", request.boosters().multiplierTier1Value());
            finitePositive(errors, "boosters.multiplierTier2Value", request.boosters().multiplierTier2Value());
            finitePositive(errors, "boosters.multiplierTier3Value", request.boosters().multiplierTier3Value());
            finitePositive(errors, "boosters.multiplierTier4Value", request.boosters().multiplierTier4Value());
            validateTierOrder(request, errors);
            validateDistribution(request.boosters().green(), GameTheme.GREEN, "boosters.green", errors);
            validateDistribution(request.boosters().red(), GameTheme.RED, "boosters.red", errors);
        }

        if (!errors.isEmpty()) throw new ConfigValidationException(errors);
    }

    private static void validateTierOrder(GameConfigurationWriteRequest request, List<FieldViolation> errors) {
        Double[] tiers = {
                request.boosters().multiplierTier1Value(),
                request.boosters().multiplierTier2Value(),
                request.boosters().multiplierTier3Value(),
                request.boosters().multiplierTier4Value()
        };
        for (int i = 1; i < tiers.length; i++) {
            if (tiers[i - 1] != null && tiers[i] != null
                    && Double.isFinite(tiers[i - 1]) && Double.isFinite(tiers[i])
                    && tiers[i] < tiers[i - 1]) {
                errors.add(new FieldViolation("boosters.multiplierTier" + (i + 1) + "Value",
                        "Booster multiplier tiers must be non-decreasing"));
            }
        }
    }

    private static void validateDistribution(
            ThemeProbabilitiesDto dto,
            GameTheme theme,
            String fieldPrefix,
            List<FieldViolation> errors) {
        if (dto == null) return;
        Map<String, Double> values = dto.asMap();
        Set<String> expected = IntStream.rangeClosed(1, theme.levelCount())
                .mapToObj(i -> "line" + i + "LootProb")
                .collect(Collectors.toSet());

        for (String key : expected) {
            if (!values.containsKey(key)) {
                errors.add(new FieldViolation(fieldPrefix + "." + key, "Probability is required"));
            }
        }
        for (String actual : values.keySet()) {
            if (!expected.contains(actual)) {
                errors.add(new FieldViolation(fieldPrefix + "." + actual,
                        "Unsupported level probability for " + theme + " theme"));
            }
        }

        double sum = 0.0;
        boolean allFinite = true;
        for (String key : expected) {
            Double value = values.get(key);
            if (value == null) {
                allFinite = false;
                continue;
            }
            if (!Double.isFinite(value) || value < 0.0 || value > 100.0) {
                allFinite = false;
                errors.add(new FieldViolation(fieldPrefix + "." + key,
                        "Probability must be a finite number between 0 and 100"));
            } else {
                sum += value;
            }
        }
        if (allFinite && Math.abs(sum - PROBABILITY_TOTAL) > PROBABILITY_TOLERANCE) {
            errors.add(new FieldViolation(fieldPrefix,
                    "Level probabilities must sum to 100"));
        }
    }

    private static void finitePositive(List<FieldViolation> errors, String field, Double value) {
        if (value != null && (!Double.isFinite(value) || value <= 0.0)) {
            errors.add(new FieldViolation(field, "Value must be a positive finite number"));
        }
    }
}
