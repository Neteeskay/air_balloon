package ru.hackathon.airballoon.config.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.config.dto.ConfigDiffEntry;
import ru.hackathon.airballoon.config.dto.ConfigDiffResponse;
import ru.hackathon.airballoon.config.dto.ConfigurationVersionDetail;

import java.util.*;

@Service
public class ConfigDiffService {
    private final ConfigService configService;

    public ConfigDiffService(ConfigService configService) {
        this.configService = configService;
    }

    @Transactional(readOnly = true)
    public ConfigDiffResponse diff(UUID fromId, UUID toId) {
        ConfigurationVersionDetail from = configService.getVersion(fromId);
        ConfigurationVersionDetail to = configService.getVersion(toId);
        Map<String, Object> before = flatten(from);
        Map<String, Object> after = flatten(to);
        Set<String> keys = new TreeSet<>();
        keys.addAll(before.keySet());
        keys.addAll(after.keySet());
        List<ConfigDiffEntry> changes = keys.stream()
                .filter(key -> !Objects.equals(before.get(key), after.get(key)))
                .map(key -> new ConfigDiffEntry(key, before.get(key), after.get(key)))
                .toList();
        return new ConfigDiffResponse(fromId, toId, changes);
    }

    private static Map<String, Object> flatten(ConfigurationVersionDetail c) {
        Map<String, Object> out = new TreeMap<>();
        out.put("gameId", c.gameId());
        out.put("gameName", c.gameName());
        out.put("gameType", c.gameType());
        out.put("isActive", c.isActive());
        out.put("crash.alpha", c.crash().alpha());
        out.put("crash.maxMultiplier", c.crash().maxMultiplier());
        out.put("crash.minCrashMultiplier", c.crash().minCrashMultiplier());
        out.put("crash.multiplierGrowthRate", c.crash().multiplierGrowthRate());
        out.put("crash.fps", c.crash().fps());
        out.put("crash.delta", c.crash().delta());
        out.put("boosters.multiplierTier1Value", c.boosters().multiplierTier1Value());
        out.put("boosters.multiplierTier2Value", c.boosters().multiplierTier2Value());
        out.put("boosters.multiplierTier3Value", c.boosters().multiplierTier3Value());
        out.put("boosters.multiplierTier4Value", c.boosters().multiplierTier4Value());
        c.boosters().green().asMap().forEach((k, v) -> out.put("boosters.green." + k, v));
        c.boosters().red().asMap().forEach((k, v) -> out.put("boosters.red." + k, v));
        out.put("points.pointsPerLine", c.points().pointsPerLine());
        out.put("points.pointsCashoutBonus", c.points().pointsCashoutBonus());
        out.put("points.pointsXNBonus", c.points().pointsXNBonus());
        return out;
    }
}
