package ru.hackathon.airballoon.common.error;

public class ConfigStateException extends RuntimeException {
    private final String code;

    public ConfigStateException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
