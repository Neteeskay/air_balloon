package ru.airballoon.integration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import ru.airballoon.game.application.port.ActiveRoundStateStore;
import ru.airballoon.game.domain.RoundCheckpoint;
import ru.airballoon.game.infrastructure.config.ResilienceProperties;

@Component
@Profile("!test & !dev")
public class PostgresActiveRoundStateStore implements ActiveRoundStateStore {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final ResilienceProperties policy;

    public PostgresActiveRoundStateStore(JdbcTemplate jdbc, ObjectMapper json, ResilienceProperties policy) {
        this.jdbc = jdbc;
        this.json = json;
        this.policy = policy;
    }

    @Override public void saveCheckpoint(RoundCheckpoint checkpoint) {
        try {
            jdbc.update("""
                    INSERT INTO core_round_checkpoints(round_id,checkpoint_json,updated_at,expires_at)
                    VALUES (?,?::jsonb,now(),NULL)
                    ON CONFLICT (round_id) DO UPDATE
                    SET checkpoint_json=excluded.checkpoint_json,updated_at=now(),expires_at=NULL
                    """, checkpoint.round().id(), json.writeValueAsString(checkpoint));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize round checkpoint", e);
        }
    }

    @Override public Optional<RoundCheckpoint> load(UUID roundId) {
        return jdbc.query("SELECT checkpoint_json::text FROM core_round_checkpoints WHERE round_id=?",
                (rs, row) -> read(rs.getString(1)), roundId).stream().findFirst();
    }

    @Override public Collection<UUID> activeRoundIds() {
        return jdbc.queryForList("SELECT round_id FROM core_round_checkpoints WHERE expires_at IS NULL",
                UUID.class);
    }

    @Override public void markFinished(UUID roundId, Instant now) {
        jdbc.update("UPDATE core_round_checkpoints SET expires_at=? WHERE round_id=? AND expires_at IS NULL",
                Timestamp.from(now.plus(policy.finishedRetention())), roundId);
    }

    @Override public void cleanup(Instant now) {
        jdbc.update("DELETE FROM core_round_checkpoints WHERE expires_at IS NOT NULL AND expires_at<=?", Timestamp.from(now));
    }

    private RoundCheckpoint read(String value) {
        try { return json.readValue(value, RoundCheckpoint.class); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Cannot read round checkpoint", e); }
    }
}
