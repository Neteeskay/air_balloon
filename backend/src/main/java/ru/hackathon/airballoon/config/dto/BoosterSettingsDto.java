package ru.hackathon.airballoon.config.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record BoosterSettingsDto(
        @NotNull @DecimalMin(value = "0.000001") @DecimalMax(value = "1000") Double multiplierTier1Value,
        @NotNull @DecimalMin(value = "0.000001") @DecimalMax(value = "1000") Double multiplierTier2Value,
        @NotNull @DecimalMin(value = "0.000001") @DecimalMax(value = "1000") Double multiplierTier3Value,
        @NotNull @DecimalMin(value = "0.000001") @DecimalMax(value = "1000") Double multiplierTier4Value,
        @NotNull @Valid ThemeProbabilitiesDto green,
        @NotNull @Valid ThemeProbabilitiesDto red) {
}
