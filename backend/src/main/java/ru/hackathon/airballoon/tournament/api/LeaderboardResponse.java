package ru.hackathon.airballoon.tournament.api;

import java.time.Instant;
import java.util.List;

public record LeaderboardResponse(TournamentView tournament, List<LeaderboardEntry> top3,
                                  List<LeaderboardEntry> participants, LeaderboardEntry currentPlayer,
                                  long totalParticipants, int page, int size, Instant updatedAt) {}
