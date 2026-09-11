package ru.hackathon.airballoon.tournament.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import ru.hackathon.airballoon.tournament.domain.Tournament;
import ru.hackathon.airballoon.tournament.domain.TournamentParticipant;
import ru.hackathon.airballoon.tournament.port.PlayerScore;

@Repository
public class TournamentRepository {
    private static final String ORDER = " ORDER BY score DESC, updated_at ASC, user_id ASC ";
    private static final RowMapper<Tournament> TOURNAMENT = (rs, n) -> new Tournament(
            rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("description"),
            instant(rs, "starts_at"), instant(rs, "ends_at"), instant(rs, "created_at"),
            instant(rs, "updated_at"), rs.getLong("revision"));
    private static final RowMapper<TournamentParticipant> PARTICIPANT = (rs, n) -> new TournamentParticipant(
            rs.getObject("tournament_id", UUID.class), rs.getObject("user_id", UUID.class),
            rs.getString("username"), rs.getLong("score"), rs.getLong("score_version"),
            instant(rs, "joined_at"), instant(rs, "updated_at"));
    private final JdbcTemplate jdbc;

    public TournamentRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public boolean createIfAbsent(Tournament tournament) {
        return jdbc.update("""
                INSERT INTO tournament.tournaments (id,name,description,starts_at,ends_at,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING
                """, tournament.id(), tournament.name(), tournament.description(), ts(tournament.startsAt()),
                ts(tournament.endsAt()), ts(tournament.createdAt()), ts(tournament.updatedAt())) == 1;
    }

    public Optional<Tournament> find(UUID id) {
        return jdbc.query("SELECT * FROM tournament.tournaments WHERE id=?", TOURNAMENT, id).stream().findFirst();
    }

    public Optional<Tournament> lock(UUID id) {
        return jdbc.query("SELECT * FROM tournament.tournaments WHERE id=? FOR UPDATE", TOURNAMENT, id).stream().findFirst();
    }

    public Optional<Tournament> active(Instant now) {
        return jdbc.query("""
                SELECT * FROM tournament.tournaments WHERE starts_at<=? AND ends_at>?
                ORDER BY starts_at DESC, id ASC LIMIT 1
                """, TOURNAMENT, ts(now), ts(now)).stream().findFirst();
    }

    public List<UUID> activeIds(Instant now) {
        return jdbc.query("""
                SELECT id FROM tournament.tournaments WHERE starts_at<=? AND ends_at>? ORDER BY id
                """, (rs, n) -> rs.getObject(1, UUID.class), ts(now), ts(now));
    }

    public boolean project(UUID tournamentId, PlayerScore player, Instant now) {
        return jdbc.update("""
                INSERT INTO tournament.participants
                    (tournament_id,user_id,username,score,score_version,joined_at,updated_at)
                VALUES (?,?,?,?,?,?,?)
                ON CONFLICT (tournament_id,user_id) DO UPDATE SET
                    username=EXCLUDED.username, score=EXCLUDED.score,
                    score_version=EXCLUDED.score_version, updated_at=EXCLUDED.updated_at
                WHERE tournament.participants.score_version < EXCLUDED.score_version
                """, tournamentId, player.userId(), player.username(), player.gameScore(), player.version(),
                ts(now), ts(now)) == 1;
    }

    public Tournament touch(UUID tournamentId, Instant now) {
        return jdbc.queryForObject("""
                UPDATE tournament.tournaments SET revision=revision+1, updated_at=? WHERE id=? RETURNING *
                """, TOURNAMENT, ts(now), tournamentId);
    }

    public List<TournamentParticipant> page(UUID tournamentId, long offset, int size) {
        return jdbc.query("SELECT * FROM tournament.participants WHERE tournament_id=?" + ORDER + "LIMIT ? OFFSET ?",
                PARTICIPANT, tournamentId, size, offset);
    }

    public Optional<TournamentParticipant> participant(UUID tournamentId, UUID userId) {
        return jdbc.query("SELECT * FROM tournament.participants WHERE tournament_id=? AND user_id=?",
                PARTICIPANT, tournamentId, userId).stream().findFirst();
    }

    public long position(TournamentParticipant p) {
        return jdbc.queryForObject("""
                SELECT count(*)+1 FROM tournament.participants WHERE tournament_id=? AND
                (score>? OR (score=? AND updated_at<?) OR (score=? AND updated_at=? AND user_id<?))
                """, Long.class, p.tournamentId(), p.score(), p.score(), ts(p.updatedAt()),
                p.score(), ts(p.updatedAt()), p.userId());
    }

    public long count(UUID id) {
        return jdbc.queryForObject("SELECT count(*) FROM tournament.participants WHERE tournament_id=?", Long.class, id);
    }

    private static Timestamp ts(Instant instant) { return Timestamp.from(instant); }
    private static Instant instant(ResultSet rs, String column) throws SQLException { return rs.getTimestamp(column).toInstant(); }
}
