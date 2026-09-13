package ru.hackathon.airballoon.admin.service;

import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import ru.hackathon.airballoon.admin.domain.AuditAction;
import ru.hackathon.airballoon.admin.dto.LoginRequest;
import ru.hackathon.airballoon.admin.dto.LoginResponse;
import ru.hackathon.airballoon.admin.entity.AdminUserEntity;
import ru.hackathon.airballoon.admin.entity.IssuedToken;
import ru.hackathon.airballoon.admin.repository.AdminUserRepository;
import ru.hackathon.airballoon.common.error.InvalidCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

@Service
public class AdminAuthService {
    private static final String GAME_ID = "air-balloon";
    private final AdminUserRepository users;
    private final AdminTokenService tokens;
    private final AuditService audit;
    private final PasswordEncoder passwordEncoder;

    public AdminAuthService(AdminUserRepository users, AdminTokenService tokens, AuditService audit,
                            PasswordEncoder passwordEncoder) {
        this.users = users;
        this.tokens = tokens;
        this.audit = audit;
        this.passwordEncoder = passwordEncoder;
    }

    public LoginResponse login(LoginRequest request) {
        AdminUserEntity user = users.findByUsername(request.username())
                .filter(AdminUserEntity::enabled)
                .orElseThrow(() -> new InvalidCredentialsException("Неверный логин или пароль администратора"));
        if (!passwordEncoder.matches(request.password(), user.passwordHash())) {
            throw new InvalidCredentialsException("Неверный логин или пароль администратора");
        }
        IssuedToken issued = tokens.issue(user);
        audit.record(user.username(), AuditAction.ADMIN_LOGIN, "AdminSession", GAME_ID, null,
                Map.of("result", "SUCCESS"));
        return new LoginResponse(issued.value(), "Bearer", issued.expiresAt());
    }

    public void logout(String rawToken, String username) {
        tokens.revoke(rawToken);
        audit.record(username == null ? "system" : username, AuditAction.ADMIN_LOGOUT,
                "AdminSession", GAME_ID, null, null);
    }
}