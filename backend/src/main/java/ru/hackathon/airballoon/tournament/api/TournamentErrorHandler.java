package ru.hackathon.airballoon.tournament.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** Scoped advice so future Backend #1/#2 error contracts are not intercepted. */
@RestControllerAdvice(assignableTypes = TournamentController.class)
public class TournamentErrorHandler {
    @ExceptionHandler(TournamentException.class)
    ResponseEntity<Error> business(TournamentException ex) {
        return ResponseEntity.status(ex.status()).body(new Error(ex.code(), ex.getMessage()));
    }
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<Error> invalidArgument() {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new Error("INVALID_ARGUMENT", "Invalid UUID or pagination value"));
    }
    public record Error(String code, String message) {}
}
