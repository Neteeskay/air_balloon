package ru.airballoon.game;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import ru.airballoon.game.domain.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import static org.assertj.core.api.Assertions.*;
import static ru.airballoon.game.TestSupport.*;
import static ru.airballoon.game.domain.GameEvent.Type.*;

@Timeout(20)
class ReliabilityTest {
    static IntStream seeds() { return IntStream.range(0, 100); }
    @ParameterizedTest(name = "deterministic round seed={0}") @MethodSource("seeds")
    void hundredDeterministicRoundsFinishWithValidBoundsTransitionsSequenceAndProof(int seed) {
        var base = config("30", 3);
        var config = new GameConfig(dec("1.01"), dec("30"), 2, base.growthPerSecond(), base.minBet(), base.maxBet(),
                base.boosterPointsPerMultiplier(), base.green(), base.red());
        var engine = new RoundEngine(); UUID id = UUID.randomUUID(), user = UUID.randomUUID();
        Theme theme = seed % 2 == 0 ? Theme.GREEN : Theme.RED; int booster = seed % 4 + 1;
        var first = engine.start(id, user, theme, dec("100"), booster, seed, config, START);
        assertThat(first).isEqualTo(engine.start(id, user, theme, dec("100"), booster, seed, config, START));
        List<GameEvent> events = new ArrayList<>(first.events()); GameRound r = first.round();
        assertThat(r.crashMultiplier()).isBetween(dec("1.01"), dec("30"));
        if (booster == 1) assertThat(r.boosterLevel()).isNull();
        else assertThat(r.boosterLevel()).isBetween(1, theme.levels());
        for (int millis = 1234; r.status().flying() && millis < 400000; millis += 1234) {
            var t = engine.advance(r, START.plusMillis(millis)); r = t.round(); events.addAll(t.events());
        }
        assertThat(r.status()).isEqualTo(RoundStatus.FINISHED); assertThat(RoundFairness.verify(r)).isTrue();
        assertThat(events.stream().map(GameEvent::sequence)).containsExactlyElementsOf(java.util.stream.LongStream.rangeClosed(1, events.size()).boxed().toList());
        assertThat(events.stream().filter(e -> e.type() == CRASH)).hasSize(1);
        assertThat(events.stream().filter(e -> e.type() == ROUND_FINISHED)).hasSize(1);
        assertThat(events.getFirst().snapshot().status()).isEqualTo(RoundStatus.RUNNING);
        assertThat(events.get(events.size() - 2).snapshot().status()).isEqualTo(RoundStatus.CRASHED);
        assertThat(events.getLast().snapshot().status()).isEqualTo(RoundStatus.FINISHED);
        assertThat(engine.advance(r, START.plusSeconds(1000)).events()).isEmpty();
    }

    @Test void hundredConcurrentActiveRoundsStayIndependentAndFinishExactlyOnce() throws Exception {
        var f = new ResilienceSupport(); List<GameRound> rounds = new CopyOnWriteArrayList<>();
        try (var pool = Executors.newFixedThreadPool(16)) {
            List<Callable<Void>> starts = new ArrayList<>();
            for (int i = 0; i < 100; i++) {
                final int index = i;
                starts.add(() -> { rounds.add(f.service.start(UUID.randomUUID(), index % 2 == 0 ? Theme.GREEN : Theme.RED, dec("100"), index % 4 + 1)); return null; });
            }
            for (var future : pool.invokeAll(starts)) future.get(5, TimeUnit.SECONDS);
            assertThat(f.service.activeRoundCount()).isEqualTo(100);
            f.clock.atMillis(3000);
            List<Callable<GameRound>> cashouts = rounds.stream().<Callable<GameRound>>map(r -> () -> f.service.cashout(r.userId(), r.id())).toList();
            for (var future : pool.invokeAll(cashouts)) assertThat(future.get().status()).isEqualTo(RoundStatus.CASHED_OUT);
            f.clock.atMillis(100000);
            List<Callable<Void>> finishes = rounds.stream().<Callable<Void>>map(r -> () -> { f.service.tick(r.id()); return null; }).toList();
            for (var future : pool.invokeAll(finishes)) future.get(5, TimeUnit.SECONDS);
        }
        assertThat(f.service.activeRoundCount()).isZero(); assertThat(f.rewarded).hasSize(100);
        for (var r : rounds) {
            var finalRound = f.service.get(r.userId(), r.id());
            assertThat(finalRound.status()).isEqualTo(RoundStatus.FINISHED); assertThat(RoundFairness.verify(finalRound)).isTrue();
            assertThat(f.balances.creditCount(r.userId())).isEqualTo(1);
            var events = f.service.replay(r.userId(), r.id(), 0).events();
            assertThat(events).allMatch(e -> e.roundId().equals(r.id()) && e.userId().equals(r.userId()));
            assertThat(events.stream().map(GameEvent::sequence)).isSorted().doesNotHaveDuplicates();
            assertThat(events.stream().filter(e -> e.type() == CRASH)).hasSize(1);
            assertThat(events.stream().filter(e -> e.type() == ROUND_FINISHED)).hasSize(1);
        }
        assertThat(f.published.stream().map(GameEvent::eventId)).doesNotHaveDuplicates();
        assertThat(f.service.activeRoundCount()).isZero();
    }

