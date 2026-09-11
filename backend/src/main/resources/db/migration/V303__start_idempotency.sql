CREATE TABLE round_start_requests (
    user_id UUID NOT NULL REFERENCES users(id),
    start_key UUID NOT NULL,
    round_id UUID NOT NULL UNIQUE REFERENCES game_rounds(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, start_key)
);
