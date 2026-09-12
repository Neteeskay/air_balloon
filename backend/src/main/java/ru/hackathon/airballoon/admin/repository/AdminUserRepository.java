package ru.hackathon.airballoon.admin.repository;

import java.util.Optional;
import java.util.UUID;
import java.sql.Timestamp;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import ru.hackathon.airballoon.admin.entity.AdminUserEntity;

@Repository
public class AdminUserRepository {
    private final JdbcTemplate jdbc;
    public AdminUserRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Optional<AdminUserEntity> findByUsername(String username) {
        return jdbc.query("""
                SELECT id, username, password_hash, role, enabled, created_at
                FROM admin_user WHERE username = ?
                """, (rs, row) -> new AdminUserEntity(
                rs.getObject("id", java.util.UUID.class),
                rs.getString("username"),
                rs.getString("password_hash"),
                rs.getString("role"),
                rs.getBoolean("enabled"),
                rs.getTimestamp("created_at").toInstant()), username)
                .stream().findFirst();
    }

    public Optional<AdminUserEntity> findById(UUID id) {
        return jdbc.query("""
                SELECT id, username, password_hash, role, enabled, created_at
                FROM admin_user WHERE id = ?
                """, (rs, row) -> new AdminUserEntity(
                rs.getObject("id", java.util.UUID.class),
                rs.getString("username"),
                rs.getString("password_hash"),
                rs.getString("role"),
                rs.getBoolean("enabled"),
                rs.getTimestamp("created_at").toInstant()), id)
                .stream().findFirst();
    }

    public void insert(AdminUserEntity user) {
        jdbc.update("""
                INSERT INTO admin_user(id, username, password_hash, role, enabled, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """, user.id(), user.username(), user.passwordHash(), user.role(), user.enabled(), Timestamp.from(user.createdAt()));
    }
}