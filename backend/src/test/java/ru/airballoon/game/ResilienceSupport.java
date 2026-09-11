package ru.airballoon.game;

import ru.airballoon.game.application.GameService;
import ru.airballoon.game.application.port.*;
import ru.airballoon.game.domain.*;
import ru.airballoon.game.infrastructure.memory.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import static ru.airballoon.game.TestSupport.*;

final class ResilienceSupport {
    final MutableClock clock = new MutableClock();
    final InMemoryRoundRepository repository = new InMemoryRoundRepository(clock, Duration.ofHours(24));
    final FakeBalanceService balances = new FakeBalanceService(dec("1000"));
    final InMemoryGameConfigProvider configs = new InMemoryGameConfigProvider(config("8.42", 3));
    final InMemoryRoundEventStore replay;
    final InMemoryActiveRoundStateStore checkpoints = new InMemoryActiveRoundStateStore(Duration.ofHours(24));
    final List<GameEvent> published = new CopyOnWriteArrayList<>();
    final Set<UUID> rewarded = java.util.concurrent.ConcurrentHashMap.newKeySet();
    final UUID user = UUID.randomUUID();
    final GameService service;
    ResilienceSupport() { this(256); }
    ResilienceSupport(int limit) {
        replay = new InMemoryRoundEventStore(limit, Duration.ofMinutes(15));
        service = service(balances, published::add, checkpoints);
    }
    GameService service(BalanceService balance, GameEventPublisher publisher, ActiveRoundStateStore store) {
        return new GameService(new RoundEngine(), configs, repository, balance, r -> rewarded.add(r.id()),
                publisher, () -> 42, clock, replay, store);
    }
    GameService restart() { return service(balances, published::add, checkpoints); }
    GameRound start(int booster) { return service.start(user, Theme.GREEN, dec("100"), booster); }
}
