package ru.hackathon.airballoon.admin.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuditEventResponse(
    UUID id,
    Instant timestamp,
    String administrator,
    String action,
    String affectedEntity,
    String gameId,
    UUID configId,
    String traceId,
    String metadata
) {}