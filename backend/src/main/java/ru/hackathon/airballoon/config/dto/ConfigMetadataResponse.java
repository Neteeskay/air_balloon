package ru.hackathon.airballoon.config.dto;

import java.util.List;

public record ConfigMetadataResponse(
        String gameIdPolicy,
        String probabilityModel,
        int greenLevelCount,
        int redLevelCount,
        List<ParameterMetadata> parameters) {
}
