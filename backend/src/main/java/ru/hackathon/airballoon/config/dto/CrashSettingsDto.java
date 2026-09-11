package ru.hackathon.airballoon.config.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record CrashSettingsDto(
        @NotNull @DecimalMin(value = "0.000001") @DecimalMax(value = "1000") Double alpha,
        @NotNull @DecimalMin(value = "1.000001") @DecimalMax(value = "1000000") Double maxMultiplier,
        @NotNull @DecimalMin(value = "0.000001") @DecimalMax(value = "100000") Double minCrashMultiplier,
        @NotNull @DecimalMin(value = "0.000001") @DecimalMax(value = "1000") Double multiplierGrowthRate,
        @NotNull @DecimalMin(value = "0.000001") @DecimalMax(value = "1000") Double fps,
        @NotNull @DecimalMin(value = "0.000000001") @DecimalMax(value = "100") Double delta) {
}
