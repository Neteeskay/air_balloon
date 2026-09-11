package ru.hackathon.airballoon.config.dto;

import java.util.List;
import java.util.UUID;

public record ConfigDiffResponse(UUID fromVersionId, UUID toVersionId, List<ConfigDiffEntry> changes) {
}
