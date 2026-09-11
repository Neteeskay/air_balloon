package ru.airballoon.game.domain;

import java.util.List;
import java.util.UUID;

/** PRIVATE recovery/outbox contract, never a public DTO. Config and seed are in round. */
public record RoundCheckpoint(int version, GameRound round, List<GameEvent> pendingEvents,
                              UUID cashoutKey, GameRound cashoutResult) {
    public static final int VERSION = 1;
    public RoundCheckpoint {
        if (version != VERSION || round == null || !RoundFairness.verify(round))
            throw new IllegalArgumentException("Unsupported or invalid round checkpoint");
        pendingEvents = List.copyOf(pendingEvents);
    }
}
