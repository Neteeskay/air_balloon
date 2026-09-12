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
import ru.hackathon.airballoon.admin.config.repository.AdminAppRepository;
import ru.hackathon.airballoon.admin.config.repository.AdminConfigRepository;
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
    private final AdminAppRepository apps;
    private final AdminConfigRepository adminConfigs;
    private final AdminConfigMapper mapper;
    private final GameConfigProvider liveConfig;

    public LiveConfigPublisher(JdbcTemplate jdbc, ObjectMapper json, AdminAppRepository apps,
                               AdminConfigRepository adminConfigs, AdminConfigMapper mapper,
                               GameConfigProvider liveConfig) {
        this.jdbc = jdbc;
        this.json = json;
        this.apps = apps;
        this.adminConfigs = adminConfigs;
        this.mapper = mapper;
        this.liveConfig = liveConfig;
    }

    @Transactional
    public long publishAndActivate(AdminConfigRow row, List<AdminBoosterProbabilityRow> boosterRows, String adminUser) {
        adminConfigs.archiveActive(GAME_ID);
        GameConfig merged = buildMerged(row, boosterRows);
        long version = publishLive(merged);
        int updated = adminConfigs.setStatus(row.id(), "ACTIVE", Instant.now(), adminUser);
        if (updated != 1) {
            throw new ConfigStateException("CONFIG_ACTIVATION_FAILED", "Configuration could not be activated");
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

        List<Integer> greenWeights = toWeights(boosterRows, "GREEN");
        List<Integer> redWeights = toWeights(boosterRows, "RED");

        return new GameConfig(
                GAME_ID,
                row.gameName(),
                row.gameType(),
                row.gameActive(),
                9,
                12,
                BigDecimal.valueOf(row.crashMinCrashMultiplier()),
                BigDecimal.valueOf(row.crashMaxMultiplier()),
                row.crashGrowthRate(),
                BigDecimal.valueOf(row.crashAlpha()),
                existing == null ? 100 : existing.updateIntervalMs(),
                existing == null ? new BigDecimal("0.01") : existing.minBet() != null ? existing.minBet() : new BigDecimal("0.01"),
                existing == null ? new BigDecimal("100") : existing.maxBet() != null ? existing.maxBet() : new BigDecimal("100"),
                List.of(1, 2, 3, 4),
                greenWeights,
                redWeights,
                row.pointsPerLine(),
                row.pointsCashoutBonus(),
                row.pointsXNBonus(),
                row.pointsXNBonus(),
                row.pointsXNBonus(),
                existing != null && existing.fixedSeedEnabled(),
                existing == null ? null : existing.fixedSeed(),
                existing != null && existing.scenario8Enabled(),
                existing == null ? 0 : existing.scenario8MinWinAmount(),
                existing == null ? 0 : existing.scenario8Price(),
                existing == null ? 0 : existing.scenario8TicketCount()
        );
    }

    private long publishLive(GameConfig config) {
        long version = apps.nextSequence(GAME_ID);
        Long writtenVersion = jdbc.queryForObject(
                "INSERT INTO game_config_versions(config_json) VALUES (?::jsonb) RETURNING version",
                Long.class, jsonUnquoted(config));
        if (writtenVersion == null || writtenVersion.longValue() != version) {
            throw new ConfigStateException("LIVE_CONFIG_INSERT_FAILED",
                    "Failed to publish live configuration; please retry");
        }
        jdbc.update("UPDATE game_config_active SET version = ? WHERE id = 1", version);
        return version;
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
                    theme + " theme must define all levels before publishing");
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