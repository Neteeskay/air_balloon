-- The backend catalog is authoritative for puzzle titles, completion thresholds and rewards.
-- Keep the original SKY_JOURNEY row/id as PUZZLE_1 so existing progress and grants retain
-- their puzzle identity. Historical grant receipts keep the threshold that applied when
-- they were issued; only current user progress is migrated to the new threshold.

INSERT INTO clothing_items(id, code, display_name, slot, asset_key, active, default_unlocked, ordering)
VALUES
    ('00000000-0000-0000-0000-000000000105', 'SPACE_HAT', 'Космическая шапка', 'HEAD',
     'avatar/space-hat', true, false, 50),
    ('00000000-0000-0000-0000-000000000106', 'TRAVELER_COSTUME', 'Костюм путешественника', 'NECK',
     'avatar/traveler-costume', true, false, 60)
ON CONFLICT (code) DO UPDATE
SET display_name = EXCLUDED.display_name;

UPDATE puzzle_definitions
SET code = 'PUZZLE_1'
WHERE code = 'SKY_JOURNEY';

INSERT INTO puzzle_definitions(id, code, name, total_fragments, reward_clothing_id, active, ordering)
SELECT '00000000-0000-0000-0000-000000000201', 'PUZZLE_1', 'Вокруг света', 12, c.id, true, 10
FROM clothing_items c
WHERE c.code = 'CLOUD_SCARF'
ON CONFLICT (code) DO NOTHING;

INSERT INTO puzzle_definitions(id, code, name, total_fragments, reward_clothing_id, active, ordering)
SELECT '00000000-0000-0000-0000-000000000202', 'PUZZLE_2', 'Космическая экспедиция', 8, c.id, true, 20
FROM clothing_items c
WHERE c.code = 'SPACE_HAT'
ON CONFLICT (code) DO NOTHING;

INSERT INTO puzzle_definitions(id, code, name, total_fragments, reward_clothing_id, active, ordering)
SELECT '00000000-0000-0000-0000-000000000203', 'PUZZLE_3', 'Небесное путешествие', 6, c.id, true, 30
FROM clothing_items c
WHERE c.code = 'TRAVELER_COSTUME'
ON CONFLICT (code) DO NOTHING;

-- total_fragments participates in two composite foreign keys. Progress tracks the current
-- definition, while a grant is an immutable receipt and therefore references only puzzle_id.
ALTER TABLE user_puzzle_progress
    DROP CONSTRAINT user_puzzle_progress_puzzle_id_total_fragments_fkey;
ALTER TABLE puzzle_reward_grants
    DROP CONSTRAINT puzzle_reward_grants_puzzle_id_total_fragments_fkey;

UPDATE puzzle_definitions p
SET name = desired.name,
    total_fragments = desired.total_fragments,
    reward_clothing_id = c.id,
    active = true,
    ordering = desired.ordering
FROM (VALUES
    ('PUZZLE_1', 'Вокруг света', 12, 'CLOUD_SCARF', 10),
    ('PUZZLE_2', 'Космическая экспедиция', 8, 'SPACE_HAT', 20),
    ('PUZZLE_3', 'Небесное путешествие', 6, 'TRAVELER_COSTUME', 30)
) AS desired(code, name, total_fragments, reward_code, ordering)
JOIN clothing_items c ON c.code = desired.reward_code
WHERE p.code = desired.code;

UPDATE user_puzzle_progress up
SET total_fragments = p.total_fragments,
    collected_fragments = LEAST(up.collected_fragments, p.total_fragments),
    completed = up.collected_fragments >= p.total_fragments,
    completed_at = CASE
        WHEN up.collected_fragments >= p.total_fragments THEN COALESCE(up.completed_at, now())
        ELSE NULL
    END,
    updated_at = now()
FROM puzzle_definitions p
WHERE p.id = up.puzzle_id;

-- If a lowered threshold completes an existing puzzle, grant its unchanged reward without
-- revoking any reward that was earned before a threshold increase.
INSERT INTO user_clothing_items(user_id, clothing_id, source_type, source_id)
SELECT up.user_id, p.reward_clothing_id, 'PUZZLE', p.id
FROM user_puzzle_progress up
JOIN puzzle_definitions p ON p.id = up.puzzle_id
WHERE up.completed
ON CONFLICT (user_id, clothing_id) DO NOTHING;

ALTER TABLE user_puzzle_progress
    ADD CONSTRAINT user_puzzle_progress_puzzle_id_total_fragments_fkey
    FOREIGN KEY (puzzle_id, total_fragments) REFERENCES puzzle_definitions(id, total_fragments);
ALTER TABLE puzzle_reward_grants
    ADD CONSTRAINT puzzle_reward_grants_puzzle_id_fkey
    FOREIGN KEY (puzzle_id) REFERENCES puzzle_definitions(id);
