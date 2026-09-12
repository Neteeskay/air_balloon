package ru.hackathon.airballoon.admin.repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.sql.Timestamp;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Server-side audit log of admin actions. */
@Repository
public class AuditLogRepository {
    private final JdbcTemplate jdbc;
    public AuditLogRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void insert(String administrator, String action, String affectedEntity, String appId,
                       UUID configId, String traceId, String metadata) {
        jdbc.update("""
                INSERT INTO admin_audit(id, event_timestamp, administrator, action, affected_entity,
                                        app_id, config_id, trace_id, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), Timestamp.from(Instant.now()), administrator, action, affectedEntity,
                appId, configId, traceId, metadata);
    }

    private static String buildWhere(String action, String administrator, UUID configId,
                                     Instant from, Instant to, List<Object> params) {
        StringBuilder sb = new StringBuilder("WHERE 1=1");
        if (action != null) { sb.append(" AND action = ?"); params.add(action); }
        if (administrator != null) { sb.append(" AND administrator = ?"); params.add(administrator); }
        if (configId != null) { sb.append(" AND config_id = ?"); params.add(configId); }
        if (from != null) { sb.append(" AND event_timestamp >= ?"); params.add(Timestamp.from(from)); }
        if (to != null) { sb.append(" AND event_timestamp <= ?"); params.add(Timestamp.from(to)); }
        return sb.toString();
    }

    public long count(String action, String administrator, UUID configId, Instant from, Instant to) {
        List<Object> params = new ArrayList<>();
        String where = buildWhere(action, administrator, configId, from, to, params);
        return jdbc.queryForObject("SELECT count(*) FROM admin_audit " + where, Long.class, params.toArray());
    }

    public List<AuditRow> searchPage(String action, String administrator, UUID configId, Instant from,
                                     Instant to, int page, int size) {
        List<Object> params = new ArrayList<>();
        String where = buildWhere(action, administrator, configId, from, to, params);
        int offset = page * size;
        String sql = """
                SELECT id, event_timestamp, administrator, action, affected_entity, app_id, config_id, trace_id, metadata
                FROM admin_audit %s ORDER BY event_timestamp DESC, id DESC LIMIT ? OFFSET ?
                """.formatted(where);
        params.add(size);
        params.add(offset);
        return jdbc.query(sql, (rs, row) -> new AuditRow(
                rs.getObject("id", UUID.class),
                rs.getTimestamp("event_timestamp").toInstant(),
                rs.getString("administrator"),
                rs.getString("action"),
                rs.getString("affected_entity"),
                rs.getString("app_id"),
                rs.getObject("config_id", UUID.class),
                rs.getString("trace_id"),
                rs.getString("metadata")), params.toArray());
    }

    public record AuditRow(UUID id, Instant timestamp, String administrator, String action,
                           String affectedEntity, String appId, UUID configId, String traceId, String metadata) {}
}