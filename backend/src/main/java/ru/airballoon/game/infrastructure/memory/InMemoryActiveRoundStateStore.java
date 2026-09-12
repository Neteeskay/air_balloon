package ru.airballoon.game.infrastructure.memory;

import ru.airballoon.game.application.port.ActiveRoundStateStore;
import ru.airballoon.game.domain.RoundCheckpoint;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public final class InMemoryActiveRoundStateStore implements ActiveRoundStateStore {
    private final Map<UUID, Entry> rounds = new ConcurrentHashMap<>();
    private final Duration retention;
    public InMemoryActiveRoundStateStore(Duration retention) {
        if (retention.isZero() || retention.isNegative()) throw new IllegalArgumentException("Invalid checkpoint retention");
        this.retention = retention;
    }
    public void saveCheckpoint(RoundCheckpoint checkpoint) {
        rounds.compute(checkpoint.round().id(), (id, old) -> old != null && old.checkpoint.round().sequence() > checkpoint.round().sequence()
                ? old : new Entry(checkpoint, old == null ? null : old.expiresAt));
    }
    public Optional<RoundCheckpoint> load(UUID id) { return Optional.ofNullable(rounds.get(id)).map(Entry::checkpoint); }
    @Override public Collection<UUID> activeRoundIds() {
        return rounds.entrySet().stream().filter(e -> e.getValue().expiresAt == null)
                .map(Map.Entry::getKey).toList();
    }
    public void markFinished(UUID id, Instant now) {
        rounds.computeIfPresent(id, (ignored, e) -> e.expiresAt == null ? new Entry(e.checkpoint, now.plus(retention)) : e);
    }
    public void cleanup(Instant now) { rounds.entrySet().removeIf(e -> e.getValue().expiresAt != null && !now.isBefore(e.getValue().expiresAt)); }
    public int retainedRounds() { return rounds.size(); }
    private record Entry(RoundCheckpoint checkpoint, Instant expiresAt) {}
}
