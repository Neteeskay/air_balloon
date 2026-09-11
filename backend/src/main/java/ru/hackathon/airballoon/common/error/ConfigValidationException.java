package ru.hackathon.airballoon.common.error;

import java.util.List;

public class ConfigValidationException extends RuntimeException {
    private final List<FieldViolation> fieldErrors;

    public ConfigValidationException(List<FieldViolation> fieldErrors) {
        super("Configuration contains invalid values");
        this.fieldErrors = List.copyOf(fieldErrors);
    }

    public List<FieldViolation> getFieldErrors() {
        return fieldErrors;
    }
}
