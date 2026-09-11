package ru.airballoon.game.application.port;

import ru.airballoon.game.domain.*;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Internal events contain secrets. Adapters must deduplicate (roundId, sequence). */
public interface RoundEventStore {
    void append(GameEvent event);
    RoundEventPage findAfter(UUID roundId, long sequence);
    Optional<GameEvent> latest(UUID roundId);
    void markFinished(UUID roundId, Instant now);
    void cleanup(Instant now);
}
