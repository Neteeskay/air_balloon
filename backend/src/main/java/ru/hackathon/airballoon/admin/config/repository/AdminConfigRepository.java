package ru.hackathon.airballoon.admin.config.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import ru.hackathon.airballoon.admin.config.entity.AdminConfigRow;

@Repository
public class AdminConfigRepository {
    private final JdbcTemplate jdbc;
    public AdminConfigRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    private static final String SELECT = """
            SELECT id, revision, base_revision, source_version_id, status, app_id,
                   game_name, game_type, game_active,
                   crash_alpha, crash_max_multiplier, crash_min_crash_multiplier,
                   crash_multiplier_growth_rate, crash_fps, crash_delta,
                   booster_tier1_value, booster_tier2_value, booster_tier3_value, booster_tier4_value,
                   points_per_line, points_cashout_bonus, points_xn_bonus,
                   created_at, created_by, activated_at, activated_by
            FROM admin_config
            """;

    public void insert(String appId, AdminConfigRow row) {
        jdbc.update("""
                INSERT INTO admin_config(id, app_id, revision, base_revision, source_version_id, status,
                    game_name, game_type, game_active,
                    crash_alpha, crash_max_multiplier, crash_min_crash_multiplier,
                    crash_multiplier_growth_rate, crash_fps, crash_delta,
                    booster_tier1_value, booster_tier2_value, booster_tier3_value, booster_tier4_value,
                    points_per_line, points_cashout_bonus, points_xn_bonus,
                    created_at, created_by, activated_at, activated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, row.id(), appId, row.revision(), row.baseRevision(), row.sourceVersionId(), row.status(),
                row.gameName(), row.gameType(), row.gameActive(),
                row.crashAlpha(), row.crashMaxMultiplier(), row.crashMinCrashMultiplier(),
                row.crashGrowthRate(), row.crashFps(), row.crashDelta(),
                row.boosterTier1(), row.boosterTier2(), row.boosterTier3(), row.boosterTier4(),
                row.pointsPerLine(), row.pointsCashoutBonus(), row.pointsXNBonus(),
                ts(row.createdAt()), row.createdBy(), ts(row.activatedAt()), row.activatedBy());
    }

    public int setStatus(UUID id, String status, Instant activatedAt, String activatedBy) {
        return jdbc.update("""
                UPDATE admin_config SET status = ?, activated_at = ?, activated_by = ? WHERE id = ?
                """, status, ts(activatedAt), activatedBy, id);
    }

    /** Used before activating/cloning so the single-active partial unique index stays valid. */
    public int archiveActive(String appId) {
        return jdbc.update("UPDATE admin_config SET status = 'ARCHIVED' WHERE app_id = ? AND status = 'ACTIVE'", appId);
    }

    public boolean existsByRevision(String appId, long revision) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM admin_config WHERE app_id = ? AND revision = ?)", Boolean.class, appId, revision));
    }

    public Optional<AdminConfigRow> findActive(String appId) {
        return findBy(SELECT + " WHERE app_id = ? AND status = 'ACTIVE'", appId);
    }

    public Optional<AdminConfigRow> findActiveForUpdate(String appId) {
        return findBy(SELECT + " WHERE app_id = ? AND status = 'ACTIVE' FOR UPDATE", appId);
    }

    public Optional<AdminConfigRow> findByIdAndAppForUpdate(UUID id, String appId) {
        return findBy(SELECT + " WHERE id = ? AND app_id = ? FOR UPDATE", id, appId);
    }

    public Optional<AdminConfigRow> findByIdAndApp(UUID id, String appId) {
        return findBy(SELECT + " WHERE id = ? AND app_id = ?", id, appId);
    }

    public List<AdminConfigRow> listByApp(String appId, int page, int size) {
        return jdbc.query(SELECT + " WHERE app_id = ? ORDER BY revision DESC LIMIT ? OFFSET ?",
                ((rs, rowNum) -> map(rs)), appId, size, (long) page * size);
    }

    public long countByApp(String appId) {
        Long v = jdbc.queryForObject("SELECT count(*) FROM admin_config WHERE app_id = ?", Long.class, appId);
        return v == null ? 0 : v;
    }

    private Optional<AdminConfigRow> findBy(String sql, Object... args) {
        return jdbc.query(sql, (rs, rowNum) -> map(rs), args).stream().findFirst();
    }

    private static AdminConfigRow map(ResultSet rs) throws SQLException {
        return new AdminConfigRow(
                rs.getObject("id", UUID.class),
                rs.getLong("revision"),
                v(rs, "base_revision"),
                rs.getObject("source_version_id", UUID.class),
                rs.getString("status"),
                rs.getString("game_name"),
                rs.getString("game_type"),
                rs.getBoolean("game_active"),
                rs.getDouble("crash_alpha"),
                rs.getDouble("crash_max_multiplier"),
                rs.getDouble("crash_min_crash_multiplier"),
                rs.getDouble("crash_multiplier_growth_rate"),
                rs.getDouble("crash_fps"),
                rs.getDouble("crash_delta"),
                rs.getDouble("booster_tier1_value"),
                rs.getDouble("booster_tier2_value"),
                rs.getDouble("booster_tier3_value"),
                rs.getDouble("booster_tier4_value"),
                rs.getLong("points_per_line"),
                rs.getLong("points_cashout_bonus"),
                rs.getLong("points_xn_bonus"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getString("created_by"),
                rs.getTimestamp("activated_at") == null ? null : rs.getTimestamp("activated_at").toInstant(),
                rs.getString("activated_by"));
    }

    private static Long v(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private static Timestamp ts(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }
}