package ru.hackathon.airballoon.tournament.domain;

import java.time.Instant;
import java.util.UUID;

public record TournamentParticipant(UUID tournamentId, UUID userId, String username,
                                    long score, long scoreVersion, Instant joinedAt, Instant updatedAt) {}
