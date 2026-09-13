package ru.hackathon.airballoon.admin.config.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.admin.config.entity.AdminBoosterProbabilityRow;
import ru.hackathon.airballoon.admin.config.entity.AdminConfigRow;
import ru.hackathon.airballoon.admin.config.repository.AdminBoosterProbabilityRepository;
import ru.hackathon.airballoon.admin.config.repository.AdminConfigRepository;
import ru.hackathon.airballoon.common.BusinessException;
import ru.hackathon.airballoon.common.error.ConfigValidationException;
import ru.hackathon.airballoon.common.error.FieldViolation;
import ru.hackathon.airballoon.config.ConfigValidator;
import ru.hackathon.airballoon.config.GameConfig;
import ru.hackathon.airballoon.config.GameConfigProvider;
import ru.hackathon.airballoon.common.error.ConfigStateException;

/**
 * Publishes an admin config revision into the live config tables
 * ({@code game_config_versions} / {@code game_config_active}) and immediately activates the admin row.
 *
 * Missing admin fields (minBet/maxBet, fixedSeed, scenario8, updateIntervalMs) are preserved
 * from the current live config so a publish never clobbers unrelated live state.
 */
@Service
public class LiveConfigPublisher {
    private static final String GAME_ID = "air-balloon";
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final AdminConfigRepository adminConfigs;
    private final AdminBoosterProbabilityRepository adminProbabilities;
    private final GameConfigProvider liveConfig;
    private final ConfigValidator liveValidator;

    public LiveConfigPublisher(JdbcTemplate jdbc, ObjectMapper json, AdminConfigRepository adminConfigs,
                               AdminBoosterProbabilityRepository adminProbabilities,
                               GameConfigProvider liveConfig, ConfigValidator liveValidator) {
        this.jdbc = jdbc;
        this.json = json;
        this.adminConfigs = adminConfigs;
        this.adminProbabilities = adminProbabilities;
        this.liveConfig = liveConfig;
        this.liveValidator = liveValidator;
    }

    @Transactional
    public long publishAndActivate(AdminConfigRow row, List<AdminBoosterProbabilityRow> boosterRows, String adminUser) {
        adminConfigs.archiveActive(GAME_ID);
        GameConfig merged = buildMerged(row, boosterRows);
        long version = publishLive(merged);
        int updated = adminConfigs.setStatus(row.id(), "ACTIVE", Instant.now(), adminUser);
        if (updated != 1) {
            throw new ConfigStateException("CONFIG_ACTIVATION_FAILED", "Не удалось активировать конфигурацию");
        }
        return version;
    }

    @Transactional
    public long publishMergedOnly(AdminConfigRow row, List<AdminBoosterProbabilityRow> boosterRows) {
        return publishLive(buildMerged(row, boosterRows));
    }

