package ru.airballoon.game.infrastructure.web;

import ru.airballoon.game.domain.*;
import java.math.BigDecimal;
import java.util.UUID;

public record FairnessView(UUID roundId, String status, String commitment, String algorithm, String format,
                           String serverSeed, BigDecimal crashMultiplier, Integer boosterLevel,
                           Boolean verified, String canonicalInput) {
    public static FairnessView from(GameRound r) {
        boolean revealed = r.status() == RoundStatus.FINISHED || r.status() == RoundStatus.CRASHED;
        return new FairnessView(r.id(), revealed ? "REVEALED" : "COMMITTED", r.fairnessCommitment(),
                "SHA-256", RoundFairness.FORMAT, revealed ? Long.toString(r.seed()) : null,
                revealed ? r.crashMultiplier() : null, revealed ? r.boosterLevel() : null,
                revealed ? RoundFairness.verify(r) : null,
                revealed ? RoundFairness.canonical(r.id(), r.seed(), r.crashMultiplier(), r.boosterLevel()) : null);
    }
}
