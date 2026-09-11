package ru.hackathon.airballoon.config.web;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import ru.hackathon.airballoon.config.dto.*;
import ru.hackathon.airballoon.config.service.ConfigDiffService;
import ru.hackathon.airballoon.config.service.ConfigMetadataService;
import ru.hackathon.airballoon.config.service.ConfigService;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/config")
public class ConfigAdminController {
    private final ConfigService configService;
    private final ConfigMetadataService metadataService;
    private final ConfigDiffService diffService;

    public ConfigAdminController(
            ConfigService configService,
            ConfigMetadataService metadataService,
            ConfigDiffService diffService) {
        this.configService = configService;
        this.metadataService = metadataService;
        this.diffService = diffService;
    }

    @GetMapping("/current")
    public ResponseEntity<GameConfigurationResponse> current() {
        GameConfigurationResponse response = configService.current();
        return ResponseEntity.ok()
                .eTag("\"revision-" + response.revision() + "\"")
                .body(response);
    }

    @GetMapping("/metadata")
    public ConfigMetadataResponse metadata() {
        return metadataService.metadata();
    }

    @PostMapping("/validate")
    public ConfigValidationResponse validate(
            @Valid @RequestBody GameConfigurationWriteRequest request,
            Authentication authentication) {
        return configService.validate(request, authentication.getName());
    }

    @PostMapping
    public ResponseEntity<GameConfigurationResponse> save(
            @Valid @RequestBody GameConfigurationWriteRequest request,
            Authentication authentication) {
        GameConfigurationResponse created = configService.createDraft(request, authentication.getName());
        return ResponseEntity.created(URI.create("/api/admin/config/versions/" + created.id()))
                .header(HttpHeaders.ETAG, "\"revision-" + created.revision() + "\"")
                .body(created);
    }

    @PostMapping("/{id}/activate")
    public GameConfigurationResponse activate(@PathVariable UUID id, Authentication authentication) {
        return configService.activate(id, authentication.getName());
    }

    @GetMapping("/versions")
    public PageResponse<ConfigurationVersionSummary> versions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return configService.listVersions(page, size);
    }

    @GetMapping("/versions/{id}")
    public ConfigurationVersionDetail version(@PathVariable UUID id) {
        return configService.getVersion(id);
    }

    @PostMapping("/versions/{id}/rollback")
    public ResponseEntity<GameConfigurationResponse> rollback(@PathVariable UUID id, Authentication authentication) {
        GameConfigurationResponse created = configService.rollback(id, authentication.getName());
        return ResponseEntity.created(URI.create("/api/admin/config/versions/" + created.id())).body(created);
    }

    @GetMapping("/versions/{fromId}/diff/{toId}")
    public ConfigDiffResponse diff(@PathVariable UUID fromId, @PathVariable UUID toId) {
        return diffService.diff(fromId, toId);
    }
}
