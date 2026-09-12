package ru.hackathon.airballoon.admin.config.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import ru.hackathon.airballoon.admin.config.dto.BoosterSettingsDto;
import ru.hackathon.airballoon.admin.config.dto.ConfigurationVersionDetail;
import ru.hackathon.airballoon.admin.config.dto.ConfigurationVersionSummary;
import ru.hackathon.airballoon.admin.config.dto.CrashSettingsDto;
import ru.hackathon.airballoon.admin.config.dto.GameConfigurationResponse;
import ru.hackathon.airballoon.admin.config.dto.GameConfigurationWriteRequest;
import ru.hackathon.airballoon.admin.config.dto.PointsSettingsDto;
import ru.hackathon.airballoon.admin.config.dto.ThemeProbabilitiesDto;
import ru.hackathon.airballoon.admin.config.entity.AdminBoosterProbabilityRow;
import ru.hackathon.airballoon.admin.config.entity.AdminConfigRow;

/** Maps between admin DTO layer, admin_config rows and the engine/live config JSON. */
@Service
public class AdminConfigMapper {
    public static final String GREEN = "GREEN";
    public static final String RED = "RED";

    public AdminConfigRow toRow(GameConfigurationWriteRequest request, long revision, Long baseRevision,
                                UUID sourceVersionId, String status, String createdBy) {
        BoosterSettingsDto b = request.boosters();
        return new AdminConfigRow(
                UUID.randomUUID(), revision, baseRevision, sourceVersionId, status,
                request.gameName(), request.gameType(), request.isActive(),
                request.crash().alpha(), request.crash().maxMultiplier(), request.crash().minCrashMultiplier(),
                request.crash().multiplierGrowthRate(), request.crash().fps(), request.crash().delta(),
                b.multiplierTier1Value(), b.multiplierTier2Value(), b.multiplierTier3Value(), b.multiplierTier4Value(),
                request.points().pointsPerLine(), request.points().pointsCashoutBonus(), request.points().pointsXNBonus(),
                java.time.Instant.now(), createdBy, null, null);
    }

    public List<AdminBoosterProbabilityRow> toProbabilityRows(UUID configId, BoosterSettingsDto boosters) {
        List<AdminBoosterProbabilityRow> rows = new java.util.ArrayList<>();
        rows.addAll(themeRows(configId, GREEN, boosters.green()));
        rows.addAll(themeRows(configId, RED, boosters.red()));
        return rows;
    }

    private List<AdminBoosterProbabilityRow> themeRows(UUID configId, String theme, ThemeProbabilitiesDto probabilities) {
        return probabilities.values().entrySet().stream()
                .map(e -> new AdminBoosterProbabilityRow(configId, theme, levelOf(e.getKey()), e.getValue()))
                .toList();
    }

    private static int levelOf(String key) {
        return Integer.parseInt(key.replace("line", "").replace("LootProb", ""));
    }

    public GameConfigurationResponse toResponse(AdminConfigRow row, Map<String, Double> green, Map<String, Double> red) {
        return new GameConfigurationResponse(
                row.id(), row.revision(), row.status(), row.createdAt(), row.createdBy(),
                row.activatedAt(), row.activatedBy(), row.baseRevision(), row.sourceVersionId(),
                "air-balloon", row.gameName(), row.gameType(), row.gameActive(),
                crash(row), boosters(row, green, red), points(row));
    }

    public ConfigurationVersionDetail toDetail(AdminConfigRow row, Map<String, Double> green, Map<String, Double> red) {
        return new ConfigurationVersionDetail(
                row.id(), row.revision(), row.status(), row.baseRevision(), row.sourceVersionId(),
                row.createdAt(), row.createdBy(), row.activatedAt(), row.activatedBy(),
                "air-balloon", row.gameName(), row.gameType(), row.gameActive(),
                crash(row), boosters(row, green, red), points(row));
    }

    public ConfigurationVersionSummary toSummary(AdminConfigRow row) {
        return new ConfigurationVersionSummary(
                row.id(), row.revision(), row.status(), row.baseRevision(), row.sourceVersionId(),
                row.createdAt(), row.createdBy(), row.activatedAt(), row.activatedBy());
    }

    public CrashSettingsDto crash(AdminConfigRow row) {
        return new CrashSettingsDto(row.crashAlpha(), row.crashMaxMultiplier(), row.crashMinCrashMultiplier(),
                row.crashGrowthRate(), row.crashFps(), row.crashDelta());
    }

    public BoosterSettingsDto boosters(AdminConfigRow row, Map<String, Double> green, Map<String, Double> red) {
        return new BoosterSettingsDto(
                row.boosterTier1(), row.boosterTier2(), row.boosterTier3(), row.boosterTier4(),
                ThemeProbabilitiesDto.of(green), ThemeProbabilitiesDto.of(red));
    }

    public PointsSettingsDto points(AdminConfigRow row) {
        return new PointsSettingsDto(row.pointsPerLine(), row.pointsCashoutBonus(), row.pointsXNBonus());
    }

    /** Probabilities of a row's config for one theme, keyed lineNLootProb. */
    public static Map<String, Double> toFlat(Map<Integer, Double> byLevel) {
        Map<String, Double> flat = new LinkedHashMap<>();
        for (var e : byLevel.entrySet()) flat.put("line" + e.getKey() + "LootProb", e.getValue());
        return flat;
    }

    /** Convert flattened lineNLootProb map to level -> value. */
    public static Map<Integer, Double> toLevelMap(Map<String, Double> flat) {
        Map<Integer, Double> out = new LinkedHashMap<>();
        for (var e : flat.entrySet()) {
            out.put(Integer.parseInt(e.getKey().replace("line", "").replace("LootProb", "")), e.getValue());
        }
        return out;
    }

    public Map<Integer, Double> byLevel(List<AdminBoosterProbabilityRow> rows, String theme) {
        return rows.stream().filter(r -> r.theme().equals(theme))
                .collect(Collectors.toMap(AdminBoosterProbabilityRow::levelNumber,
                        AdminBoosterProbabilityRow::probability,
                        (a, b) -> a, java.util.TreeMap::new));
    }
}