package ru.hackathon.airballoon.admin.dto;

import java.time.Instant;

public record LoginResponse(String accessToken, String tokenType, Instant expiresAt) {}