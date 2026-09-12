package ru.airballoon.game;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import ru.airballoon.game.infrastructure.config.GameProperties;
import ru.airballoon.game.infrastructure.memory.FakeBalanceService;
import ru.airballoon.game.infrastructure.memory.InMemoryGameConfigProvider;
import ru.airballoon.game.domain.GameConfig;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static ru.airballoon.game.TestSupport.*;

class RoundApiIT extends IntegrationSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired MutableClock clock;
    @Autowired FakeBalanceService balances;
    @Autowired InMemoryGameConfigProvider configs;
    @Autowired GameProperties properties;
    private UUID user;

    @BeforeEach void setup() {
        user = UUID.randomUUID();
        clock.atMillis(0);
        configs.replace(properties.config());
    }

    @Test void knownServerSeedReturnsAuthoritativePiecewiseCrashThroughHttp() throws Exception {
        GameConfig base = properties.config();
        configs.replace(new GameConfig(dec("1"), dec("100"), dec("0.03"), base.growthPerSecond(),
                base.minBet(), base.maxBet(), base.boosterPointsPerMultiplier(),
                base.boosterPointsX2(), base.boosterPointsX3(), base.boosterPointsX4(),
                base.cashoutPoints(), base.economyScale(), base.green(), base.red()));

        String id = start();
        clock.atMillis(100_000);
        mvc.perform(get("/api/rounds/" + id).principal(() -> user.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("status").value("FINISHED"))
                .andExpect(jsonPath("crashMultiplier").value(1.4356));
    }

    @Test void fullHttpScenarioFixesPayoutAndFinishesAfterCrash() throws Exception {
        String id = start();
        assertThat(balances.balance(user)).isEqualByComparingTo("500.00");
        clock.atMillis(1000);
        mvc.perform(get("/api/rounds/" + id).principal(() -> user.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("currentMultiplier").value(1.1))
                .andExpect(jsonPath("cashoutAvailable").value(false))
                .andExpect(jsonPath("cashoutPreviewAmount").value(550.0));
        clock.atMillis(2000);
        mvc.perform(get("/api/rounds/" + id).principal(() -> user.toString()))
                .andExpect(jsonPath("currentLevel").value(1)).andExpect(jsonPath("cashoutAvailable").value(true))
                .andExpect(jsonPath("cashoutPreviewAmount").value(600.0));
        clock.atMillis(10000);
        mvc.perform(get("/api/rounds/" + id).principal(() -> user.toString()))
                .andExpect(jsonPath("currentMultiplier").value(6.0)).andExpect(jsonPath("boosterActivated").value(true))
                .andExpect(jsonPath("cashoutPreviewAmount").value(3000.0));
        clock.atMillis(10100);
        JsonNode cashout = json(mvc.perform(post("/api/rounds/" + id + "/cashout").principal(() -> user.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("cashoutMultiplier").value(6.03))
                .andExpect(jsonPath("winAmount").value(3015.0)).andExpect(jsonPath("status").value("CASHED_OUT"))
                .andExpect(jsonPath("cashoutPreviewAmount").doesNotExist()).andReturn());
        assertThat(balances.balance(user)).isEqualByComparingTo("3515.00");
        clock.atMillis(11000);
        mvc.perform(get("/api/rounds/" + id).principal(() -> user.toString()))
                .andExpect(jsonPath("currentMultiplier").value(6.3)).andExpect(jsonPath("finishedAt").doesNotExist());
        mvc.perform(post("/api/rounds/" + id + "/cashout").principal(() -> user.toString()))
                .andExpect(status().isConflict()).andExpect(jsonPath("code").value("ALREADY_CASHED_OUT"));
        clock.atMillis(20000);
        JsonNode finished = json(mvc.perform(get("/api/rounds/" + id).principal(() -> user.toString()))
                .andExpect(jsonPath("status").value("FINISHED")).andExpect(jsonPath("outcome").value("CASHED_OUT"))
                .andExpect(jsonPath("crashMultiplier").value(8.42)).andExpect(jsonPath("finishedAt").exists()).andReturn());
        assertThat(finished.get("winAmount")).isEqualTo(cashout.get("winAmount"));
        assertThat(balances.creditCount(user)).isEqualTo(1);
    }

    @Test void startResponseExposesBoosterPositionWithoutExposingCrash() throws Exception {
        mvc.perform(post("/api/rounds").principal(() -> user.toString()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"theme\":\"GREEN\",\"betAmount\":500,\"boosterMultiplier\":3}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("boosterLevel").value(3))
                .andExpect(jsonPath("boosterActivated").value(false))
                .andExpect(jsonPath("crashMultiplier").doesNotExist())
                .andExpect(jsonPath("fairnessReveal").doesNotExist());
    }

    @ParameterizedTest
    @ValueSource(strings = {"currentMultiplier", "cashoutPreviewAmount", "cashoutMultiplier", "winAmount", "seed", "crashMultiplier", "boosterLevel", "score", "elapsedTime", "status", "userId"})
    void rejectsClientAuthorityFieldsAtStart(String field) throws Exception {
        String request = "{\"theme\":\"GREEN\",\"betAmount\":500,\"boosterMultiplier\":3,\"" + field + "\":999}";
        mvc.perform(post("/api/rounds").principal(() -> user.toString()).contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("INVALID_REQUEST"));
        assertThat(balances.balance(user)).isEqualByComparingTo("1000");
    }

    @ParameterizedTest @ValueSource(strings = {"{\"cashoutMultiplier\":999}", "{\"winAmount\":99999}", "{}", "true"})
    void cashoutAcceptsOnlyAnEmptyCommand(String body) throws Exception {
        String id = start(); clock.atMillis(3000);
        mvc.perform(post("/api/rounds/" + id + "/cashout").principal(() -> user.toString())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("INVALID_REQUEST"));
        assertThat(balances.creditCount(user)).isZero();
    }

    @Test void futureCrashSeedAndInternalConfigAreNeverExposedInActiveRound() throws Exception {
        String id = start();
        mvc.perform(get("/api/rounds/" + id).principal(() -> user.toString()))
                .andExpect(jsonPath("seed").doesNotExist()).andExpect(jsonPath("config").doesNotExist())
                .andExpect(jsonPath("crashMultiplier").doesNotExist()).andExpect(jsonPath("levelThresholds.length()").value(9));
    }

    @Test void otherUserCannotReadOrCashoutRound() throws Exception {
        String id = start(); String other = UUID.randomUUID().toString();
        mvc.perform(get("/api/rounds/" + id).principal(() -> other)).andExpect(status().isForbidden())
                .andExpect(jsonPath("code").value("FORBIDDEN_ROUND_ACCESS"));
        mvc.perform(post("/api/rounds/" + id + "/cashout").principal(() -> other)).andExpect(status().isForbidden());
    }

    @Test void malformedRequestsAndInvalidEnumUseUnifiedErrorFormat() throws Exception {
        mvc.perform(post("/api/rounds").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"theme\":\"BLUE\",\"betAmount\":100,\"boosterMultiplier\":1}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("INVALID_THEME"))
                .andExpect(jsonPath("timestamp").exists()).andExpect(jsonPath("path").value("/api/rounds"));
        mvc.perform(get("/api/rounds/not-a-uuid")).andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("INVALID_REQUEST"));
        mvc.perform(post("/api/rounds").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("INVALID_REQUEST"));
        mvc.perform(post("/api/rounds").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"theme\":\"GREEN\",\"betAmount\":100,\"boosterMultiplier\":2.5}"))
                .andExpect(status().isBadRequest());
    }

    @Test void untrustedUserHeaderDoesNotChooseProductionPrincipal() throws Exception {
        // Test filter deliberately supplies an invalid trusted principal; arbitrary X-User-Id cannot replace it.
        mvc.perform(get("/api/rounds/" + UUID.randomUUID()).header("X-Test-User", "invalid")
                        .header("X-User-Id", user.toString()))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("code").value("AUTH_REQUIRED"));
    }

    private String start() throws Exception {
        return json(mvc.perform(post("/api/rounds").principal(() -> user.toString()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"theme\":\"GREEN\",\"betAmount\":500,\"boosterMultiplier\":3}"))
                .andExpect(status().isCreated()).andReturn()).get("id").asText();
    }

    private JsonNode json(MvcResult result) throws Exception { return mapper.readTree(result.getResponse().getContentAsString()); }
}
