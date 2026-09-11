package ru.airballoon.acceptance;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import ru.airballoon.game.application.GameService;
import ru.airballoon.game.domain.GameEvent;
import ru.airballoon.integration.PostgresRoundEventStore;
import ru.hackathon.airballoon.acceptance.BackendAcceptanceDriver;
import ru.hackathon.airballoon.admin.AdminController;
import ru.hackathon.airballoon.config.ConfigSnapshot;
import ru.hackathon.airballoon.config.GameConfig;
import ru.hackathon.airballoon.config.PostgresGameConfigProvider;
import ru.hackathon.airballoon.reward.RewardService;
import ru.hackathon.airballoon.support.MutableClock;
import ru.hackathon.airballoon.tournament.api.LeaderboardResponse;
import ru.hackathon.airballoon.tournament.service.TournamentService;
import ru.hackathon.airballoon.user.DemoBootstrap;

public final class CoreBackendAcceptanceDriver implements BackendAcceptanceDriver {
    private static final List<String> LOGINS = List.of("anna", "maks", "liza");
    private static final List<String> PASSWORDS = List.of("balloon1", "balloon2", "balloon3");
    private static final String ADMIN_TOKEN = "acceptance-admin";

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final TestRestTemplate http;
    private final MutableClock clock;
    private final GameService games;
    private final TournamentService tournaments;
    private final PostgresGameConfigProvider configs;
    private final RewardService rewards;
    private final PostgresRoundEventStore eventStore;
    private final DataSource dataSource;
    private final Environment environment;
    private final Map<UUID, String> sessions = new ConcurrentHashMap<>();
    private final Map<UUID, UUID> cashoutKeys = new ConcurrentHashMap<>();
    private final Map<String, String> retryPayloads = new ConcurrentHashMap<>();
    private final AtomicInteger nextLogin = new AtomicInteger();
    public CoreBackendAcceptanceDriver(JdbcTemplate jdbc, ObjectMapper json, TestRestTemplate http,
                                MutableClock clock, GameService games, TournamentService tournaments,
                                PostgresGameConfigProvider configs, RewardService rewards,
                                PostgresRoundEventStore eventStore, DataSource dataSource,
                                Environment environment) {
        this.jdbc = jdbc;
        this.json = json;
        this.http = http;
        this.clock = clock;
        this.games = games;
        this.tournaments = tournaments;
        this.configs = configs;
        this.rewards = rewards;
        this.eventStore = eventStore;
        this.dataSource = dataSource;
        this.environment = environment;
    }

    @Override
    public void resetFixtures() {
        jdbc.update("DELETE FROM tournament.participants");
        jdbc.update("DELETE FROM tournament.tournaments");
        jdbc.update("DELETE FROM round_rewards");
        jdbc.update("DELETE FROM score_events");
        jdbc.update("DELETE FROM core_round_events");
        jdbc.update("DELETE FROM core_round_checkpoints");
        jdbc.update("DELETE FROM core_round_snapshots");
        jdbc.update("DELETE FROM economy_transactions");
        jdbc.update("DELETE FROM game_rounds");
        jdbc.update("DELETE FROM users");
        new DemoBootstrap(jdbc).run(new DefaultApplicationArguments(new String[0]));
        installDeterministicConfig(100);
        clock.set(MutableClock.INITIAL);
        sessions.clear();
        cashoutKeys.clear();
        retryPayloads.clear();
        nextLogin.set(0);
    }

    @Override
    public UUID createActiveTournament() {
        UUID id = UUID.randomUUID();
        tournaments.create(id, "Core acceptance", "Real score projection",
                clock.instant().minusSeconds(60), clock.instant().plusSeconds(3600));
        return id;
    }

    @Override
    public Response<LeaderboardResponse> leaderboard(UUID tournamentId, UUID viewer, int page, int size) {
        HttpHeaders headers = playerHeaders(viewer);
        ResponseEntity<LeaderboardResponse> response = http.exchange(url("/api/tournaments/" + tournamentId
                + "/leaderboard?page=" + page + "&size=" + size), HttpMethod.GET,
                new HttpEntity<>(headers), LeaderboardResponse.class);
        return response(response);
    }

