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
            violations.add(new FieldViolation("crash", "Параметры краша обязательны", null));
        } else {
            check(() -> Double.isNaN(crash.alpha()) || crash.alpha() < 0.0 || crash.alpha() >= 1.0,
                    "crash.alpha", "alpha должен быть в диапазоне [0, 1)", crash.alpha(), violations);
            check(() -> Double.isNaN(crash.maxMultiplier()) || crash.maxMultiplier() <= 0,
                    "crash.maxMultiplier", "maxMultiplier должен быть больше 0", crash.maxMultiplier(), violations);
            check(() -> Double.isNaN(crash.minCrashMultiplier()) || crash.minCrashMultiplier() <= 0,
                    "crash.minCrashMultiplier", "minCrashMultiplier должен быть больше 0", crash.minCrashMultiplier(), violations);
            check(() -> Double.isNaN(crash.multiplierGrowthRate()) || crash.multiplierGrowthRate() < 0,
                    "crash.multiplierGrowthRate", "multiplierGrowthRate должен быть не меньше 0", crash.multiplierGrowthRate(), violations);
            check(() -> Double.isNaN(crash.fps()) || crash.fps() <= 0,
                    "crash.fps", "fps должен быть больше 0", crash.fps(), violations);
            check(() -> Double.isNaN(crash.delta()) || crash.delta() <= 0,
                    "crash.delta", "delta должен быть больше 0", crash.delta(), violations);
            // fps and delta describe the same simulation cadence: delta is the duration of a
            // single frame and must equal 1/fps. Accept configurable ranges but keep the pair consistent.
            check(() -> Double.isFinite(crash.fps()) && Double.isFinite(crash.delta()) && crash.delta() > 0
                            && Math.abs(crash.delta() - (1.0 / crash.fps())) > 1e-9,
                    "crash.delta", "delta должен равняться 1/fps", crash.delta(), violations);
            if (crash.maxMultiplier() > 0 && crash.minCrashMultiplier() > 0
                    && !Double.isNaN(crash.maxMultiplier()) && !Double.isNaN(crash.minCrashMultiplier())
                    && crash.maxMultiplier() <= crash.minCrashMultiplier()) {
                violations.add(new FieldViolation("crash.maxMultiplier",
                        "maxMultiplier должен быть больше minCrashMultiplier", crash.maxMultiplier()));
            }
        }

        BoosterSettingsDto boosters = request.boosters();
        if (boosters == null) {
            violations.add(new FieldViolation("boosters", "Настройки бустеров обязательны", null));
        } else {
            List<Double> tiers = List.of(boosters.multiplierTier1Value(), boosters.multiplierTier2Value(),
                    boosters.multiplierTier3Value(), boosters.multiplierTier4Value());
            for (int i = 0; i < tiers.size(); i++) {
                Double v = tiers.get(i);
                if (v == null || Double.isNaN(v) || v <= 0) {
                    violations.add(new FieldViolation("boosters.multiplierTier%dValue".formatted(i + 1),
                            "Множитель бустера должен быть больше 0", v));
                } else if (!ALLOWED_TIERS.contains(v)) {
                    violations.add(new FieldViolation("boosters.multiplierTier%dValue".formatted(i + 1),
                            "Множитель бустера должен быть строго одним из " + ALLOWED_TIERS + " — так работает движок игры", v));
                }
            }
            if (tiers.stream().noneMatch(v -> v == null || Double.isNaN(v))
                    && !tiers.equals(List.of(1.0, 2.0, 3.0, 4.0))) {
                violations.add(new FieldViolation("boosters", "Множители бустеров зафиксированы: [1, 2, 3, 4]", tiers));
            }
            validateTheme(boosters.green(), GameTheme.GREEN, "boosters.green", violations);
            validateTheme(boosters.red(), GameTheme.RED, "boosters.red", violations);
        }

        if (request.points() == null) {
            violations.add(new FieldViolation("points", "Настройки очков обязательны", null));
        }
        if (request.gameId() == null || request.gameId().isBlank()) {
            violations.add(new FieldViolation("gameId", "Обязательно укажите gameId", null));
        }
        if (request.gameType() == null || !"CRASH".equals(request.gameType())) {
            violations.add(new FieldViolation("gameType", "gameType должен быть CRASH", request.gameType()));
        }
        if (request.revision() == null || request.revision() <= 0) {
            violations.add(new FieldViolation("revision", "revision должно быть положительным числом", request.revision()));
        }
        return violations.stream().sorted(Comparator.comparing(FieldViolation::field)).toList();
    }

    public List<String> computeWarnings(GameConfigurationWriteRequest request) {
        List<String> warnings = new ArrayList<>();
        CrashSettingsDto crash = request.crash();
        if (crash != null && crash.fps() > 0 && crash.delta() > 0 && Math.abs(crash.delta() - 1.0 / crash.fps()) > PROB_SUM_EPSILON) {
            warnings.add("delta не совпадает с 1/fps — живая симуляция движка может отличаться от настроек");
        }
        BoosterSettingsDto boosters = request.boosters();
        if (boosters != null) {
            warnIfNotSum100(boosters.green(), "зелёной", warnings);
            warnIfNotSum100(boosters.red(), "красной", warnings);
        }
        return warnings;
    }

    private void validateTheme(ThemeProbabilitiesDto theme, GameTheme expected, String path, List<FieldViolation> violations) {
        if (theme == null || theme.values().isEmpty()) {
            violations.add(new FieldViolation(path, "Вероятности " + themeName(expected) + " темы обязательны", null));
            return;
        }
        Map<Integer, Double> byLevel = byLevel(theme.values());
        Set<Integer> expectedLevels = new TreeSet<>();
        for (int i = 1; i <= expected.levelCount(); i++) expectedLevels.add(i);
        if (!new TreeSet<>(byLevel.keySet()).equals(expectedLevels)) {
            violations.add(new FieldViolation(path,
                    "Тема " + themeName(expected) + " должна задавать ровно уровни " + expectedLevels + ", получено " + byLevel.keySet(),
                    byLevel.keySet()));
            return;
        }
        double sum = 0.0;
        for (Map.Entry<Integer, Double> e : byLevel.entrySet()) {
            double v = e.getValue();
            sum += v;
            if (Double.isNaN(v) || v < 0.0 || v > 100.0) {
                violations.add(new FieldViolation("%s.line%dLootProb".formatted(path, e.getKey()),
                        "вероятность должна быть в диапазоне [0, 100]", v));
            }
        }
        if (Math.abs(sum - 100.0) > PROB_SUM_EPSILON) {
            violations.add(new FieldViolation(path,
                    "Вероятности " + themeName(expected) + " темы должны давать в сумме 100%, получено " + pct(sum), sum));
        }
    }

    private void warnIfNotSum100(ThemeProbabilitiesDto theme, String name, List<String> warnings) {
        if (theme == null || theme.values().isEmpty()) return;
        double sum = theme.values().values().stream().filter(v -> v != null).mapToDouble(Double::doubleValue).sum();
        if (Math.abs(sum - 100.0) > PROB_SUM_EPSILON) {
            warnings.add("Вероятности " + name + " темы дают " + pct(sum) + "% (ожидается 100%)");
        }
    }

    private static String themeName(GameTheme theme) {
        return theme == GameTheme.GREEN ? "зелёной" : "красной";
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
