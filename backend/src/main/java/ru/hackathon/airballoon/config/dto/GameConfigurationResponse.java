package ru.hackathon.airballoon.config.dto;

import ru.hackathon.airballoon.config.domain.ConfigStatus;

import java.time.Instant;
import java.util.UUID;

public record GameConfigurationResponse(
        UUID id,
        long revision,
        ConfigStatus status,
        Instant createdAt,
        String createdBy,
        Instant activatedAt,
        String gameId,
        String gameName,
        String gameType,
        boolean isActive,
        CrashSettingsDto crash,
        BoosterSettingsDto boosters,
        PointsSettingsDto points) {
}
