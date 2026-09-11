package ru.hackathon.airballoon.tournament.api;

import java.time.Instant;
import java.util.UUID;
import ru.hackathon.airballoon.tournament.domain.Tournament;
import ru.hackathon.airballoon.tournament.domain.TournamentStatus;

public record TournamentView(UUID id, String name, String description, TournamentStatus status,
                             Instant startsAt, Instant endsAt, long secondsRemaining,
                             Instant serverTime, long revision) {
    public static TournamentView of(Tournament tournament, Instant now) {
        return new TournamentView(tournament.id(), tournament.name(), tournament.description(),
                tournament.statusAt(now), tournament.startsAt(), tournament.endsAt(),
                tournament.secondsRemaining(now), now, tournament.revision());
    }
}
