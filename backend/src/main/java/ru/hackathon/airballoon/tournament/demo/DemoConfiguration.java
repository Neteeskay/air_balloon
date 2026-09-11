package ru.hackathon.airballoon.tournament.demo;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.annotation.EnableScheduling;
import ru.hackathon.airballoon.tournament.port.PlayerScoreSource;

@Configuration(proxyBeanMethods = false)
@Profile("(demo | dev) & !prod")
@EnableScheduling
public class DemoConfiguration {
    @Bean @ConditionalOnMissingBean(PlayerScoreSource.class)
    DemoScoreSource demoScoreSource() { return new DemoScoreSource(); }
}
