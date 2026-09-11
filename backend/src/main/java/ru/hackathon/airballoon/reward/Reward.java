package ru.hackathon.airballoon.reward;

import java.time.Instant;
import java.util.UUID;
public record Reward(UUID id, UUID roundId, UUID userId, String type, String rarity, Instant createdAt) {}
