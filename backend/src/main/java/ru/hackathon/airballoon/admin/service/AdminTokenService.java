package ru.hackathon.airballoon.admin.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.admin.entity.AdminPrincipal;
import ru.hackathon.airballoon.admin.entity.AdminSessionEntity;
import ru.hackathon.airballoon.admin.entity.AdminUserEntity;
import ru.hackathon.airballoon.admin.entity.IssuedToken;
import ru.hackathon.airballoon.admin.repository.AdminSessionRepository;
import ru.hackathon.airballoon.admin.repository.AdminUserRepository;

/**
 * Opaque bearer tokens with server-side sessions: the raw token is returned once,
 * only its SHA-256 hash is persisted and used for lookups; logout revokes the session.
 */
@Service
public class AdminTokenService {
    private final AdminSessionRepository sessions;
    private final AdminUserRepository users;
    private final Clock clock;
    private final Duration ttl;
    private final SecureRandom random = new SecureRandom();

    public AdminTokenService(AdminSessionRepository sessions, AdminUserRepository users, Clock clock,
                             @Value("${app.security.admin-token-ttl:PT8H}") Duration ttl) {
        this.sessions = sessions;
        this.users = users;
        this.clock = clock;
        this.ttl = ttl == null ? Duration.ofHours(8) : ttl;
    }

    @Transactional
    public IssuedToken issue(AdminUserEntity user) {
        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        Instant now = clock.instant();
        Instant expiresAt = now.plus(ttl);
        sessions.insert(new AdminSessionEntity(UUID.randomUUID(), user.id(), hash(token), now, expiresAt, null));
        return new IssuedToken(token, expiresAt);
    }

    @Transactional(readOnly = true)
    public Optional<AdminPrincipal> resolve(String rawToken) {
        Instant now = clock.instant();
        return sessions.findByTokenHash(hash(rawToken))
                .filter(s -> s.revokedAt() == null)
                .filter(s -> s.expiresAt().isAfter(now))
                .flatMap(s -> users.findById(s.adminUserId())
                        .filter(AdminUserEntity::enabled)
                        .map(u -> new AdminPrincipal(u.username(), u.role().toLowerCase(), s.expiresAt())));
    }

    @Transactional
    public boolean revoke(String rawToken) {
        Instant now = clock.instant();
        return sessions.findByTokenHash(hash(rawToken))
                .map(s -> sessions.revoke(s.id(), now) > 0)
                .orElse(false);
    }

    public static String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}