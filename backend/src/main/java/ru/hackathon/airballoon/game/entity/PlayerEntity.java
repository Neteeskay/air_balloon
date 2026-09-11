package ru.hackathon.airballoon.game.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "player_user", uniqueConstraints = @UniqueConstraint(name = "uq_player_username", columnNames = "username"))
public class PlayerEntity {
    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "username", nullable = false, length = 100)
    private String username;

    @Column(name = "bonus_balance", nullable = false, precision = 19, scale = 2)
    private BigDecimal bonusBalance;

    @Column(name = "game_points", nullable = false)
    private long gamePoints;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public BigDecimal getBonusBalance() { return bonusBalance; }
    public void setBonusBalance(BigDecimal bonusBalance) { this.bonusBalance = bonusBalance; }
    public long getGamePoints() { return gamePoints; }
    public void setGamePoints(long gamePoints) { this.gamePoints = gamePoints; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public long getLockVersion() { return lockVersion; }
    public void setLockVersion(long lockVersion) { this.lockVersion = lockVersion; }
}
