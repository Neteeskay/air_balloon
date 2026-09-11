package ru.hackathon.airballoon.game.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import ru.hackathon.airballoon.game.domain.RoundStatus;

import java.math.BigDecimal;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record RoundStateResponse(
        UUID roundId,
        RoundStatus status,
        double currentMultiplier,
        Integer crossedLevels,
        Integer totalPoints,
        Boolean boosterActivated,
        Double crashPoint,
        Double cashoutMultiplier,
        BigDecimal winnings,
        UUID configurationVersionId) {
}
