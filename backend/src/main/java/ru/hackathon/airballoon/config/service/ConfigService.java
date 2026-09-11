package ru.hackathon.airballoon.config.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.admin.domain.AuditAction;
import ru.hackathon.airballoon.admin.service.AuditService;
import ru.hackathon.airballoon.common.error.ConfigStateException;
import ru.hackathon.airballoon.common.error.ResourceNotFoundException;
import ru.hackathon.airballoon.common.error.VersionConflictException;
import ru.hackathon.airballoon.config.domain.ConfigStatus;
import ru.hackathon.airballoon.config.dto.*;
import ru.hackathon.airballoon.config.entity.GameConfigurationVersionEntity;
import ru.hackathon.airballoon.config.entity.GameEntity;
import ru.hackathon.airballoon.config.repository.GameConfigurationVersionRepository;
import ru.hackathon.airballoon.config.repository.GameRepository;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ConfigService {
    public static final String DEFAULT_GAME_ID = "air-balloon";

    private final GameRepository games;
    private final GameConfigurationVersionRepository versions;
    private final ConfigMapper mapper;
    private final ConfigValidator validator;
    private final AuditService audit;

    public ConfigService(
            GameRepository games,
            GameConfigurationVersionRepository versions,
            ConfigMapper mapper,
            ConfigValidator validator,
            AuditService audit) {
        this.games = games;
        this.versions = versions;
        this.mapper = mapper;
        this.validator = validator;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public GameConfigurationResponse current() {
        return mapper.toCurrentResponse(currentEntity());
    }

    @Transactional(readOnly = true)
    public GameConfigurationVersionEntity currentEntity() {
        return versions.findFirstByGame_IdAndStatus(DEFAULT_GAME_ID, ConfigStatus.ACTIVE)
                .orElseThrow(() -> new ResourceNotFoundException("No ACTIVE configuration exists for game " + DEFAULT_GAME_ID));
    }

    @Transactional
    public ConfigValidationResponse validate(GameConfigurationWriteRequest request, String administrator) {
        validator.validate(request, DEFAULT_GAME_ID);
        audit.record(administrator, AuditAction.CONFIG_VALIDATED, "GameConfiguration", DEFAULT_GAME_ID, null,
                Map.of("baseRevision", request.revision()));
        return ConfigValidationResponse.ok();
    }

    @Transactional
    public GameConfigurationResponse createDraft(GameConfigurationWriteRequest request, String administrator) {
        validator.validate(request, DEFAULT_GAME_ID);
        GameEntity game = games.findByIdForUpdate(DEFAULT_GAME_ID)
                .orElseThrow(() -> new ResourceNotFoundException("Game not found: " + DEFAULT_GAME_ID));
        GameConfigurationVersionEntity active = versions.findByGameAndStatusForUpdate(DEFAULT_GAME_ID, ConfigStatus.ACTIVE)
                .orElseThrow(() -> new ResourceNotFoundException("No ACTIVE configuration exists for game " + DEFAULT_GAME_ID));

        if (request.revision() != active.getRevision() && !matchesHistoricalBusinessConfiguration(request)) {
            throw new VersionConflictException(active.getRevision());
        }

        long revision = nextRevision(game);
        GameConfigurationVersionEntity draft = mapper.fromRequest(
                request, game, revision, active.getRevision(), administrator);
        draft.setStatus(ConfigStatus.DRAFT);
        versions.saveAndFlush(draft);
        audit.record(administrator, AuditAction.CONFIG_CREATED, "GameConfiguration", DEFAULT_GAME_ID, draft.getId(),
                Map.of("revision", revision, "baseRevision", active.getRevision()));
        return mapper.toCurrentResponse(draft);
    }

    @Transactional
    public GameConfigurationResponse activate(UUID id, String administrator) {
        GameEntity game = games.findByIdForUpdate(DEFAULT_GAME_ID)
                .orElseThrow(() -> new ResourceNotFoundException("Game not found: " + DEFAULT_GAME_ID));
        GameConfigurationVersionEntity target = versions.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Configuration version not found: " + id));
        if (!DEFAULT_GAME_ID.equals(target.getGame().getId())) {
            throw new ResourceNotFoundException("Configuration version not found: " + id);
        }
        return mapper.toCurrentResponse(activateInternal(game, target, administrator, true));
    }

    @Transactional
    public GameConfigurationResponse rollback(UUID sourceId, String administrator) {
        GameEntity game = games.findByIdForUpdate(DEFAULT_GAME_ID)
                .orElseThrow(() -> new ResourceNotFoundException("Game not found: " + DEFAULT_GAME_ID));
        GameConfigurationVersionEntity source = versions.findByIdForUpdate(sourceId)
                .orElseThrow(() -> new ResourceNotFoundException("Configuration version not found: " + sourceId));
        if (!DEFAULT_GAME_ID.equals(source.getGame().getId())) {
            throw new ResourceNotFoundException("Configuration version not found: " + sourceId);
        }
        GameConfigurationVersionEntity active = versions.findByGameAndStatusForUpdate(DEFAULT_GAME_ID, ConfigStatus.ACTIVE)
                .orElseThrow(() -> new ResourceNotFoundException("No ACTIVE configuration exists for game " + DEFAULT_GAME_ID));

        GameConfigurationWriteRequest sourceRequest = requestFrom(source, active.getRevision());
        validator.validate(sourceRequest, DEFAULT_GAME_ID);

        long revision = nextRevision(game);
        GameConfigurationVersionEntity replacement = mapper.copyVersion(
                source, game, revision, active.getRevision(), administrator);
        replacement.setStatus(ConfigStatus.DRAFT);
        versions.saveAndFlush(replacement);

        active.setStatus(ConfigStatus.ARCHIVED);
        versions.saveAndFlush(active);
        replacement.setStatus(ConfigStatus.ACTIVE);
        replacement.setActivatedAt(Instant.now());
        replacement.setActivatedBy(administrator);
        versions.saveAndFlush(replacement);

        audit.record(administrator, AuditAction.CONFIG_ROLLBACK, "GameConfiguration", DEFAULT_GAME_ID, replacement.getId(),
                Map.of("sourceVersionId", sourceId.toString(), "newRevision", revision));
        return mapper.toCurrentResponse(replacement);
    }

    @Transactional(readOnly = true)
    public PageResponse<ConfigurationVersionSummary> listVersions(int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 200);
        List<GameConfigurationVersionEntity> all = versions.findAllByGame_IdOrderByRevisionDesc(DEFAULT_GAME_ID);
        int from = Math.min(all.size(), safePage * safeSize);
        int to = Math.min(all.size(), from + safeSize);
        List<ConfigurationVersionSummary> content = all.subList(from, to).stream().map(mapper::toSummary).toList();
        long total = all.size();
        int totalPages = total == 0 ? 0 : (int) ((total + safeSize - 1) / safeSize);
        return new PageResponse<>(content, safePage, safeSize, total, totalPages);
    }

    @Transactional(readOnly = true)
    public ConfigurationVersionDetail getVersion(UUID id) {
        GameConfigurationVersionEntity entity = versions.findByIdAndGame_Id(id, DEFAULT_GAME_ID)
                .orElseThrow(() -> new ResourceNotFoundException("Configuration version not found: " + id));
        return mapper.toDetail(entity);
    }

    @Transactional(readOnly = true)
    public GameConfigurationVersionEntity getVersionEntity(UUID id) {
        return versions.findByIdAndGame_Id(id, DEFAULT_GAME_ID)
                .orElseThrow(() -> new ResourceNotFoundException("Configuration version not found: " + id));
    }

    private GameConfigurationVersionEntity activateInternal(
            GameEntity game,
            GameConfigurationVersionEntity target,
            String administrator,
            boolean writeActivationAudit) {
        if (target.getStatus() == ConfigStatus.ACTIVE) {
            throw new ConfigStateException("CONFIG_ALREADY_ACTIVE", "Configuration is already ACTIVE");
        }
        if (target.getStatus() != ConfigStatus.DRAFT) {
            throw new ConfigStateException("CONFIG_ACTIVATION_FAILED", "Only a DRAFT configuration can be activated; use rollback for history");
        }

        GameConfigurationVersionEntity active = versions.findByGameAndStatusForUpdate(DEFAULT_GAME_ID, ConfigStatus.ACTIVE)
                .orElseThrow(() -> new ResourceNotFoundException("No ACTIVE configuration exists for game " + DEFAULT_GAME_ID));
        if (target.getBaseRevision() == null || target.getBaseRevision() != active.getRevision()) {
            throw new VersionConflictException(active.getRevision());
        }

        active.setStatus(ConfigStatus.ARCHIVED);
        versions.saveAndFlush(active); // flush first so the PostgreSQL partial unique ACTIVE index is never transiently violated

        target.setStatus(ConfigStatus.ACTIVE);
        target.setActivatedAt(Instant.now());
        target.setActivatedBy(administrator);
        versions.saveAndFlush(target);

        if (writeActivationAudit) {
            audit.record(administrator, AuditAction.CONFIG_ACTIVATED, "GameConfiguration", DEFAULT_GAME_ID, target.getId(),
                    Map.of("revision", target.getRevision(), "previousRevision", active.getRevision()));
        }
        return target;
    }

    private boolean matchesHistoricalBusinessConfiguration(GameConfigurationWriteRequest request) {
        return versions.findAllByGame_IdOrderByRevisionDesc(DEFAULT_GAME_ID).stream()
                .anyMatch(v -> mapper.businessEquals(request, v));
    }

    private static long nextRevision(GameEntity game) {
        long next = Math.addExact(game.getConfigurationSequence(), 1L);
        game.setConfigurationSequence(next);
        return next;
    }

    private GameConfigurationWriteRequest requestFrom(GameConfigurationVersionEntity source, long baseRevision) {
        GameConfigurationResponse r = mapper.toCurrentResponse(source);
        return new GameConfigurationWriteRequest(
                r.gameId(), r.gameName(), r.gameType(), r.isActive(), baseRevision, r.crash(), r.boosters(), r.points());
    }
}
