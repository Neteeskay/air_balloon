package ru.airballoon.game.infrastructure.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.web.filter.OncePerRequestFilter;
import ru.airballoon.game.application.port.*;
import ru.airballoon.game.infrastructure.memory.*;
import java.io.IOException;
import java.security.Principal;

@Configuration(proxyBeanMethods = false)
@Profile({"dev", "demo", "test"})
public class DemoAdaptersConfiguration {
    public DemoAdaptersConfiguration(Environment environment) { EngineConfiguration.requireDemoProfile(environment); }

    @Bean @ConditionalOnMissingBean(GameConfigProvider.class)
    InMemoryGameConfigProvider demoConfigs(GameProperties properties) {
        return new InMemoryGameConfigProvider(properties.config());
    }

    @Bean @ConditionalOnMissingBean(RoundRepository.class)
    InMemoryRoundRepository demoRounds() { return new InMemoryRoundRepository(); }

    @Bean @ConditionalOnMissingBean(BalanceService.class)
    FakeBalanceService demoBalance(GameProperties properties) { return new FakeBalanceService(properties.demoBalance()); }

    @Bean @ConditionalOnMissingBean(RewardService.class)
    RewardService demoRewards() { return round -> {}; }

    @Bean
    OncePerRequestFilter demoPrincipal(GameProperties properties) {
        Principal principal = () -> properties.demoUser().toString();
        return new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                    throws ServletException, IOException {
                if (request.getUserPrincipal() != null) { chain.doFilter(request, response); return; }
                chain.doFilter(new HttpServletRequestWrapper(request) {
                    @Override public Principal getUserPrincipal() { return principal; }
                }, response);
            }
        };
    }
}
