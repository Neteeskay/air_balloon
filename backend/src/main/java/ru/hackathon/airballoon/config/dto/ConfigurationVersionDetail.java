package ru.hackathon.airballoon.config.dto;

import ru.hackathon.airballoon.config.domain.ConfigStatus;

import java.time.Instant;
import java.util.UUID;

public record ConfigurationVersionDetail(
        UUID id,
        long revision,
        ConfigStatus status,
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
        PointsSettingsDto points) {
}
