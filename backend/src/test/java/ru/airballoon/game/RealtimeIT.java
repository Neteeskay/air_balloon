package ru.airballoon.game;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import ru.airballoon.game.application.GameService;
import ru.airballoon.game.domain.Theme;
import ru.airballoon.game.infrastructure.memory.FakeBalanceService;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static ru.airballoon.game.TestSupport.*;

@Timeout(20)
class RealtimeIT extends IntegrationSupport {
    @LocalServerPort int port;
    @Autowired ObjectMapper mapper;
    @Autowired MutableClock clock;
    @Autowired GameService service;
    @Autowired FakeBalanceService balances;

    @Test void realWebSocketDeliversFullLifecycleInOrderAndKeepsUsersIsolated() throws Exception {
        clock.atMillis(0); UUID user = UUID.randomUUID(); UUID other = UUID.randomUUID();
        try (HttpClient http = HttpClient.newHttpClient()) {
            var ownerEvents = new SocketListener(); var otherEvents = new SocketListener();
            WebSocket owner = connect(http, user, ownerEvents); WebSocket stranger = connect(http, other, otherEvents);
            try {
                assertThat(ownerEvents.next().path("type").asText()).isEqualTo("CONNECTION_READY");
                assertThat(otherEvents.next().path("type").asText()).isEqualTo("CONNECTION_READY");
                var r = service.start(user, Theme.GREEN, dec("100"), 3);
                assertThat(balances.balance(user)).isEqualByComparingTo("900");
                clock.atMillis(1000); service.tick(r.id());
                clock.atMillis(2000); service.tick(r.id());
                clock.atMillis(10000); service.tick(r.id());
                clock.atMillis(10100); var payout = service.cashout(user, r.id());
                clock.atMillis(11000); service.tick(r.id());
                clock.atMillis(20000); service.tick(r.id());
                List<JsonNode> events = new ArrayList<>();
                while (events.isEmpty() || !events.getLast().path("type").asText().equals("ROUND_FINISHED")) events.add(ownerEvents.next());
                assertThat(events.stream().map(e -> e.path("type").asText())).containsSubsequence("ROUND_STARTED", "MULTIPLIER_UPDATE",
                        "LEVEL_REACHED", "BOOSTER_ACTIVATED", "CASHOUT_SUCCESS", "MULTIPLIER_UPDATE", "CRASH", "ROUND_FINISHED");
                assertThat(events.stream().map(e -> e.path("sequence").asLong())).doesNotHaveDuplicates().isSorted();
                assertThat(events.stream().filter(e -> e.path("type").asText().equals("CASHOUT_SUCCESS")).count()).isEqualTo(1);
                assertThat(events.stream().filter(e -> e.path("type").asText().equals("BOOSTER_ACTIVATED")).count()).isEqualTo(1);
                assertThat(events.getLast().path("data").path("round").path("winAmount").decimalValue()).isEqualByComparingTo(payout.winAmount());
                assertThat(events.getLast().path("data").path("round").path("status").asText()).isEqualTo("FINISHED");
                for (JsonNode event : events) {
                    assertThat(event.toString()).doesNotContain("\"seed\"");
                    if (!Set.of("CRASH", "ROUND_FINISHED").contains(event.path("type").asText()))
                        assertThat(event.toString()).doesNotContain("\"crashMultiplier\"");
                }
                // A round for the other user acts as a delivery barrier on its socket.
                var otherRound = service.start(other, Theme.RED, dec("10"), 1);
                assertThat(otherEvents.next().path("roundId").asText()).isEqualTo(otherRound.id().toString());
                assertThat(balances.creditCount(user)).isEqualTo(1);
            } finally { owner.abort(); stranger.abort(); }
        }
    }

    @Test void clientCannotInjectGameEventsThroughWebSocket() throws Exception {
        try (var http = HttpClient.newHttpClient()) {
            var listener = new SocketListener(); var socket = connect(http, UUID.randomUUID(), listener);
            try {
                listener.next();
                socket.sendText("{\"type\":\"CASHOUT_SUCCESS\",\"winAmount\":999999}", true).get(3, TimeUnit.SECONDS);
                assertThat(listener.closed.get(5, TimeUnit.SECONDS)).isEqualTo(1008);
            } finally { socket.abort(); }
        }
    }

    @Test void invalidPrincipalAndCrossOriginWebSocketAreRejected() {
        try (var http = HttpClient.newHttpClient()) {
            assertThatThrownBy(() -> http.newWebSocketBuilder().header("X-Test-User", "not-a-user")
                    .buildAsync(URI.create("ws://localhost:" + port + "/ws/rounds"), new SocketListener()).get(5, TimeUnit.SECONDS))
                    .hasCauseInstanceOf(WebSocketHandshakeException.class);
            assertThatThrownBy(() -> http.newWebSocketBuilder().header("Origin", "https://untrusted.example")
                    .buildAsync(URI.create("ws://localhost:" + port + "/ws/rounds"), new SocketListener()).get(5, TimeUnit.SECONDS))
                    .hasCauseInstanceOf(WebSocketHandshakeException.class);
        }
    }

    private WebSocket connect(HttpClient client, UUID user, SocketListener listener) throws Exception {
        return client.newWebSocketBuilder().connectTimeout(Duration.ofSeconds(5)).header("X-Test-User", user.toString())
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/rounds"), listener).get(5, TimeUnit.SECONDS);
    }

    private final class SocketListener implements WebSocket.Listener {
        final BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        final CompletableFuture<Integer> closed = new CompletableFuture<>();
        final StringBuilder fragments = new StringBuilder();
        @Override public void onOpen(WebSocket webSocket) { webSocket.request(1); }
        @Override public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            fragments.append(data);
            if (last) { messages.add(fragments.toString()); fragments.setLength(0); }
            webSocket.request(1); return null;
        }
        @Override public CompletionStage<?> onClose(WebSocket socket, int status, String reason) { closed.complete(status); return null; }
        @Override public void onError(WebSocket socket, Throwable error) { closed.completeExceptionally(error); }
        JsonNode next() throws Exception {
            String message = messages.poll(5, TimeUnit.SECONDS);
            assertThat(message).as("Expected a WebSocket message").isNotNull();
            return mapper.readTree(message);
        }
    }
}
