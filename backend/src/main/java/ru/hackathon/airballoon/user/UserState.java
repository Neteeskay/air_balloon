package ru.hackathon.airballoon.user;

import java.time.Instant;
import java.util.UUID;
public record UserState(UUID userId, String username, String displayName, long bonusBalance, long gameScore,
                        Instant createdAt, Instant updatedAt) {}
