package ru.hackathon.airballoon.admin.config.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record BoosterSettingsDto(
    @NotNull(message = "Укажите множитель бустера ×1") @DecimalMin(value = "0", inclusive = false, message = "Множитель бустера должен быть больше 0") Double multiplierTier1Value,
    @NotNull(message = "Укажите множитель бустера ×2") @DecimalMin(value = "0", inclusive = false, message = "Множитель бустера должен быть больше 0") Double multiplierTier2Value,
    @NotNull(message = "Укажите множитель бустера ×3") @DecimalMin(value = "0", inclusive = false, message = "Множитель бустера должен быть больше 0") Double multiplierTier3Value,
    @NotNull(message = "Укажите множитель бустера ×4") @DecimalMin(value = "0", inclusive = false, message = "Множитель бустера должен быть больше 0") Double multiplierTier4Value,
    @NotNull(message = "Задайте вероятности зелёной темы") @Valid ThemeProbabilitiesDto green,
    @NotNull(message = "Задайте вероятности красной темы") @Valid ThemeProbabilitiesDto red
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