package ru.hackathon.airballoon.admin.config.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record PointsSettingsDto(
    @NotNull @Min(0) @Max(1_000_000) Long pointsPerLine,
    @NotNull @Min(0) @Max(1_000_000) Long pointsCashoutBonus,
    @NotNull @Min(0) @Max(1_000_000) Long pointsXNBonus
) {}