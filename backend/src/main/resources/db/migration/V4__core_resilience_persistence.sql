CREATE TABLE core_round_snapshots (
    round_id UUID PRIMARY KEY REFERENCES game_rounds(id) ON DELETE CASCADE,
    snapshot_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE core_round_events (
    round_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
    sequence BIGINT NOT NULL CHECK (sequence > 0),
    event_id VARCHAR(80) NOT NULL UNIQUE,
    event_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    PRIMARY KEY (round_id, sequence)
);
CREATE INDEX core_round_events_expiry_idx ON core_round_events(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE core_round_checkpoints (
    round_id UUID PRIMARY KEY REFERENCES game_rounds(id) ON DELETE CASCADE,
    checkpoint_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);
CREATE INDEX core_round_checkpoints_expiry_idx ON core_round_checkpoints(expires_at) WHERE expires_at IS NOT NULL;
