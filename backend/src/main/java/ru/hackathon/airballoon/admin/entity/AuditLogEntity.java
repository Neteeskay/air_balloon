package ru.hackathon.airballoon.admin.entity;

import jakarta.persistence.*;
import ru.hackathon.airballoon.admin.domain.AuditAction;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_log", indexes = {
        @Index(name = "idx_audit_timestamp", columnList = "event_timestamp"),
        @Index(name = "idx_audit_action", columnList = "action"),
        @Index(name = "idx_audit_admin", columnList = "administrator"),
        @Index(name = "idx_audit_config_version", columnList = "configuration_version")
})
public class AuditLogEntity {
    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "event_timestamp", nullable = false, updatable = false)
    private Instant timestamp;

    @Column(name = "administrator", nullable = false, length = 100)
    private String administrator;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 64)
    private AuditAction action;

    @Column(name = "affected_entity", nullable = false, length = 100)
    private String affectedEntity;

    @Column(name = "game_id", length = 100)
    private String gameId;

    @Column(name = "configuration_version")
    private UUID configurationVersion;

    @Column(name = "trace_id", length = 100)
    private String traceId;

    @Column(name = "metadata", columnDefinition = "text")
    private String metadata;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (timestamp == null) timestamp = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
    public String getAdministrator() { return administrator; }
    public void setAdministrator(String administrator) { this.administrator = administrator; }
    public AuditAction getAction() { return action; }
    public void setAction(AuditAction action) { this.action = action; }
    public String getAffectedEntity() { return affectedEntity; }
    public void setAffectedEntity(String affectedEntity) { this.affectedEntity = affectedEntity; }
    public String getGameId() { return gameId; }
    public void setGameId(String gameId) { this.gameId = gameId; }
    public UUID getConfigurationVersion() { return configurationVersion; }
    public void setConfigurationVersion(UUID configurationVersion) { this.configurationVersion = configurationVersion; }
    public String getTraceId() { return traceId; }
    public void setTraceId(String traceId) { this.traceId = traceId; }
    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }
}
