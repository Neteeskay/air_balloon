package ru.hackathon.airballoon.admin.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import ru.hackathon.airballoon.admin.service.AdminTokenService;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

@Component
public class BearerTokenAuthenticationFilter extends OncePerRequestFilter {
    private final AdminTokenService tokenService;
    private final String demoPlayerToken;
    private final String configuredUserToken;

    public BearerTokenAuthenticationFilter(
            AdminTokenService tokenService,
            @Value("${app.security.demo-player-token:}") String demoPlayerToken,
            @Value("${app.security.user-token:}") String configuredUserToken) {
        this.tokenService = tokenService;
        this.demoPlayerToken = demoPlayerToken == null ? "" : demoPlayerToken;
        this.configuredUserToken = configuredUserToken == null ? "" : configuredUserToken;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String rawToken = bearerToken(request.getHeader("Authorization"));
        if (rawToken != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            tokenService.resolve(rawToken).ifPresentOrElse(principal -> {
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        principal.username(), null, List.of(new SimpleGrantedAuthority("ROLE_" + principal.role())));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }, () -> {
                if (matchesConfiguredPlayerToken(rawToken)) {
                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            "demo-player", null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            });
        }
        filterChain.doFilter(request, response);
    }

    public static String bearerToken(String header) {
        if (header == null) return null;
        int firstSpace = header.indexOf(' ');
        if (firstSpace <= 0 || !"Bearer".equalsIgnoreCase(header.substring(0, firstSpace))) return null;
        String token = header.substring(firstSpace + 1).trim();
        return token.isBlank() ? null : token;
    }

    private boolean matchesConfiguredPlayerToken(String rawToken) {
        return (!demoPlayerToken.isBlank() && constantTimeEquals(rawToken, demoPlayerToken))
                || (!configuredUserToken.isBlank() && constantTimeEquals(rawToken, configuredUserToken));
    }

    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}
