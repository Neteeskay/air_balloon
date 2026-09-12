package ru.hackathon.airballoon.admin.config.dto;

import java.time.Instant;
import java.util.UUID;

/** Full configuration read model returned to the admin UI. */
public record GameConfigurationResponse(
    UUID id,
    long revision,
    String status,
    Instant createdAt,
    String createdBy,
    Instant activatedAt,
    String activatedBy,
    Long baseRevision,
    UUID sourceVersionId,
    String gameId,
    String gameName,
    String gameType,
    boolean isActive,
    CrashSettingsDto crash,
    BoosterSettingsDto boosters,
    PointsSettingsDto points
) {}