-- Monotonic per-user cursor for idempotent Tournament projection.
ALTER TABLE users
    ADD COLUMN game_score_version BIGINT NOT NULL DEFAULT 0
    CHECK (game_score_version >= 0);

CREATE INDEX users_game_score_ranking_idx
    ON users (game_score DESC, updated_at ASC, id ASC);
