package ru.hackathon.airballoon.admin.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.admin.domain.AuditAction;
import ru.hackathon.airballoon.admin.dto.AuditEventResponse;
import ru.hackathon.airballoon.admin.entity.AuditLogEntity;
import ru.hackathon.airballoon.admin.repository.AuditLogRepository;
import ru.hackathon.airballoon.common.web.TraceId;
import ru.hackathon.airballoon.config.dto.PageResponse;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AuditService {
    private final AuditLogRepository repository;
    private final ObjectMapper objectMapper;

    public AuditService(AuditLogRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void record(
            String administrator,
            AuditAction action,
            String affectedEntity,
            String gameId,
            UUID configurationVersion,
            Map<String, ?> metadata) {
        AuditLogEntity event = new AuditLogEntity();
        event.setAdministrator(administrator == null || administrator.isBlank() ? "system" : administrator);
        event.setAction(action);
        event.setAffectedEntity(affectedEntity);
        event.setGameId(gameId);
        event.setConfigurationVersion(configurationVersion);
        event.setTraceId(TraceId.current());
        event.setMetadata(serializeMetadata(metadata));
        repository.save(event);
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditEventResponse> search(
            String action,
            String administrator,
            UUID configurationVersion,
            Instant from,
            Instant to,
            int page,
            int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 200);
        List<AuditLogEntity> filtered = repository.findAllByOrderByTimestampDescIdDesc().stream()
                .filter(e -> action == null || e.getAction().name().equalsIgnoreCase(action))
                .filter(e -> administrator == null || e.getAdministrator().equalsIgnoreCase(administrator))
                .filter(e -> configurationVersion == null || configurationVersion.equals(e.getConfigurationVersion()))
                .filter(e -> from == null || !e.getTimestamp().isBefore(from))
                .filter(e -> to == null || !e.getTimestamp().isAfter(to))
                .toList();
        long total = filtered.size();
        int fromIndex = Math.min(filtered.size(), safePage * safeSize);
        int toIndex = Math.min(filtered.size(), fromIndex + safeSize);
        List<AuditEventResponse> content = filtered.subList(fromIndex, toIndex).stream().map(this::toResponse).toList();
        int totalPages = total == 0 ? 0 : (int) ((total + safeSize - 1) / safeSize);
        return new PageResponse<>(content, safePage, safeSize, total, totalPages);
    }

    private AuditEventResponse toResponse(AuditLogEntity e) {
        return new AuditEventResponse(e.getId(), e.getTimestamp(), e.getAdministrator(), e.getAction(),
                e.getAffectedEntity(), e.getGameId(), e.getConfigurationVersion(), e.getTraceId(), e.getMetadata());
    }

    private String serializeMetadata(Map<String, ?> metadata) {
        if (metadata == null || metadata.isEmpty()) return "{}";
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }
}
