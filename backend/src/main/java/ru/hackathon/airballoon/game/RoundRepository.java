package ru.hackathon.airballoon.game;

import java.util.Optional;
import java.util.UUID;
public interface RoundRepository {
    GameRound save(GameRound round);
    Optional<GameRound> findById(UUID id);
    /** Must be called inside a short transaction; lock order: round, then user. */
    GameRound lockById(UUID id);
}
