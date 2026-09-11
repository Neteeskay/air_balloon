package ru.hackathon.airballoon.game.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import ru.hackathon.airballoon.config.domain.GameTheme;

import java.math.BigDecimal;

public record GameRoundStartRequest(
        @NotNull GameTheme theme,
        @NotNull @Min(1) @Max(4) Integer boosterTier,
        @NotNull @DecimalMin(value = "0.01") BigDecimal bet) {
}
