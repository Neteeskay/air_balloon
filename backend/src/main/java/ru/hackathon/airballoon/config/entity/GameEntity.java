package ru.hackathon.airballoon.config.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "game")
public class GameEntity {
    @Id
    @Column(name = "id", nullable = false, updatable = false, length = 100)
    private String id;

    @Column(name = "configuration_sequence", nullable = false)
    private long configurationSequence;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public long getConfigurationSequence() { return configurationSequence; }
    public void setConfigurationSequence(long configurationSequence) { this.configurationSequence = configurationSequence; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public long getLockVersion() { return lockVersion; }
    public void setLockVersion(long lockVersion) { this.lockVersion = lockVersion; }
}
