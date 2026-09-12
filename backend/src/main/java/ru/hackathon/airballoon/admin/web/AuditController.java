package ru.hackathon.airballoon.admin.web;

import java.time.Instant;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.hackathon.airballoon.admin.dto.AuditEventResponse;
import ru.hackathon.airballoon.admin.service.AuditService;
import ru.hackathon.airballoon.common.PageResponse;

@RestController
@RequestMapping("/api/admin/audit")
public class AuditController {
    private final AuditService audit;
    public AuditController(AuditService audit) { this.audit = audit; }

    @GetMapping
    public PageResponse<AuditEventResponse> search(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String administrator,
            @RequestParam(required = false) UUID version,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return audit.search(action, administrator, version, from, to, page, size);
    }
}