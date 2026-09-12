package ru.hackathon.airballoon.admin.entity;

import java.time.Instant;
import java.util.UUID;

public record AdminUserEntity(UUID id, String username, String passwordHash, String role, boolean enabled, Instant createdAt) {}