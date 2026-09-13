package ru.hackathon.airballoon;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import ru.hackathon.airballoon.economy.BalanceChange;
import ru.hackathon.airballoon.economy.BalanceService;
import ru.hackathon.airballoon.profile.OutfitRewardService;
import ru.hackathon.airballoon.profile.ProfileService;
import ru.hackathon.airballoon.support.PostgresSupport;
import ru.hackathon.airballoon.user.DemoBootstrap;
import ru.hackathon.airballoon.user.UserService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = ru.airballoon.AirBalloonApplication.class,
        properties = "app.admin-token=test-admin-token")
@AutoConfigureMockMvc
@ActiveProfiles("demo")
class OutfitRewardIntegrationTest extends PostgresSupport {
    private static final String OUTFIT_CODE = "SKY_TRAVELER";

    @Autowired JdbcTemplate jdbc;
    @Autowired DemoBootstrap bootstrap;
    @Autowired BalanceService balances;
    @Autowired UserService users;
    @Autowired ProfileService profiles;
    @Autowired OutfitRewardService outfitRewards;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired MockMvc http;

    UUID anna = DemoBootstrap.id("anna");
    UUID maks = DemoBootstrap.id("maks");

    @BeforeEach
    void reset() {
        assertThat(jdbc.queryForObject("SELECT current_database()", String.class)).isNotEqualTo("air_balloon");
        jdbc.execute("TRUNCATE users CASCADE");
        jdbc.update("DELETE FROM outfit_reward_definitions WHERE code<>?", OUTFIT_CODE);
        jdbc.update("UPDATE outfit_reward_definitions SET reward_amount=500,active=true WHERE code=?", OUTFIT_CODE);
        jdbc.update("UPDATE clothing_items SET active=true");
        bootstrap.run(null);
    }

    @Test
    void incompleteOutfitDoesNotRewardAndCompleteOutfitCreditsFiveHundred() {
        ProfileService.Avatar incomplete = profiles.equip(anna, "SUNHAT", null);
        assertThat(incomplete.newOutfitRewards()).isEmpty();
        assertThat(incomplete.balanceAfter()).isEqualTo(5000);

        unlock(anna, "CLOUD_SCARF");
        ProfileService.Avatar complete = profiles.equip(anna, "SUNHAT", "CLOUD_SCARF");
        assertThat(complete.newOutfitRewards()).singleElement().satisfies(reward -> {
            assertThat(reward.code()).isEqualTo(OUTFIT_CODE);
            assertThat(reward.rewardAmount()).isEqualTo(500);
            assertThat(reward.claimedAt()).isNotNull();
        });
        assertThat(complete.balanceAfter()).isEqualTo(5500);
        assertThat(balances.getBalance(anna)).isEqualTo(5500);
        assertCounts(anna, 1, 1);
    }

    @Test
    void claimPersistsAcrossReequipLoginAndServiceRecreation() throws Exception {
        unlock(anna, "CLOUD_SCARF");
        profiles.equip(anna, "SUNHAT", "CLOUD_SCARF");
        profiles.equip(anna, "SUNHAT", null);

        http.perform(put("/api/current-user/avatar/equipment").principal(() -> anna.toString())
                        .contentType("application/json")
                        .content("{\"headId\":\"SUNHAT\",\"neckId\":\"CLOUD_SCARF\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.newOutfitRewards").isEmpty())
                .andExpect(jsonPath("$.balanceAfter").value(5500));

        var recreatedOutfits = new OutfitRewardService(jdbc, balances);
        var recreatedProfiles = new ProfileService(jdbc, users, Clock.systemUTC(), recreatedOutfits, balances);
        recreatedProfiles.equip(anna, "SUNHAT", null);
        ProfileService.Avatar afterRestart = recreatedProfiles.equip(anna, "SUNHAT", "CLOUD_SCARF");
        assertThat(afterRestart.newOutfitRewards()).isEmpty();
        assertThat(afterRestart.balanceAfter()).isEqualTo(5500);
        assertCounts(anna, 1, 1);
    }

