-- Admin panel: authentication, versioned game configuration, audit log.
-- The live engine keeps reading game_config_versions/game_config_active;
-- activating an admin DRAFT publishes a new live configuration version.

CREATE TABLE admin_app (
    id VARCHAR(100) PRIMARY KEY,
    configuration_sequence BIGINT NOT NULL DEFAULT 0 CHECK (configuration_sequence >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    lock_version BIGINT NOT NULL DEFAULT 0 CHECK (lock_version >= 0)
);

CREATE TABLE admin_user (
    id UUID PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_admin_user_username UNIQUE (username),
    CONSTRAINT ck_admin_user_role CHECK (role IN ('ADMIN'))
);

CREATE TABLE admin_session (
    id UUID PRIMARY KEY,
    admin_user_id UUID NOT NULL REFERENCES admin_user(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT uq_admin_session_token_hash UNIQUE (token_hash),
    CONSTRAINT ck_admin_session_expiry CHECK (expires_at > created_at)
);
CREATE INDEX idx_admin_session_admin_user ON admin_session(admin_user_id);
CREATE INDEX idx_admin_session_expiry ON admin_session(expires_at);

CREATE TABLE admin_config (
    id UUID PRIMARY KEY,
    app_id VARCHAR(100) NOT NULL DEFAULT 'air-balloon',
    revision BIGINT NOT NULL,
    base_revision BIGINT,
    source_version_id UUID,
    status VARCHAR(16) NOT NULL,
    game_name VARCHAR(200) NOT NULL,
    game_type VARCHAR(32) NOT NULL,
    game_active BOOLEAN NOT NULL,
    crash_alpha DOUBLE PRECISION NOT NULL,
    crash_max_multiplier DOUBLE PRECISION NOT NULL,
    crash_min_crash_multiplier DOUBLE PRECISION NOT NULL,
    crash_multiplier_growth_rate DOUBLE PRECISION NOT NULL,
    crash_fps DOUBLE PRECISION NOT NULL,
    crash_delta DOUBLE PRECISION NOT NULL,
    booster_tier1_value DOUBLE PRECISION NOT NULL,
    booster_tier2_value DOUBLE PRECISION NOT NULL,
    booster_tier3_value DOUBLE PRECISION NOT NULL,
    booster_tier4_value DOUBLE PRECISION NOT NULL,
    points_per_line BIGINT NOT NULL,
    points_cashout_bonus BIGINT NOT NULL,
    points_xn_bonus BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by VARCHAR(100) NOT NULL,
    activated_at TIMESTAMPTZ,
    activated_by VARCHAR(100),
    CONSTRAINT fk_admin_config_source FOREIGN KEY (source_version_id) REFERENCES admin_config(id),
    CONSTRAINT uq_admin_config_revision UNIQUE (app_id, revision),
    CONSTRAINT ck_admin_config_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    CONSTRAINT ck_admin_config_game_type CHECK (game_type = 'CRASH'),
    CONSTRAINT ck_admin_config_crash_positive CHECK (crash_alpha >= 0 AND crash_max_multiplier > 0
        AND crash_min_crash_multiplier > 0 AND crash_multiplier_growth_rate > 0
        AND crash_fps > 0 AND crash_delta > 0),
    CONSTRAINT ck_admin_config_crash_bounds CHECK (crash_max_multiplier > crash_min_crash_multiplier),
    CONSTRAINT ck_admin_config_boosters CHECK (booster_tier1_value > 0 AND booster_tier2_value > 0
        AND booster_tier3_value > 0 AND booster_tier4_value > 0),
    CONSTRAINT ck_admin_config_booster_order CHECK (booster_tier1_value <= booster_tier2_value
        AND booster_tier2_value <= booster_tier3_value AND booster_tier3_value <= booster_tier4_value),
    CONSTRAINT ck_admin_config_points_nonnegative CHECK (points_per_line >= 0
        AND points_cashout_bonus >= 0 AND points_xn_bonus >= 0)
);
CREATE UNIQUE INDEX uq_admin_config_one_active ON admin_config(app_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_admin_config_app_status ON admin_config(app_id, status);
CREATE INDEX idx_admin_config_created_at ON admin_config(created_at DESC);

CREATE TABLE admin_booster_probability (
    id BIGSERIAL PRIMARY KEY,
    config_id UUID NOT NULL REFERENCES admin_config(id) ON DELETE CASCADE,
    theme VARCHAR(16) NOT NULL,
    level_number INTEGER NOT NULL,
    probability DOUBLE PRECISION NOT NULL,
    CONSTRAINT uq_probability_config_theme_level UNIQUE (config_id, theme, level_number),
    CONSTRAINT ck_probability_theme CHECK (theme IN ('GREEN', 'RED')),
    CONSTRAINT ck_probability_level CHECK ((theme = 'GREEN' AND level_number BETWEEN 1 AND 9)
        OR (theme = 'RED' AND level_number BETWEEN 1 AND 12)),
    CONSTRAINT ck_probability_range CHECK (probability BETWEEN 0 AND 100)
);
CREATE INDEX idx_probability_config ON admin_booster_probability(config_id);

CREATE TABLE admin_audit (
    id UUID PRIMARY KEY,
    event_timestamp TIMESTAMPTZ NOT NULL,
    administrator VARCHAR(100) NOT NULL,
    action VARCHAR(64) NOT NULL,
    affected_entity VARCHAR(100),
    app_id VARCHAR(100),
    config_id UUID,
    trace_id VARCHAR(100),
    metadata TEXT,
    CONSTRAINT ck_admin_audit_action CHECK (action IN (
        'CONFIG_CREATED', 'CONFIG_VALIDATED', 'CONFIG_ACTIVATED', 'CONFIG_ROLLBACK',
        'ADMIN_LOGIN', 'ADMIN_LOGOUT'))
);
CREATE INDEX idx_audit_timestamp ON admin_audit(event_timestamp DESC, id DESC);
CREATE INDEX idx_audit_action ON admin_audit(action);
CREATE INDEX idx_audit_admin ON admin_audit(administrator);
CREATE INDEX idx_audit_config_version ON admin_audit(config_id);