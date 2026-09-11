package ru.hackathon.airballoon.concurrency;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import ru.hackathon.airballoon.acceptance.GameAcceptanceSupport;
import static ru.hackathon.airballoon.acceptance.BackendAcceptanceDriver.*;
import static org.assertj.core.api.Assertions.*;

class GameConcurrencyIT extends GameAcceptanceSupport {
    private <T> List<T> parallel(int count, Supplier<T> command) throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(count)) {
            List<Future<T>> requests = new ArrayList<>();
            for (int i = 0; i < count; i++) requests.add(executor.submit(() -> { gate.await(); return command.get(); }));
            gate.countDown();
            List<T> results = new ArrayList<>();
            for (Future<T> request : requests) results.add(request.get(30, TimeUnit.SECONDS));
            return results;
        }
    }

    @Test void fiftySimultaneousCashoutsProduceExactlyOneWinCredit() throws Exception {
        Player user = user("CashoutRace", 1000); Round round = start(user, 1); driver.reachLevel(round.id(), 1);
        var responses = parallel(50, () -> driver.cashout(user.id(), round.id(), Map.of()));
        assertThat(responses).anyMatch(Response::successful);
        assertThat(responses).allMatch(r -> r.successful() || r.status() == 409 || r.status() == 400);
        Round current = driver.round(round.id());
        assertThat(driver.ledgerCount(round.id(), "WIN_CREDIT")).isEqualTo(1);
        assertThat(driver.player(user.id()).balance()).isEqualByComparingTo(new BigDecimal("900").add(current.winAmount()));
        assertThat(driver.events(round.id()).stream().filter(e -> e.type().equals("CASHOUT"))).hasSize(1);
    }

    @Test void tenParallelBetsCannotOverdrawBalance() throws Exception {
        Player user = user("BetRace", 100);
        var responses = parallel(10, () -> driver.start(user.id(), Theme.GREEN, bet, 1,
                SeedProfile.LATE_CRASH_AFTER_LEVEL_3, Map.of()));
        assertThat(responses.stream().filter(Response::successful)).hasSize(1);
        assertThat(driver.player(user.id()).balance()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(responses.stream().filter(r -> !r.successful()))
                .allSatisfy(r -> assertThat(r.errorCode()).isIn("INSUFFICIENT_BALANCE", "ROUND_ALREADY_RUNNING"));
        Round created = responses.stream().filter(Response::successful).findFirst().orElseThrow().body();
        assertThat(driver.ledgerCount(created.id(), "BET_DEBIT")).isEqualTo(1);
    }

    @Test void duplicateLevelEventCreditsPointsOnce() {
        Player user = user("LevelDuplicate", 1000); Round round = start(user, 1); driver.reachLevel(round.id(), 3);
        long before = driver.player(user.id()).gameScore();
        driver.redeliverLevelEvent(round.id(), 3); driver.redeliverLevelEvent(round.id(), 3);
        assertThat(driver.player(user.id()).gameScore()).isEqualTo(before);
    }

    @Test void duplicateBoosterEventChangesNeitherPointsNorMultiplier() {
        Player user = user("BoosterDuplicate", 1000);
        Round round = ok(driver.start(user.id(), Theme.GREEN, bet, 3, SeedProfile.X3_BOOSTER_AT_LEVEL_2_LATE_CRASH, Map.of()));
        driver.reachLevel(round.id(), 2);
        Round before = driver.round(round.id()); long score = driver.player(user.id()).gameScore();
        driver.redeliverBoosterEvent(round.id()); driver.redeliverBoosterEvent(round.id());
        assertThat(driver.round(round.id()).multiplier()).isEqualByComparingTo(before.multiplier());
        assertThat(driver.round(round.id()).boosterActivated()).isTrue();
        assertThat(driver.player(user.id()).gameScore()).isEqualTo(score);
        assertThat(driver.events(round.id()).stream().filter(e -> e.type().equals("BOOSTER_ACTIVATED"))).hasSize(1);
    }
}
