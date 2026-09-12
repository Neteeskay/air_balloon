package ru.hackathon.airballoon.common.error;

/** 409 with a custom code for configuration state transitions (already active, activation failed). */
public class ConfigStateException extends RuntimeException {
    private final String code;
    public ConfigStateException(String code, String message) {
        super(message);
        this.code = code;
    }
    public String code() { return code; }
}