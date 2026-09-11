package ru.hackathon.airballoon.tournament.port;

import java.util.Objects;

/** Publish synchronously inside the ScoreService database transaction. No HTTP ingress. */
public record ScoreChanged(PlayerScore player) {
    public ScoreChanged { Objects.requireNonNull(player); }
}
