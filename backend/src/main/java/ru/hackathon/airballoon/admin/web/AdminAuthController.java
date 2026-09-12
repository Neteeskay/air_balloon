package ru.hackathon.airballoon.admin.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.hackathon.airballoon.admin.dto.LoginRequest;
import ru.hackathon.airballoon.admin.dto.LoginResponse;
import ru.hackathon.airballoon.admin.security.AdminBearerTokenFilter;
import ru.hackathon.airballoon.admin.security.AdminSecurityConfiguration;
import ru.hackathon.airballoon.admin.service.AdminAuthService;

@RestController
@RequestMapping("/api/admin/auth")
public class AdminAuthController {
    private final AdminAuthService auth;
    public AdminAuthController(AdminAuthService auth) { this.auth = auth; }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return auth.login(request);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        String token = AdminBearerTokenFilter.bearerToken(request.getHeader("Authorization"));
        var principal = AdminSecurityConfiguration.principal(request);
        auth.logout(token, principal == null ? null : principal.username());
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}