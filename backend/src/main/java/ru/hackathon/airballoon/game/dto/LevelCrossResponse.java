package ru.hackathon.airballoon.game.dto;

import java.util.UUID;

public record LevelCrossResponse(
        UUID roundId,
        int level,
        int pointsAwarded,
        int totalPoints,
        boolean boosterActivated,
        Double boosterMultiplier,
        UUID configurationVersionId) {
}
