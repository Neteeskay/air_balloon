package ru.airballoon.game.application.port;

import ru.airballoon.game.domain.GameEvent;

public interface GameEventPublisher {
    /** Ordered per round, at-least-once: consumers deduplicate (roundId, sequence). */
    void publish(GameEvent event);
}
