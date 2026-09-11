package ru.hackathon.airballoon.integration;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.transaction.support.TransactionTemplate;
import ru.hackathon.airballoon.support.*;
import ru.hackathon.airballoon.tournament.port.*;
import static org.assertj.core.api.Assertions.assertThat;

class LeaderboardWebSocketIT extends TournamentIntegrationSupport {
    @Autowired ApplicationContext context;

    @Test void actualStompClientSeesCommittedScoreAndRankIncludingPlayerOutsideTopTwenty() throws Exception {
        UUID id = tournament(), me = UUID.randomUUID();
        for (int i = 0; i < 24; i++) score(UUID.randomUUID(), "Opponent" + i, 1000 + i, 1);
        score(me, "CurrentUser", 700, 1);
        try (var live = new LiveSubscription(port, "/topic/tournaments/" + id + "/leaderboard", context)) {
            score(me, "CurrentUser", 800, 2);
            var outside = live.next();
            assertThat(outside.type()).isEqualTo("LEADERBOARD_UPDATE");
            assertThat(outside.tournamentId()).isEqualTo(id);
            assertThat(outside.topPlayers()).hasSize(20);
            assertThat(outside.changedPlayer().position()).isEqualTo(25);
            assertThat(outside.changedPlayer().userId()).isEqualTo(me);
            score(me, "CurrentUser", 1200, 3);
            var first = live.next();
            assertThat(first.changedPlayer().position()).isEqualTo(1);
            assertThat(first.changedPlayer().score()).isEqualTo(1200);
            assertThat(first.revision()).isGreaterThan(outside.revision());
            assertThat(live.errors).isEmpty();
        }
    }

    @Test void rollbackAndDuplicatesEmitNoFramesBeforeNextValidCommit() throws Exception {
        UUID id = tournament(), me = UUID.randomUUID();
        score(me, "CurrentUser", 700, 1);
        try (var live = new LiveSubscription(port, "/topic/tournaments/" + id + "/leaderboard", context)) {
            new TransactionTemplate(transactionManager).executeWithoutResult(tx -> {
                events.publishEvent(new ScoreChanged(new PlayerScore(me, "CurrentUser", 9999, 2, clock.instant())));
                tx.setRollbackOnly();
            });
            score(me, "CurrentUser", 7777, 1);
            score(me, "CurrentUser", 1200, 3);
            var frame = live.next();
            assertThat(frame.changedPlayer().score()).isEqualTo(1200);
            assertThat(frame.revision()).isEqualTo(2);
        }
    }
}
