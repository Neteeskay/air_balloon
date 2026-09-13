package ru.hackathon.airballoon.security;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import ru.hackathon.airballoon.acceptance.GameAcceptanceSupport;
import static ru.hackathon.airballoon.acceptance.BackendAcceptanceDriver.*;
import static org.assertj.core.api.Assertions.*;

class GameAntiCheatIT extends GameAcceptanceSupport {
    @ParameterizedTest @ValueSource(strings = {"cashoutMultiplier", "winAmount", "score", "crashMultiplier"})
    void clientCannotSupplyAuthoritativeValues(String field) {
        Player user = user("Forged", 1000);
        var started = driver.start(user.id(), Theme.GREEN, bet, 1, SeedProfile.LATE_CRASH_AFTER_LEVEL_3, Map.of(field, 999999999));
        Round round;
        if (!started.successful()) {
            assertThat(started.status()).isBetween(400, 499);
            assertThat(driver.player(user.id()).balance()).isEqualByComparingTo("1000");
            round = start(user, 1);
        } else round = ok(started);
        driver.reachLevel(round.id(), 1);
        Round before = driver.round(round.id());
        var forged = driver.cashout(user.id(), round.id(), Map.of(field, 999999999));
        Round cashed;
        if (!forged.successful()) {
            assertThat(forged.status()).isBetween(400, 499);
            assertThat(driver.ledgerCount(round.id(), "WIN_CREDIT")).isZero();
            cashed = ok(driver.cashout(user.id(), round.id(), Map.of()));
        } else cashed = ok(forged);
        // Deterministic clock is paused at level 1: client fields cannot influence the server coefficient.
        assertThat(cashed.cashoutMultiplier()).isEqualByComparingTo(before.multiplier());
        assertThat(cashed.winAmount()).isEqualByComparingTo(bet.multiply(before.multiplier()).setScale(0, java.math.RoundingMode.DOWN));
        assertThat(driver.player(user.id()).gameScore()).isEqualTo(before.levelPoints() + before.boosterPoints()
                + cashed.cashoutPoints());
        driver.reachCrash(round.id()); persistedFinal(round.id(), "WIN");
        Player controlUser = user("Control", 1000);
        Round control = start(controlUser, 1);
        driver.reachCrash(control.id());
        assertThat(driver.round(round.id()).crashMultiplier()).isEqualByComparingTo(driver.round(control.id()).crashMultiplier());
    }

    @Test void foreignUserCannotCashoutRound() {
        Player owner = user("Owner", 1000), attacker = user("Attacker", 1000);
        Round round = start(owner, 1); driver.reachLevel(round.id(), 1);
        var attack = driver.cashout(attacker.id(), round.id(), Map.of());
        assertThat(attack.status()).isIn(403, 404);
        assertThat(driver.ledgerCount(round.id(), "WIN_CREDIT")).isZero();
        assertThat(driver.player(attacker.id()).balance()).isEqualByComparingTo("1000");
        assertThat(driver.round(round.id()).cashoutMultiplier()).isNull();
    }

    @Test void cashoutBeforeFirstLevelIsRejected() {
        Player user = user("TooEarly", 1000); Round round = start(user, 1);
        assertThat(driver.cashout(user.id(), round.id(), Map.of()).status()).isBetween(400, 499);
        assertThat(driver.ledgerCount(round.id(), "WIN_CREDIT")).isZero();
    }
}
