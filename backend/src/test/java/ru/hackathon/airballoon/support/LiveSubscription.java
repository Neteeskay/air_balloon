package ru.hackathon.airballoon.support;

import java.lang.reflect.Type;
import java.time.Duration;
import java.util.concurrent.*;
import org.springframework.context.ApplicationContext;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.broker.SimpleBrokerMessageHandler;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import ru.hackathon.airballoon.tournament.api.LeaderboardUpdate;
import static org.awaitility.Awaitility.await;

public final class LiveSubscription implements AutoCloseable {
    public final BlockingQueue<LeaderboardUpdate> updates = new LinkedBlockingQueue<>();
    public final BlockingQueue<Throwable> errors = new LinkedBlockingQueue<>();
    public final StompSession session;
    private final WebSocketStompClient client;

    public LiveSubscription(int port, String destination, ApplicationContext context) throws Exception {
        client = new WebSocketStompClient(new StandardWebSocketClient());
        var converter = new MappingJackson2MessageConverter();
        converter.getObjectMapper().findAndRegisterModules();
        client.setMessageConverter(converter);
        session = client.connectAsync("ws://localhost:" + port + "/ws", new StompSessionHandlerAdapter() {
            @Override public void handleTransportError(StompSession s, Throwable ex) { errors.add(ex); }
            @Override public void handleException(StompSession s, StompCommand command, StompHeaders headers, byte[] payload, Throwable ex) {
                errors.add(ex);
            }
        }).get(10, TimeUnit.SECONDS);
        session.subscribe(destination, new StompFrameHandler() {
            @Override public Type getPayloadType(StompHeaders headers) { return LeaderboardUpdate.class; }
            @Override public void handleFrame(StompHeaders headers, Object payload) { updates.add((LeaderboardUpdate) payload); }
        });
        // Await the real broker registry, not a timing sleep or an early SUBSCRIBE event.
        var headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        headers.setDestination(destination);
        var probe = MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
        var broker = context.getBean(SimpleBrokerMessageHandler.class);
        await().atMost(Duration.ofSeconds(10)).until(() -> !broker.getSubscriptionRegistry().findSubscriptions(probe).isEmpty());
    }
    public LeaderboardUpdate next() throws InterruptedException {
        LeaderboardUpdate update = updates.poll(10, TimeUnit.SECONDS);
        if (update == null) throw new AssertionError("No LEADERBOARD_UPDATE; transport errors: " + errors);
        return update;
    }
    @Override public void close() {
        if (session.isConnected()) session.disconnect();
        client.stop();
    }
}
