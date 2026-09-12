package ru.hackathon.airballoon.common.error;

/** A single field validation failure, e.g. {"field":"crash.alpha","message":"must be < 1.0","rejectedValue":1.5}. */
public record FieldViolation(String field, String message, Object rejectedValue) {
    public FieldViolation(String field, String message) {
        this(field, message, null);
    }
}