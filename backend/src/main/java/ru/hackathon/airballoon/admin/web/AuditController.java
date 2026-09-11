package ru.hackathon.airballoon.admin.web;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import ru.hackathon.airballoon.admin.dto.AuditEventResponse;
import ru.hackathon.airballoon.admin.service.AuditService;
import ru.hackathon.airballoon.config.dto.PageResponse;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/audit")
public class AuditController {
    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    public PageResponse<AuditEventResponse> audit(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String administrator,
            @RequestParam(required = false) UUID version,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return auditService.search(action, administrator, version, from, to, page, size);
    }
}
