package ru.hackathon.airballoon.common.error;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiErrorResponse(
        Instant timestamp,
        int status,
        String code,
        String message,
        List<FieldViolation> fieldErrors,
        String traceId,
        Long currentVersion) {

    public static ApiErrorResponse of(
            int status,
            String code,
            String message,
            List<FieldViolation> fieldErrors,
            String traceId,
            Long currentVersion) {
        return new ApiErrorResponse(Instant.now(), status, code, message,
                fieldErrors == null ? List.of() : List.copyOf(fieldErrors), traceId, currentVersion);
    }
}
