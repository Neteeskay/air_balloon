package ru.hackathon.airballoon.tournament.api;

import java.util.UUID;

public record LeaderboardEntry(long position, UUID userId, String username, long score) {}
