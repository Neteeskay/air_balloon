package ru.hackathon.airballoon.score;

import java.util.UUID;
public record ScoreChange(UUID eventId, long points, boolean replayed) {}
