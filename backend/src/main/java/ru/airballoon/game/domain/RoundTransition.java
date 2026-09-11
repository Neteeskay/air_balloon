package ru.airballoon.game.domain;

import java.util.List;

public record RoundTransition(GameRound round, List<GameEvent> events) {
    public RoundTransition { events = List.copyOf(events); }
}
