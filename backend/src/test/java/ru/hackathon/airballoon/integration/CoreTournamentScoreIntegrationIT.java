package ru.hackathon.airballoon.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import ru.airballoon.game.domain.GameEvent;
import ru.airballoon.integration.PostgresRoundEventStore;
import ru.hackathon.airballoon.acceptance.GameAcceptanceSupport;
import static org.assertj.core.api.Assertions.assertThat;
import static ru.hackathon.airballoon.acceptance.BackendAcceptanceDriver.*;

class CoreTournamentScoreIntegrationIT extends GameAcceptanceSupport {
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired PostgresRoundEventStore eventStore;
    @Autowired PlatformTransactionManager transactionManager;

    @Test
    void authoritativeScoresDriveRankingAndCurrentPlayerUsesEachHttpSession() {
        var tournament = driver.createActiveTournament();
        Player alice = user("Alice", 1000);
        Player bob = user("Bob", 1000);

        Round aliceRound = start(alice, 1);
        driver.reachLevel(aliceRound.id(), 2);
        Round bobRound = start(bob, 1);
        driver.reachLevel(bobRound.id(), 1);

        var aliceBoard = ok(driver.leaderboard(tournament, alice.id(), 0, 50));
        var bobBoard = ok(driver.leaderboard(tournament, bob.id(), 0, 50));
        assertThat(aliceBoard.top3()).extracting(entry -> entry.userId())
                .containsExactly(alice.id(), bob.id());
        assertThat(aliceBoard.currentPlayer().userId()).isEqualTo(alice.id());
        assertThat(aliceBoard.currentPlayer().score()).isEqualTo(driver.player(alice.id()).gameScore());
        assertThat(bobBoard.currentPlayer().userId()).isEqualTo(bob.id());
        assertThat(bobBoard.currentPlayer().score()).isEqualTo(driver.player(bob.id()).gameScore());
        assertThat(aliceBoard.currentPlayer()).isNotEqualTo(bobBoard.currentPlayer());
    }

    @Test
    void oneHundredLevelAndBoosterRedeliveriesDoNotDuplicateScoreOrLeaderboard() {
        var tournament = driver.createActiveTournament();
        Player player = user("Retry", 1000);
        Round round = ok(driver.start(player.id(), Theme.GREEN, new BigDecimal("500"), 3,
                SeedProfile.X3_BOOSTER_AT_LEVEL_2_LATE_CRASH, Map.of()));
        driver.reachLevel(round.id(), 2);
        long score = driver.player(player.id()).gameScore();
        long revision = ok(driver.leaderboard(tournament, player.id(), 0, 50)).tournament().revision();

        for (int i = 0; i < 100; i++) {
            driver.redeliverLevelEvent(round.id(), 2);
            driver.redeliverBoosterEvent(round.id());
        }

        assertThat(driver.player(player.id()).gameScore()).isEqualTo(score);
        var board = ok(driver.leaderboard(tournament, player.id(), 0, 50));
        assertThat(board.currentPlayer().score()).isEqualTo(score);
        assertThat(board.tournament().revision()).isEqualTo(revision);
    }

    @Test
    void restartThenRetryKeepsScoreAndLeaderboardExactlyOnce() {
        var tournament = driver.createActiveTournament();
        Player player = user("RestartRetry", 1000);
        Round round = ok(driver.start(player.id(), Theme.GREEN, new BigDecimal("500"), 3,
                SeedProfile.X3_BOOSTER_AT_LEVEL_2_LATE_CRASH, Map.of()));
        driver.reachLevel(round.id(), 2);
        driver.reachCrash(round.id());
        long score = driver.player(player.id()).gameScore();
        long revision = ok(driver.leaderboard(tournament, player.id(), 0, 50)).tournament().revision();

        driver.restartApplicationPreservingDatabase();
        driver.redeliverLevelEvent(round.id(), 2);
        driver.redeliverBoosterEvent(round.id());

        assertThat(driver.player(player.id()).gameScore()).isEqualTo(score);
        var restored = ok(driver.leaderboard(tournament, player.id(), 0, 50));
        assertThat(restored.currentPlayer().score()).isEqualTo(score);
        assertThat(restored.tournament().revision()).isEqualTo(revision);
    }

    @Test
    void scoreEventUserTotalAndTournamentProjectionRollBackTogether() throws Exception {
        var tournament = driver.createActiveTournament();
        Player player = user("Atomic", 1000);
        Round round = start(player, 1);
        driver.reachLevel(round.id(), 1);
        String payload = jdbc.queryForObject("""
                SELECT event_json::text FROM core_round_events
                WHERE round_id=? AND event_json->>'type'='LEVEL_REACHED'
                ORDER BY sequence LIMIT 1
                """, String.class, round.id());
        GameEvent event = json.readValue(payload, GameEvent.class);

        jdbc.update("DELETE FROM core_round_events WHERE round_id=? AND sequence=?", round.id(), event.sequence());
        jdbc.update("""
                UPDATE tournament.participants SET score=0,score_version=0,updated_at=now()
                WHERE tournament_id=? AND user_id=?
                """, tournament, player.id());
        jdbc.update("DELETE FROM score_events WHERE round_id=? AND type='LEVEL' AND event_key=1", round.id());
        jdbc.update("UPDATE users SET game_score=0,game_score_version=0 WHERE id=?", player.id());

        new TransactionTemplate(transactionManager).executeWithoutResult(tx -> {
            eventStore.append(event);
            assertThat(jdbc.queryForObject("SELECT game_score FROM users WHERE id=?",
                    Long.class, player.id())).isEqualTo(100L);
            assertThat(jdbc.queryForObject("""
                    SELECT score FROM tournament.participants WHERE tournament_id=? AND user_id=?
                    """, Long.class, tournament, player.id())).isEqualTo(100L);
            tx.setRollbackOnly();
        });

        assertThat(jdbc.queryForObject("SELECT game_score FROM users WHERE id=?",
                Long.class, player.id())).isZero();
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM score_events WHERE round_id=? AND type='LEVEL' AND event_key=1
                """, Long.class, round.id())).isZero();
        assertThat(jdbc.queryForObject("""
                SELECT score FROM tournament.participants WHERE tournament_id=? AND user_id=?
                """, Long.class, tournament, player.id())).isZero();
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM core_round_events WHERE round_id=? AND sequence=?
                """, Long.class, round.id(), event.sequence())).isZero();
    }
}
