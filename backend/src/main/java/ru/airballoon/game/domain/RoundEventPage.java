package ru.airballoon.game.domain;

import java.util.List;

public record RoundEventPage(List<GameEvent> events, long oldestAvailableSequence, long latestSequence,
                             boolean snapshotRequired) {
    public RoundEventPage { events = List.copyOf(events); }
}
