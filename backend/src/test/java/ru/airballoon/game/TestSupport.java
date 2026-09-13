package ru.airballoon.game;

import ru.airballoon.game.application.GameService;
import ru.airballoon.game.application.port.*;
import ru.airballoon.game.domain.*;
import ru.airballoon.game.infrastructure.memory.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;

public final class TestSupport {
    public static final Instant START = Instant.parse("2026-09-11T00:00:00Z");
    public static BigDecimal dec(String value) { return new BigDecimal(value); }

    public static GameConfig config(String crash, int boosterLevel) {
        return config(crash, boosterLevel, "0.10");
    }

    public static GameConfig config(String crash, int boosterLevel, String growthRate) {
        return new GameConfig(dec(crash), dec(crash), 0.03, dec(growthRate), dec("1.00"), dec("1000.00"),
                150, theme(Theme.GREEN, boosterLevel), theme(Theme.RED, boosterLevel));
    }

    public static GameConfig.ThemeConfig theme(Theme theme, int boosterLevel) {
        String[] values = theme == Theme.GREEN
                ? new String[]{"1.2", "1.5", "2", "3", "4", "6", "8", "10", "12"}
                : new String[]{"1.2", "1.5", "2", "3", "4", "5", "6", "8", "10", "12", "16", "20"};
        List<BigDecimal> thresholds = Arrays.stream(values).map(BigDecimal::new).toList();
        List<BigDecimal> weights = new ArrayList<>();
        for (int i = 1; i <= theme.levels(); i++) weights.add(i == boosterLevel ? BigDecimal.ONE : BigDecimal.ZERO);
        return new GameConfig.ThemeConfig(thresholds, Collections.nCopies(theme.levels(), 100L), weights);
    }

    public static final class MutableClock extends Clock {
        private final AtomicReference<Instant> now = new AtomicReference<>(START);
        public void atMillis(long millis) { now.set(START.plusMillis(millis)); }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) {
            if (!zone.equals(ZoneOffset.UTC)) throw new IllegalArgumentException("Test clock is UTC");
            return this;
        }
        @Override public Instant instant() { return now.get(); }
    }

    public static final class Fixture {
        public final UUID user = UUID.randomUUID();
        public final MutableClock clock = new MutableClock();
        public final InMemoryRoundRepository repository = new InMemoryRoundRepository();
        public final FakeBalanceService balance = new FakeBalanceService(dec("1000.00"));
        public final List<GameEvent> events = new CopyOnWriteArrayList<>();
        public final List<GameRound> rewards = new CopyOnWriteArrayList<>();
        public final InMemoryGameConfigProvider configs;
        public final GameService service;

        public Fixture() { this(config("8.42", 3)); }
        public Fixture(GameConfig config) {
            configs = new InMemoryGameConfigProvider(config);
            service = new GameService(new RoundEngine(), configs, repository, balance, rewards::add,
                    events::add, () -> 42, clock);
        }

        public GameRound start(int booster) { return service.start(user, Theme.GREEN, dec("100.00"), booster); }
        public GameRound at(GameRound round, long millis) {
            clock.atMillis(millis);
            return service.get(user, round.id());
        }
        public long count(GameEvent.Type type) { return events.stream().filter(e -> e.type() == type).count(); }
    }
}
