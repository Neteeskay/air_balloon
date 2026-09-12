ALTER TABLE users
    ADD COLUMN lottery_ticket_count BIGINT NOT NULL DEFAULT 0
        CHECK (lottery_ticket_count >= 0);

ALTER TABLE economy_transactions ALTER COLUMN type TYPE VARCHAR(32);
ALTER TABLE economy_transactions DROP CONSTRAINT economy_transactions_type_check;
ALTER TABLE economy_transactions ADD CONSTRAINT economy_transactions_type_check
    CHECK (type IN ('BET_DEBIT','WIN_CREDIT','SCENARIO8_TICKET_PURCHASE'));
ALTER TABLE economy_transactions DROP CONSTRAINT economy_transactions_check;
ALTER TABLE economy_transactions ADD CONSTRAINT economy_transactions_check CHECK (
    (type = 'BET_DEBIT' AND amount > 0 AND balance_after = balance_before - amount)
    OR (type IN ('WIN_CREDIT','SCENARIO8_TICKET_PURCHASE') AND balance_after = balance_before + CASE WHEN type='WIN_CREDIT' THEN amount ELSE -amount END)
);

CREATE TABLE scenario8_offers (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    round_id UUID NOT NULL,
    price BIGINT NOT NULL CHECK (price > 0),
    ticket_count INTEGER NOT NULL CHECK (ticket_count > 0),
    min_win_amount BIGINT NOT NULL CHECK (min_win_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    idempotency_key VARCHAR(128),
    transaction_id UUID,
    balance_before BIGINT,
    balance_after BIGINT,
    tickets_before BIGINT,
    tickets_after BIGINT,
    UNIQUE (round_id),
    FOREIGN KEY (round_id,user_id) REFERENCES game_rounds(id,user_id),
    CHECK ((consumed_at IS NULL AND idempotency_key IS NULL AND transaction_id IS NULL)
        OR (consumed_at IS NOT NULL AND idempotency_key IS NOT NULL AND transaction_id IS NOT NULL
            AND balance_before IS NOT NULL AND balance_after IS NOT NULL
            AND tickets_before IS NOT NULL AND tickets_after IS NOT NULL))
);
CREATE INDEX scenario8_offers_user_idx ON scenario8_offers(user_id, created_at DESC);
ALTER TABLE scenario8_offers ADD CONSTRAINT scenario8_offers_transaction_fk
    FOREIGN KEY (transaction_id) REFERENCES economy_transactions(id);

UPDATE game_config_versions
SET config_json = config_json || '{"scenario8Enabled":true,"scenario8MinWinAmount":0,"scenario8Price":150,"scenario8TicketCount":3}'::jsonb
WHERE NOT (config_json ? 'scenario8Enabled');
