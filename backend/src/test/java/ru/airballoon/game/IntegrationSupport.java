package ru.airballoon.game;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.security.Principal;
import static ru.airballoon.game.TestSupport.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IntegrationSupport.TestBeans.class)
abstract class IntegrationSupport {
    @TestConfiguration(proxyBeanMethods = false)
    static class TestBeans {
        @Bean @Primary MutableClock controlledClock() { return new MutableClock(); }

        /** Test-only trusted-principal substitute for real multi-user HTTP/WS isolation checks. */
        @Bean @Order(Ordered.HIGHEST_PRECEDENCE)
        OncePerRequestFilter testPrincipal() {
            return new OncePerRequestFilter() {
                protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                        throws IOException, ServletException {
                    String user = request.getHeader("X-Test-User");
                    if (user == null) { chain.doFilter(request, response); return; }
                    chain.doFilter(new HttpServletRequestWrapper(request) {
                        @Override public Principal getUserPrincipal() { return () -> user; }
                    }, response);
                }
            };
        }
    }
}
