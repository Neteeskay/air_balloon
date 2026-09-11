package ru.airballoon.game.infrastructure.memory;

import ru.airballoon.game.application.port.RoundRepository;
import ru.airballoon.game.domain.GameRound;
import ru.airballoon.game.domain.RoundStatus;
import java.time.*;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class InMemoryRoundRepository implements RoundRepository {
    private final Map<UUID, GameRound> rounds = new ConcurrentHashMap<>();
    private final Map<UUID, Instant> expiry = new ConcurrentHashMap<>();
    private final Clock clock;
    private final Duration retention;
    public InMemoryRoundRepository() { this(Clock.systemUTC(), Duration.ofHours(24)); }
    public InMemoryRoundRepository(Clock clock, Duration retention) {
        if (retention.isNegative() || retention.isZero()) throw new IllegalArgumentException("Invalid snapshot retention");
        this.clock = clock; this.retention = retention;
    }

    public GameRound save(GameRound round) {
        if (round.status() == RoundStatus.FINISHED) expiry.putIfAbsent(round.id(), clock.instant().plus(retention));
        return rounds.compute(round.id(), (id, old) -> old == null || old.sequence() <= round.sequence() ? round : old);
    }

    public Optional<GameRound> findById(UUID id) {
        Instant until = expiry.get(id);
        if (until != null && !clock.instant().isBefore(until)) return Optional.empty();
        return Optional.ofNullable(rounds.get(id));
    }
    public void cleanup(Instant now) {
        expiry.forEach((id, until) -> {
            if (!now.isBefore(until) && expiry.remove(id, until)) rounds.remove(id);
        });
    }
    public int retainedRounds() { return rounds.size(); }
}
