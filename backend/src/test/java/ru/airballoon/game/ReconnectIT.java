package ru.airballoon.game;

import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.TestPropertySource;
import ru.airballoon.game.application.GameService;
import ru.airballoon.game.application.port.RoundRepository;
import ru.airballoon.game.domain.*;
import ru.airballoon.game.infrastructure.memory.FakeBalanceService;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static ru.airballoon.game.TestSupport.*;

/** Real HTTP, real sockets and the production asynchronous scheduler, with a controlled server clock. */
@TestPropertySource(properties = "game.scheduler-enabled=true")
@Timeout(20)
class ReconnectIT extends IntegrationSupport {
    @LocalServerPort int port;
    @Autowired ObjectMapper mapper;
    @Autowired MutableClock clock;
    @Autowired GameService service;
    @Autowired RoundRepository repository;
    @Autowired FakeBalanceService balances;

    @Test void disconnectDoesNotStopSchedulerRefreshSnapshotThenReconnectCashoutCrashFinish() throws Exception {
        clock.atMillis(0); UUID user = UUID.randomUUID();
        try (var http = HttpClient.newHttpClient()) {
            var oldEvents = new Listener(); var old = connect(http, user, oldEvents); oldEvents.next();
            var started = request(http, user, "POST", "/api/rounds", "{\"theme\":\"GREEN\",\"betAmount\":100,\"boosterMultiplier\":3}");
            UUID id = UUID.fromString(started.path("id").asText());
            var startEvent = oldEvents.next();
            assertThat(startEvent.path("type").asText()).isEqualTo("ROUND_STARTED");
            assertThat(startEvent.toString()).doesNotContain("serverSeed", "crashMultiplier", "boosterLevel");
            close(old, oldEvents);
            clock.atMillis(10000);
            awaitLevel(id, 6); // No GET or explicit tick drives this progress: the real scheduler does.
            var newEvents = new Listener(); var socket = connect(http, user, newEvents);
            try {
                newEvents.next();
                var snapshot = request(http, user, "GET", "/api/rounds/" + id, null);
                assertThat(snapshot.path("currentLevel").asInt()).isEqualTo(6);
                assertThat(snapshot.path("boosterActivated").asBoolean()).isTrue();
                assertThat(snapshot.path("currentMultiplier").decimalValue()).isEqualByComparingTo("6");
                assertThat(snapshot.path("serverTime").asText()).isEqualTo(START.plusSeconds(10).toString());
                assertThat(service.activeRoundCount()).isGreaterThanOrEqualTo(1);
                var replay = request(http, user, "GET", "/api/rounds/" + id + "/events?afterSequence=1", null);
                assertThat(replay.path("snapshotRequired").asBoolean()).isFalse();
                assertThat(replay.path("events").findValuesAsText("type")).contains("LEVEL_REACHED", "BOOSTER_ACTIVATED");
                var payout = request(http, user, "POST", "/api/rounds/" + id + "/cashout", null);
                assertThat(payout.path("winAmount").decimalValue()).isEqualByComparingTo("600");
                clock.atMillis(100000); var tail = newEvents.untilFinished(id);
                assertThat(tail.stream().map(e -> e.path("type").asText())).containsSubsequence("CASHOUT_SUCCESS", "CRASH", "ROUND_FINISHED");
                assertThat(tail.stream().map(e -> e.path("sequence").asLong())).isSorted().doesNotHaveDuplicates();
                assertThat(tail.getLast().path("data").path("fairnessReveal").path("verified").asBoolean()).isTrue();
                assertThat(balances.creditCount(user)).isEqualTo(1);
            } finally { socket.abort(); }
        }
    }

    @Test void reconnectAfterCashoutRestoresFixedWinWhileFlightContinues() throws Exception {
        clock.atMillis(0); UUID user = UUID.randomUUID();
        try (var http = HttpClient.newHttpClient()) {
            var firstEvents = new Listener(); var first = connect(http, user, firstEvents); firstEvents.next();
            var r = service.start(user, Theme.GREEN, dec("100"), 1); firstEvents.next();
            clock.atMillis(3000); var payout = request(http, user, "POST", "/api/rounds/" + r.id() + "/cashout", null);
            close(first, firstEvents); clock.atMillis(5000); awaitLevel(r.id(), 2);
            var listener = new Listener(); var socket = connect(http, user, listener);
            try {
                listener.next(); var snapshot = request(http, user, "GET", "/api/rounds/" + r.id(), null);
                assertThat(snapshot.path("status").asText()).isEqualTo("CASHED_OUT");
                assertThat(snapshot.path("cashoutPerformed").asBoolean()).isTrue();
                assertThat(snapshot.path("cashoutMultiplier")).isEqualTo(payout.path("cashoutMultiplier"));
                assertThat(snapshot.path("winAmount")).isEqualTo(payout.path("winAmount"));
                clock.atMillis(100000); var finished = listener.untilFinished(r.id()).getLast().path("data").path("round");
                assertThat(finished.path("winAmount")).isEqualTo(payout.path("winAmount"));
                assertThat(balances.creditCount(user)).isEqualTo(1);
            } finally { socket.abort(); }
        }
    }

