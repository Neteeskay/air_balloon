package ru.hackathon.airballoon.admin.config.service;

import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.stereotype.Service;
import ru.hackathon.airballoon.admin.config.domain.GameTheme;
import ru.hackathon.airballoon.admin.config.dto.BoosterSettingsDto;
import ru.hackathon.airballoon.admin.config.dto.CrashSettingsDto;
import ru.hackathon.airballoon.admin.config.dto.GameConfigurationWriteRequest;
import ru.hackathon.airballoon.admin.config.dto.ThemeProbabilitiesDto;
import ru.hackathon.airballoon.common.error.FieldViolation;

/**
 * Semantic validation beyond jakarta constraints. Tier multipliers MUST stay exactly [1,2,3,4]
 * because the engine reads booster values as the literal array [1,2,3,4].
 */
@Service
public class ConfigAdminValidator {
    public static final Set<Double> ALLOWED_TIERS = Set.of(1.0, 2.0, 3.0, 4.0);
    public static final int GREEN_LEVEL_COUNT = GameTheme.GREEN.levelCount();
    public static final int RED_LEVEL_COUNT = GameTheme.RED.levelCount();
    private static final double PROB_SUM_EPSILON = 1e-6;

    public List<FieldViolation> validate(GameConfigurationWriteRequest request) {
        List<FieldViolation> violations = new ArrayList<>();

        CrashSettingsDto crash = request.crash();
        if (crash == null) {
            violations.add(new FieldViolation("crash", "crash settings are required", null));
        } else {
            check(() -> Double.isNaN(crash.alpha()) || crash.alpha() < 0.0 || crash.alpha() >= 1.0,
                    "crash.alpha", "alpha must be in [0, 1)", crash.alpha(), violations);
            check(() -> Double.isNaN(crash.maxMultiplier()) || crash.maxMultiplier() <= 0,
                    "crash.maxMultiplier", "maxMultiplier must be > 0", crash.maxMultiplier(), violations);
            check(() -> Double.isNaN(crash.minCrashMultiplier()) || crash.minCrashMultiplier() <= 0,
                    "crash.minCrashMultiplier", "minCrashMultiplier must be > 0", crash.minCrashMultiplier(), violations);
            check(() -> Double.isNaN(crash.multiplierGrowthRate()) || crash.multiplierGrowthRate() < 0,
                    "crash.multiplierGrowthRate", "multiplierGrowthRate must be >= 0", crash.multiplierGrowthRate(), violations);
            check(() -> Double.isNaN(crash.fps()) || crash.fps() <= 0,
                    "crash.fps", "fps must be > 0", crash.fps(), violations);
            check(() -> Double.isNaN(crash.delta()) || crash.delta() <= 0,
                    "crash.delta", "delta must be > 0", crash.delta(), violations);
            if (crash.maxMultiplier() > 0 && crash.minCrashMultiplier() > 0
                    && !Double.isNaN(crash.maxMultiplier()) && !Double.isNaN(crash.minCrashMultiplier())
                    && crash.maxMultiplier() <= crash.minCrashMultiplier()) {
                violations.add(new FieldViolation("crash.maxMultiplier",
                        "maxMultiplier must be greater than minCrashMultiplier", crash.maxMultiplier()));
            }
        }

        BoosterSettingsDto boosters = request.boosters();
        if (boosters == null) {
            violations.add(new FieldViolation("boosters", "booster settings are required", null));
        } else {
            List<Double> tiers = List.of(boosters.multiplierTier1Value(), boosters.multiplierTier2Value(),
                    boosters.multiplierTier3Value(), boosters.multiplierTier4Value());
            for (int i = 0; i < tiers.size(); i++) {
                Double v = tiers.get(i);
                if (v == null || Double.isNaN(v) || v <= 0) {
                    violations.add(new FieldViolation("boosters.multiplierTier%dValue".formatted(i + 1),
                            "tier multiplier must be > 0", v));
                } else if (!ALLOWED_TIERS.contains(v)) {
                    violations.add(new FieldViolation("boosters.multiplierTier%dValue".formatted(i + 1),
                            "tier multiplier must be exactly " + ALLOWED_TIERS + " to match the engine booster model", v));
                }
            }
            if (tiers.stream().noneMatch(v -> v == null || Double.isNaN(v)) && tiers.stream().distinct().count() != 4) {
                violations.add(new FieldViolation("boosters", "tier multipliers must be distinct", tiers));
            }
            validateTheme(boosters.green(), GameTheme.GREEN, "boosters.green", violations);
            validateTheme(boosters.red(), GameTheme.RED, "boosters.red", violations);
        }

        if (request.points() == null) {
            violations.add(new FieldViolation("points", "points settings are required", null));
        }
        if (request.gameId() == null || request.gameId().isBlank()) {
            violations.add(new FieldViolation("gameId", "gameId is required", null));
        }
        if (request.gameType() == null || !"CRASH".equals(request.gameType())) {
            violations.add(new FieldViolation("gameType", "gameType must be CRASH", request.gameType()));
        }
        if (request.revision() == null || request.revision() <= 0) {
            violations.add(new FieldViolation("revision", "revision must be a positive long", request.revision()));
        }
        return violations.stream().sorted(Comparator.comparing(FieldViolation::field)).toList();
    }

