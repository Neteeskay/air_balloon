package ru.hackathon.airballoon.admin.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import ru.hackathon.airballoon.admin.domain.AuditAction;
import ru.hackathon.airballoon.admin.dto.AuditEventResponse;
import ru.hackathon.airballoon.admin.repository.AuditLogRepository;
import ru.hackathon.airballoon.common.PageResponse;
import ru.hackathon.airballoon.common.web.TraceId;

/** Writes admin actions to the audit log and serves filtered, paged queries (SQL-side). */
@Service
public class AuditService {
    private final AuditLogRepository audit;
    private final ObjectMapper json;
    public AuditService(AuditLogRepository audit, ObjectMapper json) { this.audit = audit; this.json = json; }

    public void record(String administrator, AuditAction action, String affectedEntity, String appId,
                       UUID configId, Map<String, ?> metadata) {
        String metadataJson = null;
        if (metadata != null && !metadata.isEmpty()) {
            try {
                metadataJson = json.writeValueAsString(metadata);
            } catch (JsonProcessingException e) {
                throw new IllegalStateException("Cannot serialize audit metadata", e);
            }
        }
        audit.insert(administrator == null || administrator.isBlank() ? "system" : administrator,
                action.name(), affectedEntity, appId, configId, TraceId.current(), metadataJson);
    }

    public PageResponse<AuditEventResponse> search(String action, String administrator, UUID configId,
                                                   Instant from, Instant to, int page, int size) {
        int p = Math.max(page, 0);
        int s = Math.min(Math.max(size, 1), 200);
        long total = audit.count(action, administrator, configId, from, to);
        var rows = audit.searchPage(action, administrator, configId, from, to, p, s);
        var content = rows.stream().map(r -> new AuditEventResponse(r.id(), r.timestamp(), r.administrator(),
                r.action(), r.affectedEntity(), r.appId(), r.configId(), r.traceId(), r.metadata())).toList();
        return PageResponse.of(content, p, s, total);
    }
}