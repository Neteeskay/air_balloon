package ru.hackathon.airballoon.admin.config.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record CrashSettingsDto(
    @NotNull(message = "Укажите alpha") @DecimalMin(value = "0", inclusive = true, message = "alpha должен быть не меньше 0") Double alpha,
    @NotNull(message = "Укажите maxMultiplier") @DecimalMin(value = "0", inclusive = false, message = "maxMultiplier должен быть больше 0") Double maxMultiplier,
    @NotNull(message = "Укажите minCrashMultiplier") @DecimalMin(value = "0", inclusive = false, message = "minCrashMultiplier должен быть больше 0") Double minCrashMultiplier,
    @NotNull(message = "Укажите multiplierGrowthRate") @DecimalMin(value = "0", inclusive = false, message = "multiplierGrowthRate должен быть не меньше 0") Double multiplierGrowthRate,
    @NotNull(message = "Укажите fps") @DecimalMin(value = "0", inclusive = false, message = "fps должен быть больше 0") Double fps,
    @NotNull(message = "Укажите delta") @DecimalMin(value = "0", inclusive = false, message = "delta должен быть больше 0") Double delta
) {}
