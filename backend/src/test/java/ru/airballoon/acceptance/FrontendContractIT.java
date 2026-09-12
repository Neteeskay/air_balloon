package ru.airballoon.acceptance;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import ru.hackathon.airballoon.acceptance.GameAcceptanceSupport;
import static org.assertj.core.api.Assertions.assertThat;
import static ru.hackathon.airballoon.acceptance.BackendAcceptanceDriver.*;

class FrontendContractIT extends GameAcceptanceSupport {
    @Autowired CoreBackendAcceptanceDriver core;
    @Autowired JdbcTemplate jdbc;

    @Test
    void missingInvalidAndExpiredSessionsHaveStable401Contract() {
        for (String path : new String[]{"/api/auth/me","/api/current-user/state",
                "/api/current-user/balance","/api/current-user/history","/api/rounds/"+UUID.randomUUID()+"/result"}) {
            assertError(core.getAnonymous(path),401,"AUTH_REQUIRED");
            assertError(core.getWithCookie("JSESSIONID=not-a-valid-session",path),401,"AUTH_REQUIRED");
        }
        assertThat(core.postAnonymous("/api/rounds",Map.of(
                "theme","GREEN","betAmount",100,"boosterMultiplier",1)).getStatusCode().value()).isEqualTo(401);

        Player player=user("Expired",1000);
        String expiredCookie=core.sessionCookie(player.id());
        assertThat(core.get(player.id(),"/api/current-user/balance").getStatusCode().value()).isEqualTo(200);
        assertThat(core.deleteSession(player.id()).getStatusCode().value()).isEqualTo(204);
        assertError(core.getWithCookie(expiredCookie,"/api/current-user/balance"),401,"AUTH_REQUIRED");
    }

    @Test
    void currentUserResultHistoryAndRoundMutationArePrincipalScoped() {
        Player alice=user("Alice",1000);
        Player bob=user("Bob",2000);

        JsonNode aliceState=body(core.get(alice.id(),"/api/current-user/state"));
        JsonNode bobState=body(core.get(bob.id(),"/api/current-user/state"));
        assertThat(aliceState.path("userId").asText()).isEqualTo(alice.id().toString());
        assertThat(bobState.path("userId").asText()).isEqualTo(bob.id().toString());
        assertThat(body(core.get(alice.id(),"/api/current-user/balance")).path("bonusBalance").asLong()).isEqualTo(1000);
        assertThat(body(core.get(bob.id(),"/api/current-user/balance")).path("bonusBalance").asLong()).isEqualTo(2000);
        assertError(core.get(alice.id(),"/api/users/"+bob.id()+"/state"),403,"NOT_OWNER");

        Round aliceRound=start(alice,1);
        assertThat(driver.cashout(bob.id(),aliceRound.id(),Map.of()).status()).isEqualTo(403);
        driver.reachCrash(aliceRound.id());
        Round bobRound=start(bob,1);
        driver.reachCrash(bobRound.id());

        assertError(core.get(bob.id(),"/api/rounds/"+aliceRound.id()+"/result"),403,"NOT_OWNER");
        assertThat(body(core.get(alice.id(),"/api/rounds/"+aliceRound.id()+"/result")).path("roundId").asText())
                .isEqualTo(aliceRound.id().toString());

        JsonNode aliceHistory=body(core.get(alice.id(),"/api/current-user/history?size=100"));
        JsonNode bobHistory=body(core.get(bob.id(),"/api/current-user/history?size=100"));
        assertThat(roundIds(aliceHistory)).contains(aliceRound.id()).doesNotContain(bobRound.id());
        assertThat(roundIds(bobHistory)).contains(bobRound.id()).doesNotContain(aliceRound.id());
        // Global history is authenticated and privacy-safe; it does not expose userId.
        assertError(core.getAnonymous("/api/history?size=100"), 401, "AUTH_REQUIRED");
        JsonNode globalHistory = body(core.get(alice.id(), "/api/history?size=100"));
        assertThat(roundIds(globalHistory)).contains(aliceRound.id(), bobRound.id());
        for (JsonNode item : globalHistory.path("items")) {
            assertThat(item.has("userId")).isFalse();
            assertThat(item.has("username")).isFalse();
        }
    }

