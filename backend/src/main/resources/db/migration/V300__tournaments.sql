CREATE SCHEMA IF NOT EXISTS tournament;

CREATE TABLE tournament.tournaments (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL CHECK (length(trim(name)) > 0),
    description VARCHAR(2000) NOT NULL DEFAULT '',
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0),
    CHECK (ends_at > starts_at)
);
CREATE INDEX tournaments_dates_idx ON tournament.tournaments (starts_at, ends_at);

-- A projection of Backend #2's authoritative score, never a second score ledger.
-- No FK to a guessed user table: Backend #2 has not supplied its user schema yet.
CREATE TABLE tournament.participants (
    tournament_id UUID NOT NULL REFERENCES tournament.tournaments(id),
    user_id UUID NOT NULL,
    username VARCHAR(120) NOT NULL,
    score BIGINT NOT NULL CHECK (score >= 0),
    score_version BIGINT NOT NULL CHECK (score_version >= 0),
    joined_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (tournament_id, user_id)
);
CREATE INDEX participants_ranking_idx ON tournament.participants
    (tournament_id, score DESC, updated_at ASC, user_id ASC);
