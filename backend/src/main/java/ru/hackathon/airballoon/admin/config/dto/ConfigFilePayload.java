package ru.hackathon.airballoon.admin.config.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Portable configuration payload used by the export/import endpoints.
 * The file format carries only the config content (no server-side revision/status metadata),
 * so an exported file can always be re-imported onto whatever revision is current.
 */
public record ConfigFilePayload(
    @NotBlank @Size(max = 100) String gameId,
    @NotBlank @Size(max = 200) String gameName,
    @NotBlank @Pattern(regexp = "CRASH") String gameType,
    @NotNull Boolean isActive,
    @NotNull @Valid CrashSettingsDto crash,
    @NotNull @Valid BoosterSettingsDto boosters,
    @NotNull @Valid PointsSettingsDto points
) {
    public GameConfigurationWriteRequest toWriteRequest(long revision) {
        return new GameConfigurationWriteRequest(gameId, gameName, gameType, isActive, revision, crash, boosters, points);
    }
}