    @Test
    void concurrentCompletionCreatesOneClaimAndOneCredit() throws Exception {
        unlock(anna, "CLOUD_SCARF");
        profiles.equip(anna, "SUNHAT", null);
        var gate = new CountDownLatch(1);
        List<ProfileService.Avatar> results = new ArrayList<>();
        try (var pool = Executors.newFixedThreadPool(12)) {
            List<Future<ProfileService.Avatar>> futures = new ArrayList<>();
            for (int i = 0; i < 24; i++) {
                futures.add(pool.submit(() -> {
                    gate.await();
                    return profiles.equip(anna, "SUNHAT", "CLOUD_SCARF");
                }));
            }
            gate.countDown();
            for (Future<ProfileService.Avatar> future : futures) results.add(future.get(30, TimeUnit.SECONDS));
        }
        assertThat(results.stream().mapToInt(result -> result.newOutfitRewards().size()).sum()).isEqualTo(1);
        assertThat(balances.getBalance(anna)).isEqualTo(5500);
        assertCounts(anna, 1, 1);
    }

    @Test
    void lockedAndForeignInventoryCannotCompleteOutfit() throws Exception {
        http.perform(put("/api/current-user/avatar/equipment").principal(() -> anna.toString())
                        .contentType("application/json")
                        .content("{\"headId\":\"SUNHAT\",\"neckId\":\"CLOUD_SCARF\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ITEM_LOCKED"));

        unlock(maks, "CLOUD_SCARF");
        assertThatThrownBy(() -> profiles.equip(anna, "SUNHAT", "CLOUD_SCARF"))
                .hasMessageContaining("не разблокирован");
        assertThat(balances.getBalance(anna)).isEqualTo(5000);
        assertCounts(anna, 0, 0);
    }

    @Test
    void oneUpdateCanGrantMultipleDefinitionsAndIgnoresUnrelatedSlots() {
        UUID second = definition("SUNHAT_EXPLORER", "Исследователь", 200,
                requirement("HEAD", "SUNHAT"));
        assertThat(second).isNotNull();
        unlock(anna, "CLOUD_SCARF");

        ProfileService.Avatar result = profiles.equip(anna, "SUNHAT", "CLOUD_SCARF");
        assertThat(result.newOutfitRewards()).extracting(OutfitRewardService.RewardGrant::code)
                .containsExactly(OUTFIT_CODE, "SUNHAT_EXPLORER");
        assertThat(result.balanceAfter()).isEqualTo(5700);
        assertThat(balances.getBalance(anna)).isEqualTo(5700);
        assertCounts(anna, 2, 2);
    }

