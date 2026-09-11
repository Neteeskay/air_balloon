package ru.hackathon.airballoon.game.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record CashoutResponse(
        UUID roundId,
        double multiplier,
        BigDecimal winnings,
        int cashoutPoints,
        int totalPoints,
        UUID configurationVersionId) {
}
