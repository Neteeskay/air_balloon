package ru.airballoon.game.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Canonical cashout amount calculation shared by live previews and settlement. */
public final class PayoutCalculator {
    private PayoutCalculator() {}

    public static BigDecimal calculate(GameRound round, BigDecimal multiplier) {
        if (round == null || multiplier == null)
            throw new IllegalArgumentException("Round and multiplier are required");
        return round.betAmount().multiply(multiplier)
                .setScale(round.config().effectiveEconomyScale(), RoundingMode.DOWN);
    }

    public static BigDecimal calculate(GameRound round) {
        return calculate(round, round.currentMultiplier());
    }
}
