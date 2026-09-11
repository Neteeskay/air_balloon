package ru.hackathon.airballoon.support;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import ru.hackathon.airballoon.tournament.port.*;

/** A contract fake only; no balance, score arithmetic, game engine or reward fake. */
public class TestPlayerScores implements PlayerScoreSource {
    private final Map<UUID, PlayerScore> values = new ConcurrentHashMap<>();
    public void put(PlayerScore player) { values.put(player.userId(), player); }
    public void clear() { values.clear(); }
    @Override public Optional<PlayerScore> find(UUID id) { return Optional.ofNullable(values.get(id)); }
}
