package ru.airballoon.game.infrastructure.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.server.HandshakeInterceptor;
import ru.airballoon.game.application.port.GameEventPublisher;
import ru.airballoon.game.infrastructure.config.GameProperties;
import ru.airballoon.game.infrastructure.web.CurrentUser;
import java.util.Map;

@Configuration(proxyBeanMethods = false)
@EnableWebSocket
public class RealtimeConfiguration implements WebSocketConfigurer, WebMvcConfigurer {
    private final RoundWebSocketHandler handler;
    private final GameProperties properties;

    public RealtimeConfiguration(ObjectMapper mapper, GameProperties properties) {
        this.handler = new RoundWebSocketHandler(mapper);
        this.properties = properties;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/rounds")
                .setAllowedOrigins(properties.allowedOrigins().toArray(String[]::new))
                .addInterceptors(new HandshakeInterceptor() {
                    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
                        try { CurrentUser.id(request.getPrincipal()); return true; }
                        catch (RuntimeException e) { response.setStatusCode(HttpStatus.UNAUTHORIZED); return false; }
                    }
                    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                               WebSocketHandler wsHandler, Exception exception) {}
                });
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/rounds/**").allowedOrigins(properties.allowedOrigins().toArray(String[]::new))
                .allowedMethods("GET", "POST").allowCredentials(true);
    }

    @Bean
    GameEventPublisher gameEvents(ApplicationEventPublisher applicationEvents) {
        return event -> {
            applicationEvents.publishEvent(event);
            handler.publish(event);
        };
    }
}
