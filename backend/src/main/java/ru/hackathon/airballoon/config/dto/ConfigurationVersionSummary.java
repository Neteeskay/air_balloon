package ru.hackathon.airballoon.config.dto;

import ru.hackathon.airballoon.config.domain.ConfigStatus;

import java.time.Instant;
import java.util.UUID;

public record ConfigurationVersionSummary(
        UUID id,
        long revision,
        ConfigStatus status,
        Long baseRevision,
        UUID sourceVersionId,
        Instant createdAt,
        String createdBy,
        Instant activatedAt,
        String activatedBy) {
}
