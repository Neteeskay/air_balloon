package ru.hackathon.airballoon.admin.config.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record PointsSettingsDto(
    @NotNull(message = "Укажите очки за пройденную линию") @Min(value = 0, message = "Очки за линию не меньше 0") @Max(value = 1_000_000, message = "Очки за линию не больше 1 000 000") Long pointsPerLine,
    @NotNull(message = "Укажите бонус за вывод выигрыша") @Min(value = 0, message = "Бонус не меньше 0") @Max(value = 1_000_000, message = "Бонус не больше 1 000 000") Long pointsCashoutBonus,
    @NotNull(message = "Укажите бонус за бустер") @Min(value = 0, message = "Бонус не меньше 0") @Max(value = 1_000_000, message = "Бонус не больше 1 000 000") Long pointsXNBonus
) {}