package ru.hackathon.airballoon.tournament.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import ru.hackathon.airballoon.tournament.port.LeaderboardPublisher;

@Configuration(proxyBeanMethods = false)
public class LeaderboardTransportConfiguration {
    @Bean @ConditionalOnMissingBean(LeaderboardPublisher.class)
    LeaderboardPublisher leaderboardPublisher(SimpMessagingTemplate messaging) {
        return update -> messaging.convertAndSend("/topic/tournaments/" + update.tournamentId() + "/leaderboard", update);
    }
}
