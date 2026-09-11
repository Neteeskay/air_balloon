package ru.hackathon.airballoon.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.common.BusinessException;

@Service
public class PostgresGameConfigProvider implements GameConfigProvider {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final ConfigValidator validator;
    public PostgresGameConfigProvider(JdbcTemplate jdbc, ObjectMapper json, ConfigValidator validator) {
        this.jdbc = jdbc; this.json = json; this.validator = validator;
    }
    @Override
    public ConfigSnapshot getCurrentConfig() {
        return jdbc.query("SELECT v.* FROM game_config_versions v JOIN game_config_active a ON a.version=v.version WHERE a.id=1",
            this::map).stream().findFirst().orElseThrow(() -> BusinessException.missing("CONFIG_NOT_FOUND"));
    }
    @Override
    public ConfigSnapshot getVersion(long version) {
        return jdbc.query("SELECT * FROM game_config_versions WHERE version=?", this::map, version)
            .stream().findFirst().orElseThrow(() -> BusinessException.missing("CONFIG_NOT_FOUND"));
    }
    @Transactional
    public ConfigSnapshot update(long expectedVersion, GameConfig config) {
        validator.validate(config);
        Long current = jdbc.queryForObject("SELECT version FROM game_config_active WHERE id=1 FOR UPDATE", Long.class);
        if (current != expectedVersion) throw BusinessException.conflict("CONFIG_VERSION_CONFLICT", "Конфигурация уже изменена. Загрузите свежую версию");
        try {
            long version = jdbc.queryForObject("INSERT INTO game_config_versions(config_json) VALUES (?::jsonb) RETURNING version",
                Long.class, json.writeValueAsString(config));
            jdbc.update("UPDATE game_config_active SET version=? WHERE id=1", version);
            return getVersion(version);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException(e); }
    }
    private ConfigSnapshot map(ResultSet rs, int row) throws SQLException {
        try {
            GameConfig c = json.readValue(rs.getString("config_json"), GameConfig.class);
            validator.validate(c); // Disallow enabling a persisted demo seed outside the demo environment.
            return new ConfigSnapshot(rs.getLong("version"), rs.getTimestamp("created_at").toInstant(), c);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException(e); }
    }
}
