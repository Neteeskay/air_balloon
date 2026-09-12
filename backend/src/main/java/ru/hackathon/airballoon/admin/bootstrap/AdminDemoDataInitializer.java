package ru.hackathon.airballoon.admin.bootstrap;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.admin.config.domain.ConfigStatus;
import ru.hackathon.airballoon.admin.config.entity.AdminBoosterProbabilityRow;
import ru.hackathon.airballoon.admin.config.entity.AdminConfigRow;
import ru.hackathon.airballoon.admin.config.repository.AdminAppRepository;
import ru.hackathon.airballoon.admin.config.repository.AdminBoosterProbabilityRepository;
import ru.hackathon.airballoon.admin.config.repository.AdminConfigRepository;
import ru.hackathon.airballoon.admin.config.service.AdminConfigMapper;
import ru.hackathon.airballoon.admin.config.service.LiveConfigPublisher;
import ru.hackathon.airballoon.admin.domain.AdminRole;
import ru.hackathon.airballoon.config.GameConfig;
import ru.hackathon.airballoon.config.GameConfigProvider;

/**
 * Demo bootstrap: creates the admin account (admin/admin) and ensures exactly one ACTIVE admin
 * configuration. If a live config already exists it is adopted as admin revision 1; otherwise
 * contract defaults are created and published.
 */
@Component
@Profile("demo")
@Order(1)
public class AdminDemoDataInitializer implements ApplicationRunner {
    private static final String GAME_ID = "air-balloon";

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final AdminAppRepository apps;
    private final AdminConfigRepository configs;
    private final AdminBoosterProbabilityRepository probabilities;
    private final AdminConfigMapper mapper;
    private final LiveConfigPublisher publisher;
    private final GameConfigProvider liveConfig;

    public AdminDemoDataInitializer(JdbcTemplate jdbc, PasswordEncoder passwordEncoder, AdminAppRepository apps,
                                    AdminConfigRepository configs, AdminBoosterProbabilityRepository probabilities,
                                    AdminConfigMapper mapper, LiveConfigPublisher publisher,
                                    GameConfigProvider liveConfig) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.apps = apps;
        this.configs = configs;
        this.probabilities = probabilities;
        this.mapper = mapper;
        this.publisher = publisher;
        this.liveConfig = liveConfig;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        apps.createIfAbsent(GAME_ID);
        ensureAdminUser();

        if (configs.findActive(GAME_ID).isPresent()) return;

        GameConfig live = null;
        try {
            live = liveConfig.getCurrentConfig().config();
        } catch (Exception ignored) {}

        if (live != null) {
            adoptLive(live);
        } else {
            createAndPublishDefaults();
        }
    }

    private void ensureAdminUser() {
        jdbc.update("""
                INSERT INTO admin_user(id, username, password_hash, enabled, role, created_at)
                VALUES (?, ?, ?, TRUE, ?, ?)
                ON CONFLICT (username) DO NOTHING
                """, UUID.nameUUIDFromBytes("air-balloon:admin".getBytes(java.nio.charset.StandardCharsets.UTF_8)),
                "admin", passwordEncoder.encode("admin"), AdminRole.ADMIN.name(), java.sql.Timestamp.from(Instant.now()));
    }

    private void adoptLive(GameConfig live) {
        long revision = apps.nextSequence(GAME_ID);
        AdminConfigRow row = new AdminConfigRow(
                UUID.randomUUID(), revision, null, null, ConfigStatus.ACTIVE.name(),
                live.gameName(), live.gameType(), live.active(),
                live.alpha().doubleValue(), live.maxCrashMultiplier().doubleValue(),
                live.minCrashMultiplier().doubleValue(), live.growthRate(),
                60.0, 1.0 / 60.0,
                tier(live, 0), tier(live, 1), tier(live, 2), tier(live, 3),
                live.pointsPerLevel(), live.pointsCashoutBonus(), live.pointsX2Bonus(),
                Instant.now(), "admin", null, null);
        configs.insert(GAME_ID, row);
        probabilities.insertBatch(row.id(), probabilitiesOf(live, row.id()));
    }

    private void createAndPublishDefaults() {
        long revision = apps.nextSequence(GAME_ID);
        AdminConfigRow row = new AdminConfigRow(
                UUID.randomUUID(), revision, null, null, ConfigStatus.ACTIVE.name(),
                "Air Balloon", "CRASH", true,
                0.85, 100.0, 1.0, 0.15, 60.0, 1.0 / 60.0,
                1.0, 2.0, 3.0, 4.0,
                10, 25, 50,
                Instant.now(), "admin", Instant.now(), "admin");
        List<AdminBoosterProbabilityRow> boosterRows = new ArrayList<>();
        for (int i = 1; i <= 9; i++) boosterRows.add(prob(row.id(), GREEN, i, 100.0 / 9.0));
        for (int i = 1; i <= 12; i++) boosterRows.add(prob(row.id(), RED, i, 100.0 / 12.0));
        configs.insert(GAME_ID, row);
        probabilities.insertBatch(row.id(), boosterRows);
        publisher.publishMergedOnly(row, boosterRows);
    }

    private List<AdminBoosterProbabilityRow> probabilitiesOf(GameConfig live, UUID configId) {
        List<AdminBoosterProbabilityRow> rows = new ArrayList<>();
        List<Integer> greenWeights = live.greenBoosterWeights();
        List<Integer> redWeights = live.redBoosterWeights();
        if (greenWeights != null) {
            for (int i = 0; i < greenWeights.size(); i++) {
                rows.add(prob(configId, GREEN, i + 1, greenWeights.get(i) / 100.0));
            }
        }
        if (redWeights != null) {
            for (int i = 0; i < redWeights.size(); i++) {
                rows.add(prob(configId, RED, i + 1, redWeights.get(i) / 100.0));
            }
        }
        return rows;
    }

    private static AdminBoosterProbabilityRow prob(UUID configId, String theme, int level, double value) {
        return new AdminBoosterProbabilityRow(configId, theme, level, value);
    }

    private static double tier(GameConfig live, int index) {
        List<Integer> values = live.boosterValues();
        return values != null && values.size() > index ? values.get(index) : index + 1;
    }

    private static final String GREEN = "GREEN";
    private static final String RED = "RED";
}