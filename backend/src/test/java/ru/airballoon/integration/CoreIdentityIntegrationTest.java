package ru.airballoon.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = ru.airballoon.AirBalloonApplication.class,
        properties = "game.scheduler-enabled=false")
@AutoConfigureMockMvc
@ActiveProfiles("demo")
class CoreIdentityIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

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

        var startedResponse = mvc.perform(post("/api/rounds").session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"theme\":\"GREEN\",\"betAmount\":100,\"boosterMultiplier\":3}"))
                .andExpect(status().isCreated()).andReturn();
        JsonNode started = json.readTree(startedResponse.getResponse().getContentAsString());
        String roundId = started.get("id").asText();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM economy_transactions WHERE round_id=? AND type='BET_DEBIT'",
                Long.class, java.util.UUID.fromString(roundId))).isEqualTo(1L);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM core_round_checkpoints WHERE round_id=?",
                Long.class, java.util.UUID.fromString(roundId))).isEqualTo(1L);

        var afterDebitResponse = mvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk()).andReturn();
        JsonNode afterDebit = json.readTree(afterDebitResponse.getResponse().getContentAsString());
        assertThat(afterDebit.get("bonusBalance").asLong()).isEqualTo(before.get("bonusBalance").asLong() - 100);

        Thread.sleep(1_300);
        String key = "11111111-2222-4333-8444-555555555556";
        var first = mvc.perform(post("/api/rounds/{id}/cashout", roundId).session(session)
                        .header("Idempotency-Key", key))
                .andExpect(status().isOk()).andReturn();
        var second = mvc.perform(post("/api/rounds/{id}/cashout", roundId).session(session)
                        .header("Idempotency-Key", key))
                .andExpect(status().isOk()).andReturn();
        JsonNode firstCashout = json.readTree(first.getResponse().getContentAsString());
        JsonNode secondCashout = json.readTree(second.getResponse().getContentAsString());
        assertThat(secondCashout.get("winAmount")).isEqualTo(firstCashout.get("winAmount"));
        assertThat(secondCashout.get("sequence")).isEqualTo(firstCashout.get("sequence"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM economy_transactions WHERE round_id=? AND type='WIN_CREDIT'",
                Long.class, java.util.UUID.fromString(roundId))).isEqualTo(1L);
    }
}
