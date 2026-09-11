-- Keep previously applied migrations intact. Name the selected option explicitly:
-- tier 1..4 is separate from its configurable effective multiplier.
ALTER TABLE game_rounds RENAME COLUMN booster_multiplier TO booster_tier;
ALTER TABLE game_rounds ADD CONSTRAINT round_started_state CHECK (
    (status='CREATED' AND started_at IS NULL) OR (status<>'CREATED' AND started_at IS NOT NULL)
);
ALTER TABLE game_rounds ADD CONSTRAINT round_timestamps CHECK (
    (started_at IS NULL OR started_at>=created_at)
    AND (cashout_at IS NULL OR (started_at IS NOT NULL AND cashout_at>=started_at))
    AND (crashed_at IS NULL OR (started_at IS NOT NULL AND crashed_at>=started_at))
    AND (cashout_at IS NULL OR crashed_at IS NULL OR cashout_at<=crashed_at)
    AND (finished_at IS NULL OR finished_at>=crashed_at)
);
ALTER TABLE game_rounds ADD CONSTRAINT round_cashout_state CHECK (status<>'CASHED_OUT' OR cashout_at IS NOT NULL);
ALTER TABLE game_rounds ADD CONSTRAINT round_crashed_state CHECK (status<>'CRASHED' OR crashed_at IS NOT NULL);
ALTER TABLE score_events ADD CONSTRAINT score_event_key CHECK (
    (type='LEVEL' AND event_key BETWEEN 1 AND 12)
    OR (type='BOOSTER' AND event_key BETWEEN 2 AND 4)
    OR (type='CASHOUT' AND event_key=0)
);
