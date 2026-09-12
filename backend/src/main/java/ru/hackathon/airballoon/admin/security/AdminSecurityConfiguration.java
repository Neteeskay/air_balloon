package ru.hackathon.airballoon.admin.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.hackathon.airballoon.admin.entity.AdminPrincipal;

@Configuration
public class AdminSecurityConfiguration {
    @Bean
    public org.springframework.security.crypto.password.PasswordEncoder adminPasswordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    public static AdminPrincipal principal(HttpServletRequest request) {
        return (AdminPrincipal) request.getAttribute(AdminBearerTokenFilter.PRINCIPAL_ATTRIBUTE);
    }
}