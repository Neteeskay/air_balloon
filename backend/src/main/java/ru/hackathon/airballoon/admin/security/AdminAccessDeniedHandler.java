package ru.hackathon.airballoon.admin.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import ru.hackathon.airballoon.common.error.ApiErrorResponse;
import ru.hackathon.airballoon.common.web.TraceId;

import java.io.IOException;

@Component
public class AdminAccessDeniedHandler implements AccessDeniedHandler {
    private final ObjectMapper objectMapper;

    public AdminAccessDeniedHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException accessDeniedException) throws IOException, ServletException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        String traceId = request.getAttribute(TraceId.REQUEST_ATTRIBUTE) instanceof String s ? s : TraceId.current();
        objectMapper.writeValue(response.getOutputStream(),
                ApiErrorResponse.of(403, "FORBIDDEN", "You are not allowed to access this resource", null, traceId, null));
    }
}
