package ru.airballoon.game.infrastructure.memory;

import ru.airballoon.game.application.port.RoundEventStore;
import ru.airballoon.game.domain.*;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public final class InMemoryRoundEventStore implements RoundEventStore {
    private final Map<UUID, Buffer> rounds = new ConcurrentHashMap<>();
    private final int limit;
    private final Duration retention;
    public InMemoryRoundEventStore(int limit, Duration retention) {
        if (limit < 1 || retention.isNegative() || retention.isZero()) throw new IllegalArgumentException("Invalid replay policy");
        this.limit = limit; this.retention = retention;
    }
    public void append(GameEvent event) {
        rounds.compute(event.roundId(), (id, buffer) -> {
            Buffer b = buffer == null ? new Buffer() : buffer;
            synchronized (b) {
                if (!b.events.isEmpty() && b.events.getLast().sequence() >= event.sequence()) return b;
                b.events.addLast(event);
                while (b.events.size() > limit) b.events.removeFirst();
            }
            return b;
        });
    }
    public RoundEventPage findAfter(UUID id, long sequence) {
        Buffer b = rounds.get(id);
        if (b == null) return new RoundEventPage(List.of(), 0, 0, true);
        synchronized (b) {
            long oldest = b.events.getFirst().sequence(), latest = b.events.getLast().sequence();
            return new RoundEventPage(b.events.stream().filter(e -> e.sequence() > sequence).toList(),
                    oldest, latest, sequence < oldest - 1 || sequence > latest);
        }
    }
    public Optional<GameEvent> latest(UUID id) {
        Buffer b = rounds.get(id);
        if (b == null) return Optional.empty();
        synchronized (b) { return Optional.of(b.events.getLast()); }
    }
    public void markFinished(UUID id, Instant now) {
        rounds.computeIfPresent(id, (ignored, b) -> { if (b.expiresAt == null) b.expiresAt = now.plus(retention); return b; });
    }
    public void cleanup(Instant now) { rounds.entrySet().removeIf(e -> e.getValue().expiresAt != null && !now.isBefore(e.getValue().expiresAt)); }
    public int retainedRounds() { return rounds.size(); }
    private static final class Buffer {
        final ArrayDeque<GameEvent> events = new ArrayDeque<>();
        volatile Instant expiresAt;
    }
}