    public List<String> computeWarnings(GameConfigurationWriteRequest request) {
        List<String> warnings = new ArrayList<>();
        CrashSettingsDto crash = request.crash();
        if (crash != null && crash.delta() > 0 && Math.abs(crash.delta() - 1.0 / 60.0) > PROB_SUM_EPSILON) {
            warnings.add("delta does not match 1/fps of 60; live engine simulation may differ from settings");
        }
        BoosterSettingsDto boosters = request.boosters();
        if (boosters != null) {
            warnIfNotSum100(boosters.green(), "green", warnings);
            warnIfNotSum100(boosters.red(), "red", warnings);
        }
        return warnings;
    }

    private void validateTheme(ThemeProbabilitiesDto theme, GameTheme expected, String path, List<FieldViolation> violations) {
        if (theme == null || theme.values().isEmpty()) {
            violations.add(new FieldViolation(path, expected.name().toLowerCase() + " probabilities are required", null));
            return;
        }
        Map<Integer, Double> byLevel = byLevel(theme.values());
        Set<Integer> expectedLevels = new TreeSet<>();
        for (int i = 1; i <= expected.levelCount(); i++) expectedLevels.add(i);
        if (!new TreeSet<>(byLevel.keySet()).equals(expectedLevels)) {
            violations.add(new FieldViolation(path,
                    expected.name().toLowerCase() + " must define exactly levels " + expectedLevels + ", got " + byLevel.keySet(),
                    byLevel.keySet()));
            return;
        }
        double sum = 0.0;
        for (Map.Entry<Integer, Double> e : byLevel.entrySet()) {
            double v = e.getValue();
            sum += v;
            if (Double.isNaN(v) || v < 0.0 || v > 100.0) {
                violations.add(new FieldViolation("%s.line%dLootProb".formatted(path, e.getKey()),
                        "probability must be in [0, 100]", v));
            }
        }
        if (Math.abs(sum - 100.0) > PROB_SUM_EPSILON) {
            violations.add(new FieldViolation(path,
                    expected.name().toLowerCase() + " probabilities must sum to 100%, got " + pct(sum), sum));
        }
    }

    private void warnIfNotSum100(ThemeProbabilitiesDto theme, String name, List<String> warnings) {
        if (theme == null || theme.values().isEmpty()) return;
        double sum = theme.values().values().stream().filter(v -> v != null).mapToDouble(Double::doubleValue).sum();
        if (Math.abs(sum - 100.0) > PROB_SUM_EPSILON) {
            warnings.add(name + " probabilities sum to " + pct(sum) + "% (expected 100%)");
        }
    }

    private Map<Integer, Double> byLevel(Map<String, Double> flat) {
        Map<Integer, Double> out = new LinkedHashMap<>();
        for (Map.Entry<String, Double> e : flat.entrySet()) {
            String levelPart = e.getKey().replace("line", "").replace("LootProb", "");
            try {
                out.put(Integer.parseInt(levelPart), e.getValue());
            } catch (NumberFormatException ex) {
                out.put(-1, e.getValue());
            }
        }
        return out;
    }

    private void check(java.util.function.BooleanSupplier bad, String field, String message, Object value,
                       List<FieldViolation> violations) {
        if (bad.getAsBoolean()) violations.add(new FieldViolation(field, message, value));
    }

    static String pct(double v) {
        return new DecimalFormat("0.000").format(v);
    }
}