package ru.hackathon.airballoon.tournament.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public record Tournament(UUID id, String name, String description, Instant startsAt,
                         Instant endsAt, Instant createdAt, Instant updatedAt, long revision) {
    public Tournament {
        Objects.requireNonNull(id);
        Objects.requireNonNull(startsAt);
        Objects.requireNonNull(endsAt);
        Objects.requireNonNull(createdAt);
        Objects.requireNonNull(updatedAt);
        if (name == null || name.isBlank() || name.length() > 120)
            throw new IllegalArgumentException("Tournament name must contain 1–120 characters");
        if (description == null || description.length() > 2000 || !endsAt.isAfter(startsAt) || revision < 0)
            throw new IllegalArgumentException("Invalid tournament dates, description or revision");
    }

    public TournamentStatus statusAt(Instant now) {
        if (now.isBefore(startsAt)) return TournamentStatus.PLANNED;
        return now.isBefore(endsAt) ? TournamentStatus.ACTIVE : TournamentStatus.FINISHED;
    }

    public long secondsRemaining(Instant now) {
        long millis = java.time.Duration.between(now, endsAt).toMillis();
        return millis <= 0 ? 0 : Math.ceilDiv(millis, 1000);
    }
}
