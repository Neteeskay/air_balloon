package ru.hackathon.airballoon.config.service;

import org.springframework.stereotype.Component;
import ru.hackathon.airballoon.config.domain.GameTheme;
import ru.hackathon.airballoon.config.domain.GameType;
import ru.hackathon.airballoon.config.dto.*;
import ru.hackathon.airballoon.config.entity.BoosterLevelProbabilityEntity;
import ru.hackathon.airballoon.config.entity.GameConfigurationVersionEntity;
import ru.hackathon.airballoon.config.entity.GameEntity;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class ConfigMapper {
    public GameConfigurationResponse toCurrentResponse(GameConfigurationVersionEntity entity) {
        return new GameConfigurationResponse(
                entity.getId(),
                entity.getRevision(),
                entity.getStatus(),
                entity.getCreatedAt(),
                entity.getCreatedBy(),
                entity.getActivatedAt(),
                entity.getGame().getId(),
                entity.getGameName(),
                entity.getGameType().name(),
                entity.isGameActive(),
                crash(entity),
                boosters(entity),
                points(entity));
    }

    public ConfigurationVersionDetail toDetail(GameConfigurationVersionEntity entity) {
        return new ConfigurationVersionDetail(
                entity.getId(), entity.getRevision(), entity.getStatus(), entity.getBaseRevision(),
                entity.getSourceVersionId(), entity.getCreatedAt(), entity.getCreatedBy(),
                entity.getActivatedAt(), entity.getActivatedBy(), entity.getGame().getId(),
                entity.getGameName(), entity.getGameType().name(), entity.isGameActive(),
                crash(entity), boosters(entity), points(entity));
    }

    public ConfigurationVersionSummary toSummary(GameConfigurationVersionEntity entity) {
        return new ConfigurationVersionSummary(
                entity.getId(), entity.getRevision(), entity.getStatus(), entity.getBaseRevision(),
                entity.getSourceVersionId(), entity.getCreatedAt(), entity.getCreatedBy(),
                entity.getActivatedAt(), entity.getActivatedBy());
    }

    public GameConfigurationVersionEntity fromRequest(
            GameConfigurationWriteRequest request,
            GameEntity game,
            long revision,
            long baseRevision,
            String createdBy) {
        GameConfigurationVersionEntity entity = new GameConfigurationVersionEntity();
        entity.setGame(game);
        entity.setRevision(revision);
        entity.setBaseRevision(baseRevision);
        entity.setGameName(request.gameName().trim());
        entity.setGameType(GameType.valueOf(request.gameType()));
        entity.setGameActive(Boolean.TRUE.equals(request.isActive()));
        applyCrash(entity, request.crash());
        applyBoosters(entity, request.boosters());
        applyPoints(entity, request.points());
        entity.setCreatedBy(createdBy);
        addProbabilities(entity, GameTheme.GREEN, request.boosters().green());
        addProbabilities(entity, GameTheme.RED, request.boosters().red());
        return entity;
    }

    public GameConfigurationVersionEntity copyVersion(
            GameConfigurationVersionEntity source,
            GameEntity game,
            long revision,
            long baseRevision,
            String createdBy) {
        GameConfigurationVersionEntity entity = new GameConfigurationVersionEntity();
        entity.setGame(game);
        entity.setRevision(revision);
        entity.setBaseRevision(baseRevision);
        entity.setSourceVersionId(source.getId());
        entity.setGameName(source.getGameName());
        entity.setGameType(source.getGameType());
        entity.setGameActive(source.isGameActive());
        entity.setAlpha(source.getAlpha());
        entity.setMaxMultiplier(source.getMaxMultiplier());
        entity.setMinCrashMultiplier(source.getMinCrashMultiplier());
        entity.setMultiplierGrowthRate(source.getMultiplierGrowthRate());
        entity.setFps(source.getFps());
        entity.setDelta(source.getDelta());
        entity.setMultiplierTier1Value(source.getMultiplierTier1Value());
        entity.setMultiplierTier2Value(source.getMultiplierTier2Value());
        entity.setMultiplierTier3Value(source.getMultiplierTier3Value());
        entity.setMultiplierTier4Value(source.getMultiplierTier4Value());
        entity.setPointsPerLine(source.getPointsPerLine());
        entity.setPointsCashoutBonus(source.getPointsCashoutBonus());
        entity.setPointsXNBonus(source.getPointsXNBonus());
        entity.setCreatedBy(createdBy);
        for (BoosterLevelProbabilityEntity old : source.getProbabilities()) {
            BoosterLevelProbabilityEntity copy = new BoosterLevelProbabilityEntity();
            copy.setTheme(old.getTheme());
            copy.setLevelNumber(old.getLevelNumber());
            copy.setProbability(old.getProbability());
            entity.addProbability(copy);
        }
        return entity;
    }

    public boolean businessEquals(GameConfigurationWriteRequest request, GameConfigurationVersionEntity entity) {
        if (request == null || entity == null) return false;
        if (!entity.getGame().getId().equals(request.gameId())) return false;
        if (!entity.getGameName().equals(request.gameName().trim())) return false;
        if (!entity.getGameType().name().equals(request.gameType())) return false;
        if (entity.isGameActive() != Boolean.TRUE.equals(request.isActive())) return false;
        if (!same(entity.getAlpha(), request.crash().alpha())
                || !same(entity.getMaxMultiplier(), request.crash().maxMultiplier())
                || !same(entity.getMinCrashMultiplier(), request.crash().minCrashMultiplier())
                || !same(entity.getMultiplierGrowthRate(), request.crash().multiplierGrowthRate())
                || !same(entity.getFps(), request.crash().fps())
                || !same(entity.getDelta(), request.crash().delta())) return false;
        if (!same(entity.getMultiplierTier1Value(), request.boosters().multiplierTier1Value())
                || !same(entity.getMultiplierTier2Value(), request.boosters().multiplierTier2Value())
                || !same(entity.getMultiplierTier3Value(), request.boosters().multiplierTier3Value())
                || !same(entity.getMultiplierTier4Value(), request.boosters().multiplierTier4Value())) return false;
        if (entity.getPointsPerLine() != request.points().pointsPerLine()
                || entity.getPointsCashoutBonus() != request.points().pointsCashoutBonus()
                || entity.getPointsXNBonus() != request.points().pointsXNBonus()) return false;

        return probabilitiesEqual(entity, GameTheme.GREEN, request.boosters().green())
                && probabilitiesEqual(entity, GameTheme.RED, request.boosters().red());
    }

    private static CrashSettingsDto crash(GameConfigurationVersionEntity e) {
        return new CrashSettingsDto(e.getAlpha(), e.getMaxMultiplier(), e.getMinCrashMultiplier(),
                e.getMultiplierGrowthRate(), e.getFps(), e.getDelta());
    }

    private static PointsSettingsDto points(GameConfigurationVersionEntity e) {
        return new PointsSettingsDto(e.getPointsPerLine(), e.getPointsCashoutBonus(), e.getPointsXNBonus());
    }

    private static BoosterSettingsDto boosters(GameConfigurationVersionEntity e) {
        return new BoosterSettingsDto(
                e.getMultiplierTier1Value(), e.getMultiplierTier2Value(), e.getMultiplierTier3Value(),
                e.getMultiplierTier4Value(), probabilities(e, GameTheme.GREEN), probabilities(e, GameTheme.RED));
    }

    private static ThemeProbabilitiesDto probabilities(GameConfigurationVersionEntity e, GameTheme theme) {
        Map<String, Double> values = new LinkedHashMap<>();
        e.getProbabilities().stream()
                .filter(p -> p.getTheme() == theme)
                .sorted(java.util.Comparator.comparingInt(BoosterLevelProbabilityEntity::getLevelNumber))
                .forEach(p -> values.put("line" + p.getLevelNumber() + "LootProb", p.getProbability()));
        return new ThemeProbabilitiesDto(values);
    }

    private static void applyCrash(GameConfigurationVersionEntity e, CrashSettingsDto d) {
        e.setAlpha(d.alpha()); e.setMaxMultiplier(d.maxMultiplier());
        e.setMinCrashMultiplier(d.minCrashMultiplier()); e.setMultiplierGrowthRate(d.multiplierGrowthRate());
        e.setFps(d.fps()); e.setDelta(d.delta());
    }

    private static void applyBoosters(GameConfigurationVersionEntity e, BoosterSettingsDto d) {
        e.setMultiplierTier1Value(d.multiplierTier1Value()); e.setMultiplierTier2Value(d.multiplierTier2Value());
        e.setMultiplierTier3Value(d.multiplierTier3Value()); e.setMultiplierTier4Value(d.multiplierTier4Value());
    }

    private static void applyPoints(GameConfigurationVersionEntity e, PointsSettingsDto d) {
        e.setPointsPerLine(d.pointsPerLine()); e.setPointsCashoutBonus(d.pointsCashoutBonus());
        e.setPointsXNBonus(d.pointsXNBonus());
    }

    private static void addProbabilities(GameConfigurationVersionEntity e, GameTheme theme, ThemeProbabilitiesDto dto) {
        for (int level = 1; level <= theme.levelCount(); level++) {
            BoosterLevelProbabilityEntity p = new BoosterLevelProbabilityEntity();
            p.setTheme(theme); p.setLevelNumber(level); p.setProbability(dto.get("line" + level + "LootProb"));
            e.addProbability(p);
        }
    }

    private static boolean probabilitiesEqual(
            GameConfigurationVersionEntity entity, GameTheme theme, ThemeProbabilitiesDto request) {
        Map<Integer, Double> values = new java.util.HashMap<>();
        for (BoosterLevelProbabilityEntity p : entity.getProbabilities()) {
            if (p.getTheme() == theme) values.put(p.getLevelNumber(), p.getProbability());
        }
        if (values.size() != theme.levelCount()) return false;
        for (int level = 1; level <= theme.levelCount(); level++) {
            if (!same(values.get(level), request.get("line" + level + "LootProb"))) return false;
        }
        return true;
    }

    private static boolean same(double a, Double b) {
        return b != null && Double.isFinite(b) && Math.abs(a - b) <= 1.0e-9;
    }
}
