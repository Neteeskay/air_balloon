package ru.hackathon.airballoon.acceptance;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.Assumptions;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import ru.airballoon.acceptance.CoreBackendAcceptanceConfiguration;
import ru.hackathon.airballoon.support.PostgresSupport;
import static org.assertj.core.api.Assertions.*;
import static ru.hackathon.airballoon.acceptance.BackendAcceptanceDriver.*;

@SpringBootTest(classes = ru.airballoon.AirBalloonApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"game.scheduler-enabled=false", "game.random-mode=FIXED_SEED",
                "game.fixed-seed=42", "app.admin-token=acceptance-admin",
                "spring.http.client.factory=simple"})
@ActiveProfiles("demo")
@Import(CoreBackendAcceptanceConfiguration.class)
public abstract class GameAcceptanceSupport extends PostgresSupport {
    @Autowired ObjectProvider<BackendAcceptanceDriver> drivers;
    protected BackendAcceptanceDriver driver;
    protected final BigDecimal bet = new BigDecimal("100");

    @BeforeEach void requireRealBackendAdapter(TestInfo test) {
        driver = drivers.getIfAvailable();
        String blocker = "BLOCKED " + test.getDisplayName() + ": Backend #1 GameEngine/fixed-seed/HTTP and Backend #2 "
                + "users/economy/score/config/history/reward APIs are absent; provide a real BackendAcceptanceDriver bean";
        if (driver == null) {
            System.out.println(blocker);
            if (Boolean.getBoolean("acceptance.strict")) fail(blocker);
            Assumptions.assumeTrue(false, blocker);
        }
        driver.resetFixtures();
    }
    protected Player user(String name, long balance) { return driver.createPlayer(name, BigDecimal.valueOf(balance), 0); }
    protected Round start(Player user, int booster) {
        return ok(driver.start(user.id(), Theme.GREEN, bet, booster, SeedProfile.LATE_CRASH_AFTER_LEVEL_3, Map.of()));
    }
    protected <T> T ok(Response<T> response) {
        assertThat(response.status()).as("HTTP status; error=%s", response.errorCode()).isBetween(200, 299);
        assertThat(response.body()).isNotNull();
        return response.body();
    }
    protected void persistedFinal(UUID roundId, String result) {
        Round round = driver.round(roundId);
        assertThat(round.state()).isEqualTo("FINISHED");
        assertThat(round.result()).isEqualTo(result);
        assertThat(driver.reward(roundId).roundId()).isEqualTo(roundId);
        assertThat(driver.rewardCount(roundId)).isEqualTo(1);
        assertThat(ok(driver.history(0, 100)).items()).anySatisfy(item -> {
            assertThat(item.roundId()).isEqualTo(roundId);
            assertThat(item.result()).isEqualTo(result);
            assertThat(item.cashoutMultiplier()).isEqualTo(round.cashoutMultiplier());
        });
        assertThat(driver.events(roundId)).extracting(Event::type).contains("CRASH", "ROUND_FINISHED");
    }
}
