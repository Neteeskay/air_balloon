package ru.hackathon.airballoon.common;

import java.time.Instant;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.dao.DataIntegrityViolationException;

@RestControllerAdvice
public class ApiErrors {
    public record Error(String code, String message, Instant timestamp) {}
    @ExceptionHandler(BusinessException.class)
    ResponseEntity<Error> business(BusinessException e) {
        return ResponseEntity.status(e.status()).body(new Error(e.code(), e.getMessage(), Instant.now()));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<Error> badRequest(Exception e) {
        return ResponseEntity.badRequest().body(new Error("INVALID_REQUEST", "Проверьте типы и поля запроса", Instant.now()));
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<Error> integrity(Exception e) {
        return ResponseEntity.status(409).body(new Error("DATA_CONFLICT", "Нарушено ограничение целостности данных", Instant.now()));
    }
}
