package ru.hackathon.airballoon.admin.config.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import ru.hackathon.airballoon.admin.config.dto.BoosterSettingsDto;
import ru.hackathon.airballoon.admin.config.dto.ConfigDiffEntry;
import ru.hackathon.airballoon.admin.config.dto.ConfigDiffResponse;
import ru.hackathon.airballoon.admin.config.dto.GameConfigurationWriteRequest;
import ru.hackathon.airballoon.admin.config.entity.AdminConfigRow;
import ru.hackathon.airballoon.admin.config.repository.AdminBoosterProbabilityRepository;

/** Flattens both configurations into a stable key path map and emits only the changed leaves. */
@Service
public class ConfigAdminDiffService {
    private final AdminConfigMapper mapper;
    private final AdminBoosterProbabilityRepository probabilities;
    public ConfigAdminDiffService(AdminConfigMapper mapper, AdminBoosterProbabilityRepository probabilities) {
        this.mapper = mapper;
        this.probabilities = probabilities;
    }

    public ConfigDiffResponse diff(AdminConfigRow fromRow, AdminConfigRow toRow) {
        Map<String, Object> from = flatten(fromRow);
        Map<String, Object> to = flatten(toRow);
        List<ConfigDiffEntry> changes = new ArrayList<>();
        for (String key : from.keySet()) {
            Object before = from.get(key);
            Object after = to.get(key);
            if (!java.util.Objects.equals(before, after)) {
                changes.add(new ConfigDiffEntry(key, before, after));
            }
        }
        return new ConfigDiffResponse(fromRow.id(), toRow.id(), changes);
    }

    public Map<String, Object> flatten(AdminConfigRow row) {
        Map<String, Object> flat = new java.util.LinkedHashMap<>();
        flat.put("gameType", row.gameType());
        flat.put("gameActive", row.gameActive());
        flat.put("crash.alpha", row.crashAlpha());
        flat.put("crash.maxMultiplier", row.crashMaxMultiplier());
        flat.put("crash.minCrashMultiplier", row.crashMinCrashMultiplier());
        flat.put("crash.multiplierGrowthRate", row.crashGrowthRate());
        flat.put("crash.fps", row.crashFps());
        flat.put("crash.delta", row.crashDelta());
        flat.put("boosters.multiplierTier1Value", row.boosterTier1());
        flat.put("boosters.multiplierTier2Value", row.boosterTier2());
        flat.put("boosters.multiplierTier3Value", row.boosterTier3());
        flat.put("boosters.multiplierTier4Value", row.boosterTier4());
        flat.put("points.pointsPerLine", row.pointsPerLine());
        flat.put("points.pointsCashoutBonus", row.pointsCashoutBonus());
        flat.put("points.pointsXNBonus", row.pointsXNBonus());
        var themeRows = probabilities.findByConfigId(row.id());
        for (String theme : List.of("GREEN", "RED")) {
            Map<Integer, Double> byLevel = mapper.byLevel(themeRows, theme);
            for (var e : byLevel.entrySet()) {
                flat.put("boosters." + theme.toLowerCase() + ".line" + e.getKey() + "LootProb", e.getValue());
            }
        }
        return flat;
    }

    /** Flatten a write request directly (for validate/draft against an active config). */
    public Map<String, Object> flatten(GameConfigurationWriteRequest request) {
        Map<String, Object> flat = new java.util.LinkedHashMap<>();
        flat.put("gameType", request.gameType());
        flat.put("gameActive", request.isActive());
        var c = request.crash();
        flat.put("crash.alpha", c.alpha());
        flat.put("crash.maxMultiplier", c.maxMultiplier());
        flat.put("crash.minCrashMultiplier", c.minCrashMultiplier());
        flat.put("crash.multiplierGrowthRate", c.multiplierGrowthRate());
        flat.put("crash.fps", c.fps());
        flat.put("crash.delta", c.delta());
        var b = request.boosters();
        flat.put("boosters.multiplierTier1Value", b.multiplierTier1Value());
        flat.put("boosters.multiplierTier2Value", b.multiplierTier2Value());
        flat.put("boosters.multiplierTier3Value", b.multiplierTier3Value());
        flat.put("boosters.multiplierTier4Value", b.multiplierTier4Value());
        var p = request.points();
        flat.put("points.pointsPerLine", p.pointsPerLine());
        flat.put("points.pointsCashoutBonus", p.pointsCashoutBonus());
        flat.put("points.pointsXNBonus", p.pointsXNBonus());
        for (String theme : List.of("GREEN", "RED")) {
            ThemeProbabilitiesAccess access = themeAccess(request, theme);
            for (var e : access.entries().entrySet()) {
                flat.put("boosters." + theme.toLowerCase() + ".line" + e.getKey() + "LootProb", e.getValue());
            }
        }
        return flat;
    }

    private interface ThemeProbabilitiesAccess {
        Map<Integer, Double> entries();
    }

    private ThemeProbabilitiesAccess themeAccess(GameConfigurationWriteRequest request, String theme) {
        BoosterSettingsDto boosters = request.boosters();
        if (boosters == null) return () -> Map.of();
        var prob = "GREEN".equals(theme) ? boosters.green() : boosters.red();
        if (prob == null) return () -> Map.of();
        return () -> flattenLevels(prob.values());
    }

    private static Map<Integer, Double> flattenLevels(Map<String, Double> flat) {
        Map<Integer, Double> out = new java.util.LinkedHashMap<>();
        for (var e : flat.entrySet()) {
            out.put(Integer.parseInt(e.getKey().replace("line", "").replace("LootProb", "")), e.getValue());
        }
        return out;
    }
}