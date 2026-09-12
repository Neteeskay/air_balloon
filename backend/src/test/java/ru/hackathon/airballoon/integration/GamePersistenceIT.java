package ru.hackathon.airballoon.integration;

import java.util.*;
import org.junit.jupiter.api.Test;
import ru.hackathon.airballoon.acceptance.GameAcceptanceSupport;
import static ru.hackathon.airballoon.acceptance.BackendAcceptanceDriver.*;
import static org.assertj.core.api.Assertions.*;

class GamePersistenceIT extends GameAcceptanceSupport {
    @Test void globalHistoryIncludesThreeUsersAndStablePagination() {
        List<UUID> roundIds = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            Player user = user("History" + i, 1000);
            Round round = start(user, 1); driver.reachLevel(round.id(), 1);
            if (i != 1) ok(driver.cashout(user.id(), round.id(), Map.of()));
            driver.reachCrash(round.id()); roundIds.add(round.id());
            persistedFinal(round.id(), i == 1 ? "LOSS" : "WIN");
        }
        var all = ok(driver.history(0, 100));
        // Global history is privacy-safe: the canonical DTO no longer exposes
        // internal user UUIDs. Verify the three persisted rounds via pagination
        // and ordering instead of asserting a private identity field.
        assertThat(all.items()).hasSize(3);
        assertThat(all.items()).extracting(History::finishedAt).isSortedAccordingTo(Comparator.reverseOrder());
        var first = ok(driver.history(0, 1)); var second = ok(driver.history(1, 1));
        assertThat(first.items()).hasSize(1); assertThat(second.items()).hasSize(1);
        assertThat(first.items().getFirst().roundId()).isNotEqualTo(second.items().getFirst().roundId());
        assertThat(first.total()).isEqualTo(all.total());
    }

    @Test void rewardGenerationIsIdempotent() {
        Player user = user("Reward", 1000); Round round = start(user, 1); driver.reachCrash(round.id());
        Reward reward = driver.reward(round.id());
        assertThat(driver.generateRewardAgain(round.id())).isEqualTo(reward);
        assertThat(driver.generateRewardAgain(round.id())).isEqualTo(reward);
        assertThat(driver.rewardCount(round.id())).isEqualTo(1);
    }

    @Test void restartRetainsEconomyScoreRewardHistoryConfigAndTournament() {
        UUID tournamentId = driver.createActiveTournament();
        Player user = user("Recovery", 1000); Round round = start(user, 1);
        driver.reachLevel(round.id(), 1); ok(driver.cashout(user.id(), round.id(), Map.of())); driver.reachCrash(round.id());
        Player before = driver.player(user.id()); Reward reward = driver.reward(round.id()); Config config = ok(driver.getAdminConfig());
        assertThat(ok(driver.leaderboard(tournamentId, user.id(), 0, 50)).currentPlayer().score()).isEqualTo(before.gameScore());
        driver.restartApplicationPreservingDatabase();
        assertThat(driver.player(user.id())).isEqualTo(before);
        assertThat(driver.reward(round.id())).isEqualTo(reward);
        assertThat(ok(driver.getAdminConfig())).isEqualTo(config);
        persistedFinal(round.id(), "WIN");
        assertThat(ok(driver.leaderboard(tournamentId, user.id(), 0, 50)).currentPlayer().score()).isEqualTo(before.gameScore());
    }
}
