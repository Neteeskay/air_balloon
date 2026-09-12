# Scenario 8 — «Закрепи успех»

## Product contract

Offer is created only for a server-confirmed, completed WIN and is never created for a
LOSS. The offer is bound to the authenticated user and winning round, expires after ten
minutes, and is consumed at most once. Close, Escape, backdrop and “Нет, спасибо” are a
DECLINED outcome with no economy mutation. The frontend records SHOWN/ACCEPTED/DECLINED
in `sessionStorage`, so one browser session can show at most one popup. Reload preserves
that suppression; a new browser session may show a new offer after a later eligible WIN.

## Admin-facing config (future UI)

| Key | Type / range | Default | Effect | Hot reload | Existing offer |
| --- | --- | ---: | --- | --- | --- |
| `scenario8Enabled` | boolean | `true` | Enables offer creation | Yes | Unchanged |
| `scenario8MinWinAmount` | integer, 0..1,000,000 | `0` | Minimum WIN payout | Yes | Unchanged |
| `scenario8Price` | integer, 1..1,000,000,000 | `150` | Bonus debit | Yes | Snapshot retained |
| `scenario8TicketCount` | integer, 1..1,000,000 | `3` | Tickets credited | Yes | Snapshot retained |

Config changes apply to newly created offers only. Existing offers retain their price,
ticket count and eligibility decision. No admin UI is included in this release.

## Persistence and security

`users.lottery_ticket_count` and `scenario8_offers` are persisted by migration V305.
Purchase uses the existing PostgreSQL economy ledger, locks the offer and user rows, and
updates bonus balance, ticket count and ledger in one transaction. The client cannot supply
price, ticket count or WIN amount. An `Idempotency-Key` is required: a retry with the same
key returns the original response, while another key cannot consume an already consumed
offer. Round ownership is checked before offer creation and purchase.