    @Test
    void catalogAdvertisesOnlyEngineAcceptedThemesStakeBoundsAndBoosters() {
        JsonNode catalog=body(core.getAnonymous("/api/game/catalog"));
        assertThat(catalog.path("active").asBoolean()).isTrue();
        assertThat(catalog.path("themes").findValue("levels").isInt()).isTrue();
        assertThat(levels(catalog,"GREEN")).isEqualTo(9);
        assertThat(levels(catalog,"RED")).isEqualTo(12);
        BigDecimal minimum=catalog.path("stakes").path("minimum").decimalValue();
        BigDecimal maximum=catalog.path("stakes").path("maximum").decimalValue();
        assertThat(minimum).isEqualByComparingTo("1");
        assertThat(maximum).isEqualByComparingTo("1000");

        assertThat(catalog.path("stakeOptions").size()).isEqualTo(4);
        Player player=user("Catalog",5000);
        for (JsonNode option : catalog.path("stakeOptions")) {
            BigDecimal amount = option.path("amount").decimalValue();
            int multiplier = option.path("boosterMultiplier").asInt();
            Response<Round> started=driver.start(player.id(),Theme.GREEN,amount,multiplier,
                    SeedProfile.LATE_CRASH_AFTER_LEVEL_3,Map.of());
            assertThat(started.status()).isEqualTo(201);
            driver.reachCrash(started.body().id());
        }
        // The unpaired option-1 amount with x4 must be rejected by the HTTP contract.
        Player invalid=user("CatalogInvalid",5000);
        assertThat(driver.start(invalid.id(), Theme.RED, catalog.path("stakeOptions").get(0).path("amount").decimalValue(), 4,
                SeedProfile.LATE_CRASH_AFTER_LEVEL_3, Map.of()).status()).isEqualTo(400);
    }

    @Test
    void noCashoutScoreMatchesRoundResultHistoryLedgerAndUserTotal() {
        Player player=user("NoCashout",1000);
        Round round=start(player,1);
        driver.reachCrash(round.id());

        long ledger=score(round.id());
        assertThat(ledger).isEqualTo(900);
        assertThat(body(core.get(player.id(),"/api/rounds/"+round.id())).path("roundScore").asLong()).isEqualTo(ledger);
        assertThat(body(core.get(player.id(),"/api/rounds/"+round.id()+"/result")).path("score").asLong()).isEqualTo(ledger);
        assertThat(historyScore(player.id(),round.id())).isEqualTo(ledger);
        assertThat(driver.player(player.id()).gameScore()).isEqualTo(ledger);
    }

    @Test
    void cashoutAndBoosterScoreMatchesEveryDtoAndTournamentProjection() {
        UUID tournament=driver.createActiveTournament();
        Player player=user("AllBonuses",1000);
        Round round=ok(driver.start(player.id(),Theme.GREEN,new BigDecimal("500"),3,
                SeedProfile.X3_BOOSTER_AT_LEVEL_2_LATE_CRASH,Map.of()));
        driver.reachLevel(round.id(),2);
        assertThat(ok(driver.cashout(player.id(),round.id(),Map.of())).state()).isEqualTo("RUNNING");
        long expected=score(round.id());
        assertThat(score(round.id(),"LEVEL")).isGreaterThanOrEqualTo(200);
        assertThat(score(round.id(),"BOOSTER")).isEqualTo(300);
        assertThat(score(round.id(),"CASHOUT")).isEqualTo(50);
        assertThat(body(core.get(player.id(),"/api/rounds/"+round.id())).path("roundScore").asLong()).isEqualTo(expected);
        driver.reachCrash(round.id());

        assertThat(score(round.id())).isEqualTo(expected);
        assertThat(body(core.get(player.id(),"/api/rounds/"+round.id())).path("roundScore").asLong()).isEqualTo(expected);
        assertThat(body(core.get(player.id(),"/api/rounds/"+round.id()+"/result")).path("score").asLong()).isEqualTo(expected);
        assertThat(historyScore(player.id(),round.id())).isEqualTo(expected);
        assertThat(driver.player(player.id()).gameScore()).isEqualTo(expected);
        assertThat(ok(driver.leaderboard(tournament,player.id(),0,50)).currentPlayer().score()).isEqualTo(expected);
    }

