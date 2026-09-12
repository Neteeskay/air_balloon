package ru.hackathon.airballoon.admin.config.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ConfigDiffResponse(
    UUID fromVersionId,
    UUID toVersionId,
    java.util.List<ConfigDiffEntry> changes
) {}