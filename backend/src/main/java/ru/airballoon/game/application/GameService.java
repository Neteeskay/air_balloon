package ru.airballoon.game.application;

import ru.airballoon.game.application.port.*;
import ru.airballoon.game.domain.*;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.ArrayDeque;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.BiConsumer;

/** One authoritative process. No transport, Spring, or concrete storage dependency. */
public final class GameService {
    private final RoundEngine engine;
    private final GameConfigProvider configs;
    private final RoundRepository repository;
    private final BalanceService balances;
    private final RewardService rewards;
    private final GameEventPublisher events;
    private final SeedSource seeds;
    private final Clock clock;
    private final Map<UUID, Session> sessions = new ConcurrentHashMap<>();

    public GameService(RoundEngine engine, GameConfigProvider configs, RoundRepository repository,
                       BalanceService balances, RewardService rewards, GameEventPublisher events,
                       SeedSource seeds, Clock clock) {
        this.engine = engine; this.configs = configs; this.repository = repository;
        this.balances = balances; this.rewards = rewards; this.events = events; this.seeds = seeds; this.clock = clock;
    }

    public GameRound start(UUID userId, Theme theme, BigDecimal bet, int booster) {
        requireUser(userId);
        GameConfig config = configs.getCurrentConfig();
        engine.validateStart(theme, bet, booster, config);
        UUID id = UUID.randomUUID();
        // Prepare fallible random generation before debit; flight time begins after debit returns.
        long seed = seeds.nextSeed();
        balances.debitBet(userId, id, bet.setScale(2));
        RoundTransition start = engine.start(id, userId, theme, bet, booster, seed, config, clock.instant());
        Session s = new Session(start.round());
        s.lock.lock();
        try {
            sessions.put(id, s);
            commit(s, start);
            flush(s);
            return s.round;
        } finally { s.lock.unlock(); }
    }

    public GameRound cashout(UUID userId, UUID roundId) {
        Session s = owned(userId, roundId);
        s.lock.lock();
        try {
            flush(s);
            // Sample the clock AFTER acquiring the lock and finishing pending integration work.
            var handledAt = clock.instant();
            commit(s, engine.advance(s.round, handledAt));
            try { commit(s, engine.cashout(s.round, handledAt)); }
            catch (GameException rejection) {
                flush(s);
                throw rejection;
            }
            flush(s);
            return s.round;
        } finally { s.lock.unlock(); }
    }

    /** Snapshot recovery after reconnect; does not accept a client timestamp. */
    public GameRound get(UUID userId, UUID roundId) {
        Session s = owned(userId, roundId);
        s.lock.lock();
        try {
            flush(s);
            commit(s, engine.advance(s.round, clock.instant()));
            flush(s);
            return s.round;
        } finally { s.lock.unlock(); }
    }

    public void tick(UUID roundId) {
        Session s = sessions.get(roundId);
        if (s == null) return;
        s.lock.lock();
        try {
            flush(s);
            commit(s, engine.advance(s.round, clock.instant()));
            flush(s);
        } finally { s.lock.unlock(); }
    }

    /** A failed adapter for one round must not stop ticks for the remaining rounds. */
    public void tickAll(BiConsumer<UUID, RuntimeException> onFailure) {
        sessions.forEach((id, s) -> {
            if (s.round.status().flying() || s.pendingCount != 0) {
                try { tick(id); } catch (RuntimeException e) { onFailure.accept(id, e); }
            }
        });
    }

    private Session owned(UUID user, UUID id) {
        requireUser(user);
        Session s = sessions.get(id);
        if (s == null) {
            GameRound saved = repository.findById(id).orElseThrow(() ->
                    new GameException(GameError.ROUND_NOT_FOUND, "Round does not exist"));
            checkOwner(user, saved);
            // Recovery of unfinished settlements requires a durable outbox, owned by Backend #2.
            if (saved.status() != RoundStatus.FINISHED)
                throw new GameException(GameError.INTEGRATION_UNAVAILABLE, "Round requires owner-process recovery");
            s = sessions.computeIfAbsent(id, ignored -> new Session(saved));
        }
        checkOwner(user, s.round);
        return s;
    }

    private static void requireUser(UUID user) {
        if (user == null) throw new GameException(GameError.UNAUTHENTICATED, "Authenticated user is required");
    }

    private static void checkOwner(UUID user, GameRound round) {
        if (!user.equals(round.userId())) throw new GameException(GameError.FORBIDDEN_ROUND_ACCESS, "Round belongs to another user");
    }

    private void commit(Session s, RoundTransition transition) {
        if (transition.events().isEmpty()) return;
        // Fix state once. If an adapter fails, retry side effects, never recalculate a winning cashout.
        s.round = transition.round();
        s.pending.add(() -> repository.save(transition.round()));
        for (GameEvent event : transition.events()) {
            if (event.type() == GameEvent.Type.CASHOUT_SUCCESS)
                s.pending.add(() -> balances.creditWin(event.userId(), event.roundId(), event.snapshot().winAmount()));
            if (event.type() == GameEvent.Type.ROUND_FINISHED)
                s.pending.add(() -> rewards.onRoundFinished(event.snapshot()));
            s.pending.add(() -> events.publish(event));
        }
        s.pendingCount = s.pending.size();
    }

    private void flush(Session s) {
        while (!s.pending.isEmpty()) {
            try { s.pending.getFirst().run(); }
            catch (RuntimeException ex) {
                throw new GameException(GameError.INTEGRATION_UNAVAILABLE,
                        "Round " + s.round.id() + " has pending integration work; retry or reconnect", ex);
            }
            s.pending.removeFirst();
            s.pendingCount = s.pending.size();
        }
    }

    private static final class Session {
        final ReentrantLock lock = new ReentrantLock();
        final ArrayDeque<Runnable> pending = new ArrayDeque<>();
        volatile GameRound round;
        volatile int pendingCount;
        Session(GameRound round) { this.round = round; }
    }
}
