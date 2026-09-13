package ru.hackathon.airballoon.admin.config.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.hackathon.airballoon.admin.config.dto.ConfigDiffResponse;
import ru.hackathon.airballoon.admin.config.dto.ConfigMetadataResponse;
import ru.hackathon.airballoon.admin.config.dto.ConfigValidationResponse;
import ru.hackathon.airballoon.admin.config.dto.ConfigurationVersionDetail;
import ru.hackathon.airballoon.admin.config.dto.ConfigurationVersionSummary;
import ru.hackathon.airballoon.admin.config.dto.GameConfigurationResponse;
import ru.hackathon.airballoon.admin.config.dto.GameConfigurationWriteRequest;
import ru.hackathon.airballoon.admin.config.service.ConfigAdminService;
import ru.hackathon.airballoon.admin.config.service.ConfigFileService;
import ru.hackathon.airballoon.admin.config.service.ConfigMetadataService;
import ru.hackathon.airballoon.admin.security.AdminSecurityConfiguration;
import ru.hackathon.airballoon.common.PageResponse;

@RestController
@RequestMapping("/api/admin/config")
public class ConfigAdminController {
    private final ConfigAdminService service;
    private final ConfigMetadataService metadata;
    private final ConfigFileService files;
    public ConfigAdminController(ConfigAdminService service, ConfigMetadataService metadata, ConfigFileService files) {
        this.service = service;
        this.metadata = metadata;
        this.files = files;
    }

    @GetMapping("/current")
    public ResponseEntity<GameConfigurationResponse> current(
            @RequestHeader(name = "If-None-Match", required = false) String ifNoneMatch) {
        GameConfigurationResponse config = service.getActive();
        String etag = revisionTag(config.revision());
        if (ifNoneMatch != null && ifNoneMatch.trim().equals(etag)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).build();
        }
        return ResponseEntity.ok().header(HttpHeaders.ETAG, etag).body(config);
    }

    @GetMapping("/metadata")
    public ConfigMetadataResponse metadata() {
        return metadata.metadata();
    }

    @PostMapping("/validate")
    public ConfigValidationResponse validate(@Valid @RequestBody GameConfigurationWriteRequest request) {
        return service.validate(request);
    }

    @PostMapping
    public ResponseEntity<GameConfigurationResponse> create(
            @Valid @RequestBody GameConfigurationWriteRequest request, HttpServletRequest http) {
        GameConfigurationResponse created = service.createDraft(request, username(http));
        String etag = revisionTag(created.revision());
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.ETAG, etag)
                .location(URI.create(versionPath(http, created.id())))
                .body(created);
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<GameConfigurationResponse> activate(@PathVariable UUID id, HttpServletRequest http) {
        GameConfigurationResponse config = service.activate(id, username(http));
        return ResponseEntity.ok().header(HttpHeaders.ETAG, revisionTag(config.revision())).body(config);
    }

    @GetMapping("/versions")
    public PageResponse<ConfigurationVersionSummary> versions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return service.versions(page, size);
    }

    @GetMapping("/versions/{id}")
    public ConfigurationVersionDetail version(@PathVariable UUID id) {
        return service.version(id);
    }

    @GetMapping("/versions/{fromId}/diff/{toId}")
    public ConfigDiffResponse diff(@PathVariable UUID fromId, @PathVariable UUID toId) {
        return service.diff(fromId, toId);
    }

    @PostMapping("/versions/{id}/rollback")
    public ResponseEntity<ConfigurationVersionDetail> rollback(@PathVariable UUID id, HttpServletRequest http) {
        ConfigurationVersionDetail rolled = service.rollback(id, username(http));
        return ResponseEntity.status(HttpStatus.CREATED).body(rolled);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(name = "format", required = false) String format,
            @RequestParam(name = "version", required = false) UUID version) {
        ConfigFileService.Format fmt = files.parseFormat(format == null ? "" : format);
        var payload = version == null ? service.exportCurrent() : service.exportVersion(version);
        String content = files.serialize(payload, fmt);
        MediaType mediaType = fmt == ConfigFileService.Format.JSON ? MediaType.APPLICATION_JSON
                : MediaType.parseMediaType("application/yaml; charset=UTF-8");
        String extension = fmt == ConfigFileService.Format.JSON ? "json" : "yaml";
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("air-balloon-config-" + payload.gameId() + "." + extension)
                                .build().toString())
                .body(content.getBytes(StandardCharsets.UTF_8));
    }

    @PostMapping("/import")
    public ResponseEntity<GameConfigurationResponse> importConfig(
            @RequestParam(name = "format", required = false) String format,
            @RequestBody String content,
            HttpServletRequest http) {
        ConfigFileService.Format fmt = files.parseFormat(format == null ? "" : format);
        var payload = files.deserialize(content, fmt);
        GameConfigurationResponse config = service.importConfig(payload, username(http));
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.ETAG, revisionTag(config.revision()))
                .body(config);
    }

    private static String username(HttpServletRequest request) {
        var principal = AdminSecurityConfiguration.principal(request);
        return principal == null ? "system" : principal.username();
    }

    private static String revisionTag(long revision) {
        return "\"revision-" + revision + "\"";
    }

    private static String versionPath(HttpServletRequest request, UUID id) {
        String base = request.getRequestURL().toString();
        return base + "/versions/" + id;
    }
}
