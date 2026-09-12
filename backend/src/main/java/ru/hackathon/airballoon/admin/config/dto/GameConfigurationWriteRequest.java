package ru.hackathon.airballoon.admin.config.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/** Write model used by POST /api/admin/config (draft) and /api/admin/config/validate. */
public record GameConfigurationWriteRequest(
    @NotBlank @Size(max = 100) String gameId,
    @NotBlank @Size(max = 200) String gameName,
    @NotBlank @Pattern(regexp = "CRASH") String gameType,
    @NotNull Boolean isActive,
    @NotNull @Positive Long revision,
    @NotNull @Valid CrashSettingsDto crash,
    @NotNull @Valid BoosterSettingsDto boosters,
    @NotNull @Valid PointsSettingsDto points
) {}