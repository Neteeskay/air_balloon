package ru.airballoon.game.domain;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record GameEvent(Type type, UUID roundId, UUID userId, long sequence,
                        Instant timestamp, Map<String, Object> data, GameRound snapshot, Instant serverTime) {
    public GameEvent(Type type, UUID roundId, UUID userId, long sequence, Instant timestamp,
                     Map<String, Object> data, GameRound snapshot) {
        this(type, roundId, userId, sequence, timestamp, data, snapshot, timestamp);
    }
    public GameEvent { data = Map.copyOf(data); }

    /** Stable across retries, replay and process recovery. */
    public String eventId() { return roundId + ":" + sequence; }

    public boolean checkpointRequired() { return type != Type.MULTIPLIER_UPDATE; }

    public enum Type {
        ROUND_STARTED, MULTIPLIER_UPDATE, LEVEL_REACHED, BOOSTER_ACTIVATED,
        CASHOUT_SUCCESS, CRASH, ROUND_FINISHED
    }
}
