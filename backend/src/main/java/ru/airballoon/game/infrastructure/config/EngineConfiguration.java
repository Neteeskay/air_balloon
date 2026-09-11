package ru.airballoon.game.infrastructure.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import ru.airballoon.game.application.GameService;
import ru.airballoon.game.application.port.*;
import ru.airballoon.game.domain.*;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.Arrays;
import java.util.Set;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(GameProperties.class)
@EnableScheduling
public class EngineConfiguration {
    private static final Set<String> DEMO_PROFILES = Set.of("test", "dev", "demo");

    static void requireDemoProfile(Environment environment) {
        String[] profiles = environment.getActiveProfiles();
        if (profiles.length == 0 || !Arrays.stream(profiles).allMatch(DEMO_PROFILES::contains))
            throw new GameException(GameError.INVALID_GAME_CONFIG, "Demo adapters and fixed seed require only test/dev/demo profiles");
    }

    @Bean @ConditionalOnMissingBean
    Clock gameClock() { return Clock.systemUTC(); }

    @Bean
    SeedSource seedSource(GameProperties properties, Environment environment) {
        if (properties.randomMode() == GameProperties.RandomMode.FIXED_SEED) {
            requireDemoProfile(environment);
            if (properties.fixedSeed() == null)
                throw new GameException(GameError.INVALID_GAME_CONFIG, "FIXED_SEED requires game.fixed-seed");
            return () -> properties.fixedSeed();
        }
        SecureRandom random = new SecureRandom();
        return random::nextLong;
    }

    @Bean
    GameService gameService(GameConfigProvider configs, RoundRepository repository, BalanceService balances,
                            RewardService rewards, GameEventPublisher events, SeedSource seeds, Clock clock) {
        return new GameService(new RoundEngine(), configs, repository, balances, rewards, events, seeds, clock);
    }

    @Bean @ConditionalOnProperty(name = "game.scheduler-enabled", havingValue = "true", matchIfMissing = true)
    GameTicker gameTicker(GameService service) { return new GameTicker(service); }

    public static final class GameTicker {
        private static final Logger log = LoggerFactory.getLogger(GameTicker.class);
        private final GameService service;
        GameTicker(GameService service) { this.service = service; }

        @Scheduled(fixedDelayString = "${game.tick-millis:100}")
        public void tick() {
            service.tickAll((id, ex) -> log.error("Round {} tick failed", id, ex));
        }
    }
}
