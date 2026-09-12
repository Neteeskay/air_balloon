package ru.hackathon.airballoon.admin.config.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record CrashSettingsDto(
    @NotNull @DecimalMin(value = "0", inclusive = false) Double alpha,
    @NotNull @DecimalMin(value = "0", inclusive = false) Double maxMultiplier,
    @NotNull @DecimalMin(value = "0", inclusive = false) Double minCrashMultiplier,
    @NotNull @DecimalMin(value = "0", inclusive = false) Double multiplierGrowthRate,
    @NotNull @DecimalMin(value = "0", inclusive = false) Double fps,
    @NotNull @DecimalMin(value = "0", inclusive = false) Double delta
) {}