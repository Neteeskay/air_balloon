package ru.hackathon.airballoon.config;

import java.time.Instant;
public record ConfigSnapshot(long version, Instant updatedAt, GameConfig config) {}
