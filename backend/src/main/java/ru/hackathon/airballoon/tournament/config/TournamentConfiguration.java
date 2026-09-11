package ru.hackathon.airballoon.tournament.config;

import java.time.Clock;
import java.util.Optional;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.hackathon.airballoon.tournament.port.CurrentPlayerResolver;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(TournamentProperties.class)
public class TournamentConfiguration {
    @Bean @ConditionalOnMissingBean(Clock.class)
    Clock clock() { return Clock.systemUTC(); }

    @Bean @ConditionalOnMissingBean(CurrentPlayerResolver.class)
    CurrentPlayerResolver currentPlayerResolver() {
        return principal -> {
            if (principal == null) return Optional.empty();
            try { return Optional.of(UUID.fromString(principal.getName())); }
            catch (IllegalArgumentException ex) { return Optional.empty(); }
        };
    }
}
