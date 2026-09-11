package ru.hackathon.airballoon.websocket;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.web.socket.config.annotation.*;

import java.util.List;

/** The only transport in the initial scaffold. Disable this config when integrating an existing transport. */
@Configuration(proxyBeanMethods = false)
@EnableWebSocketMessageBroker
@ConditionalOnProperty(name = "tournament.standalone-websocket-enabled", havingValue = "true", matchIfMissing = true)
public class WebSocketConfiguration implements WebSocketMessageBrokerConfigurer {
    private final List<String> allowedOrigins;

    public WebSocketConfiguration(Environment environment) {
        this.allowedOrigins = Binder.get(environment)
                .bind("game.allowed-origins", Bindable.listOf(String.class))
                .orElseThrow(() -> new IllegalStateException("game.allowed-origins must be configured"));
    }

    @Override public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins(allowedOrigins.toArray(String[]::new));
    }
    @Override public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setPreservePublishOrder(true);
    }
    @Override public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor != null && (accessor.getCommand() == StompCommand.SEND
                        || accessor.getCommand() == StompCommand.SUBSCRIBE &&
                        (accessor.getDestination() == null || !accessor.getDestination().matches(
                                "/topic/tournaments/[0-9a-fA-F-]{36}/leaderboard")))) {
                    throw new MessageDeliveryException("Tournament socket is read-only");
                }
                return message;
            }
        });
    }
}
