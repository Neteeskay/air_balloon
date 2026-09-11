package ru.hackathon.airballoon.concurrency;

import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import ru.hackathon.airballoon.support.TournamentIntegrationSupport;
import static org.assertj.core.api.Assertions.assertThat;

class TournamentConcurrencyIT extends TournamentIntegrationSupport {
    @Test void fiftyOutOfOrderAndDuplicateEventsKeepNewestAuthoritativeScore() throws Exception {
        UUID id = tournament(), user = UUID.randomUUID();
        List<Integer> versions = new ArrayList<>();
        for (int v = 1; v <= 25; v++) { versions.add(v); versions.add(v); }
        Collections.shuffle(versions, new Random(17));
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(10)) {
            List<Future<?>> calls = new ArrayList<>();
            for (int version : versions) calls.add(executor.submit(() -> {
                try { start.await(); } catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw new RuntimeException(ex); }
                score(user, "Concurrent", version * 100L, version);
            }));
            start.countDown();
            for (Future<?> call : calls) call.get(30, TimeUnit.SECONDS);
        }
        var board = service.leaderboard(id, user, 0, 50);
        assertThat(board.totalParticipants()).isEqualTo(1);
        assertThat(board.currentPlayer().score()).isEqualTo(2500);
        assertThat(board.currentPlayer().position()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT score_version FROM tournament.participants WHERE tournament_id=? AND user_id=?",
                Long.class, id, user)).isEqualTo(25L);
    }

    @Test void concurrentPlayersAreNotLostAcrossSharedTournamentLock() throws Exception {
        UUID id = tournament();
        try (ExecutorService executor = Executors.newFixedThreadPool(10)) {
            List<Callable<Void>> calls = new ArrayList<>();
            for (int i = 0; i < 50; i++) {
                final int n = i;
                calls.add(() -> { score(UUID.randomUUID(), "Player" + n, n * 100L, 1); return null; });
            }
            for (Future<Void> result : executor.invokeAll(calls)) result.get(30, TimeUnit.SECONDS);
        }
        var board = service.leaderboard(id, null, 0, 100);
        assertThat(board.totalParticipants()).isEqualTo(50);
        assertThat(board.tournament().revision()).isEqualTo(50);
        assertThat(board.participants()).extracting(e -> e.score()).isSortedAccordingTo(Comparator.reverseOrder());
    }
}
