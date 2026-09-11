package ru.hackathon.airballoon;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import ru.hackathon.airballoon.common.*;
import ru.hackathon.airballoon.config.*;
import ru.hackathon.airballoon.economy.*;
import ru.hackathon.airballoon.game.*;
import ru.hackathon.airballoon.history.*;
import ru.hackathon.airballoon.reward.*;
import ru.hackathon.airballoon.score.*;
import ru.hackathon.airballoon.user.*;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="app.admin-token=test-admin-token")
@AutoConfigureMockMvc
@ActiveProfiles("demo")
class EconomyIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired DemoBootstrap bootstrap;
    @Autowired BalanceService balances;
    @Autowired ScoreService scores;
    @Autowired RewardService rewards;
    @Autowired RoundRepository rounds;
    @Autowired RoundTransactions transactions;
    @Autowired PostgresGameConfigProvider configs;
    @Autowired UserService users;
    @Autowired HistoryService history;
    @Autowired PlatformTransactionManager manager;
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    UUID anna=DemoBootstrap.id("anna");

    @BeforeEach void reset() {
        // Refuse cleanup against a developer or production database.
        assertThat(jdbc.queryForObject("SELECT current_database()",String.class)).isEqualTo("balloon_test");
        jdbc.execute("TRUNCATE users CASCADE");
        jdbc.update("UPDATE game_config_active SET version=(SELECT min(version) FROM game_config_versions) WHERE id=1");
        bootstrap.run(null);
    }
    GameRound created(UUID user,long bet,int tier) {
        return new GameRound(UUID.randomUUID(),user,GameRound.Theme.GREEN,bet,tier,tier==1?null:2,false,
            new BigDecimal("8.42"),null,0,0,GameRound.Status.CREATED,null,"test-hash",
            configs.getCurrentConfig().version(),-1,Instant.now().truncatedTo(ChronoUnit.MICROS),null,null,null,null);
    }
    GameRound phase(GameRound r,GameRound.Status status,boolean booster,BigDecimal cashout,long win,Instant finished) {
        Instant now=Instant.now().truncatedTo(ChronoUnit.MICROS);
        return new GameRound(r.id(),r.userId(),r.theme(),r.betAmount(),r.boosterTier(),r.boosterLevel(),
            booster,r.crashMultiplier(),cashout,win,r.roundScore(),status,r.seed(),r.fairnessHash(),r.configVersion(),r.version(),
            r.createdAt(),r.startedAt()==null?now:r.startedAt(),cashout==null?null:(r.cashoutAt()==null?now:r.cashoutAt()),
            finished==null?r.crashedAt():(r.crashedAt()==null?finished:r.crashedAt()),finished);
    }
    GameRound start(UUID user,long bet,int tier) {
        var r=transactions.createAndDebit(created(user,bet,tier));
        return rounds.save(phase(r,GameRound.Status.RUNNING,false,null,0,null));
    }
    GameRound winReady(GameRound r,long amount) {
        return rounds.save(phase(r,GameRound.Status.CASHED_OUT,r.boosterActivated(),new BigDecimal("6.0"),amount,null));
    }
    GameRound finish(GameRound r) {
        return phase(r,GameRound.Status.FINISHED,r.boosterActivated(),r.cashoutMultiplier(),r.winAmount(),Instant.now().truncatedTo(ChronoUnit.MICROS));
    }
    GameConfig changed(long points) {
        var tree=json.valueToTree(configs.getCurrentConfig().config());
        ((com.fasterxml.jackson.databind.node.ObjectNode)tree).put("pointsPerLevel",points);
        try { return json.treeToValue(tree,GameConfig.class); } catch(Exception e) { throw new RuntimeException(e); }
    }
    void setBalance(long balance) { jdbc.update("UPDATE users SET bonus_balance=? WHERE id=?",balance,anna); }
    List<Object> parallel(Supplier<?> a,Supplier<?> b) throws Exception {
        var gate=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            List<Future<Object>> futures=new ArrayList<>();
            for(var job:List.of(a,b)) futures.add(pool.submit(()->{gate.await();try{return job.get();}catch(Exception e){return e;}}));
            gate.countDown();
            List<Object> out=new ArrayList<>();
            for(var f:futures) out.add(f.get(15,TimeUnit.SECONDS));
            return out;
        }
    }

    @Test void bootstrapCreatesThreeProfilesWith5000() {
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users",Long.class)).isEqualTo(3);
        for(String name:List.of("anna","maks","liza")) {
            assertThat(users.getState(DemoBootstrap.id(name)).bonusBalance()).isEqualTo(5000);
            assertThat(users.getState(DemoBootstrap.id(name)).gameScore()).isZero();
        }
    }
    @Test void bootstrapIsIdempotentAndNeverRefillsSpentBalance() {
        setBalance(42); bootstrap.run(null); bootstrap.run(null);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users",Long.class)).isEqualTo(3);
        assertThat(balances.getBalance(anna)).isEqualTo(42);
    }
    @Test void debitIsAtomicAndReceiptIsSaved() {
        var r=rounds.save(created(anna,100,1));
        var receipt=balances.debitBet(anna,r.id(),100);
        assertThat(receipt.balanceBefore()).isEqualTo(5000);
        assertThat(receipt.balanceAfter()).isEqualTo(4900);
        assertThat(balances.getBalance(anna)).isEqualTo(4900);
    }
    @Test void insufficientBalanceRollsBackRoundCreation() {
        setBalance(50); var r=created(anna,100,1);
        assertThatThrownBy(()->transactions.createAndDebit(r)).isInstanceOf(BusinessException.class).hasMessageContaining("Недостаточно");
        assertThat(rounds.findById(r.id())).isEmpty();
        assertThat(balances.getBalance(anna)).isEqualTo(50);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM economy_transactions",Long.class)).isZero();
    }
    @Test void twoParallelBetsCannotOverdraw() throws Exception {
        setBalance(100);
        var a=rounds.save(created(anna,100,1));var b=rounds.save(created(anna,100,1));
        var result=parallel(()->balances.debitBet(anna,a.id(),100),()->balances.debitBet(anna,b.id(),100));
        assertThat(result.stream().filter(x->x instanceof BalanceChange).count()).isEqualTo(1);
        assertThat(result.stream().filter(x->x instanceof BusinessException e && e.code().equals("INSUFFICIENT_BALANCE")).count()).isEqualTo(1);
        assertThat(balances.getBalance(anna)).isZero();
    }
    @Test void sameBetSequentialRetryReturnsOriginalReceipt() {
        var r=rounds.save(created(anna,100,1)); var a=balances.debitBet(anna,r.id(),100);
        var b=balances.debitBet(anna,r.id(),100);
        assertThat(b.transactionId()).isEqualTo(a.transactionId());assertThat(b.replayed()).isTrue();
        assertThat(balances.getBalance(anna)).isEqualTo(4900);
    }
    @Test void sameBetParallelRetryDebitsOnce() throws Exception {
        var r=rounds.save(created(anna,100,1));
        assertThat(parallel(()->balances.debitBet(anna,r.id(),100),()->balances.debitBet(anna,r.id(),100))).allMatch(x->x instanceof BalanceChange);
        assertThat(balances.getBalance(anna)).isEqualTo(4900);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM economy_transactions",Long.class)).isEqualTo(1);
    }
    @Test void duplicateWithDifferentAmountRejected() {
        var r=rounds.save(created(anna,100,1));balances.debitBet(anna,r.id(),100);
        assertThatThrownBy(()->balances.debitBet(anna,r.id(),99)).isInstanceOf(BusinessException.class);
        assertThat(balances.getBalance(anna)).isEqualTo(4900);
    }
    @Test void successfulCreditAndReplay() {
        var r=winReady(start(anna,100,1),600);
        balances.creditWin(anna,r.id(),600);
        assertThat(balances.creditWin(anna,r.id(),600).replayed()).isTrue();
        assertThat(balances.getBalance(anna)).isEqualTo(5500);
    }
    @Test void parallelWinCreditsOnce() throws Exception {
        var r=winReady(start(anna,100,1),600);
        assertThat(parallel(()->balances.creditWin(anna,r.id(),600),()->balances.creditWin(anna,r.id(),600))).allMatch(x->x instanceof BalanceChange);
        assertThat(balances.getBalance(anna)).isEqualTo(5500);
    }
    @Test void cannotCreditWithoutCashoutOrWithWrongOwner() {
        var r=start(anna,100,1);
        assertThatThrownBy(()->balances.creditWin(anna,r.id(),600)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(()->balances.creditWin(DemoBootstrap.id("maks"),r.id(),600)).isInstanceOf(BusinessException.class);
    }
    @Test void scoreAndBalanceAreIndependentAndLevelReplayIsSafe() {
        var r=start(anna,100,1);
        scores.awardLevelPoints(anna,r.id(),1,100);
        assertThat(scores.awardLevelPoints(anna,r.id(),1,100).replayed()).isTrue();
        assertThat(users.getState(anna).gameScore()).isEqualTo(100);
        assertThat(balances.getBalance(anna)).isEqualTo(4900);
        assertThat(rounds.findById(r.id()).orElseThrow().roundScore()).isEqualTo(100);
    }
    @Test void parallelLevelEventAwardsOnce() throws Exception {
        var r=start(anna,100,1);
        assertThat(parallel(()->scores.awardLevelPoints(anna,r.id(),1,100),()->scores.awardLevelPoints(anna,r.id(),1,100)))
            .allMatch(x->x instanceof ScoreChange);
        assertThat(users.getState(anna).gameScore()).isEqualTo(100);
    }
    @Test void invalidScoreEventRejected() {
        var r=start(anna,100,1);
        assertThatThrownBy(()->scores.awardLevelPoints(anna,r.id(),10,100)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(()->scores.awardLevelPoints(anna,r.id(),1,500)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(()->scores.awardBoosterPoints(anna,r.id(),2,200)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(()->scores.awardCashoutPoints(anna,r.id(),50)).isInstanceOf(BusinessException.class);
    }
    @Test void boosterAndCashoutPointsAreIdempotent() {
        var r=start(anna,100,3);
        r=rounds.save(phase(r,GameRound.Status.RUNNING,true,null,0,null));
        scores.awardBoosterPoints(anna,r.id(),3,300);scores.awardBoosterPoints(anna,r.id(),3,300);
        r=winReady(r,600);
        scores.awardCashoutPoints(anna,r.id(),50);scores.awardCashoutPoints(anna,r.id(),50);
        assertThat(users.getState(anna).gameScore()).isEqualTo(350);
    }
    @Test void configUpdatesPreserveOldRoundSnapshot() {
        var old=start(anna,100,1);
        var initial=configs.getCurrentConfig();
        var saved=configs.update(initial.version(),changed(500));
        assertThat(saved.version()).isGreaterThan(initial.version());
        var next=start(anna,100,1);
        scores.awardLevelPoints(anna,old.id(),1,100);
        scores.awardLevelPoints(anna,next.id(),1,500);
        assertThat(users.getState(anna).gameScore()).isEqualTo(600);
        assertThat(configs.getVersion(old.configVersion()).config().pointsPerLevel()).isEqualTo(100);
    }
    @Test void invalidConfigAndStaleVersionRejected() {
        var initial=configs.getCurrentConfig();
        assertThatThrownBy(()->configs.update(initial.version(),changed(-1))).isInstanceOf(BusinessException.class);
        configs.update(initial.version(),changed(500));
        assertThatThrownBy(()->configs.update(initial.version(),changed(800))).isInstanceOf(BusinessException.class);
        assertThat(configs.getCurrentConfig().config().pointsPerLevel()).isEqualTo(500);
    }
    @Test void scenarioFiveAdminHttpToNewRoundAndOldSnapshot() throws Exception {
        var old=start(anna,100,1);
        http.perform(get("/api/admin/config").header("X-Admin-Token","test-admin-token"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.config.pointsPerLevel").value(100));
        var body=Map.of("expectedVersion",configs.getCurrentConfig().version(),"config",changed(500));
        http.perform(put("/api/admin/config").header("X-Admin-Token","test-admin-token").contentType("application/json").content(json.writeValueAsString(body)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.config.pointsPerLevel").value(500));
        http.perform(get("/api/admin/config").header("X-Admin-Token","test-admin-token"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.config.pointsPerLevel").value(500));
        assertThat(configs.getCurrentConfig().config().pointsPerLevel()).isEqualTo(500);
        var next=start(anna,100,1);
        scores.awardLevelPoints(anna,next.id(),1,500);
        assertThat(rounds.findById(next.id()).orElseThrow().roundScore()).isEqualTo(500);
        scores.awardLevelPoints(anna,old.id(),1,100);
        assertThat(rounds.findById(old.id()).orElseThrow().roundScore()).isEqualTo(100);
    }
    @Test void adminRejectsAnonymousAndBadPayload() throws Exception {
        http.perform(get("/api/admin/config")).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ADMIN_ACCESS_DENIED"));
        http.perform(put("/api/admin/config").header("X-Admin-Token","test-admin-token").contentType("application/json")
            .content(json.writeValueAsString(Map.of("expectedVersion",configs.getCurrentConfig().version(),"config",changed(-1)))))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_GAME_CONFIG"));
    }
    @Test void historyIncludesAllUsersSortedAndPaginated() throws Exception {
        for(String name:List.of("anna","maks","liza")) transactions.finishAndReward(finish(start(DemoBootstrap.id(name),100,1)));
        start(anna,100,1); // Active round must not appear.
        var page=history.getHistory(0,2);
        assertThat(page.total()).isEqualTo(3);assertThat(page.items()).hasSize(2);
        assertThat(page.items().getFirst().username()).isEqualTo("liza");
        assertThat(history.getHistory(1,2).items().getFirst().username()).isEqualTo("anna");
        http.perform(get("/api/history?size=3")).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(3));
        http.perform(get("/api/history?size=101")).andExpect(status().isBadRequest());
    }
    @Test void winningRoundRemainsWinAfterCrash() {
        var r=start(anna,100,1);
        r=transactions.saveCashoutAndCredit(phase(r,GameRound.Status.CASHED_OUT,false,new BigDecimal("6.0"),600,null));
        var finished=transactions.finishAndReward(finish(r));
        assertThat(history.getResult(finished.id()).result()).isEqualTo("WIN");
        assertThat(history.getHistory(0,20).items().getFirst().result()).isEqualTo("WIN");
    }
    @Test void rewardIsPersistedAndReadDoesNotRegenerate() throws Exception {
        var r=transactions.finishAndReward(finish(start(anna,100,1)));
        var a=rewards.generateReward(r);var b=rewards.generateReward(r);
        assertThat(a).isEqualTo(b);
        assertThat(history.getResult(r.id()).reward()).isEqualTo(a);
        http.perform(get("/api/rounds/"+r.id()+"/result")).andExpect(status().isOk()).andExpect(jsonPath("$.reward.id").value(a.id().toString()));
    }
    @Test void parallelRewardGeneratesOnlyOne() throws Exception {
        var r=rounds.save(finish(start(anna,100,1)));
        var results=parallel(()->rewards.generateReward(r),()->rewards.generateReward(r));
        assertThat(results).allMatch(x->x instanceof Reward);
        assertThat(results.get(0)).isEqualTo(results.get(1));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM round_rewards",Long.class)).isEqualTo(1);
    }
    @Test void rewardAndResultUnavailableBeforeFinish() {
        var r=start(anna,100,1);
        assertThatThrownBy(()->rewards.generateReward(r)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(()->history.getResult(r.id())).isInstanceOf(BusinessException.class);
    }
    @Test void staleRoundSaveCannotOverwrite() {
        var r=start(anna,100,1);
        rounds.save(phase(r,GameRound.Status.CASHED_OUT,false,new BigDecimal("2.0"),200,null));
        assertThatThrownBy(()->rounds.save(phase(r,GameRound.Status.CRASHED,false,null,0,null))).isInstanceOf(BusinessException.class);
    }
    @Test void databaseConstraintsRejectNegativeAndDuplicateLedger() {
        assertThatThrownBy(()->jdbc.update("UPDATE users SET bonus_balance=-1 WHERE id=?",anna)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(()->jdbc.update("UPDATE users SET game_score=-1 WHERE id=?",anna)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        var r=start(anna,100,1);
        assertThatThrownBy(()->jdbc.update("""
            INSERT INTO economy_transactions(id,user_id,round_id,type,amount,balance_before,balance_after)
            SELECT ?,user_id,round_id,type,amount,balance_before,balance_after FROM economy_transactions WHERE round_id=?
            """,UUID.randomUUID(),r.id())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
    @Test void transactionFailureRollsBackCashoutBalanceAndScore() {
        var r=start(anna,100,1);
        var tx=new TransactionTemplate(manager);
        assertThatThrownBy(()->tx.execute(status->{
            transactions.saveCashoutAndCredit(phase(r,GameRound.Status.CASHED_OUT,false,new BigDecimal("6.0"),600,null));
            throw new IllegalStateException("Injected failure");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(balances.getBalance(anna)).isEqualTo(4900);
        assertThat(users.getState(anna).gameScore()).isZero();
        assertThat(rounds.findById(r.id()).orElseThrow().cashoutAt()).isNull();
    }
    @Test void fullIntegrationScenario() {
        setBalance(1000);
        var initial=configs.getCurrentConfig();
        // Scenario uses no cashout bonus: level 100 + booster 300 = 400.
        var node=(com.fasterxml.jackson.databind.node.ObjectNode)json.valueToTree(initial.config());
        node.put("pointsCashoutBonus",0);
        try { configs.update(initial.version(),json.treeToValue(node,GameConfig.class)); } catch(Exception e) { throw new RuntimeException(e); }
        var r=start(anna,100,3);
        assertThat(balances.getBalance(anna)).isEqualTo(900);
        scores.awardLevelPoints(anna,r.id(),1,100);
        r=rounds.save(phase(r,GameRound.Status.RUNNING,true,null,0,null));
        scores.awardBoosterPoints(anna,r.id(),3,300);
        assertThat(users.getState(anna).gameScore()).isEqualTo(400);
        r=transactions.saveCashoutAndCredit(phase(r,GameRound.Status.CASHED_OUT,true,new BigDecimal("6.0"),600,null));
        assertThat(balances.getBalance(anna)).isEqualTo(1500);
        r=transactions.finishAndReward(finish(r));
        assertThat(history.getResult(r.id()).score()).isEqualTo(400);
        assertThat(history.getResult(r.id()).reward()).isNotNull();
        configs.update(configs.getCurrentConfig().version(),changed(500));
        var next=start(anna,100,1);
        scores.awardLevelPoints(anna,next.id(),1,500);
        assertThat(users.getState(anna).gameScore()).isEqualTo(900);
    }
    @Test void userStateAndErrorApi() throws Exception {
        http.perform(get("/api/users/"+anna+"/state")).andExpect(status().isOk())
            .andExpect(jsonPath("$.bonusBalance").value(5000)).andExpect(jsonPath("$.gameScore").value(0));
        http.perform(get("/api/users/"+UUID.randomUUID()+"/state")).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));
        http.perform(get("/api/users/not-a-uuid/state")).andExpect(status().isBadRequest());
    }

    @Test void configConcurrentEditorsCannotLoseUpdate() throws Exception {
        var current=configs.getCurrentConfig();
        var a=changed(500);var b=changed(800);
        var result=parallel(()->configs.update(current.version(),a),()->configs.update(current.version(),b));
        assertThat(result.stream().filter(x->x instanceof ConfigSnapshot).count()).isEqualTo(1);
        assertThat(result.stream().filter(x->x instanceof BusinessException e && e.code().equals("CONFIG_VERSION_CONFLICT")).count()).isEqualTo(1);
    }
    @Test void winOverflowRollsBackWithoutLedgerEntry() {
        var r=winReady(start(anna,100,1),600);
        setBalance(Long.MAX_VALUE);
        assertThatThrownBy(()->balances.creditWin(anna,r.id(),600)).isInstanceOf(BusinessException.class);
        assertThat(balances.getBalance(anna)).isEqualTo(Long.MAX_VALUE);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM economy_transactions WHERE type='WIN_CREDIT'",Long.class)).isZero();
    }
    @Test void scoreOverflowRollsBackWithoutEvent() {
        var r=start(anna,100,1);
        jdbc.update("UPDATE users SET game_score=? WHERE id=?",Long.MAX_VALUE,anna);
        assertThatThrownBy(()->scores.awardLevelPoints(anna,r.id(),1,100)).isInstanceOf(BusinessException.class);
        assertThat(users.getState(anna).gameScore()).isEqualTo(Long.MAX_VALUE);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM score_events",Long.class)).isZero();
    }
    @Test void failedFinishRollsBackRewardAndResult() {
        var r=start(anna,100,1);
        assertThatThrownBy(()->new TransactionTemplate(manager).execute(status->{
            transactions.finishAndReward(finish(r));
            throw new IllegalStateException("Failure after reward persistence");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(rounds.findById(r.id()).orElseThrow().finishedAt()).isNull();
        assertThat(rewards.findByRound(r.id())).isEmpty();
        assertThat(history.getHistory(0,20).total()).isZero();
    }
    @Test void databaseEnforcesScoreRewardUniquenessAndOwnership() {
        var r=start(anna,100,1);
        scores.awardLevelPoints(anna,r.id(),1,100);
        assertThatThrownBy(()->jdbc.update("""
            INSERT INTO score_events(id,user_id,round_id,type,event_key,points)
            SELECT ?,user_id,round_id,type,event_key,points FROM score_events WHERE round_id=?
            """,UUID.randomUUID(),r.id())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(()->jdbc.update("""
            INSERT INTO score_events(id,user_id,round_id,type,event_key,points) VALUES (?,?,?,'LEVEL',2,100)
            """,UUID.randomUUID(),DemoBootstrap.id("maks"),r.id())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        transactions.finishAndReward(finish(r));
        assertThatThrownBy(()->jdbc.update("""
            INSERT INTO round_rewards(id,round_id,user_id,type,rarity)
            SELECT ?,round_id,user_id,type,rarity FROM round_rewards WHERE round_id=?
            """,UUID.randomUUID(),r.id())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
    @Test void demoListingAndEncodedAdminPath() throws Exception {
        http.perform(get("/api/demo/users")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3))
            .andExpect(jsonPath("$[0].username").value("anna")).andExpect(jsonPath("$[0].bonusBalance").value(5000));
        http.perform(get(java.net.URI.create("/api/%61dmin/config"))).andExpect(status().isForbidden());
    }
}
