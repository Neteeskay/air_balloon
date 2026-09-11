package ru.hackathon.airballoon.tournament.service;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.tournament.api.*;
import ru.hackathon.airballoon.tournament.config.TournamentProperties;
import ru.hackathon.airballoon.tournament.domain.*;
import ru.hackathon.airballoon.tournament.persistence.TournamentRepository;
import ru.hackathon.airballoon.tournament.port.*;

@Service
public class TournamentService {
    private final TournamentRepository repository;
    private final TournamentProperties properties;
    private final Clock clock;
    private final ApplicationEventPublisher events;
    private final ObjectProvider<PlayerScoreSource> scores;

    public TournamentService(TournamentRepository repository, TournamentProperties properties, Clock clock,
                             ApplicationEventPublisher events, ObjectProvider<PlayerScoreSource> scores) {
        this.repository = repository;
        this.properties = properties;
        this.clock = clock;
        this.events = events;
        this.scores = scores;
    }

    @Transactional(readOnly = true)
    public Optional<TournamentView> active() {
        Instant now = clock.instant();
        return repository.active(now).map(t -> TournamentView.of(t, now));
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public LeaderboardResponse leaderboard(UUID id, UUID viewer, int page, int size) {
        if (page < 0 || size < 1 || size > 100)
            throw new TournamentException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION", "page >= 0; size between 1 and 100");
        Tournament tournament = required(id);
        long offset = (long) page * size;
        List<LeaderboardEntry> top = entries(repository.page(id, 0, 3), 0, viewer);
        List<LeaderboardEntry> participants = entries(repository.page(id, offset, size), offset, viewer);
        LeaderboardEntry current = viewer == null ? null : repository.participant(id, viewer)
                .map(p -> entry(p, repository.position(p), viewer)).orElse(null);
        return new LeaderboardResponse(TournamentView.of(tournament, clock.instant()), top, participants,
                current, repository.count(id), page, size, tournament.updatedAt());
    }

    /** Service-only creation seam; admin authorization belongs to Backend #2. */
    @Transactional
    public Tournament create(UUID id, String name, String description, Instant startsAt, Instant endsAt) {
        Instant now = clock.instant();
        repository.createIfAbsent(new Tournament(id, name, description, startsAt, endsAt, now, now, 0));
        return required(id);
    }

    @Transactional
    public void join(UUID tournamentId, UUID userId) {
        Tournament tournament = repository.lock(tournamentId).orElseThrow(this::notFound);
        Instant now = clock.instant(); // Recheck after acquiring lock, including requests queued at expiry.
        if (tournament.statusAt(now) != TournamentStatus.ACTIVE)
            throw new TournamentException(HttpStatus.CONFLICT, "TOURNAMENT_NOT_ACTIVE", "Tournament is not active");
        PlayerScoreSource source = scores.getIfAvailable();
        if (source == null)
            throw new TournamentException(HttpStatus.SERVICE_UNAVAILABLE, "SCORE_SOURCE_UNAVAILABLE", "Backend #2 score adapter is not installed");
        PlayerScore player = source.find(userId).orElseThrow(() -> new TournamentException(
                HttpStatus.NOT_FOUND, "PLAYER_NOT_FOUND", "Player not found"));
        if (!player.userId().equals(userId))
            throw new IllegalStateException("Score source returned an inconsistent snapshot");
        project(tournament, player, now);
    }

    /** Joins the producer's transaction: rollback removes both score and its projection. */
    @Transactional
    public void onScoreChanged(PlayerScore player) {
        Instant receivedAt = clock.instant();
        if (player.changedAt().isAfter(receivedAt)) throw new IllegalArgumentException("Score timestamp is in the future");
        for (UUID id : repository.activeIds(receivedAt)) {
            Tournament tournament = repository.lock(id).orElseThrow(this::notFound);
            Instant now = clock.instant();
            if (tournament.statusAt(now) == TournamentStatus.ACTIVE
                    && !player.changedAt().isBefore(tournament.startsAt())
                    && player.changedAt().isBefore(tournament.endsAt())) project(tournament, player, now);
        }
    }

    private void project(Tournament tournament, PlayerScore player, Instant now) {
        if (!repository.project(tournament.id(), player, now)) return;
        Tournament updated = repository.touch(tournament.id(), now);
        List<LeaderboardUpdate.Player> top = new ArrayList<>();
        List<TournamentParticipant> leaders = repository.page(tournament.id(), 0, properties.getLiveTopSize());
        for (int i = 0; i < leaders.size(); i++) {
            TournamentParticipant p = leaders.get(i);
            top.add(new LeaderboardUpdate.Player(p.userId(), i + 1L, p.score()));
        }
        TournamentParticipant changed = repository.participant(tournament.id(), player.userId()).orElseThrow();
        events.publishEvent(new LeaderboardUpdate("LEADERBOARD_UPDATE", tournament.id(), updated.revision(),
                List.copyOf(top), new LeaderboardUpdate.Player(player.userId(), repository.position(changed), changed.score()),
                repository.count(tournament.id()), updated.updatedAt()));
    }

    private List<LeaderboardEntry> entries(List<TournamentParticipant> rows, long offset, UUID viewer) {
        List<LeaderboardEntry> result = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) result.add(entry(rows.get(i), offset + i + 1, viewer));
        return List.copyOf(result);
    }

    private LeaderboardEntry entry(TournamentParticipant p, long position, UUID viewer) {
        String name = properties.isMaskOtherPlayerNames() && !p.userId().equals(viewer)
                ? UsernameMasker.mask(p.username()) : p.username();
        return new LeaderboardEntry(position, p.userId(), name, p.score());
    }

    private Tournament required(UUID id) { return repository.find(id).orElseThrow(this::notFound); }
    private TournamentException notFound() {
        return new TournamentException(HttpStatus.NOT_FOUND, "TOURNAMENT_NOT_FOUND", "Tournament not found");
    }
}
