package ru.hackathon.airballoon.tournament.demo;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import ru.hackathon.airballoon.tournament.port.PlayerScore;
import ru.hackathon.airballoon.tournament.port.PlayerScoreSource;

/** Explicit development fake until Backend #2 supplies demo users and the real ScoreService. */
public class DemoScoreSource implements PlayerScoreSource {
    private final ConcurrentHashMap<UUID, PlayerScore> players = new ConcurrentHashMap<>();
    @Override public Optional<PlayerScore> find(UUID userId) { return Optional.ofNullable(players.get(userId)); }
    public void remember(PlayerScore player) { players.put(player.userId(), player); }
}
