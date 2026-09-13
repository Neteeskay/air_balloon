package ru.hackathon.airballoon.admin.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import ru.hackathon.airballoon.admin.entity.AdminPrincipal;
import ru.hackathon.airballoon.admin.service.AdminTokenService;
import ru.hackathon.airballoon.common.error.ApiErrorResponse;
import ru.hackathon.airballoon.common.web.TraceId;

/**
 * Bearer-token guard for /api/admin/**.
 * - POST /api/admin/auth/login is public.
 * - no/invalid token -> 401; a valid non-admin player token -> 403 (role USER).
 * - a valid admin token is exposed as the {@code airballoon.admin.principal} request attribute.
 */
@Component
@Order(2)
public class AdminBearerTokenFilter extends OncePerRequestFilter {
    public static final String PRINCIPAL_ATTRIBUTE = "airballoon.admin.principal";

    private final AdminTokenService tokens;
    private final ObjectMapper json;
    private final String playerToken;

    public AdminBearerTokenFilter(AdminTokenService tokens, ObjectMapper json,
                                  @Value("${app.security.demo-player-token:demo-player-token}") String playerToken) {
        this.tokens = tokens;
        this.json = json;
        this.playerToken = playerToken;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = decodedPath(request);
        return !path.startsWith("/api/admin") || path.endsWith("/api/admin/auth/login")
                || HttpMethod.OPTIONS.matches(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = decodedPath(request);
        if ("/api/admin/auth/logout".equals(path)) {
            String token = bearerToken(request.getHeader("Authorization"));
            Optional<AdminPrincipal> principal = token == null ? Optional.empty() : tokens.resolve(token);
            if (principal.isPresent()) {
                request.setAttribute(PRINCIPAL_ATTRIBUTE, principal.get());
                chain.doFilter(request, response);
                return;
            }
            reject(response, 401, "UNAUTHORIZED", "Требуется авторизация");
            return;
        }
        String token = bearerToken(request.getHeader("Authorization"));
        if (token == null) {
            reject(response, 401, "UNAUTHORIZED", "Требуется авторизация");
            return;
        }
        Optional<AdminPrincipal> principal = tokens.resolve(token);
        if (principal.isPresent()) {
            request.setAttribute(PRINCIPAL_ATTRIBUTE, principal.get());
            chain.doFilter(request, response);
            return;
        }
        if (playerToken != null && !playerToken.isBlank() && constantTimeEquals(playerToken, token)) {
            reject(response, 403, "FORBIDDEN", "Доступ к ресурсу запрещён");
            return;
        }
        reject(response, 401, "UNAUTHORIZED", "Токен недействителен или истёк");
    }

    private static String decodedPath(HttpServletRequest request) {
        try {
            return java.net.URLDecoder.decode(request.getRequestURI(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return request.getRequestURI();
        }
    }

    private void reject(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        json.writeValue(response.getWriter(), ApiErrorResponse.of(
                status, code, message, null, TraceId.current(), null));
    }

    public static String bearerToken(String header) {
        if (header == null || header.isBlank()) return null;
        String[] parts = header.trim().split("\\s+", 2);
        if (parts.length == 2 && "Bearer".equalsIgnoreCase(parts[0]) && !parts[1].isBlank()) {
            return parts[1].trim();
        }
        return null;
    }

    static boolean constantTimeEquals(String expected, String actual) {
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                actual.getBytes(StandardCharsets.UTF_8));
    }
}