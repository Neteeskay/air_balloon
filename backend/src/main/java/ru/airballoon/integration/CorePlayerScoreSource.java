package ru.airballoon.integration;

import java.sql.Timestamp;
import java.util.Optional;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import ru.hackathon.airballoon.tournament.port.PlayerScore;
import ru.hackathon.airballoon.tournament.port.PlayerScoreSource;

/** Reads the canonical Core score snapshot; Tournament never recalculates point deltas. */
@Component
@Primary
@Profile("!test & !dev")
public class CorePlayerScoreSource implements PlayerScoreSource {
    private final JdbcTemplate jdbc;

    public CorePlayerScoreSource(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<PlayerScore> find(UUID userId) {
        return jdbc.query("""
                SELECT id,display_name,game_score,game_score_version,updated_at
                FROM users WHERE id=?
                """, (rs, row) -> new PlayerScore(rs.getObject("id", UUID.class),
                rs.getString("display_name"), rs.getLong("game_score"),
                rs.getLong("game_score_version"),
                rs.getObject("updated_at", Timestamp.class).toInstant()), userId).stream().findFirst();
    }
}
