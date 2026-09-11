package ru.hackathon.airballoon.admin.web;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import ru.hackathon.airballoon.admin.dto.LoginRequest;
import ru.hackathon.airballoon.admin.dto.LoginResponse;
import ru.hackathon.airballoon.admin.security.BearerTokenAuthenticationFilter;
import ru.hackathon.airballoon.admin.service.AdminAuthService;

@RestController
@RequestMapping("/api/admin/auth")
public class AdminAuthController {
    private final AdminAuthService authService;

    public AdminAuthController(AdminAuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            Authentication authentication) {
        String token = BearerTokenAuthenticationFilter.bearerToken(authorization);
        authService.logout(token, authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
