CREATE TABLE outfit_reward_definitions (
    id UUID PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(120) NOT NULL CHECK (length(trim(title)) > 0),
    reward_amount BIGINT NOT NULL CHECK (reward_amount > 0),
    active BOOLEAN NOT NULL DEFAULT true,
    ordering INTEGER NOT NULL DEFAULT 0 CHECK (ordering >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE outfit_reward_requirements (
    outfit_reward_id UUID NOT NULL REFERENCES outfit_reward_definitions(id) ON DELETE CASCADE,
    slot VARCHAR(16) NOT NULL,
    clothing_id UUID NOT NULL,
    PRIMARY KEY (outfit_reward_id, slot),
    FOREIGN KEY (clothing_id, slot) REFERENCES clothing_items(id, slot)
);

INSERT INTO outfit_reward_definitions(id, code, title, reward_amount, active, ordering)
VALUES ('00000000-0000-0000-0000-000000000301', 'SKY_TRAVELER', 'Небесный путешественник', 500, true, 10);

INSERT INTO outfit_reward_requirements(outfit_reward_id, slot, clothing_id) VALUES
    ('00000000-0000-0000-0000-000000000301', 'HEAD', '00000000-0000-0000-0000-000000000102'),
    ('00000000-0000-0000-0000-000000000301', 'NECK', '00000000-0000-0000-0000-000000000104');

-- Normalized equipment is the matching source. The existing HEAD/NECK columns remain as the
-- backwards-compatible API/storage contract and are mirrored by the trigger below.
CREATE TABLE user_avatar_equipped_items (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slot VARCHAR(16) NOT NULL,
    clothing_id UUID NOT NULL,
    PRIMARY KEY (user_id, slot),
    FOREIGN KEY (user_id, clothing_id) REFERENCES user_clothing_items(user_id, clothing_id) ON DELETE CASCADE,
    FOREIGN KEY (clothing_id, slot) REFERENCES clothing_items(id, slot)
);

CREATE FUNCTION sync_normalized_avatar_equipment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.head_clothing_id IS NULL THEN
        DELETE FROM user_avatar_equipped_items WHERE user_id = NEW.user_id AND slot = 'HEAD';
    ELSE
        INSERT INTO user_avatar_equipped_items(user_id, slot, clothing_id)
        VALUES (NEW.user_id, 'HEAD', NEW.head_clothing_id)
        ON CONFLICT (user_id, slot) DO UPDATE SET clothing_id = EXCLUDED.clothing_id;
    END IF;

    IF NEW.neck_clothing_id IS NULL THEN
        DELETE FROM user_avatar_equipped_items WHERE user_id = NEW.user_id AND slot = 'NECK';
    ELSE
        INSERT INTO user_avatar_equipped_items(user_id, slot, clothing_id)
        VALUES (NEW.user_id, 'NECK', NEW.neck_clothing_id)
        ON CONFLICT (user_id, slot) DO UPDATE SET clothing_id = EXCLUDED.clothing_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER user_avatar_equipment_normalized
AFTER INSERT OR UPDATE OF head_clothing_id, neck_clothing_id ON user_avatar_equipment
FOR EACH ROW EXECUTE FUNCTION sync_normalized_avatar_equipment();

INSERT INTO user_avatar_equipped_items(user_id, slot, clothing_id)
SELECT user_id, 'HEAD', head_clothing_id FROM user_avatar_equipment WHERE head_clothing_id IS NOT NULL
UNION ALL
SELECT user_id, 'NECK', neck_clothing_id FROM user_avatar_equipment WHERE neck_clothing_id IS NOT NULL;

ALTER TABLE economy_transactions ALTER COLUMN round_id DROP NOT NULL;
ALTER TABLE economy_transactions ADD COLUMN outfit_reward_id UUID REFERENCES outfit_reward_definitions(id);
ALTER TABLE economy_transactions ADD CONSTRAINT economy_transactions_outfit_claim_key
    UNIQUE (id, user_id, outfit_reward_id);
ALTER TABLE economy_transactions DROP CONSTRAINT economy_transactions_type_check;
ALTER TABLE economy_transactions ADD CONSTRAINT economy_transactions_type_check
    CHECK (type IN ('BET_DEBIT','WIN_CREDIT','SCENARIO8_TICKET_PURCHASE','OUTFIT_REWARD'));
ALTER TABLE economy_transactions DROP CONSTRAINT economy_transactions_check;
ALTER TABLE economy_transactions ADD CONSTRAINT economy_transactions_check CHECK (
    (type = 'BET_DEBIT' AND round_id IS NOT NULL AND outfit_reward_id IS NULL
        AND amount > 0 AND balance_after = balance_before - amount)
    OR (type = 'WIN_CREDIT' AND round_id IS NOT NULL AND outfit_reward_id IS NULL
        AND balance_after = balance_before + amount)
    OR (type = 'SCENARIO8_TICKET_PURCHASE' AND round_id IS NOT NULL AND outfit_reward_id IS NULL
        AND balance_after = balance_before - amount)
    OR (type = 'OUTFIT_REWARD' AND round_id IS NULL AND outfit_reward_id IS NOT NULL
        AND amount > 0 AND balance_after = balance_before + amount)
);
CREATE UNIQUE INDEX economy_transactions_outfit_reward_idx
    ON economy_transactions(user_id, outfit_reward_id)
    WHERE type = 'OUTFIT_REWARD';

CREATE TABLE user_outfit_reward_claims (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outfit_reward_id UUID NOT NULL REFERENCES outfit_reward_definitions(id),
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ledger_entry_id UUID NOT NULL UNIQUE,
    UNIQUE (user_id, outfit_reward_id),
    FOREIGN KEY (ledger_entry_id, user_id, outfit_reward_id)
        REFERENCES economy_transactions(id, user_id, outfit_reward_id)
);
CREATE INDEX user_outfit_reward_claims_user_idx
    ON user_outfit_reward_claims(user_id, claimed_at DESC);
