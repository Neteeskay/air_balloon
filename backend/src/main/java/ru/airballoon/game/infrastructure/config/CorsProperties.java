package ru.airballoon.game.infrastructure.config;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Single source of truth for browser origins accepted by REST and WebSocket
 * transports. Explicit CORS_ALLOWED_ORIGINS values always take precedence over
 * the frontend scheme/host/port fallback.
 */
@ConfigurationProperties("app.cors")
public record CorsProperties(String frontendScheme, String frontendHost, int frontendPort,
                             String allowedOrigins) {
    private static final Logger log = LoggerFactory.getLogger(CorsProperties.class);

    public CorsProperties {
        frontendScheme = normalizeRequired(frontendScheme, "frontend scheme");
        frontendHost = normalizeRequired(frontendHost, "frontend host");
        if (frontendPort < 1 || frontendPort > 65535) {
            throw new IllegalArgumentException("app.cors.frontend-port must be between 1 and 65535");
        }
        allowedOrigins = allowedOrigins == null ? "" : allowedOrigins;
        List<String> origins = resolveAllowedOrigins(frontendScheme, frontendHost, frontendPort, allowedOrigins);
        log.info("Configured CORS origins: {}", origins);
    }

    /** Returns a trimmed, de-duplicated, non-empty explicit or derived origin list. */
    public List<String> allowedOriginList() {
        return resolveAllowedOrigins(frontendScheme, frontendHost, frontendPort, allowedOrigins);
    }

    private static List<String> resolveAllowedOrigins(String frontendScheme, String frontendHost, int frontendPort,
                                                      String allowedOrigins) {
        List<String> explicit = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .distinct()
                .toList();
        if (!explicit.isEmpty()) {
            explicit.forEach(CorsProperties::validateOrigin);
            return explicit;
        }

        String primary = frontendScheme + "://" + frontendHost + ":" + frontendPort;
        if ("localhost".equalsIgnoreCase(frontendHost)) {
            return List.of(primary, frontendScheme + "://127.0.0.1:" + frontendPort);
        }
        return List.of(primary);
    }

    private static String normalizeRequired(String value, String label) {
        String normalized = Objects.requireNonNull(value, label + " must be configured").trim();
        if (normalized.isEmpty() || normalized.contains("://") || normalized.contains("/")) {
            throw new IllegalArgumentException("Invalid " + label + ": " + value);
        }
        return normalized;
    }

    private static void validateOrigin(String origin) {
        if ("*".equals(origin) || origin.contains("*")) {
            throw new IllegalArgumentException("Wildcard CORS origins are not allowed: " + origin);
        }
        URI parsed;
        try {
            parsed = URI.create(origin);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid CORS origin: " + origin, ex);
        }
        if (parsed.getScheme() == null || parsed.getHost() == null
                || parsed.getRawPath() != null && !parsed.getRawPath().isEmpty()
                || parsed.getRawQuery() != null || parsed.getRawFragment() != null) {
            throw new IllegalArgumentException("CORS origin must contain only scheme, host and optional port: " + origin);
        }
    }
}
