package ru.hackathon.airballoon.tournament.port;

import java.util.Optional;
import java.util.UUID;

/** Read adapter to Backend #2's existing UserService/ScoreService. */
@FunctionalInterface
public interface PlayerScoreSource {
    Optional<PlayerScore> find(UUID userId);
}
