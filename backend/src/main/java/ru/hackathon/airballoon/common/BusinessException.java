package ru.hackathon.airballoon.common;

import org.springframework.http.HttpStatus;

public class BusinessException extends RuntimeException {
    private final String code;
    private final HttpStatus status;
    public BusinessException(String code, String message, HttpStatus status) {
        super(message); this.code = code; this.status = status;
    }
    public String code() { return code; }
    public HttpStatus status() { return status; }
    public static BusinessException invalid(String code, String message) {
        return new BusinessException(code, message, HttpStatus.BAD_REQUEST);
    }
    public static BusinessException missing(String code) {
        return new BusinessException(code, code, HttpStatus.NOT_FOUND);
    }
    public static BusinessException conflict(String code, String message) {
        return new BusinessException(code, message, HttpStatus.CONFLICT);
    }
    public static BusinessException forbidden(String code, String message) {
        return new BusinessException(code, message, HttpStatus.FORBIDDEN);
    }
}