    @Override
    public Player createPlayer(String name, BigDecimal balance, long gameScore) {
        int index = nextLogin.getAndIncrement();
        if (index >= LOGINS.size()) throw new IllegalStateException("Acceptance fixture supports three simultaneous users");
        String login = LOGINS.get(index);
        UUID id = DemoBootstrap.id(login);
        jdbc.update("UPDATE users SET display_name=?,bonus_balance=?,game_score=?,game_score_version=0,updated_at=? WHERE id=?",
                name, balance.longValueExact(), gameScore, Timestamp.from(clock.instant()), id);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<JsonNode> loginResponse = http.exchange(url("/api/auth/demo-login"), HttpMethod.POST,
                new HttpEntity<>(Map.of("username", login, "password", PASSWORDS.get(index)), headers), JsonNode.class);
        if (status(loginResponse) < 200 || status(loginResponse) >= 300)
            throw new IllegalStateException("Demo login failed: " + loginResponse.getBody());
        String setCookie = loginResponse.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        if (setCookie == null) throw new IllegalStateException("Demo login did not create an HTTP session");
        sessions.put(id, setCookie.split(";", 2)[0]);
        return player(id);
    }

    @Override
    public Player player(UUID userId) {
        ResponseEntity<JsonNode> response = http.exchange(url("/api/users/" + userId + "/state"), HttpMethod.GET,
                new HttpEntity<>(playerHeaders(userId)), JsonNode.class);
        requireSuccess(response);
        JsonNode body = response.getBody();
        return new Player(UUID.fromString(body.path("userId").asText()), body.path("bonusBalance").decimalValue(),
                body.path("gameScore").asLong());
    }

