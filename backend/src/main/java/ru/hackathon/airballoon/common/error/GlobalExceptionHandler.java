package ru.hackathon.airballoon.common.error;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import ru.hackathon.airballoon.common.web.TraceId;

import java.util.List;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleBeanValidation(
            MethodArgumentNotValidException ex, HttpServletRequest request) {
        List<FieldViolation> fields = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> new FieldViolation(e.getField(), e.getDefaultMessage() == null ? "Invalid value" : e.getDefaultMessage()))
                .toList();
        return error(HttpStatus.BAD_REQUEST, "CONFIG_VALIDATION_ERROR",
                "Configuration contains invalid values", fields, request, null);
    }

    @ExceptionHandler(ConfigValidationException.class)
    public ResponseEntity<ApiErrorResponse> handleConfigValidation(
            ConfigValidationException ex, HttpServletRequest request) {
        return error(HttpStatus.BAD_REQUEST, "CONFIG_VALIDATION_ERROR", ex.getMessage(),
                ex.getFieldErrors(), request, null);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleUnreadable(
            HttpMessageNotReadableException ex, HttpServletRequest request) {
        return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Request body is malformed or contains invalid field types",
                List.of(), request, null);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleConstraintViolation(
            ConstraintViolationException ex, HttpServletRequest request) {
        List<FieldViolation> fields = ex.getConstraintViolations().stream()
                .map(v -> new FieldViolation(v.getPropertyPath().toString(), v.getMessage()))
                .toList();
        return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Request parameters are invalid", fields, request, null);
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidCredentials(
            InvalidCredentialsException ex, HttpServletRequest request) {
        return error(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", ex.getMessage(), List.of(), request, null);
    }

    @ExceptionHandler(VersionConflictException.class)
    public ResponseEntity<ApiErrorResponse> handleVersionConflict(
            VersionConflictException ex, HttpServletRequest request) {
        return error(HttpStatus.CONFLICT, "CONFIG_VERSION_CONFLICT", ex.getMessage(), List.of(), request,
                ex.getCurrentVersion());
    }

    @ExceptionHandler(ConfigStateException.class)
    public ResponseEntity<ApiErrorResponse> handleConfigState(
            ConfigStateException ex, HttpServletRequest request) {
        return error(HttpStatus.CONFLICT, ex.getCode(), ex.getMessage(), List.of(), request, null);
    }

    @ExceptionHandler(BusinessRuleException.class)
    public ResponseEntity<ApiErrorResponse> handleBusinessRule(
            BusinessRuleException ex, HttpServletRequest request) {
        return error(HttpStatus.CONFLICT, ex.getCode(), ex.getMessage(), List.of(), request, null);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNotFound(
            ResourceNotFoundException ex, HttpServletRequest request) {
        return error(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", ex.getMessage(), List.of(), request, null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleIntegrity(
            DataIntegrityViolationException ex, HttpServletRequest request) {
        return error(HttpStatus.CONFLICT, "DATA_INTEGRITY_CONFLICT",
                "The requested operation conflicts with persisted state", List.of(), request, null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
        String trace = traceId(request);
        log.error("Unhandled request failure traceId={}", trace, ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiErrorResponse.of(500, "INTERNAL_ERROR", "Unexpected server error", List.of(), trace, null));
    }

    private static ResponseEntity<ApiErrorResponse> error(
            HttpStatus status,
            String code,
            String message,
            List<FieldViolation> fields,
            HttpServletRequest request,
            Long currentVersion) {
        return ResponseEntity.status(status)
                .body(ApiErrorResponse.of(status.value(), code, message, fields, traceId(request), currentVersion));
    }

    private static String traceId(HttpServletRequest request) {
        Object value = request.getAttribute(TraceId.REQUEST_ATTRIBUTE);
        return value instanceof String s && !s.isBlank() ? s : TraceId.current();
    }
}