    @Test
    void scenario8WinOfferPurchaseIsAtomicAndLossHasNoOffer() {
        Player winner = user("S8Winner", 1000);
        Round winRound = start(winner, 1);
        driver.reachLevel(winRound.id(), 1);
        ok(driver.cashout(winner.id(), winRound.id(), Map.of()));
        driver.reachCrash(winRound.id());

        JsonNode offer = body(core.get(winner.id(), "/api/current-user/upsell/lottery-tickets/offer?roundId=" + winRound.id()));
        assertThat(offer.path("offerId").isTextual()).isTrue();
        assertThat(offer.path("price").asLong()).isPositive();
        assertThat(offer.path("ticketCount").asInt()).isPositive();
        long balanceBefore = body(core.get(winner.id(), "/api/current-user/state")).path("bonusBalance").asLong();
        long ticketsBefore = body(core.get(winner.id(), "/api/current-user/state")).path("lotteryTicketCount").asLong();
        String key = "22222222-2222-4222-8222-222222222222";
        JsonNode purchased = body(core.post(winner.id(), "/api/current-user/upsell/lottery-tickets/purchase",
                Map.of("offerId", offer.path("offerId").asText()), key));
        assertThat(purchased.path("replayed").asBoolean()).isFalse();
        assertThat(purchased.path("bonusBalance").asLong()).isEqualTo(balanceBefore - offer.path("price").asLong());
        assertThat(purchased.path("lotteryTicketCount").asLong()).isEqualTo(ticketsBefore + offer.path("ticketCount").asInt());
        JsonNode replay = body(core.post(winner.id(), "/api/current-user/upsell/lottery-tickets/purchase",
                Map.of("offerId", offer.path("offerId").asText()), key));
        assertThat(replay.path("replayed").asBoolean()).isTrue();
        assertThat(replay.path("bonusBalance").asLong()).isEqualTo(purchased.path("bonusBalance").asLong());
        assertThat(replay.path("lotteryTicketCount").asLong()).isEqualTo(purchased.path("lotteryTicketCount").asLong());

        Player loser = user("S8Loser", 1000);
        Round lossRound = start(loser, 1);
        driver.reachCrash(lossRound.id());
        ResponseEntity<JsonNode> lossOffer = core.get(loser.id(), "/api/current-user/upsell/lottery-tickets/offer?roundId=" + lossRound.id());
        assertThat(lossOffer.getStatusCode().value()).isEqualTo(204);
    }

    @Test
    void scenario8SchemaUpgradesFrom304To305WithoutDataLoss() {
        try (var postgres=new PostgreSQLContainer<>("postgres:17-alpine")) {
            postgres.start();
            Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword())
                    .locations("classpath:db/migration").target("304").load().migrate();
            JdbcTemplate upgrade=new JdbcTemplate(new org.springframework.jdbc.datasource.DriverManagerDataSource(
                    postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword()));
            upgrade.update("INSERT INTO users(id,username,display_name) VALUES (?,?,?)",UUID.randomUUID(),"upgrade-user","Upgrade User");
            assertThat(upgrade.queryForObject("SELECT config_json ? 'scenario8Enabled' FROM game_config_versions WHERE version=1",Boolean.class)).isFalse();

            Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword())
                    .locations("classpath:db/migration").load().migrate();
            assertThat(upgrade.queryForObject("SELECT config_json->>'scenario8Enabled' FROM game_config_versions WHERE version=1",String.class)).isEqualTo("true");
            assertThat(upgrade.queryForObject("SELECT lottery_ticket_count FROM users WHERE username='upgrade-user'",Long.class)).isZero();
            assertThat(upgrade.queryForObject("SELECT count(*) FROM users WHERE username='upgrade-user'",Long.class)).isEqualTo(1);
        }
    }

    private long historyScore(UUID userId,UUID roundId) {
        for (JsonNode item : body(core.get(userId,"/api/current-user/history?size=100")).path("items"))
            if (item.path("roundId").asText().equals(roundId.toString())) return item.path("score").asLong();
        throw new AssertionError("Round missing from personal history: "+roundId);
    }

    private long score(UUID roundId) {
        return jdbc.queryForObject("SELECT COALESCE(sum(points),0) FROM score_events WHERE round_id=?",Long.class,roundId);
    }

    private long score(UUID roundId,String type) {
        return jdbc.queryForObject("SELECT COALESCE(sum(points),0) FROM score_events WHERE round_id=? AND type=?",
                Long.class,roundId,type);
    }

    private static int levels(JsonNode catalog,String theme) {
        for (JsonNode item : catalog.path("themes"))
            if (item.path("theme").asText().equals(theme)) return item.path("levels").asInt();
        return -1;
    }

    private static java.util.List<UUID> roundIds(JsonNode page) {
        java.util.List<UUID> ids=new java.util.ArrayList<>();
        for (JsonNode item : page.path("items")) ids.add(UUID.fromString(item.path("roundId").asText()));
        return ids;
    }

    private static JsonNode body(ResponseEntity<JsonNode> response) {
        assertThat(response.getStatusCode().value()).isBetween(200,299);
        assertThat(response.getBody()).isNotNull();
        return response.getBody();
    }

    private static void assertError(ResponseEntity<JsonNode> response,int status,String code) {
        assertThat(response.getStatusCode().value()).isEqualTo(status);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().path("code").asText()).isEqualTo(code);
    }
}
