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
        {
            var ownerEvents = new SocketListener(); var otherEvents = new SocketListener();
            TestNativeWebSocket owner = connect(user, ownerEvents);
            TestNativeWebSocket stranger = connect(other, otherEvents);
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
                clock.atMillis(100000); service.tick(r.id());
                List<JsonNode> events = new ArrayList<>();
                while (events.isEmpty() || !events.getLast().path("type").asText().equals("ROUND_FINISHED")) events.add(ownerEvents.next());
                assertThat(events.stream().map(e -> e.path("type").asText())).containsSubsequence("ROUND_STARTED", "MULTIPLIER_UPDATE",
                        "LEVEL_REACHED", "BOOSTER_ACTIVATED", "CASHOUT_SUCCESS", "MULTIPLIER_UPDATE", "CRASH", "ROUND_FINISHED");
                assertThat(events.stream().map(e -> e.path("sequence").asLong())).doesNotHaveDuplicates().isSorted();
                assertThat(events.stream().filter(e -> e.path("type").asText().equals("CASHOUT_SUCCESS")).count()).isEqualTo(1);
                assertThat(events.stream().filter(e -> e.path("type").asText().equals("BOOSTER_ACTIVATED")).count()).isEqualTo(1);
                var booster = events.stream().filter(e -> e.path("type").asText().equals("BOOSTER_ACTIVATED")).findFirst().orElseThrow();
                assertThat(booster.path("data").path("cashoutPreviewAmount").decimalValue()).isEqualByComparingTo("600.00");
                assertThat(events.stream().filter(e -> e.path("type").asText().equals("MULTIPLIER_UPDATE")
                        && e.path("data").has("cashoutPreviewAmount")).toList()).isNotEmpty();
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
        {
            var listener = new SocketListener(); var socket = connect(UUID.randomUUID(), listener);
            try {
                listener.next();
                socket.sendText("{\"type\":\"CASHOUT_SUCCESS\",\"winAmount\":999999}");
                assertThat(listener.closed.get(5, TimeUnit.SECONDS)).isEqualTo(1008);
            } finally { socket.abort(); }
        }
    }

    @Test void invalidPrincipalAndCrossOriginWebSocketAreRejected() {
        {
            assertThatThrownBy(() -> TestNativeWebSocket.connect(port,
                    Map.of("X-Test-User", "not-a-user"), new SocketListener()));
            assertThatThrownBy(() -> TestNativeWebSocket.connect(port,
                    Map.of("Origin", "https://untrusted.example"), new SocketListener()));
        }
    }

    @Test void configuredFrontendOriginCanOpenNativeWebSocket() throws Exception {
        var listener = new SocketListener();
        var socket = TestNativeWebSocket.connect(port, Map.of(
                "X-Test-User", UUID.randomUUID().toString(),
                "Origin", "http://localhost:5173"), listener);
        try {
            assertThat(listener.next().path("type").asText()).isEqualTo("CONNECTION_READY");
        } finally {
            socket.abort();
        }
    }

    private TestNativeWebSocket connect(UUID user, SocketListener listener) throws Exception {
        return TestNativeWebSocket.connect(port, Map.of("X-Test-User", user.toString()), listener);
    }

    private final class SocketListener implements TestNativeWebSocket.Listener {
        final BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        final CompletableFuture<Integer> closed = new CompletableFuture<>();
        @Override public void onText(String data) { messages.add(data); }
        @Override public void onClose(int status) { closed.complete(status); }
        @Override public void onError(Throwable error) { closed.completeExceptionally(error); }
        JsonNode next() throws Exception {
            String message = messages.poll(5, TimeUnit.SECONDS);
            assertThat(message).as("Expected a WebSocket message").isNotNull();
            return mapper.readTree(message);
        }
    }
}
