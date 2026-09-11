-- Existing engine deployments accepted this exact range from application.yml.
-- Persist it into every immutable config snapshot so catalog and start validation
-- consume the same versioned PostgreSQL source on both fresh and upgraded databases.
UPDATE game_config_versions
SET config_json = config_json || jsonb_build_object(
        'minBet', COALESCE(config_json->'minBet', '1'::jsonb),
        'maxBet', COALESCE(config_json->'maxBet', '1000'::jsonb))
WHERE NOT (config_json ? 'minBet') OR NOT (config_json ? 'maxBet');
