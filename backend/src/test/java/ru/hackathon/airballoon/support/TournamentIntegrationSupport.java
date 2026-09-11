package ru.hackathon.airballoon.support;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import ru.hackathon.airballoon.tournament.config.TournamentProperties;
import ru.hackathon.airballoon.tournament.port.*;
import ru.hackathon.airballoon.tournament.service.TournamentService;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TournamentTestConfiguration.class)
public abstract class TournamentIntegrationSupport extends PostgresSupport {
    @Autowired protected TournamentService service;
    @Autowired protected ApplicationEventPublisher events;
    @Autowired protected MutableClock clock;
    @Autowired protected TournamentProperties properties;
    @Autowired protected TestPlayerScores scores;
    @Autowired protected JdbcTemplate jdbc;
    @Autowired protected PlatformTransactionManager transactionManager;
    @Autowired protected TestRestTemplate http;
    @LocalServerPort protected int port;

    @BeforeEach void resetTournamentData() {
        jdbc.update("DELETE FROM tournament.participants");
        jdbc.update("DELETE FROM tournament.tournaments");
        clock.set(MutableClock.INITIAL);
        scores.clear();
        properties.setMaskOtherPlayerNames(true);
    }
    protected UUID tournament() {
        UUID id = UUID.randomUUID();
        service.create(id, "Test race", "Integration fixture", clock.instant().minusSeconds(60), clock.instant().plusSeconds(3600));
        return id;
    }
    protected PlayerScore score(UUID user, String name, long value, long version) {
        PlayerScore player = new PlayerScore(user, name, value, version, clock.instant());
        scores.put(player);
        new TransactionTemplate(transactionManager).executeWithoutResult(s -> events.publishEvent(new ScoreChanged(player)));
        return player;
    }
}
