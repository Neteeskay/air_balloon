package ru.airballoon.game;

import java.net.URI;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/** Native WebSocket test transport that avoids the host-broken JDK java.net.http selector. */
final class TestNativeWebSocket {
    interface Listener {
        void onText(String text);
        void onClose(int status);
        void onError(Throwable error);
    }

    private final WebSocketSession session;

    private TestNativeWebSocket(WebSocketSession session) { this.session = session; }

    static TestNativeWebSocket connect(int port, Map<String, String> headers, Listener listener) throws Exception {
        WebSocketHttpHeaders requestHeaders = new WebSocketHttpHeaders();
        headers.forEach(requestHeaders::set);
        WebSocketSession session = new StandardWebSocketClient().execute(new TextWebSocketHandler() {
            @Override protected void handleTextMessage(WebSocketSession session, TextMessage message) {
                listener.onText(message.getPayload());
            }
            @Override public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
                listener.onClose(status.getCode());
            }
            @Override public void handleTransportError(WebSocketSession session, Throwable exception) {
                listener.onError(exception);
            }
        }, requestHeaders, URI.create("ws://localhost:" + port + "/ws/rounds")).get(5, TimeUnit.SECONDS);
        return new TestNativeWebSocket(session);
    }

    void sendText(String text) throws Exception { session.sendMessage(new TextMessage(text)); }
    void close() throws Exception { session.close(CloseStatus.NORMAL); }
    void abort() {
        try { session.close(); } catch (Exception ignored) { }
    }
}
