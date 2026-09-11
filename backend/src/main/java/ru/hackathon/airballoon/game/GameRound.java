package ru.hackathon.airballoon.game;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Data contract only. Engine owns transitions, random generation and payout calculations.
 * version=-1 means a new record. roundScore is a read-only projection of score_events.
 */
public record GameRound(
    UUID id, UUID userId, Theme theme, long betAmount, int boosterTier,
    Integer boosterLevel, boolean boosterActivated, BigDecimal crashMultiplier,
    BigDecimal cashoutMultiplier, long winAmount, long roundScore, Status status,
    String seed, String fairnessHash, long configVersion, long version,
    Instant createdAt, Instant startedAt, Instant cashoutAt, Instant crashedAt, Instant finishedAt
) {
    public enum Theme { RED, GREEN }
    public enum Status { CREATED, RUNNING, CASHED_OUT, CRASHED, FINISHED }
}
