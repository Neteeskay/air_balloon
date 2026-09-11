package ru.hackathon.airballoon.game.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.common.error.BusinessRuleException;
import ru.hackathon.airballoon.common.error.ResourceNotFoundException;
import ru.hackathon.airballoon.config.domain.GameTheme;
import ru.hackathon.airballoon.config.entity.GameConfigurationVersionEntity;
import ru.hackathon.airballoon.config.service.ConfigService;
import ru.hackathon.airballoon.game.domain.RoundStatus;
import ru.hackathon.airballoon.game.dto.CashoutResponse;
import ru.hackathon.airballoon.game.dto.GameRoundResponse;
import ru.hackathon.airballoon.game.dto.GameRoundStartRequest;
import ru.hackathon.airballoon.game.dto.LevelCrossResponse;
import ru.hackathon.airballoon.game.dto.RoundStateResponse;
import ru.hackathon.airballoon.game.entity.GameRoundEntity;
import ru.hackathon.airballoon.game.entity.PlayerEntity;
import ru.hackathon.airballoon.game.repository.GameRoundRepository;
import ru.hackathon.airballoon.game.repository.PlayerRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;

@Service
public class GameRoundService {
    private final ConfigService configService;
    private final PlayerRepository players;
    private final GameRoundRepository rounds;
    private final CrashMathEngine crashMath;
    private final BoosterSelector boosterSelector;

    public GameRoundService(
            ConfigService configService,
            PlayerRepository players,
            GameRoundRepository rounds,
            CrashMathEngine crashMath,
            BoosterSelector boosterSelector) {
        this.configService = configService;
        this.players = players;
        this.rounds = rounds;
        this.crashMath = crashMath;
        this.boosterSelector = boosterSelector;
    }

    @Transactional
    public GameRoundResponse start(String username, GameRoundStartRequest request) {
        GameConfigurationVersionEntity config = configService.currentEntity();
        // Initialize the immutable distribution snapshot while the same transaction is active.
        config.getProbabilities().size();
        if (!config.isGameActive()) {
            throw new BusinessRuleException("GAME_INACTIVE", "New rounds are disabled by the active configuration");
        }

        PlayerEntity player = players.findByUsernameForUpdate(username)
                .orElseGet(() -> players.findByUsernameForUpdate("demo-player")
                        .orElseThrow(() -> new ResourceNotFoundException("Player not found")));
        if (player.getBonusBalance().compareTo(request.bet()) < 0) {
            throw new BusinessRuleException("INSUFFICIENT_BALANCE", "Not enough bonus balance for this bet");
        }
        player.setBonusBalance(player.getBonusBalance().subtract(request.bet()));

        GameRoundEntity round = new GameRoundEntity();
        round.setPlayer(player);
        round.setConfigurationVersion(config);
        round.setTheme(request.theme());
        round.setBoosterTier(request.boosterTier());
        round.setBoosterLevel(boosterSelector.selectLevel(config, request.theme(), request.boosterTier()));
        round.setBetAmount(request.bet());
        round.setCrashPoint(crashMath.generateCrashPoint(config));
        round.setStatus(RoundStatus.RUNNING);
        round.setLastCrossedLevel(0);
        round.setPointsAwarded(0);
        round.setBoosterActivated(false);
        rounds.save(round);
        return toResponse(round);
    }

    @Transactional
    public LevelCrossResponse crossLevel(String username, UUID roundId, int level) {
        GameRoundEntity round = ownedRoundForUpdate(username, roundId);
        if (round.getStatus() != RoundStatus.RUNNING && round.getStatus() != RoundStatus.CASHED_OUT) {
            throw new BusinessRuleException("ROUND_NOT_RUNNING", "The round no longer accepts level events");
        }
        if (level != round.getLastCrossedLevel() + 1) {
            throw new BusinessRuleException("INVALID_LEVEL_SEQUENCE", "Levels must be crossed sequentially");
        }
        if (level < 1 || level > round.getTheme().levelCount()) {
            throw new BusinessRuleException("INVALID_LEVEL", "Level is outside the selected theme");
        }

        double threshold = crashMath.levelThreshold(level);
        if (threshold > round.getCrashPoint()) {
            round.setStatus(RoundStatus.CRASHED);
            round.setCompletedAt(Instant.now());
            rounds.save(round);
            throw new BusinessRuleException("ROUND_CRASHED", "The server crash point was reached before this level");
        }

        GameConfigurationVersionEntity config = round.getConfigurationVersion();
        int awarded = config.getPointsPerLine();
        boolean boosterActivatedNow = false;
        Double boosterMultiplier = null;
        if (round.getStatus() == RoundStatus.RUNNING
                && !round.isBoosterActivated()
                && round.getBoosterLevel() != null
                && round.getBoosterLevel() == level) {
            round.setBoosterActivated(true);
            boosterActivatedNow = true;
            boosterMultiplier = crashMath.boosterValue(config, round.getBoosterTier());
            awarded = Math.addExact(awarded, config.getPointsXNBonus());
        }

        round.setLastCrossedLevel(level);
        round.setPointsAwarded(Math.addExact(round.getPointsAwarded(), awarded));
        PlayerEntity player = round.getPlayer();
        player.setGamePoints(Math.addExact(player.getGamePoints(), awarded));
        rounds.save(round);
        players.save(player);
        return new LevelCrossResponse(round.getId(), level, awarded, round.getPointsAwarded(),
                boosterActivatedNow, boosterMultiplier, config.getId());
    }

