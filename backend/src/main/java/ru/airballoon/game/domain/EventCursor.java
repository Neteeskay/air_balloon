package ru.airballoon.game.domain;

import java.util.UUID;

/** Example client reducer guard. A gap requires snapshot/replay before applying deltas. */
public final class EventCursor {
    public enum Decision { ACCEPT, STALE, GAP, WRONG_ROUND }
    private final UUID roundId;
    private long sequence;
    public EventCursor(UUID roundId, long snapshotSequence) { this.roundId = roundId; this.sequence = snapshotSequence; }
    public Decision accept(UUID id, long next) {
        if (!roundId.equals(id)) return Decision.WRONG_ROUND;
        if (next <= sequence) return Decision.STALE;
        boolean gap = next != sequence + 1;
        sequence = next;
        return gap ? Decision.GAP : Decision.ACCEPT;
    }
    public long sequence() { return sequence; }
}
