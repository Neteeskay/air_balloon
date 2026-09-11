package ru.hackathon.airballoon.admin.service;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.admin.domain.AuditAction;
import ru.hackathon.airballoon.admin.dto.LoginRequest;
import ru.hackathon.airballoon.admin.dto.LoginResponse;
import ru.hackathon.airballoon.admin.entity.AdminUserEntity;
import ru.hackathon.airballoon.admin.repository.AdminUserRepository;
import ru.hackathon.airballoon.common.error.InvalidCredentialsException;

import java.util.Map;

@Service
public class AdminAuthService {
    private final AdminUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AdminTokenService tokenService;
    private final AuditService auditService;

    public AdminAuthService(
            AdminUserRepository users,
            PasswordEncoder passwordEncoder,
            AdminTokenService tokenService,
            AuditService auditService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.auditService = auditService;
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        AdminUserEntity user = users.findByUsername(request.username())
                .filter(AdminUserEntity::isEnabled)
                .orElseThrow(InvalidCredentialsException::new);
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        AdminTokenService.IssuedToken token = tokenService.issue(user);
        auditService.record(user.getUsername(), AuditAction.ADMIN_LOGIN, "AdminSession", null, null,
                Map.of("result", "SUCCESS"));
        return new LoginResponse(token.value(), "Bearer", token.expiresAt());
    }

    @Transactional
    public void logout(String rawToken, String username) {
        if (tokenService.revoke(rawToken)) {
            auditService.record(username, AuditAction.ADMIN_LOGOUT, "AdminSession", null, null,
                    Map.of("result", "SUCCESS"));
        }
    }
}
