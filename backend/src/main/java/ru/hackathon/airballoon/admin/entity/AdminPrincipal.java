package ru.hackathon.airballoon.admin.entity;

import java.time.Instant;

/** Authenticated admin identity resolved from a bearer token. */
public record AdminPrincipal(String username, String role, Instant expiresAt) {
    public boolean expired(Instant now) {
        return expiresAt == null || !expiresAt.isAfter(now);
    }
}