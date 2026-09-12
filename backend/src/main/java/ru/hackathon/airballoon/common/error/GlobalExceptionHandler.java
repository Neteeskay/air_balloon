package ru.hackathon.airballoon.common.error;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import ru.hackathon.airballoon.common.web.TraceId;

import java.util.List;

/** Central error mapping for the admin API (and a uniform format for /api/admin/**). */
@RestControllerAdvice(basePackages = "ru.hackathon.airballoon.admin")
@Order(Ordered.HIGHEST_PRECEDENCE)
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private static boolean adminPath(HttpServletRequest request) {
        return request != null && request.getRequestURI() != null && request.getRequestURI().startsWith("/api/admin");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiErrorResponse> beanValidation(MethodArgumentNotValidException e, HttpServletRequest request) {
        List<FieldViolation> violations = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> new FieldViolation(fe.getField(), fe.getDefaultMessage()))
                .toList();
        return body(HttpStatus.BAD_REQUEST, "CONFIG_VALIDATION_ERROR", "Configuration validation failed",
                violations, null, request);
    }

    @ExceptionHandler(ConfigValidationException.class)
    ResponseEntity<ApiErrorResponse> configValidation(ConfigValidationException e, HttpServletRequest request) {
        return body(HttpStatus.BAD_REQUEST, "CONFIG_VALIDATION_ERROR", e.getMessage(), e.fieldErrors(), null, request);
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    ResponseEntity<ApiErrorResponse> invalidCredentials(InvalidCredentialsException e, HttpServletRequest request) {
        return body(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", e.getMessage(), null, null, request);
    }

    @ExceptionHandler(VersionConflictException.class)
    ResponseEntity<ApiErrorResponse> versionConflict(VersionConflictException e, HttpServletRequest request) {
        return body(HttpStatus.CONFLICT, "CONFIG_VERSION_CONFLICT", e.getMessage(), null, e.currentVersion(), request);
    }

    @ExceptionHandler(ConfigStateException.class)
    ResponseEntity<ApiErrorResponse> configState(ConfigStateException e, HttpServletRequest request) {
        return body(HttpStatus.CONFLICT, e.code(), e.getMessage(), null, null, request);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    ResponseEntity<ApiErrorResponse> notFound(ResourceNotFoundException e, HttpServletRequest request) {
        return body(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", e.getMessage(), null, null, request);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ApiErrorResponse> malformedRequest(Exception e, HttpServletRequest request) throws Exception {
        if (!adminPath(request)) throw e; // keep the game engine handler for player-facing paths
        return body(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                "Invalid JSON, unsupported fields or malformed parameters", null, null, request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiErrorResponse> unexpected(Exception e, HttpServletRequest request) {
        log.error("Admin API request failed [{}]", TraceId.current(), e);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
                "Internal server error", null, null, request);
    }

    private ResponseEntity<ApiErrorResponse> body(HttpStatus status, String code, String message,
                                                  List<FieldViolation> fieldErrors, Long currentVersion,
                                                  HttpServletRequest request) {
        return ResponseEntity.status(status)
                .body(ApiErrorResponse.of(status.value(), code, message, fieldErrors, TraceId.current(), currentVersion));
    }
}