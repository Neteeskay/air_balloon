package ru.hackathon.airballoon.admin.config.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/** Write model used by POST /api/admin/config (draft) and /api/admin/config/validate. */
public record GameConfigurationWriteRequest(
    @NotBlank(message = "Обязательно укажите gameId") @Size(max = 100, message = "gameId не длиннее 100 символов") String gameId,
    @NotBlank(message = "Укажите название игры") @Size(max = 200, message = "Название игры не длиннее 200 символов") String gameName,
    @NotBlank(message = "Укажите gameType") @Pattern(regexp = "CRASH", message = "gameType должен быть CRASH") String gameType,
    @NotNull(message = "Задайте состояние игры (isActive)") Boolean isActive,
    @NotNull(message = "Укажите revision") @Positive(message = "revision должно быть положительным числом") Long revision,
    @NotNull(message = "Задайте параметры краша") @Valid CrashSettingsDto crash,
    @NotNull(message = "Задайте настройки бустеров") @Valid BoosterSettingsDto boosters,
    @NotNull(message = "Задайте настройки очков") @Valid PointsSettingsDto points
) {}