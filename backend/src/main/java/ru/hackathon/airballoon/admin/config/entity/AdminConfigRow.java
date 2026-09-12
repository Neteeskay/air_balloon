package ru.hackathon.airballoon.admin.config.entity;

import java.time.Instant;
import java.util.UUID;

/** Flat row of the admin_config table. */
public record AdminConfigRow(
    UUID id,
    long revision,
    Long baseRevision,
    UUID sourceVersionId,
    String status,
    String gameName,
    String gameType,
    boolean gameActive,
    double crashAlpha,
    double crashMaxMultiplier,
    double crashMinCrashMultiplier,
    double crashGrowthRate,
    double crashFps,
    double crashDelta,
    double boosterTier1,
    double boosterTier2,
    double boosterTier3,
    double boosterTier4,
    long pointsPerLine,
    long pointsCashoutBonus,
    long pointsXNBonus,
    Instant createdAt,
    String createdBy,
    Instant activatedAt,
    String activatedBy
) {}