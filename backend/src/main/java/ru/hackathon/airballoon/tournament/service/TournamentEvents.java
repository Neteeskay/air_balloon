package ru.hackathon.airballoon.tournament.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import ru.hackathon.airballoon.tournament.api.LeaderboardUpdate;
import ru.hackathon.airballoon.tournament.port.LeaderboardPublisher;
import ru.hackathon.airballoon.tournament.port.ScoreChanged;

@Component
public class TournamentEvents {
    private static final Logger LOG = LoggerFactory.getLogger(TournamentEvents.class);
    private final TournamentService service;
    private final LeaderboardPublisher publisher;
    public TournamentEvents(TournamentService service, LeaderboardPublisher publisher) {
        this.service = service;
        this.publisher = publisher;
    }
    @EventListener
    public void scoreChanged(ScoreChanged event) { service.onScoreChanged(event.player()); }

    @TransactionalEventListener
    public void committed(LeaderboardUpdate event) {
        try { publisher.publish(event); }
        catch (RuntimeException ex) {
            // Scores have committed. A disconnected broker must not turn success into a retry/duplicate command.
            LOG.warn("Leaderboard broadcast failed for tournament {}, revision {}; clients must resync via GET",
                    event.tournamentId(), event.revision(), ex);
        }
    }
}
