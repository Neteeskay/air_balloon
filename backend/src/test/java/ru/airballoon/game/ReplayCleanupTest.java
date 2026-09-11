package ru.airballoon.game;

import org.junit.jupiter.api.Test;
import ru.airballoon.game.domain.*;
import ru.airballoon.game.infrastructure.web.RoundEventView;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static ru.airballoon.game.TestSupport.*;

class ReplayCleanupTest {
    @Test void boundedReplayReportsGapAndProvidesOrderedTail() {
        var f = new ResilienceSupport(3); var r = f.start(1);
        for (int i = 1; i <= 10; i++) { f.clock.atMillis(i * 100); f.service.tick(r.id()); }
        var page = f.service.replay(f.user, r.id(), 0);
        assertThat(page.events()).hasSize(3); assertThat(page.snapshotRequired()).isTrue();
        assertThat(page.oldestAvailableSequence()).isEqualTo(9); assertThat(page.latestSequence()).isEqualTo(11);
        assertThat(page.events()).extracting(GameEvent::sequence).containsExactly(9L, 10L, 11L);
        assertThat(f.service.replay(f.user, r.id(), 9).events()).extracting(GameEvent::sequence).containsExactly(10L, 11L);
        assertThat(f.service.replay(f.user, r.id(), 8).snapshotRequired()).isFalse();
        assertThat(f.service.replay(f.user, r.id(), 11).events()).isEmpty();
        assertThat(f.service.replay(f.user, r.id(), 999).snapshotRequired()).isTrue();
        assertThatThrownBy(() -> f.service.replay(f.user, r.id(), -1)).isInstanceOf(GameException.class);
    }
    @Test void outOfOrderTenTwelveElevenAndDuplicatesHaveUnambiguousDecisions() {
        UUID id = UUID.randomUUID(); var cursor = new EventCursor(id, 9);
        assertThat(cursor.accept(id, 10)).isEqualTo(EventCursor.Decision.ACCEPT);
        assertThat(cursor.accept(id, 12)).isEqualTo(EventCursor.Decision.GAP);
        assertThat(cursor.accept(id, 11)).isEqualTo(EventCursor.Decision.STALE);
        assertThat(cursor.accept(id, 12)).isEqualTo(EventCursor.Decision.STALE);
        assertThat(cursor.accept(UUID.randomUUID(), 13)).isEqualTo(EventCursor.Decision.WRONG_ROUND);
        assertThat(cursor.sequence()).isEqualTo(12);
    }
    @Test void replayEnvelopeMatchesRealtimeIncludingStableIdAndServerTime() {
        var f = new ResilienceSupport(); var r = f.start(3); f.clock.atMillis(10000); f.service.tick(r.id());
        var replay = f.service.replay(f.user, r.id(), 0).events();
        assertThat(replay.stream().map(RoundEventView::from)).containsExactlyElementsOf(f.published.stream().map(RoundEventView::from).toList());
        var level = replay.stream().filter(e -> e.type() == GameEvent.Type.LEVEL_REACHED).findFirst().orElseThrow();
        assertThat(level.timestamp()).isEqualTo(START.plusSeconds(2));
        assertThat(level.serverTime()).isEqualTo(START.plusSeconds(10));
        assertThat(level.eventId()).isEqualTo(r.id() + ":" + level.sequence());
    }
    @Test void finishedSessionsStopTicksAndTtlReleasesReplayThenSnapshotsAndCheckpoints() {
        var f = new ResilienceSupport(); var r = f.start(3);
        f.clock.atMillis(100000); f.service.tick(r.id());
        int count = f.published.size();
        assertThat(f.service.activeRoundCount()).isZero();
        f.service.tick(r.id()); f.service.tickAll((id, error) -> { throw error; });
        assertThat(f.published).hasSize(count);
        f.clock.atMillis(100000 + 15 * 60000 + 1); f.service.cleanup();
        assertThat(f.replay.retainedRounds()).isZero();
        assertThat(f.service.replay(f.user, r.id(), 0).snapshotRequired()).isTrue();
        assertThat(RoundFairness.verify(f.service.get(f.user, r.id()))).isTrue();
        assertThat(f.service.activeRoundCount()).isZero();
        f.clock.atMillis(100000 + 24 * 3600000 + 1); f.service.cleanup();
        assertThat(f.checkpoints.retainedRounds()).isZero(); assertThat(f.repository.retainedRounds()).isZero();
        assertThatThrownBy(() -> f.service.get(f.user, r.id())).isInstanceOf(GameException.class);
    }
    @Test void unfinishedRoundsAreNotRemovedByRetentionCleanup() {
        var f = new ResilienceSupport(); var r = f.start(3);
        f.clock.atMillis(25 * 3600000); f.service.cleanup();
        assertThat(f.replay.retainedRounds()).isEqualTo(1); assertThat(f.checkpoints.retainedRounds()).isEqualTo(1);
        assertThat(f.repository.findById(r.id())).isPresent(); assertThat(f.service.activeRoundCount()).isEqualTo(1);
    }
    @Test void concurrentSameCashoutKeyReturnsOneFixedResult() throws Exception {
        var f = new ResilienceSupport(); var r = f.start(1); var key = UUID.randomUUID(); f.clock.atMillis(3000);
        try (var pool = Executors.newFixedThreadPool(8)) {
            List<Callable<GameRound>> calls = new ArrayList<>();
            for (int i = 0; i < 50; i++) calls.add(() -> f.service.cashout(f.user, r.id(), key));
            Set<GameRound> results = new HashSet<>();
            for (var future : pool.invokeAll(calls)) results.add(future.get(5, TimeUnit.SECONDS));
            assertThat(results).hasSize(1);
        }
        assertThat(f.balances.creditCount(f.user)).isEqualTo(1);
        assertThatThrownBy(() -> f.service.cashout(f.user, r.id(), UUID.randomUUID())).isInstanceOf(GameException.class);
    }
}
