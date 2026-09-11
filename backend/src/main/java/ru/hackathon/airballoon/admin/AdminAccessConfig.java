package ru.hackathon.airballoon.admin;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.*;
import org.springframework.web.servlet.config.annotation.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import ru.hackathon.airballoon.common.ApiErrors;

@Configuration
public class AdminAccessConfig implements WebMvcConfigurer {
    private final String token;
    private final ObjectMapper json;
    public AdminAccessConfig(@Value("${app.admin-token:}") String token,ObjectMapper json) { this.token=token; this.json=json; }
    @Override public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override public boolean preHandle(HttpServletRequest request,HttpServletResponse response,Object handler) throws Exception {
                if (handler instanceof HandlerMethod method && AdminController.class.isAssignableFrom(method.getBeanType())) {
                    String provided=request.getHeader("X-Admin-Token");
                    if (token.isBlank() || provided==null || !MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8),provided.getBytes(StandardCharsets.UTF_8))) {
                        response.setStatus(403); response.setContentType("application/json"); response.setCharacterEncoding("UTF-8");
                        json.writeValue(response.getWriter(),new ApiErrors.Error("ADMIN_ACCESS_DENIED","Требуется X-Admin-Token",Instant.now()));
                        return false;
                    }
                }
                return true;
            }
        });
    }
}
