package ru.hackathon.airballoon.common.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Propagates X-Trace-Id from the client or generates one, exposes it back and in MDC. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TraceIdFilter extends OncePerRequestFilter {
    private static final Pattern SAFE = Pattern.compile("[A-Za-z0-9._:-]{1,100}");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String incoming = request.getHeader("X-Trace-Id");
        String traceId = incoming != null && SAFE.matcher(incoming).matches() ? incoming : UUID.randomUUID().toString();
        request.setAttribute(TraceId.REQUEST_ATTRIBUTE, traceId);
        MDC.put(TraceId.MDC_KEY, traceId);
        try {
            response.setHeader("X-Trace-Id", traceId);
            chain.doFilter(request, response);
        } finally {
            MDC.remove(TraceId.MDC_KEY);
        }
    }
}