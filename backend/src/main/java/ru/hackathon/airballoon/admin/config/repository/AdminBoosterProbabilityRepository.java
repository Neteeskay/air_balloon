package ru.hackathon.airballoon.admin.config.repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import ru.hackathon.airballoon.admin.config.entity.AdminBoosterProbabilityRow;

@Repository
public class AdminBoosterProbabilityRepository {
    private final JdbcTemplate jdbc;
    public AdminBoosterProbabilityRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void insertBatch(UUID configId, List<AdminBoosterProbabilityRow> rows) {
        jdbc.batchUpdate("""
                INSERT INTO admin_booster_probability(config_id, theme, level_number, probability)
                VALUES (?, ?, ?, ?)
                """, rows, rows.size(), (ps, row) -> {
                    ps.setObject(1, configId);
                    ps.setString(2, row.theme());
                    ps.setInt(3, row.levelNumber());
                    ps.setDouble(4, row.probability());
                });
    }

    public Map<UUID, List<AdminBoosterProbabilityRow>> findByConfigIds(List<UUID> configIds) {
        if (configIds.isEmpty()) return Map.of();
        String in = configIds.stream().map(id -> "?").collect(Collectors.joining(", "));
        List<AdminBoosterProbabilityRow> rows = jdbc.query(
                "SELECT config_id, theme, level_number, probability FROM admin_booster_probability WHERE config_id IN (" + in + ")"
                        + " ORDER BY theme, level_number",
                (rs, row) -> new AdminBoosterProbabilityRow(
                        rs.getObject("config_id", UUID.class),
                        rs.getString("theme"),
                        rs.getInt("level_number"),
                        rs.getDouble("probability")),
                configIds.toArray());
        return rows.stream().collect(Collectors.groupingBy(AdminBoosterProbabilityRow::configId));
    }

    public List<AdminBoosterProbabilityRow> findByConfigId(UUID configId) {
        return findByConfigIds(List.of(configId)).getOrDefault(configId, List.of());
    }
}