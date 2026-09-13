package ru.airballoon.game;

import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import ru.airballoon.game.application.GameService;
import ru.airballoon.game.domain.*;
import ru.airballoon.game.infrastructure.memory.FakeBalanceService;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static ru.airballoon.game.TestSupport.*;

class ResilienceApiIT extends IntegrationSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired MutableClock clock;
    @Autowired GameService service;
    @Autowired FakeBalanceService balances;
    private UUID user;
    @BeforeEach void setup() { clock.atMillis(0); user = UUID.randomUUID(); }
    private GameRound start() { return service.start(user, Theme.GREEN, dec("100"), 3); }

    @Test void fairnessEndpointCommitsThenRevealsAndCanBeIndependentlyVerified() throws Exception {
        var r = start();
        mvc.perform(get("/api/rounds/{id}/fairness", r.id()).principal(() -> user.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("status").value("COMMITTED"))
                .andExpect(jsonPath("commitment").value(r.fairnessCommitment()))
                .andExpect(jsonPath("serverSeed").doesNotExist()).andExpect(jsonPath("crashMultiplier").doesNotExist())
                .andExpect(jsonPath("boosterLevel").doesNotExist()).andExpect(jsonPath("canonicalInput").doesNotExist());
        clock.atMillis(100000);
        String body = mvc.perform(get("/api/rounds/{id}/fairness", r.id()).principal(() -> user.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("status").value("REVEALED"))
                .andExpect(jsonPath("verified").value(true)).andReturn().getResponse().getContentAsString();
        var proof = mapper.readTree(body);
        assertThat(RoundFairness.verify(r.fairnessCommitment(), UUID.fromString(proof.path("roundId").asText()),
                Long.parseLong(proof.path("serverSeed").asText()), proof.path("crashMultiplier").decimalValue(), proof.path("boosterLevel").asInt())).isTrue();
    }

    @Test void snapshotIsAuthoritativeForRefreshCashoutAndFinishedReconnect() throws Exception {
        var r = start(); clock.atMillis(10000);
        mvc.perform(get("/api/rounds/{id}", r.id()).principal(() -> user.toString()))
                .andExpect(jsonPath("roundId").value(r.id().toString())).andExpect(jsonPath("currentLevel").value(3))
                .andExpect(jsonPath("currentMultiplier").value(6)).andExpect(jsonPath("boosterActivated").value(true))
                .andExpect(jsonPath("boosterLevel").value(3)).andExpect(jsonPath("cashoutPerformed").value(false))
                .andExpect(jsonPath("serverTime").value(START.plusSeconds(10).toString()))
                .andExpect(jsonPath("fairnessCommitment").value(r.fairnessCommitment())).andExpect(jsonPath("fairnessReveal").doesNotExist());
        service.cashout(user, r.id()); clock.atMillis(11000);
        mvc.perform(get("/api/rounds/{id}", r.id()).principal(() -> user.toString()))
                .andExpect(jsonPath("cashoutPerformed").value(true)).andExpect(jsonPath("cashoutMultiplier").value(6))
                .andExpect(jsonPath("winAmount").value(600)).andExpect(jsonPath("status").value("CASHED_OUT"));
        clock.atMillis(100000);
        mvc.perform(get("/api/rounds/{id}", r.id()).principal(() -> user.toString()))
                .andExpect(jsonPath("status").value("FINISHED")).andExpect(jsonPath("fairnessReveal.verified").value(true))
                .andExpect(jsonPath("winAmount").value(600)).andExpect(jsonPath("crashMultiplier").value(8.42))
                .andExpect(jsonPath("serverTime").value(START.plusSeconds(100).toString()));
    }

    @Test void replayUsesSafeEventDtoAndRejectsInvalidAndForeignCursors() throws Exception {
        var r = start(); clock.atMillis(1000);
        String body = mvc.perform(get("/api/rounds/{id}/events", r.id()).principal(() -> user.toString()).param("afterSequence", "0"))
                .andExpect(status().isOk()).andExpect(jsonPath("events[0].data.fairnessCommitment").value(r.fairnessCommitment()))
                .andExpect(jsonPath("events[0].eventId").value(r.id() + ":1"))
                .andExpect(jsonPath("events[0].serverTime").exists()).andExpect(jsonPath("snapshotRequired").value(false))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("serverSeed", "\"seed\"", "crashMultiplier", "canonicalInput", "\"config\"", "\"userId\"");
        assertThat(mapper.readTree(body).path("events").get(0).path("data").path("round").path("boosterLevel").asInt()).isEqualTo(3);
        mvc.perform(get("/api/rounds/{id}/events", r.id()).principal(() -> user.toString()).param("afterSequence", "-1")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/rounds/{id}/events", r.id()).principal(() -> user.toString()).param("afterSequence", "bad")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/rounds/{id}/events", r.id()).principal(() -> UUID.randomUUID().toString())).andExpect(status().isForbidden());
        mvc.perform(get("/api/rounds/{id}/fairness", r.id()).principal(() -> UUID.randomUUID().toString())).andExpect(status().isForbidden());
        mvc.perform(get("/api/rounds/{id}/fairness", UUID.randomUUID()).principal(() -> user.toString())).andExpect(status().isNotFound());
    }

    @Test void optionalIdempotencyHeaderReturnsOriginalSuccessEvenAfterCrash() throws Exception {
        var r = start(); clock.atMillis(3000); String key = UUID.randomUUID().toString();
        for (int millis : new int[]{3000, 4000, 100000}) {
            clock.atMillis(millis);
            if (millis == 100000) service.tick(r.id());
            mvc.perform(post("/api/rounds/{id}/cashout", r.id()).principal(() -> user.toString()).header("Idempotency-Key", key))
                    .andExpect(status().isOk()).andExpect(jsonPath("winAmount").value(130))
                    .andExpect(jsonPath("cashoutMultiplier").value(1.3)).andExpect(jsonPath("cashoutPerformed").value(true));
        }
        assertThat(balances.creditCount(user)).isEqualTo(1);
        mvc.perform(post("/api/rounds/{id}/cashout", r.id()).principal(() -> user.toString()).header("Idempotency-Key", "invalid"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/rounds/{id}/cashout", r.id()).principal(() -> UUID.randomUUID().toString()).header("Idempotency-Key", key))
                .andExpect(status().isForbidden());
    }

    @Test void fixedSeedKeepsResultDeterministicWhileCommitmentBindsRoundId() {
        var a = start(); var b = start();
        assertThat(a.seed()).isEqualTo(b.seed()); assertThat(a.crashMultiplier()).isEqualTo(b.crashMultiplier());
        assertThat(a.boosterLevel()).isEqualTo(b.boosterLevel());
        assertThat(a.fairnessCommitment()).isNotEqualTo(b.fairnessCommitment());
        assertThat(RoundFairness.verify(a)).isTrue(); assertThat(RoundFairness.verify(b)).isTrue();
    }
}
