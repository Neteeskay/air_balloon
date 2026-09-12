package ru.hackathon.airballoon.rating.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = GlobalRatingController.class)
public class GlobalRatingErrorHandler {
    @ExceptionHandler(GlobalRatingException.class)
    ResponseEntity<Error> business(GlobalRatingException ex) {
        return ResponseEntity.status(ex.status()).body(new Error(ex.code(), ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<Error> invalidArgument() {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new Error("INVALID_ARGUMENT", "Invalid pagination value"));
    }

    public record Error(String code, String message) {}
}
