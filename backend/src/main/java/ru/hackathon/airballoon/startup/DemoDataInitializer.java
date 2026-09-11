package ru.hackathon.airballoon.startup;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.admin.domain.AdminRole;
import ru.hackathon.airballoon.admin.entity.AdminUserEntity;
import ru.hackathon.airballoon.admin.repository.AdminUserRepository;
import ru.hackathon.airballoon.config.domain.ConfigStatus;
import ru.hackathon.airballoon.config.dto.*;
import ru.hackathon.airballoon.config.entity.GameConfigurationVersionEntity;
import ru.hackathon.airballoon.config.entity.GameEntity;
import ru.hackathon.airballoon.config.repository.GameConfigurationVersionRepository;
import ru.hackathon.airballoon.config.repository.GameRepository;
import ru.hackathon.airballoon.config.service.ConfigMapper;
import ru.hackathon.airballoon.config.service.ConfigService;
import ru.hackathon.airballoon.game.entity.PlayerEntity;
import ru.hackathon.airballoon.game.repository.PlayerRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class DemoDataInitializer implements CommandLineRunner {
    private final GameRepository games;
    private final GameConfigurationVersionRepository configs;
    private final ConfigMapper mapper;
    private final AdminUserRepository admins;
    private final PlayerRepository players;
    private final PasswordEncoder passwordEncoder;
    private final boolean enabled;
    private final boolean syncPassword;
    private final String adminUsername;
    private final String adminPassword;

    public DemoDataInitializer(
            GameRepository games,
            GameConfigurationVersionRepository configs,
            ConfigMapper mapper,
            AdminUserRepository admins,
            PlayerRepository players,
            PasswordEncoder passwordEncoder,
            @Value("${app.demo.enabled:true}") boolean enabled,
            @Value("${app.demo.sync-admin-password:true}") boolean syncPassword,
            @Value("${app.demo.admin-username:admin}") String adminUsername,
            @Value("${app.demo.admin-password:admin}") String adminPassword) {
        this.games = games;
        this.configs = configs;
        this.mapper = mapper;
        this.admins = admins;
        this.players = players;
        this.passwordEncoder = passwordEncoder;
        this.enabled = enabled;
        this.syncPassword = syncPassword;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (!enabled) return;
        seedAdmin();
        seedPlayer();
        seedGameAndConfig();
    }

    private void seedAdmin() {
        AdminUserEntity admin = admins.findByUsername(adminUsername).orElseGet(AdminUserEntity::new);
        if (admin.getId() == null) {
            admin.setUsername(adminUsername);
            admin.setRole(AdminRole.ADMIN);
            admin.setEnabled(true);
            admin.setPasswordHash(passwordEncoder.encode(adminPassword));
            admins.save(admin);
        } else if (syncPassword && !passwordEncoder.matches(adminPassword, admin.getPasswordHash())) {
            admin.setPasswordHash(passwordEncoder.encode(adminPassword));
            admins.save(admin);
        }
    }

    private void seedPlayer() {
        if (players.findByUsername("demo-player").isPresent()) return;
        PlayerEntity player = new PlayerEntity();
        player.setUsername("demo-player");
        player.setBonusBalance(new BigDecimal("100000.00"));
        player.setGamePoints(0L);
        players.save(player);
    }

    private void seedGameAndConfig() {
        GameEntity game = games.findById(ConfigService.DEFAULT_GAME_ID).orElseGet(() -> {
            GameEntity created = new GameEntity();
            created.setId(ConfigService.DEFAULT_GAME_ID);
            created.setConfigurationSequence(0L);
            return games.save(created);
        });
        if (configs.findFirstByGame_IdAndStatus(ConfigService.DEFAULT_GAME_ID, ConfigStatus.ACTIVE).isPresent()) {
            long maxRevision = configs.findAllByGame_IdOrderByRevisionDesc(ConfigService.DEFAULT_GAME_ID).stream()
                    .mapToLong(GameConfigurationVersionEntity::getRevision).max().orElse(0L);
            if (game.getConfigurationSequence() < maxRevision) game.setConfigurationSequence(maxRevision);
            return;
        }

        GameConfigurationWriteRequest defaults = new GameConfigurationWriteRequest(
                ConfigService.DEFAULT_GAME_ID,
                "Воздушный Шар",
                "CRASH",
                true,
                1L,
                new CrashSettingsDto(0.85, 100.0, 1.50, 0.15, 60.0, 1.0 / 60.0),
                new BoosterSettingsDto(1.0, 2.0, 3.0, 4.0,
                        new ThemeProbabilitiesDto(greenProbabilities()),
                        new ThemeProbabilitiesDto(redProbabilities())),
                new PointsSettingsDto(10, 25, 50));
        game.setConfigurationSequence(1L);
        GameConfigurationVersionEntity active = mapper.fromRequest(defaults, game, 1L, 0L, "system");
        active.setStatus(ConfigStatus.ACTIVE);
        active.setActivatedAt(Instant.now());
        active.setActivatedBy("system");
        configs.save(active);
    }

    private static Map<String, Double> greenProbabilities() {
        double[] values = {4, 6, 8, 10, 12, 14, 16, 15, 15};
        return probabilityMap(values);
    }

    private static Map<String, Double> redProbabilities() {
        double[] values = {3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13};
        return probabilityMap(values);
    }

    private static Map<String, Double> probabilityMap(double[] values) {
        Map<String, Double> result = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i++) result.put("line" + (i + 1) + "LootProb", values[i]);
        return result;
    }
}
