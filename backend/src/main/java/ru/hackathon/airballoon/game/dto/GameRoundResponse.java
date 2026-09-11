package ru.hackathon.airballoon.game.dto;

import ru.hackathon.airballoon.config.domain.GameTheme;
import ru.hackathon.airballoon.game.domain.RoundStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record GameRoundResponse(
        UUID id,
        UUID roundId,
        UUID configurationVersionId,
        long configurationRevision,
        GameTheme theme,
        int boosterTier,
        Integer boosterLevel,
        BigDecimal bet,
        RoundStatus status,
        int crossedLevels,
        int totalPoints,
        boolean boosterActivated,
        Instant startedAt) {
}
