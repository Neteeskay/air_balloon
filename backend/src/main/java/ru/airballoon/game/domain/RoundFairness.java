package ru.airballoon.game.domain;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

/** Versioned, locale-independent UTF-8 format. All values have restricted alphabets. */
public final class RoundFairness {
    public static final String FORMAT = "air-balloon-fairness:v1";
    private RoundFairness() {}

    public static String canonical(UUID roundId, long seed, BigDecimal crash, Integer boosterLevel) {
        return FORMAT + "\nroundId=" + roundId + "\nserverSeed=" + seed
                + "\ncrashMultiplier=" + crash.stripTrailingZeros().toPlainString()
                + "\nboosterLevel=" + (boosterLevel == null ? "null" : boosterLevel) + "\n";
    }

    public static String commitment(UUID id, long seed, BigDecimal crash, Integer boosterLevel) {
        try {
            byte[] bytes = canonical(id, seed, crash, boosterLevel).getBytes(StandardCharsets.UTF_8);
            return "sha256:" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException("SHA-256 unavailable", e); }
    }

    public static boolean verify(String original, UUID id, long seed, BigDecimal crash, Integer boosterLevel) {
        return commitment(id, seed, crash, boosterLevel).equals(original);
    }

    public static boolean verify(GameRound r) {
        return verify(r.fairnessCommitment(), r.id(), r.seed(), r.crashMultiplier(), r.boosterLevel());
    }
}
