CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(40) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    bonus_balance BIGINT NOT NULL DEFAULT 0 CHECK (bonus_balance >= 0),
    game_score BIGINT NOT NULL DEFAULT 0 CHECK (game_score >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE game_config_versions (
    version BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    config_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE game_config_active (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version BIGINT NOT NULL REFERENCES game_config_versions(version)
);
CREATE TABLE game_rounds (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    theme VARCHAR(5) NOT NULL CHECK (theme IN ('RED', 'GREEN')),
    bet_amount BIGINT NOT NULL CHECK (bet_amount > 0),
    booster_multiplier INTEGER NOT NULL CHECK (booster_multiplier IN (1,2,3,4)),
    booster_level INTEGER,
    booster_activated BOOLEAN NOT NULL DEFAULT false,
    crash_multiplier NUMERIC(20,8) NOT NULL CHECK (crash_multiplier > 0),
    cashout_multiplier NUMERIC(20,8) CHECK (cashout_multiplier > 0),
    win_amount BIGINT NOT NULL DEFAULT 0 CHECK (win_amount >= 0),
    status VARCHAR(20) NOT NULL CHECK (status IN ('CREATED','RUNNING','CASHED_OUT','CRASHED','FINISHED')),
    seed VARCHAR(256),
    fairness_hash VARCHAR(256),
    config_version BIGINT NOT NULL REFERENCES game_config_versions(version),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    cashout_at TIMESTAMPTZ,
    crashed_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    UNIQUE (id, user_id),
    CHECK (booster_level IS NULL OR booster_level BETWEEN 1 AND CASE WHEN theme = 'GREEN' THEN 9 ELSE 12 END),
    CHECK ((booster_multiplier = 1 AND booster_level IS NULL AND NOT booster_activated)
        OR (booster_multiplier > 1 AND booster_level IS NOT NULL)),
    CHECK ((cashout_at IS NULL AND cashout_multiplier IS NULL AND win_amount = 0)
        OR (cashout_at IS NOT NULL AND cashout_multiplier IS NOT NULL)),
    CHECK ((status = 'FINISHED') = (finished_at IS NOT NULL)),
    CHECK (finished_at IS NULL OR crashed_at IS NOT NULL)
);
CREATE INDEX game_rounds_completed_idx ON game_rounds(finished_at DESC, id) WHERE finished_at IS NOT NULL;
CREATE INDEX game_rounds_user_completed_idx ON game_rounds(user_id, finished_at DESC);
CREATE TABLE economy_transactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    round_id UUID NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('BET_DEBIT','WIN_CREDIT')),
    amount BIGINT NOT NULL CHECK (amount >= 0),
    balance_before BIGINT NOT NULL CHECK (balance_before >= 0),
    balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (round_id, type),
    FOREIGN KEY (round_id,user_id) REFERENCES game_rounds(id,user_id),
    CHECK ((type = 'BET_DEBIT' AND amount > 0 AND balance_after = balance_before - amount)
        OR (type = 'WIN_CREDIT' AND balance_after = balance_before + amount))
);
CREATE TABLE score_events (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    round_id UUID NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('LEVEL','BOOSTER','CASHOUT')),
    event_key INTEGER NOT NULL CHECK (event_key >= 0),
    points BIGINT NOT NULL CHECK (points >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (round_id,type,event_key),
    FOREIGN KEY (round_id,user_id) REFERENCES game_rounds(id,user_id)
);
CREATE TABLE round_rewards (
    id UUID PRIMARY KEY,
    round_id UUID NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(20) NOT NULL CHECK (type IN ('CLOUD','FEATHER','STAR','MOON','MOUNTAIN')),
    rarity VARCHAR(20) NOT NULL CHECK (rarity IN ('COMMON','RARE','EPIC','LEGENDARY')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (round_id,user_id) REFERENCES game_rounds(id,user_id)
);