    @Transactional
    public CashoutResponse cashout(String username, UUID roundId) {
        GameRoundEntity round = ownedRoundForUpdate(username, roundId);
        if (round.getStatus() != RoundStatus.RUNNING) {
            throw new BusinessRuleException("CASHOUT_NOT_AVAILABLE", "Cashout is only available once during a running round");
        }
        if (round.getLastCrossedLevel() < 1) {
            throw new BusinessRuleException("CASHOUT_NOT_AVAILABLE", "Cashout becomes available after crossing the first level");
        }

        GameConfigurationVersionEntity config = round.getConfigurationVersion();
        double timeMultiplier = crashMath.currentMultiplier(config, round.getStartedAt(),
                round.isBoosterActivated(), round.getBoosterTier());
        double minimumFromProgress = crashMath.levelThreshold(round.getLastCrossedLevel());
        double multiplier = Math.max(timeMultiplier, minimumFromProgress);
        if (multiplier >= round.getCrashPoint()) {
            round.setStatus(RoundStatus.CRASHED);
            round.setCompletedAt(Instant.now());
            rounds.save(round);
            throw new BusinessRuleException("ROUND_CRASHED", "The server crash point has already been reached");
        }

        BigDecimal winnings = round.getBetAmount()
                .multiply(BigDecimal.valueOf(multiplier))
                .setScale(2, RoundingMode.DOWN);
        round.setCashoutMultiplier(multiplier);
        round.setWinnings(winnings);
        round.setStatus(RoundStatus.CASHED_OUT);
        int cashoutPoints = config.getPointsCashoutBonus();
        round.setPointsAwarded(Math.addExact(round.getPointsAwarded(), cashoutPoints));
        PlayerEntity player = round.getPlayer();
        player.setBonusBalance(player.getBonusBalance().add(winnings));
        player.setGamePoints(Math.addExact(player.getGamePoints(), cashoutPoints));
        rounds.save(round);
        players.save(player);
        return new CashoutResponse(round.getId(), multiplier, winnings, cashoutPoints,
                round.getPointsAwarded(), config.getId());
    }

    @Transactional
    public RoundStateResponse state(String username, UUID roundId) {
        GameRoundEntity round = ownedRoundForUpdate(username, roundId);
        GameConfigurationVersionEntity config = round.getConfigurationVersion();
        double current = crashMath.currentMultiplier(config, round.getStartedAt(),
                round.isBoosterActivated(), round.getBoosterTier());
        double visible = Math.min(current, round.getCrashPoint());
        if ((round.getStatus() == RoundStatus.RUNNING || round.getStatus() == RoundStatus.CASHED_OUT)
                && current >= round.getCrashPoint()) {
            round.setCompletedAt(Instant.now());
            round.setStatus(round.getStatus() == RoundStatus.CASHED_OUT ? RoundStatus.COMPLETED : RoundStatus.CRASHED);
            rounds.save(round);
        }
        boolean terminal = round.getStatus() == RoundStatus.CRASHED || round.getStatus() == RoundStatus.COMPLETED;
        return new RoundStateResponse(round.getId(), round.getStatus(), visible, round.getLastCrossedLevel(),
                round.getPointsAwarded(), round.isBoosterActivated(), terminal ? round.getCrashPoint() : null,
                round.getCashoutMultiplier(), round.getWinnings(), config.getId());
    }

    @Transactional(readOnly = true)
    public GameRoundResponse get(String username, UUID roundId) {
        GameRoundEntity round = rounds.findDetailedById(roundId)
                .orElseThrow(() -> new ResourceNotFoundException("Round not found: " + roundId));
        assertOwner(username, round);
        return toResponse(round);
    }

    private GameRoundEntity ownedRoundForUpdate(String username, UUID id) {
        GameRoundEntity round = rounds.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Round not found: " + id));
        assertOwner(username, round);
        return round;
    }

    private static void assertOwner(String username, GameRoundEntity round) {
        if (!round.getPlayer().getUsername().equals(username) && !"demo-player".equals(username)) {
            throw new ResourceNotFoundException("Round not found: " + round.getId());
        }
    }

    private static GameRoundResponse toResponse(GameRoundEntity round) {
        return new GameRoundResponse(
                round.getId(), round.getId(), round.getConfigurationVersion().getId(),
                round.getConfigurationVersion().getRevision(), round.getTheme(), round.getBoosterTier(),
                round.getBoosterLevel(), round.getBetAmount(), round.getStatus(), round.getLastCrossedLevel(),
                round.getPointsAwarded(), round.isBoosterActivated(), round.getStartedAt());
    }
}
