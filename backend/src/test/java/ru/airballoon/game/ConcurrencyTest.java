package ru.airballoon.game;

import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import ru.airballoon.game.application.GameService;
import ru.airballoon.game.application.port.*;
import ru.airballoon.game.domain.*;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.assertj.core.api.Assertions.*;
import static ru.airballoon.game.TestSupport.*;
import static ru.airballoon.game.domain.GameEvent.Type.*;

@Timeout(15)
class ConcurrencyTest {
    @Test void oneStartKeyCreatesOneRoundAndOneDebitAcrossConcurrentRetries() throws Exception {
        var f = new Fixture(); UUID key = UUID.randomUUID();
        var results = concurrent(
                () -> f.service.start(f.user, Theme.GREEN, dec("100.00"), 2, key),
                () -> f.service.start(f.user, Theme.GREEN, dec("100.00"), 2, key));
        assertThat(results).extracting(GameRound::id).containsOnly(results.getFirst().id());
        assertThat(f.balance.balance(f.user)).isEqualByComparingTo("900.00");
        assertThat(f.count(ROUND_STARTED)).isEqualTo(1);
    }

    @Test void reusingStartKeyWithDifferentInputIsRejectedWithoutAnotherDebit() {
        var f = new Fixture(); UUID key = UUID.randomUUID();
        f.service.start(f.user, Theme.GREEN, dec("100.00"), 2, key);
        assertThatThrownBy(() -> f.service.start(f.user, Theme.RED, dec("100.00"), 2, key))
                .isInstanceOfSatisfying(GameException.class,
                        error -> assertThat(error.code()).isEqualTo(GameError.INVALID_REQUEST));
        assertThat(f.balance.balance(f.user)).isEqualByComparingTo("900.00");
        assertThat(f.count(ROUND_STARTED)).isEqualTo(1);
    }

    @Test void cashoutOneMillisecondBeforeCrashWinsEvenWithConcurrentTick() throws Exception {
        var f = new Fixture(config("2", 3)); var r = f.start(1); f.clock.atMillis(9999);
        concurrent(() -> attempt(() -> f.service.cashout(f.user, r.id())), () -> attempt(() -> f.service.tick(r.id())));
        assertThat(f.service.get(f.user, r.id()).cashoutMultiplier()).isEqualByComparingTo("1.9999");
        f.clock.atMillis(10000); f.service.tick(r.id());
        assertThat(f.service.get(f.user, r.id()).winAmount()).isEqualByComparingTo("199.99");
        assertThat(f.balance.creditCount(f.user)).isEqualTo(1);
    }

    @RepeatedTest(15) void twoSimultaneousCashoutsHaveOneWinner() throws Exception {
        var f = new Fixture(); var r = f.start(1); f.clock.atMillis(3000);
        var results = concurrent(() -> attempt(() -> f.service.cashout(f.user, r.id())),
                () -> attempt(() -> f.service.cashout(f.user, r.id())));
        assertThat(results).containsExactlyInAnyOrder("SUCCESS", "ALREADY_CASHED_OUT");
        assertThat(f.balance.creditCount(f.user)).isEqualTo(1);
        assertThat(f.count(CASHOUT_SUCCESS)).isEqualTo(1);
    }

    @RepeatedTest(15) void tickAndCashoutAtCrashBoundaryAlwaysLose() throws Exception {
        var f = new Fixture(config("2", 3)); var r = f.start(1); f.clock.atMillis(10000);
        var results = concurrent(() -> attempt(() -> f.service.cashout(f.user, r.id())),
                () -> attempt(() -> f.service.tick(r.id())));
        assertThat(results).contains("ROUND_ALREADY_CRASHED");
        assertThat(f.count(CRASH)).isEqualTo(1); assertThat(f.count(ROUND_FINISHED)).isEqualTo(1);
        assertThat(f.balance.creditCount(f.user)).isZero();
    }

