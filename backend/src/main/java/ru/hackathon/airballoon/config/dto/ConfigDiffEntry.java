package ru.hackathon.airballoon.config.dto;

public record ConfigDiffEntry(String field, Object before, Object after) {
}
