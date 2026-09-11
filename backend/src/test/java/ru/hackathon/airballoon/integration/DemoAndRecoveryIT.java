package ru.hackathon.airballoon.integration;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import ru.hackathon.airballoon.AirBalloonApplication;
import ru.hackathon.airballoon.support.PostgresSupport;
import ru.hackathon.airballoon.tournament.api.*;
import ru.hackathon.airballoon.tournament.demo.*;
import ru.hackathon.airballoon.tournament.port.PlayerScoreSource;
import ru.hackathon.airballoon.tournament.service.TournamentService;
import static org.assertj.core.api.Assertions.*;

class DemoAndRecoveryIT extends PostgresSupport {
    private ConfigurableApplicationContext start(String... profiles) {
        Map<String, Object> props = new HashMap<>(connectionProperties());
        props.put("server.port", 0);
        props.put("tournament.demo-tournament-simulation-enabled", Arrays.asList(profiles).contains("prod"));
        SpringApplication app = new SpringApplication(AirBalloonApplication.class);
        app.setAdditionalProfiles(profiles);
        return app.run(props.entrySet().stream().map(e -> "--" + e.getKey() + "=" + e.getValue()).toArray(String[]::new));
    }
    @Test void demoSeedingSimulationAndActualContextRestartRetainLeaderboard() {
        UUID id; LeaderboardResponse before;
        try (var context = start("demo")) {
            var demo = context.getBean(DemoTournament.class);
            var service = context.getBean(TournamentService.class);
            id = demo.idToday();
            // Other integration fixtures may have later-starting active tournaments in this shared test DB.
            JdbcTemplate jdbc = context.getBean(JdbcTemplate.class);
            jdbc.update("DELETE FROM tournament.participants WHERE tournament_id<>?", id);
            jdbc.update("DELETE FROM tournament.tournaments WHERE id<>?", id);
            assertThat(service.active().orElseThrow().id()).isEqualTo(id);
            assertThat(service.leaderboard(id, null, 0, 50).totalParticipants()).isEqualTo(24);
            var seeded = service.leaderboard(id, null, 0, 50);
            context.getBean(DemoLifecycle.class).tick();
            assertThat(service.leaderboard(id, null, 0, 50).tournament().revision()).isEqualTo(seeded.tournament().revision());
            demo.initialize();
            assertThat(service.leaderboard(id, null, 0, 50).participants()).isEqualTo(seeded.participants());
            assertThat(service.leaderboard(id, null, 0, 50).tournament().revision()).isEqualTo(seeded.tournament().revision());
            long sum = seeded.participants().stream().mapToLong(LeaderboardEntry::score).sum();
            demo.simulateOnce();
            before = service.leaderboard(id, null, 0, 50);
            assertThat(before.participants().stream().mapToLong(LeaderboardEntry::score).sum() - sum).isIn(50L, 100L, 200L);
        }
        try (var restarted = start("demo")) {
            var restored = restarted.getBean(TournamentService.class).leaderboard(id, null, 0, 50);
            assertThat(restored.participants()).isEqualTo(before.participants());
            assertThat(restored.top3()).isEqualTo(before.top3());
            assertThat(restored.tournament().revision()).isEqualTo(before.tournament().revision());
            assertThat(restored.updatedAt()).isEqualTo(before.updatedAt());
            // Real migration rerun succeeded on the same DB; no seed reset and no loss of updates.
        }
    }

    @Test void prodExcludesDemoEvenWhenDemoProfileAndSimulationFlagArePresent() {
        try (var context = start("demo", "prod")) {
            assertThat(context.getBeansOfType(DemoScoreSource.class)).isEmpty();
            assertThat(context.getBeansOfType(DemoTournament.class)).isEmpty();
            assertThat(context.getBeansOfType(DemoLifecycle.class)).isEmpty();
            assertThat(context.getBeansOfType(PlayerScoreSource.class)).isEmpty();
            JdbcTemplate jdbc = context.getBean(JdbcTemplate.class);
            jdbc.update("DELETE FROM tournament.participants"); jdbc.update("DELETE FROM tournament.tournaments");
            var service = context.getBean(TournamentService.class);
            assertThat(service.active()).isEmpty();
            UUID id = UUID.randomUUID(); var now = java.time.Instant.now();
            service.create(id, "No adapter", "", now.minusSeconds(10), now.plusSeconds(3600));
            assertThatThrownBy(() -> service.join(id, UUID.randomUUID())).isInstanceOfSatisfying(TournamentException.class,
                    ex -> { assertThat(ex.status()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                        assertThat(ex.code()).isEqualTo("SCORE_SOURCE_UNAVAILABLE"); });
        }
    }
}
