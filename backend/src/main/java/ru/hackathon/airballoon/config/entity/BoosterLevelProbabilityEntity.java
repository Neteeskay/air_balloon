package ru.hackathon.airballoon.config.entity;

import jakarta.persistence.*;
import ru.hackathon.airballoon.config.domain.GameTheme;

@Entity
@Table(name = "booster_level_probability",
       uniqueConstraints = @UniqueConstraint(name = "uq_probability_config_theme_level", columnNames = {"configuration_version_id", "theme", "level_number"}),
       indexes = @Index(name = "idx_probability_config", columnList = "configuration_version_id"))
public class BoosterLevelProbabilityEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "configuration_version_id", nullable = false, updatable = false, foreignKey = @ForeignKey(name = "fk_probability_config"))
    private GameConfigurationVersionEntity configurationVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "theme", nullable = false, length = 16, updatable = false)
    private GameTheme theme;

    @Column(name = "level_number", nullable = false, updatable = false)
    private int levelNumber;

    @Column(name = "probability", nullable = false)
    private double probability;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public GameConfigurationVersionEntity getConfigurationVersion() { return configurationVersion; }
    public void setConfigurationVersion(GameConfigurationVersionEntity configurationVersion) { this.configurationVersion = configurationVersion; }
    public GameTheme getTheme() { return theme; }
    public void setTheme(GameTheme theme) { this.theme = theme; }
    public int getLevelNumber() { return levelNumber; }
    public void setLevelNumber(int levelNumber) { this.levelNumber = levelNumber; }
    public double getProbability() { return probability; }
    public void setProbability(double probability) { this.probability = probability; }
}
