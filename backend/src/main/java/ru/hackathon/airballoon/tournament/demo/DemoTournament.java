package ru.hackathon.airballoon.tournament.demo;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import ru.hackathon.airballoon.tournament.domain.TournamentParticipant;
import ru.hackathon.airballoon.tournament.persistence.TournamentRepository;
import ru.hackathon.airballoon.tournament.port.PlayerScore;
import ru.hackathon.airballoon.tournament.port.ScoreChanged;
import ru.hackathon.airballoon.tournament.service.TournamentService;
import ru.hackathon.airballoon.user.DemoBootstrap;

@Service
@Profile("(demo | dev) & !prod")
public class DemoTournament {
    public static final List<String> NAMES = List.of("Alex", "Sofia", "Lucky777", "SkyMan", "Rocket", "Nika",
            "Player17", "Ballooner", "CloudRunner", "AirKing", "Maks", "Alexander", "SkyFox", "Luna",
            "Pilot", "Vega", "Windy", "Comet", "Orbit", "Flame", "Aurora", "Sunny", "Nimbus", "Sirius");
    private final Clock clock;
    private final TournamentService tournaments;
    private final TournamentRepository repository;
    private final ObjectProvider<DemoScoreSource> source;
    private final ApplicationEventPublisher events;

    public DemoTournament(Clock clock, TournamentService tournaments, TournamentRepository repository,
                          ObjectProvider<DemoScoreSource> source, ApplicationEventPublisher events) {
        this.clock = clock;
        this.tournaments = tournaments;
        this.repository = repository;
        this.source = source;
        this.events = events;
    }

    public UUID idToday() {
        return stableId("tournament:" + clock.instant().atZone(ZoneOffset.UTC).toLocalDate());
    }
    public static UUID playerId(String name) { return stableId("player:" + name); }
    private static UUID stableId(String value) {
        return UUID.nameUUIDFromBytes(("air-balloon-demo:" + value).getBytes(StandardCharsets.UTF_8));
    }

    @Transactional
    public void initialize() {
        DemoScoreSource fake = source.getIfAvailable();
        Instant now = clock.instant();
        Instant start = now.atZone(ZoneOffset.UTC).toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant();
        UUID id = idToday();
        tournaments.create(id, "Воздушная гонка", "Демонстрационный турнир · 24 часа", start, start.plusSeconds(86400));
        if (fake == null) {
            for (DemoBootstrap.DemoUser user : DemoBootstrap.USERS) {
                tournaments.join(id, DemoBootstrap.id(user.username()));
            }
            return;
        }
        for (int i = 0; i < NAMES.size(); i++) {
            String name = NAMES.get(i);
            UUID user = playerId(name);
            TournamentParticipant persisted = repository.participant(id, user).orElse(null);
            PlayerScore player = persisted == null ? new PlayerScore(user, name, 700 + i * 350L, 0, now)
                    : new PlayerScore(user, name, persisted.score(), persisted.scoreVersion(), persisted.updatedAt());
            fake.remember(player);
            tournaments.join(id, user);
        }
    }

    @Transactional
    public void simulateOnce() {
        DemoScoreSource fake = source.getIfAvailable();
        if (fake == null) return;
        UUID id = idToday();
        if (repository.find(id).isEmpty()) initialize();
        // Serialize demo updates using the same tournament lock; restart reads the persisted version.
        repository.lock(id).orElseThrow();
        String name = NAMES.get(ThreadLocalRandom.current().nextInt(NAMES.size()));
        TournamentParticipant current = repository.participant(id, playerId(name)).orElseThrow();
        long delta = new long[]{50, 100, 200}[ThreadLocalRandom.current().nextInt(3)];
        PlayerScore next = new PlayerScore(current.userId(), name, Math.addExact(current.score(), delta),
                current.scoreVersion() + 1, clock.instant());
        events.publishEvent(new ScoreChanged(next));
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { fake.remember(next); }
        });
    }
}
