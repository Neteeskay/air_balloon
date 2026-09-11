package ru.hackathon.airballoon.config.dto;

import java.util.List;

public record ConfigValidationResponse(boolean valid, List<String> warnings) {
    public static ConfigValidationResponse ok() {
        return new ConfigValidationResponse(true, List.of());
    }
}
