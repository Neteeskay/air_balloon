package ru.hackathon.airballoon.admin.entity;

import java.time.Instant;

public record IssuedToken(String value, Instant expiresAt) {}