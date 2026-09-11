package ru.airballoon.integration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.airballoon.game.application.port.RoundEventStore;
import ru.airballoon.game.domain.GameEvent;
import ru.airballoon.game.domain.RoundEventPage;
import ru.airballoon.game.infrastructure.config.ResilienceProperties;
import ru.hackathon.airballoon.score.ScoreService;

@Component
@Profile("!test & !dev")
public class PostgresRoundEventStore implements RoundEventStore {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final ScoreService scores;
    private final ResilienceProperties policy;

    public PostgresRoundEventStore(JdbcTemplate jdbc, ObjectMapper json, ScoreService scores,
                                   ResilienceProperties policy) {
        this.jdbc = jdbc;
        this.json = json;
        this.scores = scores;
        this.policy = policy;
    }

    @Override
    @Transactional
    public void append(GameEvent event) {
        int inserted;
        try {
            inserted = jdbc.update("""
                    INSERT INTO core_round_events(round_id,sequence,event_id,event_json)
                    VALUES (?,?,?,?::jsonb) ON CONFLICT (round_id,sequence) DO NOTHING
                    """, event.roundId(), event.sequence(), event.eventId(), json.writeValueAsString(event));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize game event", e);
        }
        if (inserted == 1) awardScore(event);
        jdbc.update("""
                DELETE FROM core_round_events e WHERE e.round_id=? AND e.sequence NOT IN
                (SELECT sequence FROM core_round_events WHERE round_id=? ORDER BY sequence DESC LIMIT ?)
                """, event.roundId(), event.roundId(), policy.replayLimit());
    }

    private void awardScore(GameEvent event) {
        Number points = (Number) event.data().get("pointsToAward");
        switch (event.type()) {
            case LEVEL_REACHED -> {
                if (points != null && points.longValue() > 0)
                    scores.awardLevelPoints(event.userId(), event.roundId(),
                            ((Number) event.data().get("level")).intValue(), points.longValue());
            }
            case BOOSTER_ACTIVATED -> {
                if (points != null && points.longValue() > 0)
                    scores.awardBoosterPoints(event.userId(), event.roundId(),
                            ((Number) event.data().get("booster")).intValue(), points.longValue());
            }
            case CASHOUT_SUCCESS -> scores.awardCashoutPoints(event.userId(), event.roundId(),
                    configCashoutPoints(event.roundId()));
            default -> { }
        }
    }

    private long configCashoutPoints(UUID roundId) {
        return jdbc.queryForObject("""
                SELECT (c.config_json->>'pointsCashoutBonus')::bigint
                FROM game_rounds r JOIN game_config_versions c ON c.version=r.config_version WHERE r.id=?
                """, Long.class, roundId);
    }

    @Override
    public RoundEventPage findAfter(UUID roundId, long sequence) {
        List<Long> bounds = jdbc.query("SELECT min(sequence),max(sequence) FROM core_round_events WHERE round_id=?",
                (rs, row) -> List.of(rs.getLong(1), rs.getLong(2)), roundId).stream().findFirst().orElse(List.of(0L, 0L));
        long oldest = bounds.get(0), latest = bounds.get(1);
        if (latest == 0) return new RoundEventPage(List.of(), 0, 0, true);
        List<GameEvent> events = jdbc.query("""
                SELECT event_json::text FROM core_round_events
                WHERE round_id=? AND sequence>? ORDER BY sequence
                """, (rs, row) -> read(rs.getString(1)), roundId, sequence);
        return new RoundEventPage(events, oldest, latest, sequence < oldest - 1 || sequence > latest);
    }

    @Override
    public Optional<GameEvent> latest(UUID roundId) {
        return jdbc.query("""
                SELECT event_json::text FROM core_round_events WHERE round_id=? ORDER BY sequence DESC LIMIT 1
                """, (rs, row) -> read(rs.getString(1)), roundId).stream().findFirst();
    }

    @Override public void markFinished(UUID roundId, Instant now) {
        jdbc.update("UPDATE core_round_events SET expires_at=? WHERE round_id=? AND expires_at IS NULL",
                Timestamp.from(now.plus(policy.replayRetention())), roundId);
    }

    @Override public void cleanup(Instant now) {
        jdbc.update("DELETE FROM core_round_events WHERE expires_at IS NOT NULL AND expires_at<=?", Timestamp.from(now));
    }

    private GameEvent read(String value) {
        try { return json.readValue(value, GameEvent.class); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Cannot read game event", e); }
    }
}
