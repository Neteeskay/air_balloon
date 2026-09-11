CREATE TABLE game (
    id                     varchar(100) PRIMARY KEY,
    configuration_sequence bigint       NOT NULL DEFAULT 0 CHECK (configuration_sequence >= 0),
    created_at             timestamptz  NOT NULL,
    lock_version           bigint       NOT NULL DEFAULT 0 CHECK (lock_version >= 0)
);

CREATE TABLE admin_user (
    id            uuid         PRIMARY KEY,
    username      varchar(100) NOT NULL,
    password_hash varchar(255) NOT NULL,
    role          varchar(32)  NOT NULL,
    enabled       boolean      NOT NULL DEFAULT true,
    created_at    timestamptz  NOT NULL,
    CONSTRAINT uq_admin_user_username UNIQUE (username),
    CONSTRAINT ck_admin_user_role CHECK (role IN ('ADMIN'))
);

CREATE TABLE admin_session (
    id            uuid        PRIMARY KEY,
    admin_user_id uuid        NOT NULL,
    token_hash    varchar(64) NOT NULL,
    created_at    timestamptz NOT NULL,
    expires_at    timestamptz NOT NULL,
    revoked_at    timestamptz,
    CONSTRAINT uq_admin_session_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_admin_session_user FOREIGN KEY (admin_user_id) REFERENCES admin_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_admin_session_expiry CHECK (expires_at > created_at)
);
CREATE INDEX idx_admin_session_admin_user ON admin_session(admin_user_id);
CREATE INDEX idx_admin_session_expiry ON admin_session(expires_at);

CREATE TABLE game_configuration_version (
    id                         uuid         PRIMARY KEY,
    game_id                    varchar(100) NOT NULL,
    revision                   bigint       NOT NULL CHECK (revision > 0),
    base_revision              bigint,
    source_version_id          uuid,
    status                     varchar(16)  NOT NULL,
    game_name                  varchar(200) NOT NULL,
    game_type                  varchar(32)  NOT NULL,
    game_active                boolean      NOT NULL,
    alpha                      double precision NOT NULL,
    max_multiplier             double precision NOT NULL,
    min_crash_multiplier       double precision NOT NULL,
    multiplier_growth_rate     double precision NOT NULL,
    fps                        double precision NOT NULL,
    delta                      double precision NOT NULL,
    multiplier_tier_1_value    double precision NOT NULL,
    multiplier_tier_2_value    double precision NOT NULL,
    multiplier_tier_3_value    double precision NOT NULL,
    multiplier_tier_4_value    double precision NOT NULL,
    points_per_line            integer      NOT NULL,
    points_cashout_bonus       integer      NOT NULL,
    points_xn_bonus            integer      NOT NULL,
    created_at                 timestamptz  NOT NULL,
    created_by                 varchar(100) NOT NULL,
    activated_at               timestamptz,
    activated_by               varchar(100),
    CONSTRAINT fk_config_game FOREIGN KEY (game_id) REFERENCES game(id) ON DELETE RESTRICT,
    CONSTRAINT fk_config_source FOREIGN KEY (source_version_id) REFERENCES game_configuration_version(id) ON DELETE RESTRICT,
    CONSTRAINT uq_game_config_revision UNIQUE (game_id, revision),
    CONSTRAINT ck_config_status CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
    CONSTRAINT ck_config_game_type CHECK (game_type = 'CRASH'),
    CONSTRAINT ck_config_crash_positive CHECK (
        alpha > 0 AND max_multiplier > 0 AND min_crash_multiplier > 0
        AND multiplier_growth_rate > 0 AND fps > 0 AND delta > 0
    ),
    CONSTRAINT ck_config_crash_bounds CHECK (max_multiplier > min_crash_multiplier),
    CONSTRAINT ck_config_booster_positive CHECK (
        multiplier_tier_1_value > 0 AND multiplier_tier_2_value > 0
        AND multiplier_tier_3_value > 0 AND multiplier_tier_4_value > 0
    ),
    CONSTRAINT ck_config_booster_order CHECK (
        multiplier_tier_2_value >= multiplier_tier_1_value
        AND multiplier_tier_3_value >= multiplier_tier_2_value
        AND multiplier_tier_4_value >= multiplier_tier_3_value
    ),
    CONSTRAINT ck_config_points_nonnegative CHECK (
        points_per_line >= 0 AND points_cashout_bonus >= 0 AND points_xn_bonus >= 0
    )
);
CREATE UNIQUE INDEX uq_game_one_active_config
    ON game_configuration_version(game_id)
    WHERE status = 'ACTIVE';
CREATE INDEX idx_config_game_status ON game_configuration_version(game_id, status);
CREATE INDEX idx_config_created_at ON game_configuration_version(created_at DESC);

