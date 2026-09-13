package ru.airballoon.game;

import org.junit.jupiter.api.Test;
import ru.airballoon.game.application.port.*;
import ru.airballoon.game.domain.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.*;
import static org.assertj.core.api.Assertions.*;
import static ru.airballoon.game.TestSupport.*;
import static ru.airballoon.game.domain.GameEvent.Type.*;

class RecoveryTest {
    @Test void checkpointSurvivesJsonRoundTripAsAStorageContract() throws Exception {
        var f = new ResilienceSupport(); var r = f.start(3); f.clock.atMillis(10000); f.service.tick(r.id());
        var mapper = com.fasterxml.jackson.databind.json.JsonMapper.builder().findAndAddModules().build();
        var original = f.checkpoints.load(r.id()).orElseThrow();
        var restored = mapper.readValue(mapper.writeValueAsBytes(original), RoundCheckpoint.class);
        assertThat(restored).isEqualTo(original);
        f.checkpoints.saveCheckpoint(restored); f.clock.atMillis(10100);
        assertThat(f.restart().recover(f.user, r.id()).roundScore()).isEqualTo(original.round().roundScore());
    }

    @Test void failedCheckpointWritePreventsPayoutAndRecoveryCanRetry() {
        var f = new ResilienceSupport(); var fail = new AtomicBoolean(true);
        ActiveRoundStateStore flaky = new ActiveRoundStateStore() {
            public void saveCheckpoint(RoundCheckpoint c) {
                if (c.round().status() == RoundStatus.CASHED_OUT && fail.getAndSet(false)) throw new IllegalStateException("Checkpoint unavailable");
                f.checkpoints.saveCheckpoint(c);
            }
            public Optional<RoundCheckpoint> load(UUID id) { return f.checkpoints.load(id); }
            public void markFinished(UUID id, Instant now) { f.checkpoints.markFinished(id, now); }
            public void cleanup(Instant now) { f.checkpoints.cleanup(now); }
        };
        var service = f.service(f.balances, f.published::add, flaky);
        var r = service.start(f.user, Theme.GREEN, dec("100"), 1); f.clock.atMillis(3000); var key = UUID.randomUUID();
        assertThatThrownBy(() -> service.cashout(f.user, r.id(), key)).isInstanceOf(GameException.class);
        assertThat(f.balances.creditCount(f.user)).isZero();
        assertThat(f.published.stream().filter(e -> e.type() == CASHOUT_SUCCESS)).isEmpty();
        f.clock.atMillis(4000);
        assertThat(service.cashout(f.user, r.id(), key).winAmount()).isEqualByComparingTo("134.98");
        assertThat(f.balances.creditCount(f.user)).isEqualTo(1);
    }

    @Test void recoveryUsesOriginalConfigAndKeepsTickHighWaterWithoutRepeatingLevelsOrBooster() {
        var f = new ResilienceSupport(); var r = f.start(3);
        f.clock.atMillis(10000); f.service.tick(r.id());
        var cp = f.checkpoints.load(r.id()).orElseThrow();
        f.clock.atMillis(10100); var before = f.service.get(f.user, r.id());
        assertThat(before.sequence()).isGreaterThan(cp.round().sequence());
        f.configs.replace(config("30", 8));
        var recovered = f.restart(); f.clock.atMillis(10200);
        var after = recovered.recover(f.user, r.id());
        var expected = new RoundEngine().advance(before, f.clock.instant()).round();
        assertThat(after).isEqualTo(expected);
        assertThat(f.published.stream().filter(e -> e.type() == BOOSTER_ACTIVATED)).hasSize(1);
        assertThat(f.published.stream().filter(e -> e.type() == LEVEL_REACHED).map(e -> e.data().get("level"))).doesNotHaveDuplicates();
        assertThat(f.published.stream().map(GameEvent::sequence)).isSorted().doesNotHaveDuplicates();
        assertThat(f.balances.balance(f.user)).isEqualByComparingTo("900");
    }

    @Test void recoveryCatchesUpAcrossCrashExactlyOnce() {
        var f = new ResilienceSupport(); var r = f.start(3);
        f.clock.atMillis(2000); f.service.tick(r.id());
        var recovered = f.restart(); f.clock.atMillis(100000);
        var finished = recovered.recover(f.user, r.id());
        assertThat(finished.status()).isEqualTo(RoundStatus.FINISHED);
        assertThat(RoundFairness.verify(finished)).isTrue();
        recovered.tick(r.id()); recovered.recover(f.user, r.id());
        assertThat(f.published.stream().filter(e -> e.type() == CRASH)).hasSize(1);
        assertThat(f.published.stream().filter(e -> e.type() == ROUND_FINISHED)).hasSize(1);
        assertThat(f.rewarded).containsExactly(r.id());
        assertThat(recovered.activeRoundCount()).isZero();
    }

    @Test void cashoutCheckpointRestoresSamePayoutAndIdempotencyKeyAfterRestartAndCrash() {
        var f = new ResilienceSupport(); var r = f.start(1); var key = UUID.randomUUID();
        f.clock.atMillis(3000); var payout = f.service.cashout(f.user, r.id(), key);
        var recovered = f.restart(); f.clock.atMillis(4000);
        var snapshot = recovered.recover(f.user, r.id());
        assertThat(snapshot.cashoutAt()).isEqualTo(payout.cashoutAt());
        assertThat(snapshot.winAmount()).isEqualTo(payout.winAmount());
        f.clock.atMillis(100000); recovered.tick(r.id());
        assertThat(recovered.cashout(f.user, r.id(), key)).isEqualTo(payout);
        assertThat(f.balances.creditCount(f.user)).isEqualTo(1);
    }

