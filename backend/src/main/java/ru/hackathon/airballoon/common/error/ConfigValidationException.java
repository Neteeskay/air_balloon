package ru.hackathon.airballoon.common.error;

import java.util.List;

/** 400 CONFIG_VALIDATION_ERROR — the candidate configuration violates rules. */
public class ConfigValidationException extends RuntimeException {
    private final List<FieldViolation> fieldErrors;
    public ConfigValidationException(List<FieldViolation> fieldErrors) {
        super("Ошибка проверки конфигурации");
        this.fieldErrors = List.copyOf(fieldErrors);
    }
    public List<FieldViolation> fieldErrors() { return fieldErrors; }
}