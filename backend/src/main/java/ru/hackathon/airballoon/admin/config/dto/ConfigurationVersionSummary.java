package ru.hackathon.airballoon.admin.config.dto;

import java.time.Instant;
import java.util.UUID;

/** Lightweight version row for the history list. */
public record ConfigurationVersionSummary(
    UUID id,
    long revision,
    String status,
    Long baseRevision,
    UUID sourceVersionId,
    Instant createdAt,
    String createdBy,
    Instant activatedAt,
    String activatedBy
) {}