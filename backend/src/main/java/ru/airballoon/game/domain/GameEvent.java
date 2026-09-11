package ru.airballoon.game.domain;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record GameEvent(Type type, UUID roundId, UUID userId, long sequence,
                        Instant timestamp, Map<String, Object> data, GameRound snapshot) {
    public GameEvent { data = Map.copyOf(data); }

    public enum Type {
        ROUND_STARTED, MULTIPLIER_UPDATE, LEVEL_REACHED, BOOSTER_ACTIVATED,
        CASHOUT_SUCCESS, CRASH, ROUND_FINISHED
    }
}