    @Test
    void ledgerAndHistoryExposeOnlyCurrentUsersAuthoritativeState() throws Exception {
        unlock(anna, "CLOUD_SCARF");
        profiles.equip(anna, "SUNHAT", "CLOUD_SCARF");
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM economy_transactions
                WHERE user_id=? AND type='OUTFIT_REWARD' AND amount=500
                  AND balance_before=5000 AND balance_after=5500
                """, Long.class, anna)).isEqualTo(1);

        http.perform(get("/api/current-user/outfit-rewards").principal(() -> anna.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value(OUTFIT_CODE))
                .andExpect(jsonPath("$[0].completed").value(true))
                .andExpect(jsonPath("$[0].claimed").value(true))
                .andExpect(jsonPath("$[0].claimedAt").exists());
        http.perform(get("/api/current-user/outfit-rewards").principal(() -> maks.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].claimed").value(false));
    }

    @Test
    void forgedRewardClaimAndForeignUserFieldsAreRejectedWithoutBalanceChange() throws Exception {
        unlock(anna, "CLOUD_SCARF");
        http.perform(put("/api/current-user/avatar/equipment").principal(() -> anna.toString())
                        .contentType("application/json")
                        .content("""
                                {"headId":"SUNHAT","neckId":"CLOUD_SCARF",
                                 "rewardAmount":999999,"claimed":true,"outfitCode":"SKY_TRAVELER",
                                 "userId":"%s"}
                                """.formatted(maks)))
                .andExpect(status().isBadRequest());
        assertThat(balances.getBalance(anna)).isEqualTo(5000);
        assertThat(balances.getBalance(maks)).isEqualTo(5000);
        assertCounts(anna, 0, 0);
    }

    @Test
    void outerTransactionRollbackRemovesEquipmentClaimLedgerAndBalance() {
        unlock(anna, "CLOUD_SCARF");
        assertThatThrownBy(() -> new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            profiles.equip(anna, "SUNHAT", "CLOUD_SCARF");
            throw new IllegalStateException("injected after economy credit");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(balances.getBalance(anna)).isEqualTo(5000);
        assertThat(profiles.get(anna).avatar().equipped())
                .isEqualTo(new ProfileService.Equipped("AVIATOR", "BOW"));
        assertCounts(anna, 0, 0);
    }

    @Test
    void economyFailureCannotLeaveClaimBehind() {
        unlock(anna, "CLOUD_SCARF");
        BalanceService failingEconomy = new BalanceService() {
            @Override public void lockUser(UUID userId) {}
            @Override public BalanceChange debitBet(UUID userId, UUID roundId, long amount) { throw new UnsupportedOperationException(); }
            @Override public BalanceChange creditWin(UUID userId, UUID roundId, long amount) { throw new UnsupportedOperationException(); }
            @Override public BalanceChange creditOutfitReward(UUID userId, UUID outfitRewardId, long amount) {
                throw new IllegalStateException("injected economy failure");
            }
            @Override public long getBalance(UUID userId) { return 5000; }
        };
        OutfitRewardService failingRewards = new OutfitRewardService(jdbc, failingEconomy);

        assertThatThrownBy(() -> new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            jdbc.update("""
                    UPDATE user_avatar_equipment
                    SET head_clothing_id=(SELECT id FROM clothing_items WHERE code='SUNHAT'),
                        neck_clothing_id=(SELECT id FROM clothing_items WHERE code='CLOUD_SCARF')
                    WHERE user_id=?
                    """, anna);
            failingRewards.grantMatching(anna);
        })).isInstanceOf(IllegalStateException.class).hasMessageContaining("economy failure");
        assertThat(balances.getBalance(anna)).isEqualTo(5000);
        assertCounts(anna, 0, 0);
    }

    @Test
    void databaseConstraintsRejectDuplicateClaimAndInvalidRequirementSlot() {
        unlock(anna, "CLOUD_SCARF");
        profiles.equip(anna, "SUNHAT", "CLOUD_SCARF");
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO user_outfit_reward_claims(id,user_id,outfit_reward_id,ledger_entry_id)
                SELECT ?,user_id,outfit_reward_id,ledger_entry_id
                FROM user_outfit_reward_claims WHERE user_id=?
                """, UUID.randomUUID(), anna)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(() -> definition("INVALID_SLOT", "Неверный слот", 1,
                requirement("NECK", "SUNHAT")))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    private void unlock(UUID userId, String clothingCode) {
        jdbc.update("""
                INSERT INTO user_clothing_items(user_id,clothing_id,source_type,source_id)
                SELECT ?,id,'PUZZLE',id FROM clothing_items WHERE code=?
                ON CONFLICT (user_id,clothing_id) DO NOTHING
                """, userId, clothingCode);
    }

    private Requirement requirement(String slot, String clothingCode) {
        return new Requirement(slot, clothingCode);
    }

    private UUID definition(String code, String title, long amount, Requirement... requirements) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO outfit_reward_definitions(id,code,title,reward_amount,active,ordering)
                VALUES (?,?,?,?,true,20)
                """, id, code, title, amount);
        for (Requirement requirement : requirements) {
            jdbc.update("""
                    INSERT INTO outfit_reward_requirements(outfit_reward_id,slot,clothing_id)
                    SELECT ?,?,id FROM clothing_items WHERE code=?
                    """, id, requirement.slot(), requirement.clothingCode());
        }
        return id;
    }

    private void assertCounts(UUID userId, long claims, long credits) {
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM user_outfit_reward_claims WHERE user_id=?", Long.class, userId))
                .isEqualTo(claims);
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM economy_transactions WHERE user_id=? AND type='OUTFIT_REWARD'
                """, Long.class, userId)).isEqualTo(credits);
    }

    private record Requirement(String slot, String clothingCode) {}
}
