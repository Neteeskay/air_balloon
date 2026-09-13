package ru.airballoon.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import ru.hackathon.airballoon.support.PostgresSupport;

@SpringBootTest(classes = ru.airballoon.AirBalloonApplication.class,
        properties = "game.scheduler-enabled=false")
@AutoConfigureMockMvc
@ActiveProfiles("demo")
class CoreIdentityIntegrationTest extends PostgresSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    @Test
    void adminExceptionAdviceDoesNotCapturePlayerAuthenticationErrors() throws Exception {
        var response = mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized()).andReturn();
        assertThat(json.readTree(response.getResponse().getContentAsString()).get("code").asText())
                .isEqualTo("AUTH_REQUIRED");
    }

    @Test
    void loginIdentityAndEconomyStateUseTheSameUser() throws Exception {
        var login = mvc.perform(post("/api/auth/demo-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"anna\",\"password\":\"balloon1\"}"))
                .andExpect(status().isOk()).andReturn();
        JsonNode authenticated = json.readTree(login.getResponse().getContentAsString());
        HttpSession raw = login.getRequest().getSession(false);
        assertThat(raw).isInstanceOf(MockHttpSession.class);
        MockHttpSession session = (MockHttpSession) raw;

        var me = mvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk()).andReturn();
        var economy = mvc.perform(get("/api/users/{id}/state", authenticated.get("userId").asText())
                        .session(session))
                .andExpect(status().isOk()).andReturn();

        JsonNode current = json.readTree(me.getResponse().getContentAsString());
        JsonNode state = json.readTree(economy.getResponse().getContentAsString());
        assertThat(current.get("userId")).isEqualTo(authenticated.get("userId"));
        assertThat(state.get("userId")).isEqualTo(authenticated.get("userId"));
        assertThat(state.get("bonusBalance")).isEqualTo(authenticated.get("bonusBalance"));
    }

    @Test
    void startDebitsAtomicallyAndCashoutKeyCannotCreditTwice() throws Exception {
        var login = mvc.perform(post("/api/auth/demo-login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"maks\",\"password\":\"balloon2\"}"))
                .andExpect(status().isOk()).andReturn();
        JsonNode before = json.readTree(login.getResponse().getContentAsString());
        MockHttpSession session = (MockHttpSession) login.getRequest().getSession(false);
        long balance = before.get("bonusBalance").asLong();

        // The continuous crash distribution may bust a round before the first level,
        // so retry until a round survives the level-one threshold.
        for (int attempt = 0; attempt < 25; attempt++) {
            var startedResponse = mvc.perform(post("/api/rounds").session(session)
                            .contentType(MediaType.APPLICATION_JSON)
                            // Catalog option 3 is the authoritative paired stake for x3.
                            .content("{\"theme\":\"GREEN\",\"betAmount\":500,\"boosterMultiplier\":3}"))
                    .andExpect(status().isCreated()).andReturn();
            JsonNode started = json.readTree(startedResponse.getResponse().getContentAsString());
            UUID roundId = java.util.UUID.fromString(started.get("id").asText());
            assertThat(jdbc.queryForObject("SELECT count(*) FROM economy_transactions WHERE round_id=? AND type='BET_DEBIT'",
                    Long.class, roundId)).isEqualTo(1L);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM core_round_checkpoints WHERE round_id=?",
                    Long.class, roundId)).isEqualTo(1L);

            var afterDebitResponse = mvc.perform(get("/api/auth/me").session(session))
                    .andExpect(status().isOk()).andReturn();
            JsonNode afterDebit = json.readTree(afterDebitResponse.getResponse().getContentAsString());
            assertThat(afterDebit.get("bonusBalance").asLong()).isEqualTo(balance - 500);
            balance = afterDebit.get("bonusBalance").asLong();

            if (!awaitFirstLevel(session, roundId)) continue;

            String key = "11111111-2222-4333-8444-555555555556";
            var first = mvc.perform(post("/api/rounds/{id}/cashout", roundId).session(session)
                            .header("Idempotency-Key", key))
                    .andReturn();
            if (first.getResponse().getStatus() != 200) continue; // round crashed before the cashout was accepted
            assertThat(first.getResponse().getStatus()).isEqualTo(200);
            var second = mvc.perform(post("/api/rounds/{id}/cashout", roundId).session(session)
                            .header("Idempotency-Key", key))
                    .andExpect(status().isOk()).andReturn();
            JsonNode firstCashout = json.readTree(first.getResponse().getContentAsString());
            JsonNode secondCashout = json.readTree(second.getResponse().getContentAsString());
            assertThat(secondCashout.get("winAmount")).isEqualTo(firstCashout.get("winAmount"));
            assertThat(secondCashout.get("sequence")).isEqualTo(firstCashout.get("sequence"));
            assertThat(jdbc.queryForObject("SELECT count(*) FROM economy_transactions WHERE round_id=? AND type='WIN_CREDIT'",
                    Long.class, roundId)).isEqualTo(1L);
            return;
        }
        fail("No round survived past the first level within 25 attempts");
    }

    /** Polls the round until it levels up (cashed-out viable) or crashes; false means it busted. */
    private boolean awaitFirstLevel(MockHttpSession session, UUID roundId) throws Exception {
        for (int poll = 0; poll < 100; poll++) {
            JsonNode view = json.readTree(mvc.perform(get("/api/rounds/{roundId}", roundId).session(session))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
            String status = view.get("status").asText();
            if (status.equals("CRASHED") || status.equals("FINISHED")) return false;
            if (status.equals("RUNNING") && view.get("currentLevel").asInt() >= 1) return true;
            Thread.sleep(100);
        }
        return false;
    }
}