    @Override
    public Response<Round> start(UUID userId, Theme theme, BigDecimal bet, int booster,
                                 SeedProfile seed, Map<String, Object> forgedFields) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("theme", theme.name());
        body.put("betAmount", bet);
        body.put("boosterMultiplier", booster);
        body.putAll(forgedFields);
        HttpHeaders headers = playerHeaders(userId);
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<JsonNode> response = http.exchange(url("/api/rounds"), HttpMethod.POST,
                new HttpEntity<>(body, headers), JsonNode.class);
        return roundResponse(response);
    }

    @Override
    public Response<Round> cashout(UUID actingUser, UUID roundId, Map<String, Object> forgedFields) {
        HttpHeaders headers = playerHeaders(actingUser);
        headers.set("Idempotency-Key", cashoutKeys.computeIfAbsent(roundId, ignored -> UUID.randomUUID()).toString());
        HttpEntity<?> request;
        if (forgedFields.isEmpty()) request = new HttpEntity<>(headers);
        else {
            headers.setContentType(MediaType.APPLICATION_JSON);
            request = new HttpEntity<>(forgedFields, headers);
        }
        ResponseEntity<JsonNode> response = http.exchange(url("/api/rounds/" + roundId + "/cashout"),
                HttpMethod.POST, request, JsonNode.class);
        return roundResponse(response);
    }

    @Override
    public Round round(UUID roundId) {
        UUID owner = jdbc.queryForObject("SELECT user_id FROM game_rounds WHERE id=?", UUID.class, roundId);
        ResponseEntity<JsonNode> response = http.exchange(url("/api/rounds/" + roundId), HttpMethod.GET,
                new HttpEntity<>(playerHeaders(owner)), JsonNode.class);
        requireSuccess(response);
        return mapRound(response.getBody());
    }

    @Override
    public void reachLevel(UUID roundId, int level) {
        for (int i = 0; i < 400 && round(roundId).level() < level; i++) {
            clock.set(clock.instant().plusMillis(250));
            games.tick(roundId);
            if (round(roundId).state().equals("FINISHED"))
                throw new IllegalStateException("Round crashed before required level " + level);
        }
        if (round(roundId).level() < level) throw new IllegalStateException("Level was not reached");
    }

    @Override
    public void reachCrash(UUID roundId) {
        for (int i = 0; i < 120 && !round(roundId).state().equals("FINISHED"); i++) {
            clock.set(clock.instant().plusSeconds(5));
            games.tick(roundId);
        }
        if (!round(roundId).state().equals("FINISHED")) throw new IllegalStateException("Round did not finish");
    }

    @Override
    public List<Event> events(UUID roundId) {
        return jdbc.query("SELECT event_json::text FROM core_round_events WHERE round_id=? ORDER BY sequence",
                (rs, row) -> mapEvent(readEvent(rs.getString(1))), roundId);
    }

    @Override
    public long ledgerCount(UUID roundId, String type) {
        return jdbc.queryForObject("SELECT count(*) FROM economy_transactions WHERE round_id=? AND type=?",
                Long.class, roundId, type);
    }

    @Override
    public Response<Config> getAdminConfig() {
        ResponseEntity<JsonNode> response = http.exchange(url("/api/admin/config"), HttpMethod.GET,
                new HttpEntity<>(adminHeaders()), JsonNode.class);
        return configResponse(response);
    }

    @Override
    public Response<Config> setPointsPerLevel(long points) {
        ConfigSnapshot current = configs.getCurrentConfig();
        GameConfig updated = copyConfig(current.config(), points, current.config().minCrashMultiplier(),
                current.config().maxCrashMultiplier(), current.config().greenBoosterWeights(),
                current.config().redBoosterWeights());
        HttpHeaders headers = adminHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<JsonNode> response = http.exchange(url("/api/admin/config"), HttpMethod.PUT,
                new HttpEntity<>(new AdminController.Update(current.version(), updated), headers), JsonNode.class);
        return configResponse(response);
    }

    @Override
    public Response<HistoryPage> history(int page, int size) {
        ResponseEntity<JsonNode> response = http.exchange(url("/api/history?page=" + page + "&size=" + size),
                HttpMethod.GET, HttpEntity.EMPTY, JsonNode.class);
        if (!successful(response)) return new Response<>(status(response), errorCode(response), null);
        List<History> items = new ArrayList<>();
        for (JsonNode item : response.getBody().path("items")) {
            items.add(new History(UUID.fromString(item.path("roundId").asText()),
                    UUID.fromString(item.path("userId").asText()), item.path("result").asText(),
                    decimalOrNull(item.get("cashoutMultiplier")), Instant.parse(item.path("finishedAt").asText())));
        }
        return new Response<>(status(response), null, new HistoryPage(List.copyOf(items),
                response.getBody().path("total").asLong()));
    }

    @Override
    public Reward reward(UUID roundId) {
        ru.hackathon.airballoon.reward.Reward reward = rewards.findByRound(roundId).orElseThrow();
        return new Reward(reward.id(), reward.roundId());
    }

    @Override
    public Reward generateRewardAgain(UUID roundId) {
        var saved = jdbc.queryForObject("SELECT id,user_id FROM game_rounds WHERE id=?",
                (rs, row) -> new UUID[]{rs.getObject(1, UUID.class), rs.getObject(2, UUID.class)}, roundId);
        ru.hackathon.airballoon.game.GameRound round = new ru.hackathon.airballoon.game.PostgresRoundRepository(jdbc, configs)
                .findById(saved[0]).orElseThrow();
        ru.hackathon.airballoon.reward.Reward reward = rewards.generateReward(round);
        return new Reward(reward.id(), reward.roundId());
    }

    @Override
    public long rewardCount(UUID roundId) {
        return jdbc.queryForObject("SELECT count(*) FROM round_rewards WHERE round_id=?", Long.class, roundId);
    }

    @Override
    public void redeliverLevelEvent(UUID roundId, int level) {
        redeliver(roundId, "LEVEL_REACHED", level);
    }

    @Override
    public void redeliverBoosterEvent(UUID roundId) {
        redeliver(roundId, "BOOSTER_ACTIVATED", null);
    }

    @Override
    public void restartApplicationPreservingDatabase() {
        try {
            jdbc.query("SELECT event_json::text FROM core_round_events WHERE event_json->>'type' IN ('LEVEL_REACHED','BOOSTER_ACTIVATED')",
                    rs -> {
                        while (rs.next()) {
                            String payload = rs.getString(1);
                            GameEvent event = readEvent(payload);
                            retryPayloads.put(retryKey(event.roundId(), event.type().name(),
                                    event.data().get("level") instanceof Number n ? n.intValue() : null), payload);
                        }
                    });
            String url;
            String user;
            try (var connection = dataSource.getConnection()) {
                url = connection.getMetaData().getURL();
                user = connection.getMetaData().getUserName();
            }
            String password = System.getenv().getOrDefault("TEST_DATABASE_PASSWORD", "");
            try (ConfigurableApplicationContext ignored = new SpringApplicationBuilder(ru.airballoon.AirBalloonApplication.class)
                    .web(WebApplicationType.NONE)
                    .profiles("integration")
                    .properties("logging.level.root=WARN", "spring.main.banner-mode=off")
                    .run("--spring.datasource.url=" + url, "--spring.datasource.username=" + user,
                            "--spring.datasource.password=" + password, "--game.scheduler-enabled=false")) {
                // A cold Core context has completed Flyway validation and startup recovery against this database.
            }
        } catch (Exception e) {
            throw new IllegalStateException("Core restart against the preserved database failed", e);
        }
    }

    private void redeliver(UUID roundId, String type, Integer level) {
        List<String> rows = level == null
                ? jdbc.queryForList("SELECT event_json::text FROM core_round_events WHERE round_id=? AND event_json->>'type'=? ORDER BY sequence LIMIT 1",
                        String.class, roundId, type)
                : jdbc.queryForList("SELECT event_json::text FROM core_round_events WHERE round_id=? AND event_json->>'type'=? AND (event_json->'data'->>'level')::int=? ORDER BY sequence LIMIT 1",
                        String.class, roundId, type, level);
        String payload = rows.isEmpty() ? retryPayloads.get(retryKey(roundId, type, level)) : rows.getFirst();
        if (payload == null && level == null) {
            String prefix = roundId + ":" + type + ":";
            payload = retryPayloads.entrySet().stream()
                    .filter(entry -> entry.getKey().startsWith(prefix))
                    .map(Map.Entry::getValue)
                    .findFirst()
                    .orElse(null);
        }
        if (payload == null) throw new IllegalStateException("Event not found: " + type);
        retryPayloads.put(retryKey(roundId, type, level), payload);
        GameEvent event = readEvent(payload);
        jdbc.update("DELETE FROM core_round_events WHERE round_id=? AND sequence=?",
                event.roundId(), event.sequence());
        eventStore.append(event);
    }

    private static String retryKey(UUID roundId, String type, Integer level) {
        return roundId + ":" + type + ":" + (level == null ? "-" : level);
    }

    private void installDeterministicConfig(long points) {
        ConfigSnapshot current = configs.getCurrentConfig();
        List<Integer> green = exclusiveWeights(9, 2);
        List<Integer> red = exclusiveWeights(12, 2);
        configs.update(current.version(), copyConfig(current.config(), points, new BigDecimal("30.0000"),
                new BigDecimal("30.0001"), green, red));
    }

    private static List<Integer> exclusiveWeights(int size, int level) {
        List<Integer> weights = new ArrayList<>();
        for (int i = 1; i <= size; i++) weights.add(i == level ? 10_000 : 0);
        return List.copyOf(weights);
    }

    private static GameConfig copyConfig(GameConfig c, long points, BigDecimal minCrash, BigDecimal maxCrash,
                                         List<Integer> greenWeights, List<Integer> redWeights) {
        return new GameConfig(c.gameId(), c.gameName(), c.gameType(), c.active(), c.greenLevelCount(),
                c.redLevelCount(), minCrash, maxCrash, c.growthRate(), c.alpha(), c.updateIntervalMs(),
                c.minBet(), c.maxBet(), c.boosterValues(), greenWeights, redWeights, points, c.pointsCashoutBonus(), c.pointsX2Bonus(),
                c.pointsX3Bonus(), c.pointsX4Bonus(), false, null);
    }

    private Response<Round> roundResponse(ResponseEntity<JsonNode> response) {
        return successful(response)
                ? new Response<>(status(response), null, mapRound(response.getBody()))
                : new Response<>(status(response), errorCode(response), null);
    }

    private Round mapRound(JsonNode body) {
        UUID id = UUID.fromString(body.path("id").asText());
        UUID userId = jdbc.queryForObject("SELECT user_id FROM game_rounds WHERE id=?", UUID.class, id);
        String rawStatus = body.path("status").asText();
        String state = rawStatus.equals("FINISHED") ? "FINISHED" : "RUNNING";
        String result = rawStatus.equals("FINISHED") ? (body.path("cashoutPerformed").asBoolean() ? "WIN" : "LOSS") : null;
        long levelPoints = score(id, "LEVEL");
        long boosterPoints = score(id, "BOOSTER");
        long cashoutPoints = score(id, "CASHOUT");
        long pointsSnapshot = jdbc.queryForObject("""
                SELECT (c.config_json->>'pointsPerLevel')::bigint FROM game_rounds r
                JOIN game_config_versions c ON c.version=r.config_version WHERE r.id=?
                """, Long.class, id);
        return new Round(id, userId, state, result, Theme.valueOf(body.path("theme").asText()),
                body.path("totalLevels").asInt(), body.path("boosterMultiplier").asInt(),
                body.path("currentLevel").asInt(), body.path("cashoutAvailable").asBoolean(),
                body.path("currentMultiplier").decimalValue(), decimalOrNull(body.get("cashoutMultiplier")),
                body.path("winAmount").decimalValue(), decimalOrNull(body.get("crashMultiplier")),
                levelPoints, boosterPoints, cashoutPoints, body.path("boosterActivated").asBoolean(), pointsSnapshot);
    }

    private long score(UUID roundId, String type) {
        return jdbc.queryForObject("SELECT COALESCE(sum(points),0) FROM score_events WHERE round_id=? AND type=?",
                Long.class, roundId, type);
    }

    private Event mapEvent(GameEvent event) {
        String type = event.type() == GameEvent.Type.CASHOUT_SUCCESS ? "CASHOUT" : event.type().name();
        return new Event(type, number(event.data().get("level")).intValue(),
                number(event.data().get("points")).longValue(), decimal(event.data().get("beforeMultiplier")),
                decimal(event.data().get("afterMultiplier")));
    }

    private GameEvent readEvent(String value) {
        try { return json.readValue(value, GameEvent.class); }
        catch (Exception e) { throw new IllegalStateException("Cannot deserialize persisted Core event", e); }
    }

    private Response<Config> configResponse(ResponseEntity<JsonNode> response) {
        if (!successful(response)) return new Response<>(status(response), errorCode(response), null);
        return new Response<>(status(response), null,
                new Config(response.getBody().path("config").path("pointsPerLevel").asLong()));
    }

    private HttpHeaders playerHeaders(UUID userId) {
        String cookie = sessions.get(userId);
        if (cookie == null) throw new IllegalStateException("No authenticated session for " + userId);
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.COOKIE, cookie);
        return headers;
    }

    public ResponseEntity<JsonNode> get(UUID userId, String path) {
        return http.exchange(url(path), HttpMethod.GET, new HttpEntity<>(playerHeaders(userId)), JsonNode.class);
    }

    public ResponseEntity<JsonNode> getAnonymous(String path) {
        return http.exchange(url(path), HttpMethod.GET, HttpEntity.EMPTY, JsonNode.class);
    }

    public ResponseEntity<JsonNode> getWithCookie(String cookie, String path) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.COOKIE, cookie);
        return http.exchange(url(path), HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class);
    }

    public String sessionCookie(UUID userId) { return sessions.get(userId); }

    public ResponseEntity<JsonNode> post(UUID userId, String path, Object body) {
        HttpHeaders headers=playerHeaders(userId);
        HttpEntity<?> request;
        if (body==null) request=new HttpEntity<>(headers);
        else {
            headers.setContentType(MediaType.APPLICATION_JSON);
            request=new HttpEntity<>(body,headers);
        }
        return http.exchange(url(path),HttpMethod.POST,request,JsonNode.class);
    }

    public ResponseEntity<JsonNode> postAnonymous(String path, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return http.exchange(url(path), HttpMethod.POST, new HttpEntity<>(body, headers), JsonNode.class);
    }

    public ResponseEntity<JsonNode> deleteSession(UUID userId) {
        ResponseEntity<JsonNode> response=http.exchange(url("/api/auth/session"),HttpMethod.DELETE,
                new HttpEntity<>(playerHeaders(userId)),JsonNode.class);
        sessions.remove(userId);
        return response;
    }

    private static HttpHeaders adminHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Admin-Token", ADMIN_TOKEN);
        return headers;
    }

    private String url(String path) {
        return "http://127.0.0.1:" + environment.getRequiredProperty("local.server.port") + path;
    }

    private static boolean successful(ResponseEntity<?> response) {
        return status(response) >= 200 && status(response) < 300;
    }

    private static int status(ResponseEntity<?> response) { return response.getStatusCode().value(); }

    private static String errorCode(ResponseEntity<JsonNode> response) {
        return response.getBody() == null ? null : response.getBody().path("code").asText(null);
    }

    private static void requireSuccess(ResponseEntity<JsonNode> response) {
        if (!successful(response)) throw new IllegalStateException("HTTP " + status(response) + ": " + response.getBody());
    }

    private static <T> Response<T> response(ResponseEntity<T> response) {
        return new Response<>(status(response), null, response.getBody());
    }

    private static BigDecimal decimalOrNull(JsonNode node) {
        return node == null || node.isNull() || node.isMissingNode() ? null : node.decimalValue();
    }

    private static Number number(Object value) { return value instanceof Number n ? n : 0; }

    private static BigDecimal decimal(Object value) {
        return value == null ? null : new BigDecimal(value.toString());
    }
}