    @Test void reconnectAfterCrashGetsFinishedProofWithoutWaitingForOldRealtimeEvent() throws Exception {
        clock.atMillis(0); UUID user = UUID.randomUUID();
        try (var http = HttpClient.newHttpClient()) {
            var listener = new Listener(); var socket = connect(http, user, listener); listener.next();
            var r = service.start(user, Theme.GREEN, dec("100"), 1); listener.next(); close(socket, listener);
            clock.atMillis(100000);
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (repository.findById(r.id()).orElseThrow().status() != RoundStatus.FINISHED && System.nanoTime() < deadline) Thread.sleep(10);
            assertThat(repository.findById(r.id()).orElseThrow().status()).isEqualTo(RoundStatus.FINISHED);
            var fresh = new Listener(); var reconnected = connect(http, user, fresh);
            try {
                fresh.next(); var snapshot = request(http, user, "GET", "/api/rounds/" + r.id(), null);
                assertThat(snapshot.path("status").asText()).isEqualTo("FINISHED");
                assertThat(snapshot.path("outcome").asText()).isEqualTo("LOSS");
                assertThat(snapshot.path("fairnessReveal").path("verified").asBoolean()).isTrue();
                assertThat(snapshot.path("crashMultiplier").decimalValue()).isEqualByComparingTo("8.42");
                assertThat(snapshot.path("cashoutPerformed").asBoolean()).isFalse();
            } finally { reconnected.abort(); }
        }
    }

    private void awaitLevel(UUID id, int level) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (repository.findById(id).orElseThrow().currentLevel() < level && System.nanoTime() < deadline) Thread.sleep(10);
        assertThat(repository.findById(id).orElseThrow().currentLevel()).isEqualTo(level);
    }
    private JsonNode request(HttpClient client, UUID user, String method, String path, String body) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).timeout(Duration.ofSeconds(5))
                .header("X-Test-User", user.toString());
        if (body != null) builder.header("Content-Type", "application/json");
        var response = client.send(builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isBetween(200, 201); return mapper.readTree(response.body());
    }
    private WebSocket connect(HttpClient client, UUID user, Listener listener) throws Exception {
        return client.newWebSocketBuilder().header("X-Test-User", user.toString())
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/rounds"), listener).get(5, TimeUnit.SECONDS);
    }
    private void close(WebSocket socket, Listener listener) throws Exception {
        socket.sendClose(1000, "refresh").get(3, TimeUnit.SECONDS); listener.closed.get(3, TimeUnit.SECONDS);
    }
    private final class Listener implements WebSocket.Listener {
        final BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        final CompletableFuture<Integer> closed = new CompletableFuture<>();
        final StringBuilder fragments = new StringBuilder();
        public void onOpen(WebSocket socket) { socket.request(1); }
        public CompletionStage<?> onText(WebSocket socket, CharSequence text, boolean last) {
            fragments.append(text); if (last) { messages.add(fragments.toString()); fragments.setLength(0); }
            socket.request(1); return null;
        }
        public CompletionStage<?> onClose(WebSocket socket, int status, String reason) { closed.complete(status); return null; }
        public void onError(WebSocket socket, Throwable error) { closed.completeExceptionally(error); }
        JsonNode next() throws Exception {
            String text = messages.poll(5, TimeUnit.SECONDS); assertThat(text).as("Expected realtime event").isNotNull(); return mapper.readTree(text);
        }
        List<JsonNode> untilFinished(UUID id) throws Exception {
            List<JsonNode> events = new ArrayList<>();
            while (events.isEmpty() || !events.getLast().path("type").asText().equals("ROUND_FINISHED")) {
                var e = next(); if (e.path("roundId").asText().equals(id.toString())) events.add(e);
            }
            return events;
        }
    }
}
