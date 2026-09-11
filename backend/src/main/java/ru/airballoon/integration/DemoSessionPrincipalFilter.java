package ru.airballoon.integration;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.security.Principal;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Profile("demo")
@Order(Ordered.HIGHEST_PRECEDENCE)
public class DemoSessionPrincipalFilter extends OncePerRequestFilter {
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                               FilterChain chain) throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        UUID id = session == null ? null : (UUID) session.getAttribute(DemoAuthController.SESSION_USER);
        if (id == null || request.getUserPrincipal() != null) {
            chain.doFilter(request, response);
            return;
        }
        Principal principal = () -> id.toString();
        chain.doFilter(new HttpServletRequestWrapper(request) {
            @Override public Principal getUserPrincipal() { return principal; }
        }, response);
    }
}
