package ru.hackathon.airballoon;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
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
import ru.hackathon.airballoon.profile.*;
import ru.hackathon.airballoon.rating.service.GlobalRatingService;
import ru.hackathon.airballoon.reward.*;
import ru.hackathon.airballoon.score.*;
import ru.hackathon.airballoon.user.*;
import ru.hackathon.airballoon.upsell.Scenario8OfferService;
import ru.hackathon.airballoon.support.PostgresSupport;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="app.admin-token=test-admin-token")
@AutoConfigureMockMvc
@ActiveProfiles("demo")
class EconomyIntegrationTest extends PostgresSupport {
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
    @Autowired Scenario8OfferService scenario8;
    @Autowired PuzzleRewardService puzzleRewards;
    @Autowired ProfileService profiles;
    @Autowired GlobalRatingService globalRating;
    @Autowired PlatformTransactionManager manager;
    @Autowired MockMvc http;
    @Autowired ObjectMapper json;
    @Autowired ru.hackathon.airballoon.admin.config.service.ConfigAdminService adminConfigs;
    UUID anna=DemoBootstrap.id("anna");

    @BeforeEach void reset() {
        // Refuse cleanup against a developer or production database.
        assertThat(jdbc.queryForObject("SELECT current_database()",String.class)).isNotEqualTo("air_balloon");
        jdbc.execute("TRUNCATE users CASCADE");
        jdbc.update("UPDATE clothing_items SET active=true");
        jdbc.update("""
                UPDATE game_config_active
                SET version=(SELECT min(version) FROM game_config_versions WHERE config_json->>'alpha'='0.03')
                WHERE id=1
                """);
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
        var oldLive=configs.getCurrentConfig();
        UUID tournamentId=UUID.randomUUID();
        Instant now=Instant.now();
        jdbc.update("""
                INSERT INTO tournament.tournaments
                    (id,name,description,starts_at,ends_at,created_at,updated_at)
                VALUES (?,?,?,?::timestamptz,?::timestamptz,?::timestamptz,?::timestamptz)
                """,tournamentId,"Admin config acceptance","",now.minusSeconds(60).toString(),
                now.plusSeconds(3600).toString(),now.toString(),now.toString());
        jdbc.update("""
                INSERT INTO tournament.participants
                    (tournament_id,user_id,username,score,score_version,joined_at,updated_at)
                VALUES (?,?,?,?,?,?,?)
                """,tournamentId,anna,"anna",0,0,Timestamp.from(now),Timestamp.from(now));
        String token=adminToken();
        var currentResult=http.perform(get("/api/admin/config/current").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andReturn();
        var current=json.readTree(currentResult.getResponse().getContentAsString());
        var body=json.createObjectNode();
        for(String field:List.of("gameId","gameName","gameType","isActive","crash","boosters","points")) {
            body.set(field,current.path(field));
        }
        body.put("revision",current.path("revision").asLong()+1);
        ((com.fasterxml.jackson.databind.node.ObjectNode)body.path("points")).put("pointsPerLine",500);
        var created=http.perform(post("/api/admin/config").header("Authorization","Bearer "+token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
            .andExpect(status().isCreated())
            .andExpect(header().exists("ETag")).andReturn();
        String location=created.getResponse().getHeader("Location");
        assertThat(location).isNotNull();
        String id=location.substring(location.lastIndexOf('/')+1);
        http.perform(post("/api/admin/config/"+id+"/activate").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"));
        var liveNow = configs.getCurrentConfig().config();
        assertThat(liveNow.pointsPerLevel()).isEqualTo(500);
        assertThat(liveNow.pointsX2Bonus()).isEqualTo(oldLive.config().pointsX2Bonus());
        assertThat(liveNow.pointsX3Bonus()).isEqualTo(oldLive.config().pointsX3Bonus());
        assertThat(liveNow.pointsX4Bonus()).isEqualTo(oldLive.config().pointsX4Bonus());
        assertThat(liveNow.updateIntervalMs()).isEqualTo(oldLive.config().updateIntervalMs());
        assertThat(liveNow.minBet()).isEqualByComparingTo(oldLive.config().minBet());
        assertThat(liveNow.maxBet()).isEqualByComparingTo(oldLive.config().maxBet());
        assertThat(liveNow.scenario8Enabled()).isEqualTo(oldLive.config().scenario8Enabled());
        assertThat(liveNow.scenario8MinWinAmount()).isEqualTo(oldLive.config().scenario8MinWinAmount());
        assertThat(liveNow.scenario8Price()).isEqualTo(oldLive.config().scenario8Price());
        assertThat(liveNow.scenario8TicketCount()).isEqualTo(oldLive.config().scenario8TicketCount());
        assertThat(configs.getVersion(old.configVersion()).config().pointsPerLevel()).isEqualTo(100);
        var next=start(anna,100,1);
        scores.awardLevelPoints(anna,next.id(),1,500);
        assertThat(rounds.findById(next.id()).orElseThrow().roundScore()).isEqualTo(500);
        scores.awardLevelPoints(anna,old.id(),1,100);
        assertThat(rounds.findById(old.id()).orElseThrow().roundScore()).isEqualTo(100);
        var finished=transactions.finishAndReward(finish(winReady(next,600)));
        assertThat(history.getResult(finished.id()).score()).isEqualTo(500);
        assertThat(globalRating.rating(anna,0,100).currentPlayer().score()).isEqualTo(600);
        assertThat(jdbc.queryForObject("""
                SELECT score FROM tournament.participants WHERE tournament_id=? AND user_id=?
                """,Long.class,tournamentId,anna)).isEqualTo(600);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM tournament.participants WHERE tournament_id=?",
                Long.class,tournamentId)).isEqualTo(1);
        assertThat(puzzleRewards.findByRound(finished.id())).get()
                .extracting(PuzzleRewardService.RewardView::fragments).isEqualTo(1);
        assertThat(scenario8.offer(anna,finished.id())).isNotNull()
                .extracting(Scenario8OfferService.OfferView::price,Scenario8OfferService.OfferView::ticketCount)
                .containsExactly(oldLive.config().scenario8Price(),oldLive.config().scenario8TicketCount());
    }

    @Test void adminRejectsAnonymousAndBadPayload() throws Exception {
        http.perform(get("/api/admin/config/versions"))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        String token=adminToken();
        long revision=activeRevision(token);
        var bad=(Map<String,Object>)draftBody(revision + 1,500);
        var boosters=(Map<String,Object>)bad.get("boosters");
        boosters.put("multiplierTier3Value",5.0);
        http.perform(post("/api/admin/config").header("Authorization","Bearer "+token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(bad)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CONFIG_VALIDATION_ERROR"));
    }

    @Test void adminLifecycleSecurityVersionsRollbackAuditAndLogout() throws Exception {
        http.perform(post("/api/admin/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username","admin","password","wrong"))))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        http.perform(get("/api/admin/config/current").header("Authorization","Bearer invalid"))
            .andExpect(status().isUnauthorized());
        http.perform(get("/api/admin/config/current").header("Authorization","Bearer demo-player-token"))
            .andExpect(status().isForbidden());

        String expired=adminToken();
        String expiredHash=ru.hackathon.airballoon.admin.service.AdminTokenService.hash(expired);
        jdbc.update("UPDATE admin_session SET created_at=now()-interval '2 hours', expires_at=now()-interval '1 hour' WHERE token_hash=?",expiredHash);
        http.perform(get("/api/admin/config/current").header("Authorization","Bearer "+expired))
            .andExpect(status().isUnauthorized());

        String token=adminToken();
        String tokenHash=ru.hackathon.airballoon.admin.service.AdminTokenService.hash(token);
        assertThat(jdbc.queryForObject("SELECT token_hash FROM admin_session WHERE token_hash=?",String.class,tokenHash)).isEqualTo(tokenHash);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_session WHERE token_hash=?",Long.class,token)).isZero();

        var currentResult=http.perform(get("/api/admin/config/current").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(header().exists("ETag")).andReturn();
        var current=json.readTree(currentResult.getResponse().getContentAsString());
        long revision=current.path("revision").asLong();
        String currentId=current.path("id").asText();
        var body=draftBody(revision+1,current.path("points").path("pointsPerLine").asLong()+1);

        http.perform(get("/api/admin/config/metadata").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.parameters").isArray());
        http.perform(post("/api/admin/config/validate").header("Authorization","Bearer "+token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(true));
        var created=http.perform(post("/api/admin/config").header("Authorization","Bearer "+token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
            .andExpect(status().isCreated()).andExpect(header().exists("Location"))
            .andReturn();
        var createdJson=json.readTree(created.getResponse().getContentAsString());
        String createdId=createdJson.path("id").asText();
        assertThat(created.getResponse().getHeader("Location")).endsWith("/api/admin/config/versions/"+createdId);
        http.perform(post("/api/admin/config").header("Authorization","Bearer "+token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.currentVersion").value(revision));
        http.perform(get("/api/admin/config/versions").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").isNumber());
        http.perform(get("/api/admin/config/versions/"+createdId).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DRAFT"));
        http.perform(get("/api/admin/config/versions/"+currentId+"/diff/"+createdId).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.changes").isArray());
        http.perform(post("/api/admin/config/"+createdId+"/activate").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"));
        http.perform(post("/api/admin/config/versions/"+currentId+"/rollback").header("Authorization","Bearer "+token))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("ACTIVE"));
        http.perform(get("/api/admin/audit").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content[?(@.action == 'CONFIG_CREATED')]").exists())
            .andExpect(jsonPath("$.content[?(@.action == 'CONFIG_ACTIVATED')]").exists())
            .andExpect(jsonPath("$.content[?(@.action == 'CONFIG_ROLLBACK')]").exists());
        http.perform(post("/api/admin/auth/logout").header("Authorization","Bearer "+token))
            .andExpect(status().isNoContent());
        http.perform(get("/api/admin/config/current").header("Authorization","Bearer "+token))
            .andExpect(status().isUnauthorized());
    }

    @Test void concurrentAdminsCannotCreateOrActivateTheSameRevisionTwice() throws Exception {
        long revision=adminConfigs.activeRevision().orElseThrow();
        var request=json.convertValue(draftBody(revision+1,777),
                ru.hackathon.airballoon.admin.config.dto.GameConfigurationWriteRequest.class);
        var creates=parallel(
                ()->{try{return adminConfigs.createDraft(request,"admin-a");}catch(RuntimeException e){return e;}},
                ()->{try{return adminConfigs.createDraft(request,"admin-b");}catch(RuntimeException e){return e;}});
        assertThat(creates).filteredOn(ru.hackathon.airballoon.admin.config.dto.GameConfigurationResponse.class::isInstance).hasSize(1);
        assertThat(creates).filteredOn(ru.hackathon.airballoon.common.error.VersionConflictException.class::isInstance).hasSize(1);
        var draft=(ru.hackathon.airballoon.admin.config.dto.GameConfigurationResponse)creates.stream()
                .filter(ru.hackathon.airballoon.admin.config.dto.GameConfigurationResponse.class::isInstance).findFirst().orElseThrow();
        var activations=parallel(
                ()->{try{return adminConfigs.activate(draft.id(),"admin-a");}catch(RuntimeException e){return e;}},
                ()->{try{return adminConfigs.activate(draft.id(),"admin-b");}catch(RuntimeException e){return e;}});
        assertThat(activations).filteredOn(ru.hackathon.airballoon.admin.config.dto.GameConfigurationResponse.class::isInstance).hasSize(1);
        assertThat(activations).filteredOn(ru.hackathon.airballoon.common.error.ConfigStateException.class::isInstance).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_config WHERE status='ACTIVE'",Long.class)).isEqualTo(1);
    }

    String adminToken() throws Exception {
        var result=http.perform(post("/api/admin/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username","admin","password","admin"))))
            .andExpect(status().isOk()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
    }
    long activeRevision(String token) throws Exception {
        var result=http.perform(get("/api/admin/config/current").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("revision").asLong();
    }
    Map<String,Object> draftBody(long revision,long points) {
        Map<String,Object> green=new LinkedHashMap<>();
        for(int i=1;i<=9;i++) green.put("line"+i+"LootProb",100.0/9);
        Map<String,Object> red=new LinkedHashMap<>();
        for(int i=1;i<=12;i++) red.put("line"+i+"LootProb",100.0/12);
        return new LinkedHashMap<>(Map.of(
            "gameId","air-balloon","gameName","Air Balloon","gameType","CRASH","isActive",true,"revision",revision,
            "crash",Map.of("alpha",0.85,"maxMultiplier",100.0,"minCrashMultiplier",1.0,"multiplierGrowthRate",0.15,"fps",60.0,"delta",0.0166666667),
            "boosters",new LinkedHashMap<>(Map.of(
                "multiplierTier1Value",1.0,"multiplierTier2Value",2.0,"multiplierTier3Value",3.0,"multiplierTier4Value",4.0,
                "green",green,"red",red)),
            "points",Map.of("pointsPerLine",points,"pointsCashoutBonus",25,"pointsXNBonus",50)));
    }

    @Test void demoListingAndUndocumentedAdminPath() throws Exception {
        http.perform(get("/api/demo/users")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3))
            .andExpect(jsonPath("$[0].username").value("anna")).andExpect(jsonPath("$[0].bonusBalance").value(5000));
        http.perform(get(java.net.URI.create("/api/%61dmin/config"))).andExpect(status().isUnauthorized());
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
    @Test void legacyRewardReceiptIsPersistedButLossHasNoPlayerFacingReward() throws Exception {
        var r=transactions.finishAndReward(finish(start(anna,100,1)));
        var a=rewards.generateReward(r);var b=rewards.generateReward(r);
        assertThat(a).isEqualTo(b);
        assertThat(history.getResult(r.id()).reward()).isNull();
        http.perform(get("/api/rounds/"+r.id()+"/result").principal(()->anna.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.reward").doesNotExist())
            .andExpect(jsonPath("$.playerCharacter.code").value("GREEDY"))
            .andExpect(jsonPath("$.playerCharacter.title").value("Жадина"));
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
        assertThat(profiles.get(anna).puzzles().getFirst().collectedFragments()).isEqualTo(1);
        configs.update(configs.getCurrentConfig().version(),changed(500));
        var next=start(anna,100,1);
        scores.awardLevelPoints(anna,next.id(),1,500);
        assertThat(users.getState(anna).gameScore()).isEqualTo(900);
    }
    @Test void userStateAndErrorApi() throws Exception {
        http.perform(get("/api/users/"+anna+"/state").principal(()->anna.toString())).andExpect(status().isOk())
            .andExpect(jsonPath("$.bonusBalance").value(5000)).andExpect(jsonPath("$.gameScore").value(0));
        http.perform(get("/api/users/"+UUID.randomUUID()+"/state").principal(()->anna.toString())).andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("NOT_OWNER"));
        http.perform(get("/api/users/not-a-uuid/state").principal(()->anna.toString())).andExpect(status().isBadRequest());
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
    @Test void scenario8IsWinOnlyAndPurchaseIsIdempotent() {
        var win = transactions.finishAndReward(finish(winReady(start(anna,100,1),600)));
        assertThat(puzzleRewards.findByRound(win.id())).get().extracting(PuzzleRewardService.RewardView::fragments).isEqualTo(1);
        var offer = scenario8.offer(anna, win.id());
        assertThat(offer).isNotNull().extracting(Scenario8OfferService.OfferView::price,
                Scenario8OfferService.OfferView::ticketCount).containsExactly(150L, 3);
        var purchased = scenario8.purchase(anna, offer.offerId(), "scenario8-test-key");
        var replay = scenario8.purchase(anna, offer.offerId(), "scenario8-test-key");
        assertThat(replay.replayed()).isTrue();
        assertThat(purchased.bonusBalance()).isEqualTo(5000L - 100L + 600L - 150L);
        assertThat(users.getState(anna).lotteryTicketCount()).isEqualTo(3);
        assertThat(profiles.get(anna).puzzles().getFirst().collectedFragments()).isEqualTo(1);
        var loss = transactions.finishAndReward(finish(start(anna,100,1)));
        assertThat(scenario8.offer(anna, loss.id())).isNull();
        assertThat(puzzleRewards.findByRound(loss.id())).isEmpty();
        assertThat(profiles.get(anna).puzzles().getFirst().collectedFragments()).isEqualTo(1);
    }

    @Test void oneHundredConcurrentScenario8PurchasesMutateEconomyOnce() throws Exception {
        var win = transactions.finishAndReward(finish(winReady(start(anna,100,1),600)));
        var offer = scenario8.offer(anna, win.id());
        long scoreBefore = users.getState(anna).gameScore();
        var gate = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(20)) {
            var futures = new ArrayList<Future<Scenario8OfferService.PurchaseResult>>();
            for (int i=0;i<100;i++) futures.add(pool.submit(() -> {
                gate.await();
                return scenario8.purchase(anna, offer.offerId(), "scenario8-concurrent-key");
            }));
            gate.countDown();
            for (var future : futures) assertThat(future.get(30, TimeUnit.SECONDS).offerId()).isEqualTo(offer.offerId());
        }
        assertThat(users.getState(anna).bonusBalance()).isEqualTo(5000L - 100L + 600L - 150L);
        assertThat(users.getState(anna).lotteryTicketCount()).isEqualTo(3);
        assertThat(users.getState(anna).gameScore()).isEqualTo(scoreBefore);
        assertThat(profiles.get(anna).puzzles().getFirst().collectedFragments()).isEqualTo(1);
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM economy_transactions
                WHERE round_id=? AND type='SCENARIO8_TICKET_PURCHASE'
                """, Long.class, win.id())).isEqualTo(1);
    }

    @Test void winningRoundGrantsOneFragmentAndLossGrantsNone() throws Exception {
        var loss = transactions.finishAndReward(finish(start(anna,100,1)));
        assertThat(puzzleRewards.findByRound(loss.id())).isEmpty();
        var win = transactions.finishAndReward(finish(winReady(start(anna,100,1),600)));
        assertThat(puzzleRewards.findByRound(win.id())).get().satisfies(reward -> {
            assertThat(reward.type()).isEqualTo("PUZZLE_FRAGMENT");
            assertThat(reward.puzzleId()).isEqualTo("SKY_JOURNEY");
            assertThat(reward.fragments()).isEqualTo(1);
            assertThat(reward.totalFragments()).isEqualTo(6);
            assertThat(reward.puzzleCompleted()).isFalse();
        });
        http.perform(get("/api/rounds/" + win.id() + "/result").principal(() -> anna.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reward.type").value("PUZZLE_FRAGMENT"))
                .andExpect(jsonPath("$.reward.puzzleId").value("SKY_JOURNEY"))
                .andExpect(jsonPath("$.reward.fragments").value(1))
                .andExpect(jsonPath("$.playerCharacter.code").value("COLD_BLOODED"));
    }

    @Test void fiveOfSixWinCompletesPuzzleAndUnlocksCloudScarfOnlyOnce() {
        jdbc.update("""
                INSERT INTO user_puzzle_progress(user_id,puzzle_id,total_fragments,collected_fragments,completed)
                SELECT ?,id,total_fragments,5,false FROM puzzle_definitions WHERE code='SKY_JOURNEY'
                """, anna);
        var win = transactions.finishAndReward(finish(winReady(start(anna,100,1),600)));
        var reward = puzzleRewards.findByRound(win.id()).orElseThrow();
        assertThat(reward.fragments()).isEqualTo(6);
        assertThat(reward.puzzleCompleted()).isTrue();
        assertThat(reward.unlockedClothing()).extracting(PuzzleRewardService.ClothingReward::id).isEqualTo("CLOUD_SCARF");
        rewards.generateReward(win);
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM user_clothing_items uci JOIN clothing_items c ON c.id=uci.clothing_id
                WHERE uci.user_id=? AND c.code='CLOUD_SCARF'
                """, Long.class, anna)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM puzzle_reward_grants WHERE round_id=?", Long.class, win.id())).isEqualTo(1);
    }

    @Test void completedOnlyPuzzleDoesNotAdvanceOrGrantAgain() {
        for (int i=0;i<6;i++) transactions.finishAndReward(finish(winReady(start(anna,100,1),600)));
        var extra = transactions.finishAndReward(finish(winReady(start(anna,100,1),600)));
        var puzzle = profiles.get(anna).puzzles().getFirst();
        assertThat(puzzle.collectedFragments()).isEqualTo(6);
        assertThat(puzzle.completed()).isTrue();
        assertThat(puzzleRewards.findByRound(extra.id())).isEmpty();
    }

    @Test void oneHundredConcurrentRetriesGrantExactlyOneFragment() throws Exception {
        var finished = rounds.save(finish(winReady(start(anna,100,1),600)));
        var gate = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(20)) {
            var futures = new ArrayList<Future<?>>();
            for (int i=0;i<100;i++) futures.add(pool.submit(() -> {
                gate.await();
                return puzzleRewards.grantForWinningRound(finished);
            }));
            gate.countDown();
            for (var future : futures) assertThat(future.get(30, TimeUnit.SECONDS)).isInstanceOf(Optional.class);
        }
        assertThat(profiles.get(anna).puzzles().getFirst().collectedFragments()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM puzzle_reward_grants WHERE round_id=?", Long.class, finished.id())).isEqualTo(1);
    }

    @Test void profileReturnsPuzzleWardrobeAndPersistentEquipment() throws Exception {
        http.perform(get("/api/current-user/profile").principal(() -> anna.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.userId").value(anna.toString()))
                .andExpect(jsonPath("$.puzzles[0].id").value("SKY_JOURNEY"))
                .andExpect(jsonPath("$.puzzles[0].collectedFragments").value(0))
                .andExpect(jsonPath("$.avatar.equipped.headId").value("AVIATOR"))
                .andExpect(jsonPath("$.avatar.equipped.neckId").value("BOW"))
                .andExpect(jsonPath("$.wardrobe[3].id").value("CLOUD_SCARF"))
                .andExpect(jsonPath("$.wardrobe[3].unlocked").value(false));
        http.perform(put("/api/current-user/avatar/equipment").principal(() -> anna.toString())
                .contentType("application/json").content("{\"headId\":\"SUNHAT\",\"neckId\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.equipped.headId").value("SUNHAT"))
                .andExpect(jsonPath("$.equipped.neckId").doesNotExist());
        assertThat(profiles.get(anna).avatar().equipped()).isEqualTo(new ProfileService.Equipped("SUNHAT", null));
    }

    @Test void equipRejectsLockedUnknownWrongSlotInactiveAndForeignInventory() throws Exception {
        http.perform(put("/api/current-user/avatar/equipment").principal(() -> anna.toString())
                .contentType("application/json").content("{\"headId\":\"AVIATOR\",\"neckId\":\"CLOUD_SCARF\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ITEM_LOCKED"));
        http.perform(put("/api/current-user/avatar/equipment").principal(() -> anna.toString())
                .contentType("application/json").content("{\"headId\":\"UNKNOWN\",\"neckId\":null}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CLOTHING_NOT_FOUND"));
        http.perform(put("/api/current-user/avatar/equipment").principal(() -> anna.toString())
                .contentType("application/json").content("{\"headId\":\"BOW\",\"neckId\":null}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("WRONG_CLOTHING_SLOT"));
        jdbc.update("UPDATE clothing_items SET active=false WHERE code='SUNHAT'");
        http.perform(put("/api/current-user/avatar/equipment").principal(() -> anna.toString())
                .contentType("application/json").content("{\"headId\":\"SUNHAT\",\"neckId\":null}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ITEM_INACTIVE"));
        UUID maks = DemoBootstrap.id("maks");
        assertThat(profiles.get(maks).wardrobe().stream().filter(i -> i.id().equals("CLOUD_SCARF")).findFirst().orElseThrow().unlocked()).isFalse();
    }

    @Test void databaseProtectsProgressInventoryGrantAndEquipmentOwnership() {
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO user_puzzle_progress(user_id,puzzle_id,total_fragments,collected_fragments,completed)
                SELECT ?,id,total_fragments,7,true FROM puzzle_definitions WHERE code='SKY_JOURNEY'
                """, anna)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("""
                UPDATE user_avatar_equipment SET neck_clothing_id=(SELECT id FROM clothing_items WHERE code='CLOUD_SCARF')
                WHERE user_id=?
                """, anna)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test void rewardAndEquipmentSurviveServiceRecreationAndRewardRetry() {
        var win = transactions.finishAndReward(finish(winReady(start(anna,100,1),600)));
        profiles.equip(anna, "SUNHAT", null);
        var recreatedRewards = new PuzzleRewardService(jdbc, true);
        var replay = recreatedRewards.grantForWinningRound(win).orElseThrow();
        var recreatedProfiles = new ProfileService(jdbc, users, java.time.Clock.systemUTC());
        assertThat(replay.fragments()).isEqualTo(1);
        assertThat(recreatedProfiles.get(anna).puzzles().getFirst().collectedFragments()).isEqualTo(1);
        assertThat(recreatedProfiles.get(anna).avatar().equipped()).isEqualTo(new ProfileService.Equipped("SUNHAT", null));
    }

    @Test void concurrentEquipmentUpdatesLeaveOneValidCommittedOutfit() throws Exception {
        var gate = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(20)) {
            var futures = new ArrayList<Future<ProfileService.Avatar>>();
            for (int i=0;i<100;i++) {
                int index = i;
                futures.add(pool.submit(() -> {
                    gate.await();
                    return profiles.equip(anna, index % 2 == 0 ? "AVIATOR" : "SUNHAT", index % 3 == 0 ? "BOW" : null);
                }));
            }
            gate.countDown();
            for (var future : futures) assertThat(future.get(30, TimeUnit.SECONDS)).isNotNull();
        }
        var equipped = profiles.get(anna).avatar().equipped();
        assertThat(equipped.headId()).isIn("AVIATOR", "SUNHAT");
        assertThat(equipped.neckId()).isIn("BOW", null);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM user_avatar_equipment WHERE user_id=?", Long.class, anna)).isEqualTo(1);
    }

    @Test void scenario8InsufficientBalanceDoesNotCreditTickets() {
        var win = transactions.finishAndReward(finish(winReady(start(anna,100,1),600)));
        var offer = scenario8.offer(anna, win.id());
        setBalance(100);
        assertThatThrownBy(() -> scenario8.purchase(anna, offer.offerId(), "insufficient-key"))
                .isInstanceOf(BusinessException.class).hasMessageContaining("Недостаточно");
        assertThat(users.getState(anna).lotteryTicketCount()).isZero();
        assertThat(users.getState(anna).bonusBalance()).isEqualTo(100);
    }

}
