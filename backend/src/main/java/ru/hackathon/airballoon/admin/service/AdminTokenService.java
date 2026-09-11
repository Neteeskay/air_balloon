package ru.hackathon.airballoon.admin.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.admin.entity.AdminSessionEntity;
import ru.hackathon.airballoon.admin.entity.AdminUserEntity;
import ru.hackathon.airballoon.admin.repository.AdminSessionRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

@Service
public class AdminTokenService {
    private final AdminSessionRepository repository;
    private final SecureRandom secureRandom = new SecureRandom();
    private final Duration ttl;

    public AdminTokenService(
            AdminSessionRepository repository,
            @Value("${app.security.admin-token-ttl:PT8H}") Duration ttl) {
        this.repository = repository;
        this.ttl = ttl;
    }

    @Transactional
    public IssuedToken issue(AdminUserEntity user) {
        byte[] random = new byte[32];
        secureRandom.nextBytes(random);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(random);
        Instant expiresAt = Instant.now().plus(ttl);
        AdminSessionEntity session = new AdminSessionEntity();
        session.setAdminUser(user);
        session.setTokenHash(hash(rawToken));
        session.setExpiresAt(expiresAt);
        repository.save(session);
        return new IssuedToken(rawToken, expiresAt);
    }

    @Transactional(readOnly = true)
    public Optional<AdminPrincipal> resolve(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return Optional.empty();
        return repository.findByTokenHash(hash(rawToken))
                .filter(s -> s.getRevokedAt() == null)
                .filter(s -> s.getExpiresAt().isAfter(Instant.now()))
                .filter(s -> s.getAdminUser().isEnabled())
                .map(s -> new AdminPrincipal(
                        s.getAdminUser().getUsername(), s.getAdminUser().getRole().name(), s.getExpiresAt()));
    }

    @Transactional
    public boolean revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return false;
        Optional<AdminSessionEntity> found = repository.findByTokenHash(hash(rawToken));
        if (found.isEmpty()) return false;
        AdminSessionEntity session = found.get();
        if (session.getRevokedAt() == null) {
            session.setRevokedAt(Instant.now());
            repository.save(session);
        }
        return true;
    }

    private static String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by the JDK", e);
        }
    }

    public record IssuedToken(String value, Instant expiresAt) {}
    public record AdminPrincipal(String username, String role, Instant expiresAt) {}
}
