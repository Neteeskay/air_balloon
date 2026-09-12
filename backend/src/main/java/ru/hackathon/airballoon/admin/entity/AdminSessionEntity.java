package ru.hackathon.airballoon.admin.entity;

import java.time.Instant;
import java.util.UUID;

public record AdminSessionEntity(UUID id, UUID adminUserId, String tokenHash, Instant createdAt, Instant expiresAt, Instant revokedAt) {}