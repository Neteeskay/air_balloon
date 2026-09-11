package ru.airballoon.game.application.port;

import ru.airballoon.game.domain.RoundCheckpoint;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Backend #2 can replace this with a durable checkpoint/outbox adapter. Single writer per round. */
public interface ActiveRoundStateStore {
    void saveCheckpoint(RoundCheckpoint checkpoint);
    Optional<RoundCheckpoint> load(UUID roundId);
    void markFinished(UUID roundId, Instant now);
    void cleanup(Instant now);
}
