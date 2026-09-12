CREATE TABLE clothing_items (
    id UUID PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(120) NOT NULL CHECK (length(trim(display_name)) > 0),
    slot VARCHAR(16) NOT NULL CHECK (slot IN ('HEAD','NECK')),
    asset_key VARCHAR(160) NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT true,
    default_unlocked BOOLEAN NOT NULL DEFAULT false,
    ordering INTEGER NOT NULL DEFAULT 0 CHECK (ordering >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, slot)
);

CREATE TABLE puzzle_definitions (
    id UUID PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL CHECK (length(trim(name)) > 0),
    total_fragments INTEGER NOT NULL CHECK (total_fragments > 0),
    reward_clothing_id UUID NOT NULL REFERENCES clothing_items(id),
    active BOOLEAN NOT NULL DEFAULT true,
    ordering INTEGER NOT NULL DEFAULT 0 CHECK (ordering >= 0),
    rewards_enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, total_fragments)
);

CREATE TABLE user_puzzle_progress (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    puzzle_id UUID NOT NULL,
    total_fragments INTEGER NOT NULL,
    collected_fragments INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, puzzle_id),
    FOREIGN KEY (puzzle_id, total_fragments) REFERENCES puzzle_definitions(id, total_fragments),
    CHECK (collected_fragments BETWEEN 0 AND total_fragments),
    CHECK (completed = (collected_fragments = total_fragments)),
    CHECK ((completed AND completed_at IS NOT NULL) OR (NOT completed AND completed_at IS NULL))
);

CREATE TABLE puzzle_reward_grants (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    round_id UUID NOT NULL,
    reward_type VARCHAR(32) NOT NULL CHECK (reward_type = 'PUZZLE_FRAGMENT'),
    puzzle_id UUID NOT NULL,
    total_fragments INTEGER NOT NULL,
    fragment_delta INTEGER NOT NULL CHECK (fragment_delta = 1),
    collected_fragments_after INTEGER NOT NULL,
    puzzle_completed BOOLEAN NOT NULL,
    clothing_unlocked BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, round_id, reward_type),
    FOREIGN KEY (round_id, user_id) REFERENCES game_rounds(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (puzzle_id, total_fragments) REFERENCES puzzle_definitions(id, total_fragments),
    CHECK (collected_fragments_after BETWEEN 1 AND total_fragments),
    CHECK (puzzle_completed = (collected_fragments_after = total_fragments)),
    CHECK (NOT clothing_unlocked OR puzzle_completed)
);
CREATE UNIQUE INDEX puzzle_reward_grants_round_type_idx
    ON puzzle_reward_grants(round_id, reward_type);

CREATE TABLE user_clothing_items (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clothing_id UUID NOT NULL REFERENCES clothing_items(id),
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_type VARCHAR(24) NOT NULL CHECK (source_type IN ('DEFAULT','PUZZLE')),
    source_id UUID NOT NULL,
    PRIMARY KEY (user_id, clothing_id)
);
CREATE INDEX user_clothing_items_user_idx ON user_clothing_items(user_id, unlocked_at);

CREATE TABLE user_avatar_equipment (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    head_clothing_id UUID REFERENCES clothing_items(id),
    neck_clothing_id UUID REFERENCES clothing_items(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    FOREIGN KEY (user_id, head_clothing_id) REFERENCES user_clothing_items(user_id, clothing_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, neck_clothing_id) REFERENCES user_clothing_items(user_id, clothing_id) ON DELETE CASCADE
);

INSERT INTO clothing_items(id, code, display_name, slot, asset_key, active, default_unlocked, ordering) VALUES
    ('00000000-0000-0000-0000-000000000101', 'AVIATOR', 'Шлем авиатора', 'HEAD', 'avatar/aviator', true, true, 10),
    ('00000000-0000-0000-0000-000000000102', 'SUNHAT', 'Солнечная шляпа', 'HEAD', 'avatar/sunhat', true, true, 20),
    ('00000000-0000-0000-0000-000000000103', 'BOW', 'Бантик', 'NECK', 'avatar/bow', true, true, 30),
    ('00000000-0000-0000-0000-000000000104', 'CLOUD_SCARF', 'Облачный шарфик', 'NECK', 'avatar/cloud-scarf', true, false, 40);

INSERT INTO puzzle_definitions(id, code, name, total_fragments, reward_clothing_id, active, ordering)
VALUES ('00000000-0000-0000-0000-000000000201', 'SKY_JOURNEY', 'Небесное путешествие', 6,
        '00000000-0000-0000-0000-000000000104', true, 10);

CREATE FUNCTION provision_avatar_profile() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO user_clothing_items(user_id, clothing_id, source_type, source_id)
    SELECT NEW.id, c.id, 'DEFAULT', c.id FROM clothing_items c WHERE c.default_unlocked;
    INSERT INTO user_avatar_equipment(user_id, head_clothing_id, neck_clothing_id)
    VALUES (NEW.id,
            '00000000-0000-0000-0000-000000000101',
            '00000000-0000-0000-0000-000000000103');
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_provision_avatar_profile
AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION provision_avatar_profile();

INSERT INTO user_clothing_items(user_id, clothing_id, source_type, source_id)
SELECT u.id, c.id, 'DEFAULT', c.id
FROM users u CROSS JOIN clothing_items c
WHERE c.default_unlocked
ON CONFLICT (user_id, clothing_id) DO NOTHING;

INSERT INTO user_avatar_equipment(user_id, head_clothing_id, neck_clothing_id)
SELECT u.id,
       '00000000-0000-0000-0000-000000000101',
       '00000000-0000-0000-0000-000000000103'
FROM users u
ON CONFLICT (user_id) DO NOTHING;

CREATE FUNCTION validate_avatar_equipment_slots() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.head_clothing_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM clothing_items WHERE id = NEW.head_clothing_id AND slot = 'HEAD' AND active
    ) THEN
        RAISE EXCEPTION 'invalid or inactive HEAD clothing' USING ERRCODE = '23514';
    END IF;
    IF NEW.neck_clothing_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM clothing_items WHERE id = NEW.neck_clothing_id AND slot = 'NECK' AND active
    ) THEN
        RAISE EXCEPTION 'invalid or inactive NECK clothing' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER user_avatar_equipment_slots
BEFORE INSERT OR UPDATE ON user_avatar_equipment
FOR EACH ROW EXECUTE FUNCTION validate_avatar_equipment_slots();