    private GameConfig buildMerged(AdminConfigRow row, List<AdminBoosterProbabilityRow> boosterRows) {
        GameConfig existing = null;
        try {
            existing = liveConfig.getCurrentConfig().config();
        } catch (Exception ignored) {}

        List<Integer> requestedGreenWeights = toWeights(boosterRows, "GREEN");
        List<Integer> requestedRedWeights = toWeights(boosterRows, "RED");
        AdminConfigRow base = row.baseRevision() == null ? null
                : adminConfigs.findByRevision(GAME_ID, row.baseRevision()).orElse(null);
        List<AdminBoosterProbabilityRow> baseProbabilities = base == null ? List.of()
                : adminProbabilities.findByConfigId(base.id());
        List<Integer> baseGreenWeights = base == null ? List.of() : toWeights(baseProbabilities, "GREEN");
        List<Integer> baseRedWeights = base == null ? List.of() : toWeights(baseProbabilities, "RED");
        boolean greenWeightsChanged = base == null || !requestedGreenWeights.equals(baseGreenWeights);
        boolean redWeightsChanged = base == null || !requestedRedWeights.equals(baseRedWeights);
        boolean multiplierBonusChanged = base == null || row.pointsXNBonus() != base.pointsXNBonus();

        return new GameConfig(
                GAME_ID,
                changed(base, row.gameName(), base == null ? null : base.gameName()) || existing == null
                        ? row.gameName() : existing.gameName(),
                changed(base, row.gameType(), base == null ? null : base.gameType()) || existing == null
                        ? row.gameType() : existing.gameType(),
                base == null || row.gameActive() != base.gameActive() || existing == null
                        ? row.gameActive() : existing.active(),
                9,
                12,
                changed(base, row.crashMinCrashMultiplier(), base == null ? 0 : base.crashMinCrashMultiplier()) || existing == null
                        ? BigDecimal.valueOf(row.crashMinCrashMultiplier()) : existing.minCrashMultiplier(),
                changed(base, row.crashMaxMultiplier(), base == null ? 0 : base.crashMaxMultiplier()) || existing == null
                        ? BigDecimal.valueOf(row.crashMaxMultiplier()) : existing.maxCrashMultiplier(),
                changed(base, row.crashGrowthRate(), base == null ? 0 : base.crashGrowthRate()) || existing == null
                        ? row.crashGrowthRate() : existing.growthRate(),
                changed(base, row.crashAlpha(), base == null ? 0 : base.crashAlpha()) || existing == null
                        ? BigDecimal.valueOf(row.crashAlpha()) : existing.alpha(),
                existing == null ? 100 : existing.updateIntervalMs(),
                existing == null ? new BigDecimal("0.01") : existing.minBet() != null ? existing.minBet() : new BigDecimal("0.01"),
                existing == null ? new BigDecimal("100") : existing.maxBet() != null ? existing.maxBet() : new BigDecimal("100"),
                List.of(1, 2, 3, 4),
                greenWeightsChanged || existing == null ? requestedGreenWeights : existing.greenBoosterWeights(),
                redWeightsChanged || existing == null ? requestedRedWeights : existing.redBoosterWeights(),
                base == null || row.pointsPerLine() != base.pointsPerLine() || existing == null
                        ? row.pointsPerLine() : existing.pointsPerLevel(),
                base == null || row.pointsCashoutBonus() != base.pointsCashoutBonus() || existing == null
                        ? row.pointsCashoutBonus() : existing.pointsCashoutBonus(),
                multiplierBonusChanged || existing == null ? row.pointsXNBonus() : existing.pointsX2Bonus(),
                multiplierBonusChanged || existing == null ? row.pointsXNBonus() : existing.pointsX3Bonus(),
                multiplierBonusChanged || existing == null ? row.pointsXNBonus() : existing.pointsX4Bonus(),
                existing != null && existing.fixedSeedEnabled(),
                existing == null ? null : existing.fixedSeed(),
                existing != null && existing.scenario8Enabled(),
                existing == null ? 0 : existing.scenario8MinWinAmount(),
                existing == null ? 0 : existing.scenario8Price(),
                existing == null ? 0 : existing.scenario8TicketCount()
        );
    }

    private static boolean changed(AdminConfigRow base, String requested, String original) {
        return base == null || !java.util.Objects.equals(requested, original);
    }

    private static boolean changed(AdminConfigRow base, double requested, double original) {
        return base == null || Double.compare(requested, original) != 0;
    }

    private long publishLive(GameConfig config) {
        try {
            liveValidator.validate(config);
        } catch (BusinessException e) {
            throw new ConfigValidationException(List.of(
                    new FieldViolation("configuration", e.getMessage(), null)));
        }
        Long writtenVersion = jdbc.queryForObject(
                "INSERT INTO game_config_versions(config_json) VALUES (?::jsonb) RETURNING version",
                Long.class, jsonUnquoted(config));
        if (writtenVersion == null) {
            throw new ConfigStateException("LIVE_CONFIG_INSERT_FAILED",
                    "Не удалось опубликовать живую конфигурацию; попробуйте ещё раз");
        }
        jdbc.update("UPDATE game_config_active SET version = ? WHERE id = 1", writtenVersion);
        return writtenVersion;
    }

    private String jsonUnquoted(GameConfig config) {
        try {
            return json.writeValueAsString(config);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot serialize live config", e);
        }
    }

    private static List<Integer> toWeights(List<AdminBoosterProbabilityRow> rows, String theme) {
        List<AdminBoosterProbabilityRow> themeRows = rows.stream()
                .filter(r -> r.theme().equals(theme))
                .sorted(java.util.Comparator.comparing(AdminBoosterProbabilityRow::levelNumber))
                .toList();
        if (themeRows.size() < ("GREEN".equals(theme) ? 9 : 12)) {
            throw new ConfigStateException("LIVE_CONFIG_WEIGHTS_MISSING",
                    (theme.equals("GREEN") ? "Зелёная" : "Красная") + " тема должна задавать все уровни перед публикацией");
        }
        List<Integer> weights = themeRows.stream()
                .map(r -> (int) Math.round(r.probability() * 100.0))
                .collect(java.util.stream.Collectors.toCollection(java.util.ArrayList::new));
        long diff = 10000 - weights.stream().mapToLong(Integer::longValue).sum();
        for (int i = 0; i < diff; i++) weights.set(i % weights.size(), weights.get(i % weights.size()) + 1);
        for (int i = 0; i > diff; i--) {
            int idx = (-i) % weights.size();
            if (weights.get(idx) > 0) weights.set(idx, weights.get(idx) - 1);
        }
        return List.copyOf(weights);
    }
}
