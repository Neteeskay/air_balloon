package ru.hackathon.airballoon.tournament.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Public topic intentionally has no usernames or viewer-specific identity. */
public record LeaderboardUpdate(String type, UUID tournamentId, long revision, List<Player> topPlayers,
                                Player changedPlayer, long totalParticipants, Instant updatedAt) {
    public record Player(UUID userId, long position, long score) {}
}