    @Test void ambiguousPayoutFailureRestartsFromWriteAheadCheckpointWithoutSecondCredit() {
        var f = new ResilienceSupport(); var fail = new AtomicBoolean(true);
        BalanceService flaky = new BalanceService() {
            public void debitBet(UUID u, UUID r, BigDecimal a) { f.balances.debitBet(u, r, a); }
            public void creditWin(UUID u, UUID r, BigDecimal a) {
                f.balances.creditWin(u, r, a);
                if (fail.getAndSet(false)) throw new IllegalStateException("Credit response lost");
            }
        };
        var first = f.service(flaky, f.published::add, f.checkpoints);
        var r = first.start(f.user, Theme.GREEN, dec("100"), 1); f.clock.atMillis(3000);
        UUID key = UUID.randomUUID();
        assertThatThrownBy(() -> first.cashout(f.user, r.id(), key)).isInstanceOf(GameException.class);
        var cp = f.checkpoints.load(r.id()).orElseThrow();
        assertThat(cp.pendingEvents()).extracting(GameEvent::type).contains(CASHOUT_SUCCESS);
        f.clock.atMillis(100000); var recovered = f.restart();
        var finished = recovered.recover(f.user, r.id());
        assertThat(finished.winAmount()).isEqualByComparingTo("134.98");
        assertThat(f.balances.creditCount(f.user)).isEqualTo(1);
        assertThat(recovered.cashout(f.user, r.id(), key).winAmount()).isEqualTo(finished.winAmount());
        assertThat(f.replay.findAfter(r.id(), 0).events().stream().map(GameEvent::eventId)).doesNotHaveDuplicates();
    }

    @Test void ambiguousEventDeliveryReusesEventIdAndClientCanDeduplicate() {
        var f = new ResilienceSupport(); var fail = new AtomicBoolean(true);
        var first = f.service(f.balances, e -> {
            f.published.add(e);
            if (e.type() == BOOSTER_ACTIVATED && fail.getAndSet(false)) throw new IllegalStateException("Delivery response lost");
        }, f.checkpoints);
        var r = first.start(f.user, Theme.GREEN, dec("100"), 3); f.clock.atMillis(10000);
        assertThatThrownBy(() -> first.tick(r.id())).isInstanceOf(GameException.class);
        var recovered = f.restart(); var result = recovered.recover(f.user, r.id());
        assertThat(result.boosterActivated()).isTrue();
        assertThat(result.roundScore()).isEqualTo(600);
        var delivered = f.published.stream().filter(e -> e.type() == BOOSTER_ACTIVATED).toList();
        assertThat(delivered).hasSize(2);
        assertThat(delivered.getFirst().eventId()).isEqualTo(delivered.getLast().eventId());
        assertThat(f.replay.findAfter(r.id(), 0).events().stream().filter(e -> e.type() == BOOSTER_ACTIVATED)).hasSize(1);
    }

    @Test void checkpointsAreNotWrittenForEveryMultiplierTick() {
        var f = new ResilienceSupport(); var writes = new AtomicInteger();
        ActiveRoundStateStore counted = new ActiveRoundStateStore() {
            public void saveCheckpoint(RoundCheckpoint c) { writes.incrementAndGet(); f.checkpoints.saveCheckpoint(c); }
            public Optional<RoundCheckpoint> load(UUID id) { return f.checkpoints.load(id); }
            public void markFinished(UUID id, Instant now) { f.checkpoints.markFinished(id, now); }
            public void cleanup(Instant now) { f.checkpoints.cleanup(now); }
        };
        var service = f.service(f.balances, f.published::add, counted);
        var r = service.start(f.user, Theme.GREEN, dec("100"), 1); int atStart = writes.get();
        for (int i = 1; i < 18; i++) { f.clock.atMillis(i * 100); service.tick(r.id()); }
        assertThat(writes).hasValue(atStart);
        f.clock.atMillis(1824); service.tick(r.id());
        assertThat(writes.get()).isGreaterThan(atStart);
    }

    @Test void ownerCheckPrecedesRecoveryOrReplaySideEffects() {
        var f = new ResilienceSupport(); var r = f.start(3); f.clock.atMillis(100000);
        var recovered = f.restart();
        assertThatThrownBy(() -> recovered.recover(UUID.randomUUID(), r.id())).isInstanceOf(GameException.class);
        assertThatThrownBy(() -> recovered.replay(UUID.randomUUID(), r.id(), 0)).isInstanceOf(GameException.class);
        assertThat(f.published).hasSize(1); assertThat(recovered.activeRoundCount()).isZero();
    }

    @Test void unsupportedCheckpointVersionFailsClosed() {
        var f = new ResilienceSupport(); var r = f.start(1);
        assertThatThrownBy(() -> new RoundCheckpoint(99, r, List.of(), null, null)).isInstanceOf(IllegalArgumentException.class);
    }
}
