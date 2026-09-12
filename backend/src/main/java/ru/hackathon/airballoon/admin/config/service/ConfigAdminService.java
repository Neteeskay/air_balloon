package ru.hackathon.airballoon.admin.config.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.admin.config.domain.ConfigStatus;
import ru.hackathon.airballoon.admin.config.dto.ConfigDiffResponse;
import ru.hackathon.airballoon.admin.config.dto.ConfigValidationResponse;
import ru.hackathon.airballoon.admin.config.dto.ConfigurationVersionDetail;
import ru.hackathon.airballoon.admin.config.dto.ConfigurationVersionSummary;
import ru.hackathon.airballoon.admin.config.dto.GameConfigurationResponse;
import ru.hackathon.airballoon.admin.config.dto.GameConfigurationWriteRequest;
import ru.hackathon.airballoon.admin.config.entity.AdminBoosterProbabilityRow;
import ru.hackathon.airballoon.admin.config.entity.AdminConfigRow;
import ru.hackathon.airballoon.admin.config.repository.AdminAppRepository;
import ru.hackathon.airballoon.admin.config.repository.AdminBoosterProbabilityRepository;
import ru.hackathon.airballoon.admin.config.repository.AdminConfigRepository;
import ru.hackathon.airballoon.admin.domain.AuditAction;
import ru.hackathon.airballoon.admin.service.AuditService;
import ru.hackathon.airballoon.common.PageResponse;
import ru.hackathon.airballoon.common.error.ConfigStateException;
import ru.hackathon.airballoon.common.error.ConfigValidationException;
import ru.hackathon.airballoon.common.error.FieldViolation;
import ru.hackathon.airballoon.common.error.ResourceNotFoundException;
import ru.hackathon.airballoon.common.error.VersionConflictException;

@Service
public class ConfigAdminService {
    public static final String GAME_ID = "air-balloon";

    private final AdminAppRepository apps;
    private final AdminConfigRepository repository;
    private final AdminBoosterProbabilityRepository probabilities;
    private final AdminConfigMapper mapper;
    private final ConfigAdminValidator validator;
    private final ConfigAdminDiffService diffService;
    private final LiveConfigPublisher publisher;
    private final AuditService audit;

    public ConfigAdminService(AdminAppRepository apps, AdminConfigRepository repository,
                              AdminBoosterProbabilityRepository probabilities, AdminConfigMapper mapper,
                              ConfigAdminValidator validator, ConfigAdminDiffService diffService,
                              LiveConfigPublisher publisher, AuditService audit) {
        this.apps = apps;
        this.repository = repository;
        this.probabilities = probabilities;
        this.mapper = mapper;
        this.validator = validator;
        this.diffService = diffService;
        this.publisher = publisher;
        this.audit = audit;
    }

    public Optional<Long> activeRevision() {
        return repository.findActive(GAME_ID).map(AdminConfigRow::revision);
    }

