package ru.airballoon.game.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import ru.airballoon.game.domain.GameConfig;
import ru.airballoon.game.domain.GameError;
import ru.airballoon.game.domain.GameException;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@ConfigurationProperties("game")
public record GameProperties(GameConfig config, RandomMode randomMode, Long fixedSeed, int tickMillis,
                             boolean schedulerEnabled, UUID demoUser, BigDecimal demoBalance,
                             List<String> allowedOrigins) {
    public GameProperties {
        if (tickMillis < 50 || tickMillis > 1000 || randomMode == null || config == null
                || allowedOrigins == null || allowedOrigins.isEmpty() || allowedOrigins.contains("*"))
            throw new GameException(GameError.INVALID_GAME_CONFIG, "Invalid tick interval, mode, config or allowed origins");
        allowedOrigins = List.copyOf(allowedOrigins);
    }
    public enum RandomMode { NORMAL, FIXED_SEED }
}
