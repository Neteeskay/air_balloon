package ru.hackathon.airballoon.acceptance;

import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.*;
import static org.assertj.core.api.Assertions.*;
import static ru.hackathon.airballoon.acceptance.BackendAcceptanceDriver.*;

class GameScenariosIT extends GameAcceptanceSupport {
    @Test @DisplayName("SCENARIO 1 Bet + Start GREEN/RED")
    void scenario1BetAndStart() {
        Player user = user("StartGreen", 1000);
        Round round = start(user, 2);
        assertThat(driver.player(user.id()).balance()).isEqualByComparingTo("900");
        assertThat(driver.ledgerCount(round.id(), "BET_DEBIT")).isEqualTo(1);
        assertThat(round.state()).isEqualTo("RUNNING");
        assertThat(round.theme()).isEqualTo(Theme.GREEN);
        assertThat(round.levels()).isEqualTo(9);
        assertThat(round.booster()).isEqualTo(2);
        assertThat(round.cashoutAvailable()).isFalse();
        assertThat(driver.events(round.id())).extracting(Event::type).contains("ROUND_STARTED");
        Player red = user("StartRed", 1000);
        Round redRound = ok(driver.start(red.id(), Theme.RED, bet, 2, SeedProfile.LATE_CRASH_AFTER_LEVEL_3, Map.of()));
        assertThat(redRound.theme()).isEqualTo(Theme.RED);
        assertThat(redRound.levels()).isEqualTo(12);
        assertThat(driver.player(red.id()).balance()).isEqualByComparingTo("900");
    }

    @Test @DisplayName("SCENARIO 2 Cashout + continued flight + crash + result")
    void scenario2SuccessfulCashout() {
        Player user = user("Cashout", 1000); Round round = start(user, 1);
        driver.reachLevel(round.id(), 1);
        assertThat(driver.round(round.id()).cashoutAvailable()).isTrue();
        Round cashed = ok(driver.cashout(user.id(), round.id(), Map.of()));
        assertThat(cashed.cashoutMultiplier()).isPositive();
        assertThat(cashed.winAmount()).isEqualByComparingTo(bet.multiply(cashed.cashoutMultiplier()));
        assertThat(driver.player(user.id()).balance()).isEqualByComparingTo(new BigDecimal("900").add(cashed.winAmount()));
        assertThat(cashed.state()).isEqualTo("RUNNING");
        assertThat(driver.ledgerCount(round.id(), "WIN_CREDIT")).isEqualTo(1);
        driver.reachLevel(round.id(), 2);
        assertThat(driver.round(round.id()).level()).isGreaterThanOrEqualTo(2);
        driver.reachCrash(round.id());
        persistedFinal(round.id(), "WIN");
        assertThat(driver.round(round.id()).winAmount()).isEqualByComparingTo(cashed.winAmount());
        assertThat(driver.player(user.id()).gameScore()).isEqualTo(driver.round(round.id()).levelPoints() + driver.round(round.id()).boosterPoints());
        assertThat(driver.player(user.id()).balance()).isEqualByComparingTo(new BigDecimal("900").add(cashed.winAmount()));
        assertThat(driver.ledgerCount(round.id(), "WIN_CREDIT")).isEqualTo(1);
    }

