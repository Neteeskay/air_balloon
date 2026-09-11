package ru.hackathon.airballoon.admin.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.hackathon.airballoon.admin.entity.AdminSessionEntity;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface AdminSessionRepository extends JpaRepository<AdminSessionEntity, UUID> {
    Optional<AdminSessionEntity> findByTokenHash(String tokenHash);

    @Modifying
    @Query("delete from AdminSessionEntity s where s.expiresAt < :cutoff or s.revokedAt is not null")
    int deleteExpiredOrRevoked(@Param("cutoff") Instant cutoff);
}
