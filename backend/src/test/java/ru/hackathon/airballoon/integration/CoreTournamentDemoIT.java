package ru.hackathon.airballoon.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import ru.hackathon.airballoon.support.PostgresSupport;
import ru.hackathon.airballoon.tournament.demo.DemoTournament;
import ru.hackathon.airballoon.tournament.service.TournamentService;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = ru.airballoon.AirBalloonApplication.class,
        properties = "game.scheduler-enabled=false")
@ActiveProfiles("demo")
class CoreTournamentDemoIT extends PostgresSupport {
    @Autowired JdbcTemplate jdbc;
    @Autowired DemoTournament demo;
    @Autowired TournamentService tournaments;

    @Test
    void integratedCoreSeedsTwentyFourCanonicalUsersAndParticipants() {
        var id = demo.idToday();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users", Long.class)).isEqualTo(24);
        assertThat(tournaments.leaderboard(id, null, 0, 50).totalParticipants()).isEqualTo(24);
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM tournament.participants p
                JOIN users u ON u.id=p.user_id WHERE p.tournament_id=?
                """, Long.class, id)).isEqualTo(24);
    }
}
