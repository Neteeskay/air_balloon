package ru.hackathon.airballoon.admin.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import ru.hackathon.airballoon.common.error.ApiErrorResponse;
import ru.hackathon.airballoon.common.web.TraceId;

import java.io.IOException;

@Component
public class AdminAuthenticationEntryPoint implements AuthenticationEntryPoint {
    private final ObjectMapper objectMapper;

    public AdminAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException authException) throws IOException, ServletException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        String traceId = request.getAttribute(TraceId.REQUEST_ATTRIBUTE) instanceof String s ? s : TraceId.current();
        objectMapper.writeValue(response.getOutputStream(),
                ApiErrorResponse.of(401, "UNAUTHORIZED", "Authentication is required", null, traceId, null));
    }
}