CREATE TABLE booster_level_probability (
    id                       bigserial PRIMARY KEY,
    configuration_version_id uuid             NOT NULL,
    theme                    varchar(16)      NOT NULL,
    level_number             integer          NOT NULL,
    probability              double precision NOT NULL,
    CONSTRAINT fk_probability_config FOREIGN KEY (configuration_version_id)
        REFERENCES game_configuration_version(id) ON DELETE CASCADE,
    CONSTRAINT uq_probability_config_theme_level UNIQUE (configuration_version_id, theme, level_number),
    CONSTRAINT ck_probability_theme CHECK (theme IN ('GREEN','RED')),
    CONSTRAINT ck_probability_level CHECK (
        (theme = 'GREEN' AND level_number BETWEEN 1 AND 9)
        OR (theme = 'RED' AND level_number BETWEEN 1 AND 12)
    ),
    CONSTRAINT ck_probability_range CHECK (probability >= 0 AND probability <= 100)
);
CREATE INDEX idx_probability_config ON booster_level_probability(configuration_version_id);

CREATE TABLE audit_log (
    id                    uuid         PRIMARY KEY,
    event_timestamp       timestamptz  NOT NULL,
    administrator         varchar(100) NOT NULL,
    action                varchar(64)  NOT NULL,
    affected_entity       varchar(100) NOT NULL,
    game_id               varchar(100),
    configuration_version uuid,
    trace_id              varchar(100),
    metadata              text,
    CONSTRAINT ck_audit_action CHECK (action IN (
        'CONFIG_CREATED','CONFIG_VALIDATED','CONFIG_ACTIVATED','CONFIG_ROLLBACK','ADMIN_LOGIN','ADMIN_LOGOUT'
    )),
    CONSTRAINT fk_audit_game FOREIGN KEY (game_id) REFERENCES game(id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_config FOREIGN KEY (configuration_version)
        REFERENCES game_configuration_version(id) ON DELETE SET NULL
);
CREATE INDEX idx_audit_timestamp ON audit_log(event_timestamp DESC, id DESC);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_admin ON audit_log(administrator);
CREATE INDEX idx_audit_config_version ON audit_log(configuration_version);

CREATE TABLE player_user (
    id            uuid          PRIMARY KEY,
    username      varchar(100)  NOT NULL,
    bonus_balance numeric(19,2) NOT NULL CHECK (bonus_balance >= 0),
    game_points   bigint        NOT NULL DEFAULT 0 CHECK (game_points >= 0),
    created_at    timestamptz   NOT NULL,
    lock_version  bigint        NOT NULL DEFAULT 0 CHECK (lock_version >= 0),
    CONSTRAINT uq_player_username UNIQUE (username)
);

CREATE TABLE game_round (
    id                       uuid          PRIMARY KEY,
    player_id                uuid          NOT NULL,
    configuration_version_id uuid          NOT NULL,
    theme                    varchar(16)   NOT NULL,
    booster_tier             integer       NOT NULL,
    booster_level            integer,
    bet_amount               numeric(19,2) NOT NULL,
    crash_point              double precision NOT NULL,
    started_at               timestamptz   NOT NULL,
    last_crossed_level       integer       NOT NULL DEFAULT 0,
    points_awarded           integer       NOT NULL DEFAULT 0,
    booster_activated        boolean       NOT NULL DEFAULT false,
    cashout_multiplier       double precision,
    winnings                 numeric(19,2),
    status                   varchar(24)   NOT NULL,
    completed_at             timestamptz,
    lock_version             bigint        NOT NULL DEFAULT 0,
    CONSTRAINT fk_round_player FOREIGN KEY (player_id) REFERENCES player_user(id) ON DELETE RESTRICT,
    CONSTRAINT fk_round_config FOREIGN KEY (configuration_version_id)
        REFERENCES game_configuration_version(id) ON DELETE RESTRICT,
    CONSTRAINT ck_round_theme CHECK (theme IN ('GREEN','RED')),
    CONSTRAINT ck_round_booster_tier CHECK (booster_tier BETWEEN 1 AND 4),
    CONSTRAINT ck_round_booster_level CHECK (
        booster_level IS NULL
        OR (theme = 'GREEN' AND booster_level BETWEEN 1 AND 9)
        OR (theme = 'RED' AND booster_level BETWEEN 1 AND 12)
    ),
    CONSTRAINT ck_round_bet CHECK (bet_amount > 0),
    CONSTRAINT ck_round_crash_point CHECK (crash_point > 0),
    CONSTRAINT ck_round_level CHECK (last_crossed_level BETWEEN 0 AND 12),
    CONSTRAINT ck_round_points CHECK (points_awarded >= 0),
    CONSTRAINT ck_round_status CHECK (status IN ('RUNNING','CASHED_OUT','CRASHED','COMPLETED'))
);
CREATE INDEX idx_round_player_created ON game_round(player_id, started_at DESC);
CREATE INDEX idx_round_config ON game_round(configuration_version_id);