    @Test void slowRoundDoesNotBlockSchedulerAndRepeatedDispatchDoesNotQueueDuplicateWork() throws Exception {
        var f = new ResilienceSupport(); var entered = new CountDownLatch(1); var release = new CountDownLatch(1);
        var healthyTick = new CountDownLatch(1); var blockedCalls = new AtomicInteger(); UUID other = UUID.randomUUID();
        var service = f.service(f.balances, e -> {
            if (e.type() == MULTIPLIER_UPDATE && e.userId().equals(f.user)) {
                blockedCalls.incrementAndGet(); entered.countDown();
                try { if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Release timeout"); }
                catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw new IllegalStateException(ex); }
            }
            if (e.type() == MULTIPLIER_UPDATE && e.userId().equals(other)) healthyTick.countDown();
        }, f.checkpoints);
        service.start(f.user, Theme.GREEN, dec("100"), 1); service.start(other, Theme.RED, dec("100"), 1);
        f.clock.atMillis(1000); List<RuntimeException> errors = new CopyOnWriteArrayList<>();
        try (var workers = Executors.newVirtualThreadPerTaskExecutor()) {
            try {
                service.tickAll((id, e) -> errors.add(e), workers);
                assertThat(entered.await(3, TimeUnit.SECONDS)).isTrue();
                assertThat(healthyTick.await(2, TimeUnit.SECONDS)).isTrue();
                for (int i = 0; i < 100; i++) service.tickAll((id, e) -> errors.add(e), workers);
                assertThat(blockedCalls).hasValue(1);
            } finally { release.countDown(); }
        }
        assertThat(errors).isEmpty();
    }

    @Test void failedSchedulerRoundDoesNotKillHealthyRoundsOrLaterDispatches() throws Exception {
        var f = new ResilienceSupport(); var failed = new CountDownLatch(1); var healthy = new CountDownLatch(1);
        UUID other = UUID.randomUUID();
        var service = f.service(f.balances, e -> {
            if (e.type() == MULTIPLIER_UPDATE && e.userId().equals(f.user)) throw new IllegalStateException("Unavailable consumer");
            if (e.type() == ROUND_FINISHED && e.userId().equals(other)) healthy.countDown();
        }, f.checkpoints);
        service.start(f.user, Theme.GREEN, dec("100"), 1);
        var r = service.start(other, Theme.RED, dec("100"), 1); f.clock.atMillis(1000);
        try (var workers = Executors.newVirtualThreadPerTaskExecutor()) {
            service.tickAll((id, e) -> failed.countDown(), workers);
            assertThat(failed.await(3, TimeUnit.SECONDS)).isTrue();
        }
        f.clock.atMillis(100000);
        try (var workers = Executors.newVirtualThreadPerTaskExecutor()) { service.tickAll((id, e) -> {}, workers); }
        assertThat(healthy.await(3, TimeUnit.SECONDS)).isTrue();
        assertThat(service.get(other, r.id()).status()).isEqualTo(RoundStatus.FINISHED);
    }
}