    @RepeatedTest(10) void tickAndCashoutAtBoosterBoundaryAlwaysApplyBoosterFirst() throws Exception {
        var f = new Fixture(); var r = f.start(3); f.clock.atMillis(10000);
        concurrent(() -> attempt(() -> f.service.cashout(f.user, r.id())), () -> attempt(() -> f.service.tick(r.id())));
        var result = f.service.get(f.user, r.id());
        assertThat(result.cashoutMultiplier()).isEqualByComparingTo("6");
        assertThat(f.count(BOOSTER_ACTIVATED)).isEqualTo(1);
        assertThat(f.balance.creditCount(f.user)).isEqualTo(1);
        assertThat(f.events.stream().map(GameEvent::type)).containsSubsequence(BOOSTER_ACTIVATED, CASHOUT_SUCCESS);
    }

    @Test void manySimultaneousTicksCannotDuplicateLevelsOrBoosterOrCrash() throws Exception {
        var f = new Fixture(); var r = f.start(3); f.clock.atMillis(100000);
        try (var executor = Executors.newFixedThreadPool(8)) {
            CountDownLatch go = new CountDownLatch(1); List<Future<?>> futures = new ArrayList<>();
            for (int i = 0; i < 32; i++) futures.add(executor.submit(() -> { go.await(); f.service.tick(r.id()); return null; }));
            go.countDown(); for (var future : futures) future.get(5, TimeUnit.SECONDS);
        }
        assertThat(f.count(BOOSTER_ACTIVATED)).isEqualTo(1);
        assertThat(f.count(CRASH)).isEqualTo(1);
        assertThat(f.count(LEVEL_REACHED)).isEqualTo(7);
        assertThat(f.events.stream().map(GameEvent::sequence)).doesNotHaveDuplicates().isSorted();
    }

    @Test void slowSettlementForOneRoundDoesNotLockAnotherRound() throws Exception {
        var f = new Fixture(); CountDownLatch entered = new CountDownLatch(1); CountDownLatch release = new CountDownLatch(1);
        BalanceService slow = new BalanceService() {
            public void debitBet(UUID user, UUID round, BigDecimal amount) { f.balance.debitBet(user, round, amount); }
            public void creditWin(UUID user, UUID round, BigDecimal amount) {
                if (user.equals(f.user)) {
                    entered.countDown();
                    try { if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Test release timed out"); }
                    catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
                }
                f.balance.creditWin(user, round, amount);
            }
        };
        GameService service = service(f, slow, f.repository, f.events::add);
        var a = service.start(f.user, Theme.GREEN, dec("100"), 1); UUID other = UUID.randomUUID();
        var b = service.start(other, Theme.GREEN, dec("100"), 1); f.clock.atMillis(3000);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<?> first = executor.submit(() -> service.cashout(f.user, a.id()));
            try {
                assertThat(entered.await(3, TimeUnit.SECONDS)).isTrue();
                assertThat(executor.submit(() -> service.cashout(other, b.id())).get(2, TimeUnit.SECONDS).status())
                        .isEqualTo(RoundStatus.CASHED_OUT);
            } finally { release.countDown(); }
            first.get(3, TimeUnit.SECONDS);
        }
    }

