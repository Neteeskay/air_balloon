package ru.airballoon.game.infrastructure.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import ru.airballoon.game.domain.GameEvent;
import ru.airballoon.game.infrastructure.web.CurrentUser;
import ru.airballoon.game.infrastructure.web.RoundView;
import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Native JSON WebSocket: each connection receives only its authenticated user's rounds. */
public final class RoundWebSocketHandler extends TextWebSocketHandler {
    private final ObjectMapper mapper;
    private final Map<String, Client> clients = new ConcurrentHashMap<>();

    public RoundWebSocketHandler(ObjectMapper mapper) { this.mapper = mapper; }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        UUID user = CurrentUser.id(session.getPrincipal());
        clients.put(session.getId(), new Client(user, new ConcurrentWebSocketSessionDecorator(session, 1000, 65536)));
        session.sendMessage(new TextMessage("{\"type\":\"CONNECTION_READY\"}"));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        // Client cannot send game state or issue alternate cashout commands through the socket.
        session.close(CloseStatus.POLICY_VIOLATION.withReason("Server events only; use REST commands"));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) { clients.remove(session.getId()); }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws IOException {
        clients.remove(session.getId());
        session.close(CloseStatus.SERVER_ERROR);
    }

    public void publish(GameEvent event) {
        Map<String, Object> data = new HashMap<>(event.data());
        if (event.type() == GameEvent.Type.ROUND_STARTED || event.type() == GameEvent.Type.ROUND_FINISHED)
            data.put("round", RoundView.from(event.snapshot()));
        final TextMessage message;
        try { message = new TextMessage(mapper.writeValueAsString(new EventView(event.type(), event.roundId(),
                event.sequence(), event.timestamp(), data))); }
        catch (IOException e) { throw new IllegalStateException("Unable to serialize game event", e); }
        clients.forEach((id, client) -> {
            if (client.user().equals(event.userId())) {
                try { client.session().sendMessage(message); }
                catch (IOException | RuntimeException e) {
                    clients.remove(id);
                    try { client.session().close(CloseStatus.SESSION_NOT_RELIABLE); } catch (IOException ignored) { }
                }
            }
        });
    }

    public record EventView(GameEvent.Type type, UUID roundId, long sequence, Instant timestamp, Map<String, Object> data) {}
    private record Client(UUID user, WebSocketSession session) {}
}
