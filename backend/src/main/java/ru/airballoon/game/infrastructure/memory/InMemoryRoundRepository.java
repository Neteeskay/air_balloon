package ru.airballoon.game.infrastructure.memory;

import ru.airballoon.game.application.port.RoundRepository;
import ru.airballoon.game.domain.GameRound;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class InMemoryRoundRepository implements RoundRepository {
    private final Map<UUID, GameRound> rounds = new ConcurrentHashMap<>();

    public GameRound save(GameRound round) {
        return rounds.compute(round.id(), (id, old) -> old == null || old.sequence() <= round.sequence() ? round : old);
    }

    public Optional<GameRound> findById(UUID id) { return Optional.ofNullable(rounds.get(id)); }
}