    @Test void ambiguousCreditFailureRetriesSameAmountWithoutDuplicateMoney() {
        var f = new Fixture(); var fail = new AtomicBoolean(true);
        BalanceService flaky = new BalanceService() {
            public void debitBet(UUID user, UUID round, BigDecimal amount) { f.balance.debitBet(user, round, amount); }
            public void creditWin(UUID user, UUID round, BigDecimal amount) {
                f.balance.creditWin(user, round, amount);
                if (fail.getAndSet(false)) throw new IllegalStateException("Response lost after committed credit");
            }
        };
        var service = service(f, flaky, f.repository, f.events::add);
        var r = service.start(f.user, Theme.GREEN, dec("100"), 3); f.clock.atMillis(10100);
        assertThat(attempt(() -> service.cashout(f.user, r.id()))).isEqualTo("INTEGRATION_UNAVAILABLE");
        f.clock.atMillis(11000);
        assertThat(attempt(() -> service.cashout(f.user, r.id()))).isEqualTo("ALREADY_CASHED_OUT");
        f.clock.atMillis(100000); service.tick(r.id());
        assertThat(f.balance.creditCount(f.user)).isEqualTo(1);
        assertThat(f.balance.balance(f.user)).isEqualByComparingTo("1503.00");
        assertThat(f.count(CASHOUT_SUCCESS)).isEqualTo(1);
        assertThat(service.get(f.user, r.id()).winAmount()).isEqualByComparingTo("603.00");
    }

    @Test void failedSnapshotSaveKeepsFixedCashoutAndRetriesPersistenceBeforeCredit() {
        var f = new Fixture(); var fail = new AtomicBoolean(true);
        RoundRepository flaky = new RoundRepository() {
            public GameRound save(GameRound r) {
                if (r.status() == RoundStatus.CASHED_OUT && fail.getAndSet(false)) throw new IllegalStateException("Storage unavailable");
                return f.repository.save(r);
            }
            public Optional<GameRound> findById(UUID id) { return f.repository.findById(id); }
        };
        var service = service(f, f.balance, flaky, f.events::add);
        var r = service.start(f.user, Theme.GREEN, dec("100"), 1); f.clock.atMillis(3000);
        assertThat(attempt(() -> service.cashout(f.user, r.id()))).isEqualTo("INTEGRATION_UNAVAILABLE");
        assertThat(f.balance.creditCount(f.user)).isZero();
        f.clock.atMillis(4000); service.tick(r.id());
        assertThat(service.get(f.user, r.id()).winAmount()).isEqualByComparingTo("130.00");
        assertThat(f.balance.creditCount(f.user)).isEqualTo(1);
    }

    @Test void failingRoundDoesNotStopOtherTicks() {
        var f = new Fixture(); UUID other = UUID.randomUUID();
        var service = service(f, f.balance, f.repository, e -> {
            if (e.userId().equals(f.user) && e.type() == MULTIPLIER_UPDATE) throw new IllegalStateException("Unavailable consumer");
            f.events.add(e);
        });
        service.start(f.user, Theme.GREEN, dec("100"), 1);
        var b = service.start(other, Theme.GREEN, dec("100"), 1); f.clock.atMillis(3000);
        List<UUID> failures = new ArrayList<>(); service.tickAll((id, e) -> failures.add(id));
        assertThat(failures).hasSize(1);
        assertThat(service.get(other, b.id()).currentMultiplier()).isEqualByComparingTo("1.3");
    }

    private static GameService service(Fixture f, BalanceService balances, RoundRepository rounds, GameEventPublisher events) {
        return new GameService(new RoundEngine(), f.configs, rounds, balances, f.rewards::add, events, () -> 42, f.clock);
    }

    private static String attempt(Runnable action) {
        try { action.run(); return "SUCCESS"; } catch (GameException e) { return e.code().name(); }
    }

    private static <T> List<T> concurrent(Callable<T> a, Callable<T> b) throws Exception {
        try (var pool = Executors.newFixedThreadPool(2)) {
            var ready = new CountDownLatch(2); var go = new CountDownLatch(1);
            Callable<T> first = () -> { ready.countDown(); go.await(); return a.call(); };
            Callable<T> second = () -> { ready.countDown(); go.await(); return b.call(); };
            var af = pool.submit(first); var bf = pool.submit(second);
            assertThat(ready.await(3, TimeUnit.SECONDS)).isTrue(); go.countDown();
            return List.of(af.get(5, TimeUnit.SECONDS), bf.get(5, TimeUnit.SECONDS));
        }
    }
}
