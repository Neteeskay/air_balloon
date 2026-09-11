package ru.hackathon.airballoon.support;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.security.Principal;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

@TestConfiguration(proxyBeanMethods = false)
public class TournamentTestConfiguration {
    @Bean @Primary MutableClock testClock() { return new MutableClock(); }
    @Bean TestPlayerScores testPlayerScores() { return new TestPlayerScores(); }
    // Only compiled in src/test; production never trusts this header.
    @Bean Filter testAuthentication() {
        return new Filter() {
            @Override public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
                    throws IOException, ServletException {
                HttpServletRequest http = (HttpServletRequest) req;
                chain.doFilter(new HttpServletRequestWrapper(http) {
                    @Override public Principal getUserPrincipal() {
                        String id = http.getHeader("X-Test-Principal");
                        return id == null ? null : () -> id;
                    }
                }, res);
            }
        };
    }
}
