package ru.airballoon.game.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import java.time.Duration;

@ConfigurationProperties("game.resilience")
public record ResilienceProperties(@DefaultValue("256") int replayLimit,
                                   @DefaultValue("15m") Duration replayRetention,
                                   @DefaultValue("24h") Duration finishedRetention) {
    public ResilienceProperties {
        if (replayLimit < 1 || replayLimit > 500 || replayRetention.isNegative() || replayRetention.isZero()
                || finishedRetention.isNegative() || finishedRetention.isZero()
                || finishedRetention.compareTo(replayRetention) < 0)
            throw new IllegalArgumentException("Invalid replay/finished retention policy");
    }
}
