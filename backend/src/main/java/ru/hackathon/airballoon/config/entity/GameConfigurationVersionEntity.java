package ru.hackathon.airballoon.config.entity;

import jakarta.persistence.*;
import ru.hackathon.airballoon.config.domain.ConfigStatus;
import ru.hackathon.airballoon.config.domain.GameType;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "game_configuration_version",
       uniqueConstraints = @UniqueConstraint(name = "uq_game_config_revision", columnNames = {"game_id", "revision"}),
       indexes = {
           @Index(name = "idx_config_game_status", columnList = "game_id,status"),
           @Index(name = "idx_config_created_at", columnList = "created_at")
       })
public class GameConfigurationVersionEntity {
    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "game_id", nullable = false, updatable = false, foreignKey = @ForeignKey(name = "fk_config_game"))
    private GameEntity game;

    @Column(name = "revision", nullable = false, updatable = false)
    private long revision;

    @Column(name = "base_revision", updatable = false)
    private Long baseRevision;

    @Column(name = "source_version_id", updatable = false)
    private UUID sourceVersionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ConfigStatus status;

    @Column(name = "game_name", nullable = false, length = 200)
    private String gameName;

    @Enumerated(EnumType.STRING)
    @Column(name = "game_type", nullable = false, length = 32)
    private GameType gameType;

    @Column(name = "game_active", nullable = false)
    private boolean gameActive;

    @Column(name = "alpha", nullable = false)
    private double alpha;

    @Column(name = "max_multiplier", nullable = false)
    private double maxMultiplier;

    @Column(name = "min_crash_multiplier", nullable = false)
    private double minCrashMultiplier;

    @Column(name = "multiplier_growth_rate", nullable = false)
    private double multiplierGrowthRate;

    @Column(name = "fps", nullable = false)
    private double fps;

    @Column(name = "delta", nullable = false)
    private double delta;

    @Column(name = "multiplier_tier_1_value", nullable = false)
    private double multiplierTier1Value;

    @Column(name = "multiplier_tier_2_value", nullable = false)
    private double multiplierTier2Value;

    @Column(name = "multiplier_tier_3_value", nullable = false)
    private double multiplierTier3Value;

    @Column(name = "multiplier_tier_4_value", nullable = false)
    private double multiplierTier4Value;

    @Column(name = "points_per_line", nullable = false)
    private int pointsPerLine;

    @Column(name = "points_cashout_bonus", nullable = false)
    private int pointsCashoutBonus;

    @Column(name = "points_xn_bonus", nullable = false)
    private int pointsXNBonus;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", nullable = false, updatable = false, length = 100)
    private String createdBy;

    @Column(name = "activated_at")
    private Instant activatedAt;

    @Column(name = "activated_by", length = 100)
    private String activatedBy;

    @OneToMany(mappedBy = "configurationVersion", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("theme ASC, levelNumber ASC")
    private List<BoosterLevelProbabilityEntity> probabilities = new ArrayList<>();

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
    }

    public void addProbability(BoosterLevelProbabilityEntity probability) {
        probability.setConfigurationVersion(this);
        probabilities.add(probability);
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public GameEntity getGame() { return game; }
    public void setGame(GameEntity game) { this.game = game; }
    public long getRevision() { return revision; }
    public void setRevision(long revision) { this.revision = revision; }
    public Long getBaseRevision() { return baseRevision; }
    public void setBaseRevision(Long baseRevision) { this.baseRevision = baseRevision; }
    public UUID getSourceVersionId() { return sourceVersionId; }
    public void setSourceVersionId(UUID sourceVersionId) { this.sourceVersionId = sourceVersionId; }
    public ConfigStatus getStatus() { return status; }
    public void setStatus(ConfigStatus status) { this.status = status; }
    public String getGameName() { return gameName; }
    public void setGameName(String gameName) { this.gameName = gameName; }
    public GameType getGameType() { return gameType; }
    public void setGameType(GameType gameType) { this.gameType = gameType; }
    public boolean isGameActive() { return gameActive; }
    public void setGameActive(boolean gameActive) { this.gameActive = gameActive; }
    public double getAlpha() { return alpha; }
    public void setAlpha(double alpha) { this.alpha = alpha; }
    public double getMaxMultiplier() { return maxMultiplier; }
    public void setMaxMultiplier(double maxMultiplier) { this.maxMultiplier = maxMultiplier; }
    public double getMinCrashMultiplier() { return minCrashMultiplier; }
    public void setMinCrashMultiplier(double minCrashMultiplier) { this.minCrashMultiplier = minCrashMultiplier; }
    public double getMultiplierGrowthRate() { return multiplierGrowthRate; }
    public void setMultiplierGrowthRate(double multiplierGrowthRate) { this.multiplierGrowthRate = multiplierGrowthRate; }
    public double getFps() { return fps; }
    public void setFps(double fps) { this.fps = fps; }
    public double getDelta() { return delta; }
    public void setDelta(double delta) { this.delta = delta; }
    public double getMultiplierTier1Value() { return multiplierTier1Value; }
    public void setMultiplierTier1Value(double multiplierTier1Value) { this.multiplierTier1Value = multiplierTier1Value; }
    public double getMultiplierTier2Value() { return multiplierTier2Value; }
    public void setMultiplierTier2Value(double multiplierTier2Value) { this.multiplierTier2Value = multiplierTier2Value; }
    public double getMultiplierTier3Value() { return multiplierTier3Value; }
    public void setMultiplierTier3Value(double multiplierTier3Value) { this.multiplierTier3Value = multiplierTier3Value; }
    public double getMultiplierTier4Value() { return multiplierTier4Value; }
    public void setMultiplierTier4Value(double multiplierTier4Value) { this.multiplierTier4Value = multiplierTier4Value; }
    public int getPointsPerLine() { return pointsPerLine; }
    public void setPointsPerLine(int pointsPerLine) { this.pointsPerLine = pointsPerLine; }
    public int getPointsCashoutBonus() { return pointsCashoutBonus; }
    public void setPointsCashoutBonus(int pointsCashoutBonus) { this.pointsCashoutBonus = pointsCashoutBonus; }
    public int getPointsXNBonus() { return pointsXNBonus; }
    public void setPointsXNBonus(int pointsXNBonus) { this.pointsXNBonus = pointsXNBonus; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getActivatedAt() { return activatedAt; }
    public void setActivatedAt(Instant activatedAt) { this.activatedAt = activatedAt; }
    public String getActivatedBy() { return activatedBy; }
    public void setActivatedBy(String activatedBy) { this.activatedBy = activatedBy; }
    public List<BoosterLevelProbabilityEntity> getProbabilities() { return probabilities; }
    public void setProbabilities(List<BoosterLevelProbabilityEntity> probabilities) { this.probabilities = probabilities; }
}
