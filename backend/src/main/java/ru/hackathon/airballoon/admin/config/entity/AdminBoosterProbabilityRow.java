package ru.hackathon.airballoon.admin.config.entity;

import java.util.UUID;

public record AdminBoosterProbabilityRow(UUID configId, String theme, int levelNumber, double probability) {}