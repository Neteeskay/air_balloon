package ru.hackathon.airballoon.admin.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.hackathon.airballoon.admin.entity.AdminUserEntity;

import java.util.Optional;
import java.util.UUID;

public interface AdminUserRepository extends JpaRepository<AdminUserEntity, UUID> {
    Optional<AdminUserEntity> findByUsername(String username);
}
