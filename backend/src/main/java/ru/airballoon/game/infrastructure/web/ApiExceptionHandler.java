package ru.airballoon.game.infrastructure.web;

import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import ru.airballoon.game.domain.*;
import java.time.Clock;
import java.time.Instant;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);
    private final Clock clock;
    public ApiExceptionHandler(Clock clock) { this.clock = clock; }

    @ExceptionHandler(GameException.class)
    ResponseEntity<ApiError> business(GameException e, HttpServletRequest request) {
        HttpStatus status = switch (e.code()) {
            case ROUND_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case UNAUTHENTICATED -> HttpStatus.UNAUTHORIZED;
            case FORBIDDEN_ROUND_ACCESS -> HttpStatus.FORBIDDEN;
            case ROUND_NOT_RUNNING, CASHOUT_NOT_AVAILABLE_YET, ALREADY_CASHED_OUT, ROUND_ALREADY_CRASHED,
                    INSUFFICIENT_BALANCE -> HttpStatus.CONFLICT;
            case INVALID_GAME_CONFIG, INTEGRATION_UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
            default -> HttpStatus.BAD_REQUEST;
        };
        return ResponseEntity.status(status).body(new ApiError(e.code(), e.getMessage(), clock.instant(), request.getRequestURI()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> malformed(HttpMessageNotReadableException e, HttpServletRequest request) {
        Throwable cause = e;
        while (cause != null) {
            if (cause instanceof InvalidFormatException invalid && invalid.getTargetType() == Theme.class)
                return business(new GameException(GameError.INVALID_THEME, "Theme must be GREEN or RED"), request);
            cause = cause.getCause();
        }
        return business(new GameException(GameError.INVALID_REQUEST, "Invalid JSON or unsupported request fields"), request);
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ApiError> invalidRequest(Exception e, HttpServletRequest request) {
        return business(new GameException(GameError.INVALID_REQUEST, "Missing or invalid request parameters"), request);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiError> wrongMethod(Exception e, HttpServletRequest request) {
        return ResponseEntity.status(405).body(new ApiError(GameError.INVALID_REQUEST,
                "HTTP method not supported", clock.instant(), request.getRequestURI()));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception e, HttpServletRequest request) {
        log.error("Game API request failed", e);
        return business(new GameException(GameError.INTEGRATION_UNAVAILABLE, "Game service is temporarily unavailable"), request);
    }

    public record ApiError(GameError code, String message, Instant timestamp, String path) {}
}
