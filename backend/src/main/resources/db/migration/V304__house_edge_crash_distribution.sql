WITH current_config AS (
    SELECT v.config_json
    FROM game_config_versions v
    JOIN game_config_active a ON a.version = v.version
    WHERE a.id = 1
), inserted AS (
    INSERT INTO game_config_versions(config_json)
    SELECT jsonb_set(config_json, '{alpha}', '0.03'::jsonb, true)
    FROM current_config
    RETURNING version
)
UPDATE game_config_active
SET version = (SELECT version FROM inserted)
WHERE id = 1;