    public GameConfigurationResponse getActive() {
        return repository.findActive(GAME_ID)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("No active configuration"));
    }

    @Transactional
    public ConfigValidationResponse validate(GameConfigurationWriteRequest request) {
        List<FieldViolation> violations = validator.validate(request);
        if (!violations.isEmpty()) throw new ConfigValidationException(violations);
        return ConfigValidationResponse.ok();
    }

    @Transactional
    public GameConfigurationResponse createDraft(GameConfigurationWriteRequest request, String adminUser) {
        List<FieldViolation> violations = validator.validate(request);
        if (!violations.isEmpty()) throw new ConfigValidationException(violations);

        apps.createIfAbsent(GAME_ID);
        // optimistic concurrency guard: the reported revision must equal the next
        // revision that will be assigned (active revision + 1); proves the client
        // observed the current/last snapshot and nobody else created in between.
        Optional<AdminConfigRow> active = repository.findActiveForUpdate(GAME_ID);
        long currentVersion = active.map(AdminConfigRow::revision).orElse(0L);
        long expectedNext = currentVersion + 1;
        if (request.revision() == null || request.revision() != expectedNext) {
            throw new VersionConflictException(currentVersion);
        }
        if (repository.existsByRevision(GAME_ID, expectedNext)) {
            throw new VersionConflictException(currentVersion);
        }

        long revision = apps.nextSequence(GAME_ID);
        AdminConfigRow row = mapper.toRow(request, revision, active.map(AdminConfigRow::revision).orElse(null),
                null, ConfigStatus.DRAFT.name(), adminUser);
        repository.insert(GAME_ID, row);
        probabilities.insertBatch(row.id(), mapper.toProbabilityRows(row.id(), request.boosters()));
        audit.record(adminUser, AuditAction.CONFIG_CREATED, "GameConfiguration", GAME_ID, row.id(),
                Map.of("revision", row.revision(), "targetStatus", configStatus().name()));
        return toResponse(row);
    }

    @Transactional
    public GameConfigurationResponse activate(UUID id, String adminUser) {
        AdminConfigRow row = repository.findByIdAndAppForUpdate(id, GAME_ID)
                .orElseThrow(() -> new ResourceNotFoundException("Configuration version not found"));
        if (ConfigStatus.ACTIVE.name().equals(row.status())) {
            throw new ConfigStateException("CONFIG_ALREADY_ACTIVE",
                    "Configuration is already active: " + row.revision());
        }
        if (!ConfigStatus.DRAFT.name().equals(row.status())) {
            throw new ConfigStateException("CONFIG_ACTIVATION_FAILED",
                    "Only a draft configuration can be activated");
        }
        List<AdminBoosterProbabilityRow> boosterRows = probabilities.findByConfigId(row.id());
        publisher.publishAndActivate(row, boosterRows, adminUser);
        AdminConfigRow activated = repository.findByIdAndApp(row.id(), GAME_ID).orElse(row);
        audit.record(adminUser, AuditAction.CONFIG_ACTIVATED, "GameConfiguration", GAME_ID, row.id(),
                Map.of("revision", activated.revision(), "status", ConfigStatus.ACTIVE.name()));
        return toResponse(activated);
    }

    public PageResponse<ConfigurationVersionSummary> versions(int page, int size) {
        int p = Math.max(page, 0);
        int s = Math.min(Math.max(size, 1), 200);
        long total = repository.countByApp(GAME_ID);
        List<ConfigurationVersionSummary> content = repository.listByApp(GAME_ID, p, s).stream()
                .map(mapper::toSummary).toList();
        return PageResponse.of(content, p, s, total);
    }

    public ConfigurationVersionDetail version(UUID id) {
        AdminConfigRow row = repository.findByIdAndApp(id, GAME_ID)
                .orElseThrow(() -> new ResourceNotFoundException("Configuration version not found"));
        return toDetail(row);
    }

    @Transactional
    public ConfigDiffResponse diff(UUID fromId, UUID toId) {
        AdminConfigRow from = repository.findByIdAndApp(fromId, GAME_ID)
                .orElseThrow(() -> new ResourceNotFoundException("Source configuration not found"));
        AdminConfigRow to = repository.findByIdAndApp(toId, GAME_ID)
                .orElseThrow(() -> new ResourceNotFoundException("Target configuration not found"));
        return diffService.diff(from, to);
    }

    @Transactional
    public ConfigurationVersionDetail rollback(UUID fromId, String adminUser) {
        AdminConfigRow source = repository.findByIdAndAppForUpdate(fromId, GAME_ID)
                .orElseThrow(() -> new ResourceNotFoundException("Configuration version not found"));
        Long currentRevision = repository.findActive(GAME_ID).map(AdminConfigRow::revision).orElse(null);

        List<AdminBoosterProbabilityRow> boosterRows = probabilities.findByConfigId(source.id());
        repository.archiveActive(GAME_ID);

        long revision = apps.nextSequence(GAME_ID);
        AdminConfigRow clone = new AdminConfigRow(
                UUID.randomUUID(), revision, currentRevision, source.id(), ConfigStatus.ACTIVE.name(),
                source.gameName(), source.gameType(), source.gameActive(),
                source.crashAlpha(), source.crashMaxMultiplier(), source.crashMinCrashMultiplier(),
                source.crashGrowthRate(), source.crashFps(), source.crashDelta(),
                source.boosterTier1(), source.boosterTier2(), source.boosterTier3(), source.boosterTier4(),
                source.pointsPerLine(), source.pointsCashoutBonus(), source.pointsXNBonus(),
                java.time.Instant.now(), adminUser, java.time.Instant.now(), adminUser);
        repository.insert(GAME_ID, clone);
        probabilities.insertBatch(clone.id(), boosterRows);
        publisher.publishMergedOnly(clone, boosterRows);
        audit.record(adminUser, AuditAction.CONFIG_ROLLBACK, "GameConfiguration", GAME_ID, clone.id(),
                Map.of("revision", clone.revision(), "restoredFrom", source.id().toString()));
        return toDetail(clone);
    }

    private GameConfigurationResponse toResponse(AdminConfigRow row) {
        var rows = probabilities.findByConfigId(row.id());
        Map<String, Double> green = AdminConfigMapper.toFlat(mapper.byLevel(rows, AdminConfigMapper.GREEN));
        Map<String, Double> red = AdminConfigMapper.toFlat(mapper.byLevel(rows, AdminConfigMapper.RED));
        return mapper.toResponse(row, green, red);
    }

    private ConfigurationVersionDetail toDetail(AdminConfigRow row) {
        var rows = probabilities.findByConfigId(row.id());
        Map<String, Double> green = AdminConfigMapper.toFlat(mapper.byLevel(rows, AdminConfigMapper.GREEN));
        Map<String, Double> red = AdminConfigMapper.toFlat(mapper.byLevel(rows, AdminConfigMapper.RED));
        return mapper.toDetail(row, green, red);
    }

    private static ConfigStatus configStatus() { return ConfigStatus.DRAFT; }
}
