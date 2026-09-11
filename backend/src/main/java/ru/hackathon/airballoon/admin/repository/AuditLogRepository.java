package ru.hackathon.airballoon.admin.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.hackathon.airballoon.admin.entity.AuditLogEntity;

import java.util.List;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLogEntity, UUID> {
    List<AuditLogEntity> findAllByOrderByTimestampDescIdDesc();
}
