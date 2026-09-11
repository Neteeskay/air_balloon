package ru.hackathon.airballoon.tournament.demo;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import ru.hackathon.airballoon.tournament.config.TournamentProperties;

@Component
@Profile("(demo | dev) & !prod")
@Order(10)
public class DemoLifecycle implements ApplicationRunner {
    private final DemoTournament demo;
    private final TournamentProperties properties;
    public DemoLifecycle(DemoTournament demo, TournamentProperties properties) { this.demo = demo; this.properties = properties; }
    @Override public void run(ApplicationArguments args) { demo.initialize(); }
    @Scheduled(fixedDelayString = "${tournament.demo-simulation-delay-ms:5000}",
            initialDelayString = "${tournament.demo-simulation-delay-ms:5000}")
    public void tick() {
        if (properties.isDemoTournamentSimulationEnabled()) demo.simulateOnce();
    }
}
