package ru.airballoon.game.application.port;

import ru.airballoon.game.domain.GameRound;
import java.util.Optional;
import java.util.UUID;

public interface RoundRepository {
    /** Upsert an immutable snapshot; repeated saves of the same sequence must be safe. */
    GameRound save(GameRound round);
    Optional<GameRound> findById(UUID id);
}
