package ru.hackathon.airballoon.admin.config.repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Revision sequence holder per app; protected by a pessimistic lock on the row. */
@Repository
public class AdminAppRepository {
    private final JdbcTemplate jdbc;
    public AdminAppRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public long createIfAbsent(String appId) {
        int updated = jdbc.update("""
                INSERT INTO admin_app(id, configuration_sequence, created_at) VALUES (?, 0, ?)
                ON CONFLICT (id) DO NOTHING
                """, appId, Timestamp.from(Instant.now()));
        return updated > 0 ? 0 : sequenceOf(appId);
    }

    public long sequenceOf(String appId) {
        Long seq = jdbc.queryForObject("SELECT configuration_sequence FROM admin_app WHERE id = ?", Long.class, appId);
        return seq == null ? 0 : seq;
    }

    public boolean exists(String appId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM admin_app WHERE id = ?)", Boolean.class, appId));
    }

    /** Returns the new sequence and increments it atomically. */
    public long nextSequence(String appId) {
        return jdbc.queryForObject("""
                UPDATE admin_app SET configuration_sequence = configuration_sequence + 1
                WHERE id = ? RETURNING configuration_sequence
                """, Long.class, appId);
    }

    public void setSequence(String appId, long value) {
        jdbc.update("UPDATE admin_app SET configuration_sequence = ? WHERE id = ?", value, appId);
    }

    public Optional<Long> lockSequence(String appId) {
        return Optional.ofNullable(jdbc.query("SELECT configuration_sequence FROM admin_app WHERE id = ? FOR UPDATE",
                rs -> rs.next() ? rs.getLong(1) : null, appId));
    }
}