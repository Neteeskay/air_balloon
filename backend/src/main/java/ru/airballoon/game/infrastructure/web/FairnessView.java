package ru.airballoon.game.infrastructure.web;

import ru.airballoon.game.domain.*;
import java.math.BigDecimal;
import java.util.UUID;

public record FairnessView(UUID roundId, String status, String commitment, String algorithm, String format,
                           String serverSeed, BigDecimal crashMultiplier, Integer boosterLevel,
                           Boolean verified, String canonicalInput,
                           String formulaVersion, BigDecimal uniformSample,
                           BigDecimal calculatedCrashMultiplier, Boolean formulaVerified,
                           BigDecimal minCrashMultiplier, BigDecimal maxCrashMultiplier,
                           BigDecimal alpha, String theme, Integer boosterMultiplier) {
    public static FairnessView from(GameRound r) {
        boolean revealed = r.status() == RoundStatus.FINISHED || r.status() == RoundStatus.CRASHED;
        BigDecimal sample = revealed ? CrashPointGenerator.uniformSample(r.theme(), r.boosterMultiplier(), r.seed()) : null;
        BigDecimal calculated = revealed ? new CrashPointGenerator().generate(r.config(), r.theme(), r.boosterMultiplier(), r.seed()) : null;
        return new FairnessView(r.id(), revealed ? "REVEALED" : "COMMITTED", r.fairnessCommitment(),
                "SHA-256", RoundFairness.FORMAT, revealed ? Long.toString(r.seed()) : null,
                revealed ? r.crashMultiplier() : null, revealed ? r.boosterLevel() : null,
                revealed ? RoundFairness.verify(r) : null,
                revealed ? RoundFairness.canonical(r.id(), r.seed(), r.crashMultiplier(), r.boosterLevel()) : null,
                revealed ? r.config().crashMathModel().name() : null, sample, calculated,
                revealed ? calculated.compareTo(r.crashMultiplier()) == 0 : null,
                revealed ? r.config().minCrashMultiplier() : null,
                revealed ? r.config().maxCrashMultiplier() : null,
                revealed ? r.config().alpha() : null, revealed ? r.theme().name() : null,
                revealed ? r.boosterMultiplier() : null);
    }
}
