package ru.hackathon.airballoon.admin.config.dto;

import java.time.Instant;
import java.util.UUID;

/** Historical version with every setting value. */
public record ConfigurationVersionDetail(
    UUID id,
    long revision,
    String status,
    Long baseRevision,
    UUID sourceVersionId,
    Instant createdAt,
    String createdBy,
    Instant activatedAt,
    String activatedBy,
    String gameId,
    String gameName,
    String gameType,
    boolean isActive,
    CrashSettingsDto crash,
    BoosterSettingsDto boosters,
    PointsSettingsDto points
) {}