    @Test @DisplayName("SCENARIO 3 Loss preserves level points, reward and history")
    void scenario3Loss() {
        Player user = user("Loss", 1000); Round round = start(user, 1);
        driver.reachLevel(round.id(), 1); driver.reachCrash(round.id());
        persistedFinal(round.id(), "LOSS");
        Round finished = driver.round(round.id());
        assertThat(finished.winAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(driver.player(user.id()).balance()).isEqualByComparingTo("900");
        assertThat(finished.levelPoints()).isPositive();
        assertThat(driver.player(user.id()).gameScore()).isEqualTo(finished.levelPoints());
        assertThat(driver.ledgerCount(round.id(), "WIN_CREDIT")).isZero();
    }

    @Test @DisplayName("SCENARIO 4 x3 Booster activates once and cashout uses boosted value")
    void scenario4Booster() {
        Player user = user("Booster", 1000);
        Round round = ok(driver.start(user.id(), Theme.GREEN, bet, 3, SeedProfile.X3_BOOSTER_AT_LEVEL_2_LATE_CRASH, Map.of()));
        driver.reachLevel(round.id(), 2);
        var boosters = driver.events(round.id()).stream().filter(e -> e.type().equals("BOOSTER_ACTIVATED")).toList();
        assertThat(boosters).hasSize(1);
        assertThat(boosters.getFirst().multiplierAfter()).isEqualByComparingTo(boosters.getFirst().multiplierBefore().multiply(new BigDecimal("3")));
        assertThat(boosters.getFirst().points()).isPositive();
        Round cashed = ok(driver.cashout(user.id(), round.id(), Map.of()));
        assertThat(cashed.boosterActivated()).isTrue();
        assertThat(cashed.boosterPoints()).isEqualTo(boosters.getFirst().points());
        assertThat(cashed.cashoutMultiplier()).isGreaterThanOrEqualTo(boosters.getFirst().multiplierAfter());
        assertThat(cashed.winAmount()).isEqualByComparingTo(bet.multiply(cashed.cashoutMultiplier()));
        driver.reachCrash(round.id()); persistedFinal(round.id(), "WIN");
        assertThat(driver.events(round.id()).stream().filter(e -> e.type().equals("BOOSTER_ACTIVATED"))).hasSize(1);
        Player early = user("CashoutBeforeBooster", 1000);
        Round earlyRound = ok(driver.start(early.id(), Theme.GREEN, bet, 3, SeedProfile.X3_BOOSTER_AT_LEVEL_2_LATE_CRASH, Map.of()));
        driver.reachLevel(earlyRound.id(), 1);
        ok(driver.cashout(early.id(), earlyRound.id(), Map.of()));
        driver.reachCrash(earlyRound.id());
        assertThat(driver.round(earlyRound.id()).boosterActivated()).isFalse();
        assertThat(driver.round(earlyRound.id()).boosterPoints()).isZero();
        assertThat(driver.events(earlyRound.id()).stream().filter(e -> e.type().equals("BOOSTER_ACTIVATED"))).isEmpty();
    }

    @Test @DisplayName("SCENARIO 5 pointsPerLevel config change preserves existing round snapshot")
    void scenario5RuntimeConfig() {
        long original = ok(driver.getAdminConfig()).pointsPerLevel();
        try {
            ok(driver.setPointsPerLevel(100));
            Player oldUser = user("OldConfig", 1000); Round oldRound = start(oldUser, 1);
            assertThat(ok(driver.setPointsPerLevel(500)).pointsPerLevel()).isEqualTo(500);
            assertThat(ok(driver.getAdminConfig()).pointsPerLevel()).isEqualTo(500);
            Player newUser = user("NewConfig", 1000); Round newRound = start(newUser, 1);
            driver.reachLevel(oldRound.id(), 1); driver.reachLevel(newRound.id(), 1);
            assertThat(driver.round(oldRound.id()).pointsPerLevelSnapshot()).isEqualTo(100);
            assertThat(driver.round(newRound.id()).pointsPerLevelSnapshot()).isEqualTo(500);
            assertThat(driver.player(oldUser.id()).gameScore()).isEqualTo(100);
            assertThat(driver.player(newUser.id()).gameScore()).isEqualTo(500);
            assertThat(driver.events(newRound.id())).anySatisfy(event -> {
                assertThat(event.type()).isEqualTo("LEVEL_REACHED"); assertThat(event.level()).isEqualTo(1);
                assertThat(event.points()).isEqualTo(500);
            });
        } finally { ok(driver.setPointsPerLevel(original)); }
    }
}
