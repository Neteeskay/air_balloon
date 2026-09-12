package ru.hackathon.airballoon.rating.persistence;

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

/** Reads the canonical Core users table; this repository does not maintain a rating copy. */
@Repository
public class GlobalRatingRepository {
    private static final String ORDER = " ORDER BY game_score DESC, updated_at ASC, id ASC ";
    private static final RowMapper<Row> ROW = (rs, n) -> new Row(
            rs.getObject("id", UUID.class), rs.getString("display_name"), rs.getLong("game_score"),
            rs.getLong("game_score_version"), instant(rs, "updated_at"));
    private final JdbcTemplate jdbc;

    public GlobalRatingRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<Row> page(long offset, int size) {
        return jdbc.query("SELECT id,display_name,game_score,game_score_version,updated_at FROM users"
                + ORDER + " LIMIT ? OFFSET ?", ROW, size, offset);
    }

    public Optional<Row> find(UUID id) {
        return jdbc.query("SELECT id,display_name,game_score,game_score_version,updated_at FROM users WHERE id=?",
                ROW, id).stream().findFirst();
    }

    public long rank(Row row) {
        return jdbc.queryForObject("""
                SELECT count(*)+1 FROM users WHERE
                    game_score>? OR (game_score=? AND updated_at<?)
                    OR (game_score=? AND updated_at=? AND id<?)
                """, Long.class, row.score(), row.score(), ts(row.updatedAt()), row.score(),
                ts(row.updatedAt()), row.userId());
    }

    /** Sum of monotonic per-user versions changes on every canonical score update. */
    public Stats stats() {
        return jdbc.queryForObject("""
                SELECT count(*) AS total, COALESCE(sum(game_score_version),0)::bigint AS revision FROM users
                """, (rs, n) -> new Stats(rs.getLong("total"), rs.getLong("revision")));
    }

    public record Row(UUID userId, String displayName, long score, long scoreVersion, Instant updatedAt) {}
    public record Stats(long totalParticipants, long revision) {}

    private static Timestamp ts(Instant instant) { return Timestamp.from(instant); }
    private static Instant instant(ResultSet rs, String column) throws SQLException {
        return rs.getTimestamp(column).toInstant();
    }
}
