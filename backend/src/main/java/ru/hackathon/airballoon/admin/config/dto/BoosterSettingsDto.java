package ru.hackathon.airballoon.admin.config.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record BoosterSettingsDto(
    @NotNull @DecimalMin(value = "0", inclusive = false) Double multiplierTier1Value,
    @NotNull @DecimalMin(value = "0", inclusive = false) Double multiplierTier2Value,
    @NotNull @DecimalMin(value = "0", inclusive = false) Double multiplierTier3Value,
    @NotNull @DecimalMin(value = "0", inclusive = false) Double multiplierTier4Value,
    @NotNull @Valid ThemeProbabilitiesDto green,
    @NotNull @Valid ThemeProbabilitiesDto red
) {
    public double tier(int i) {
        return switch (i) {
            case 1 -> multiplierTier1Value;
            case 2 -> multiplierTier2Value;
            case 3 -> multiplierTier3Value;
            case 4 -> multiplierTier4Value;
            default -> throw new IllegalArgumentException("Tier out of range: " + i);
        };
    }
}