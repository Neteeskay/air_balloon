package ru.airballoon.game.application.port;

import ru.airballoon.game.domain.RoundCheckpoint;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Backend #2 can replace this with a durable checkpoint/outbox adapter. Single writer per round. */
public interface ActiveRoundStateStore {
    void saveCheckpoint(RoundCheckpoint checkpoint);
    Optional<RoundCheckpoint> load(UUID roundId);
    default Collection<UUID> activeRoundIds() { return List.of(); }
    void markFinished(UUID roundId, Instant now);
    void cleanup(Instant now);
}
