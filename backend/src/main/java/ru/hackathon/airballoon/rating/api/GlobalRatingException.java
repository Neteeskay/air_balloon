package ru.hackathon.airballoon.rating.api;

import org.springframework.http.HttpStatus;

public class GlobalRatingException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public GlobalRatingException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }
}
