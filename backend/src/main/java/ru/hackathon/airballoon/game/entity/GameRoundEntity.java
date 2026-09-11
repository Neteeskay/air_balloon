package ru.hackathon.airballoon.game.entity;

import jakarta.persistence.*;
import ru.hackathon.airballoon.config.domain.GameTheme;
import ru.hackathon.airballoon.config.entity.GameConfigurationVersionEntity;
import ru.hackathon.airballoon.game.domain.RoundStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "game_round", indexes = {
        @Index(name = "idx_round_player_created", columnList = "player_id,created_at"),
        @Index(name = "idx_round_config", columnList = "configuration_version_id")
})
public class GameRoundEntity {
    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "player_id", nullable = false, updatable = false, foreignKey = @ForeignKey(name = "fk_round_player"))
    private PlayerEntity player;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "configuration_version_id", nullable = false, updatable = false, foreignKey = @ForeignKey(name = "fk_round_config"))
    private GameConfigurationVersionEntity configurationVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "theme", nullable = false, length = 16, updatable = false)
    private GameTheme theme;

    @Column(name = "booster_tier", nullable = false, updatable = false)
    private int boosterTier;

    @Column(name = "booster_level", updatable = false)
    private Integer boosterLevel;

    @Column(name = "bet_amount", nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal betAmount;

    @Column(name = "crash_point", nullable = false, updatable = false)
    private double crashPoint;

    @Column(name = "started_at", nullable = false, updatable = false)
    private Instant startedAt;

    @Column(name = "last_crossed_level", nullable = false)
    private int lastCrossedLevel;

    @Column(name = "points_awarded", nullable = false)
    private int pointsAwarded;

    @Column(name = "booster_activated", nullable = false)
    private boolean boosterActivated;

    @Column(name = "cashout_multiplier")
    private Double cashoutMultiplier;

    @Column(name = "winnings", precision = 19, scale = 2)
    private BigDecimal winnings;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private RoundStatus status;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (startedAt == null) startedAt = Instant.now();
        if (status == null) status = RoundStatus.RUNNING;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public PlayerEntity getPlayer() { return player; }
    public void setPlayer(PlayerEntity player) { this.player = player; }
    public GameConfigurationVersionEntity getConfigurationVersion() { return configurationVersion; }
    public void setConfigurationVersion(GameConfigurationVersionEntity configurationVersion) { this.configurationVersion = configurationVersion; }
    public GameTheme getTheme() { return theme; }
    public void setTheme(GameTheme theme) { this.theme = theme; }
    public int getBoosterTier() { return boosterTier; }
    public void setBoosterTier(int boosterTier) { this.boosterTier = boosterTier; }
    public Integer getBoosterLevel() { return boosterLevel; }
    public void setBoosterLevel(Integer boosterLevel) { this.boosterLevel = boosterLevel; }
    public BigDecimal getBetAmount() { return betAmount; }
    public void setBetAmount(BigDecimal betAmount) { this.betAmount = betAmount; }
    public double getCrashPoint() { return crashPoint; }
    public void setCrashPoint(double crashPoint) { this.crashPoint = crashPoint; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public int getLastCrossedLevel() { return lastCrossedLevel; }
    public void setLastCrossedLevel(int lastCrossedLevel) { this.lastCrossedLevel = lastCrossedLevel; }
    public int getPointsAwarded() { return pointsAwarded; }
    public void setPointsAwarded(int pointsAwarded) { this.pointsAwarded = pointsAwarded; }
    public boolean isBoosterActivated() { return boosterActivated; }
    public void setBoosterActivated(boolean boosterActivated) { this.boosterActivated = boosterActivated; }
    public Double getCashoutMultiplier() { return cashoutMultiplier; }
    public void setCashoutMultiplier(Double cashoutMultiplier) { this.cashoutMultiplier = cashoutMultiplier; }
    public BigDecimal getWinnings() { return winnings; }
    public void setWinnings(BigDecimal winnings) { this.winnings = winnings; }
    public RoundStatus getStatus() { return status; }
    public void setStatus(RoundStatus status) { this.status = status; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public long getLockVersion() { return lockVersion; }
    public void setLockVersion(long lockVersion) { this.lockVersion = lockVersion; }
}
