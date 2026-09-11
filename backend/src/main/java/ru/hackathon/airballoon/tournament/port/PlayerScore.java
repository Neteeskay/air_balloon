package ru.hackathon.airballoon.tournament.port;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Backend #2 supplies the total score and a strictly increasing per-user version. */
public record PlayerScore(UUID userId, String username, long gameScore, long version, Instant changedAt) {
    public PlayerScore {
        Objects.requireNonNull(userId);
        Objects.requireNonNull(changedAt);
        if (username == null || username.isBlank() || username.length() > 120 || gameScore < 0 || version < 0)
            throw new IllegalArgumentException("Invalid authoritative player score");
    }
}
