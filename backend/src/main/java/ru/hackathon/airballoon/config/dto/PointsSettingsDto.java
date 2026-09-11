package ru.hackathon.airballoon.config.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record PointsSettingsDto(
        @NotNull @Min(0) @Max(1_000_000) Integer pointsPerLine,
        @NotNull @Min(0) @Max(1_000_000) Integer pointsCashoutBonus,
        @NotNull @Min(0) @Max(1_000_000) Integer pointsXNBonus) {
}
