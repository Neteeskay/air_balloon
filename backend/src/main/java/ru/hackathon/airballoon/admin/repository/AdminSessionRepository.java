package ru.hackathon.airballoon.admin.repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.sql.Timestamp;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import ru.hackathon.airballoon.admin.entity.AdminSessionEntity;

@Repository
public class AdminSessionRepository {
    private final JdbcTemplate jdbc;
    public AdminSessionRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void insert(AdminSessionEntity session) {
        jdbc.update("""
                INSERT INTO admin_session(id, admin_user_id, token_hash, created_at, expires_at, revoked_at)
                VALUES (?, ?, ?, ?, ?, NULL)
                """, session.id(), session.adminUserId(), session.tokenHash(), Timestamp.from(session.createdAt()), Timestamp.from(session.expiresAt()));
    }

    public Optional<AdminSessionEntity> findByTokenHash(String tokenHash) {
        return jdbc.query("""
                SELECT id, admin_user_id, token_hash, created_at, expires_at, revoked_at
                FROM admin_session WHERE token_hash = ?
                """, (rs, row) -> new AdminSessionEntity(
                rs.getObject("id", UUID.class),
                rs.getObject("admin_user_id", UUID.class),
                rs.getString("token_hash"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("expires_at").toInstant(),
                rs.getTimestamp("revoked_at") == null ? null : rs.getTimestamp("revoked_at").toInstant()), tokenHash)
                .stream().findFirst();
    }

    public int revoke(UUID sessionId, Instant now) {
        return jdbc.update("UPDATE admin_session SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
                Timestamp.from(now), sessionId);
    }
}