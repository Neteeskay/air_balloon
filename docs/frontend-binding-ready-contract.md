# Frontend binding-ready contract

Backend branch `integration/backend-binding-ready` is the source of truth for the
next frontend integration. The mock frontend is intentionally unchanged.

## Authentication and ownership

Use the server-side session cookie from `POST /api/auth/demo-login` and send
`credentials: include` on every request. `GET /api/auth/me` (or
`/api/current-user/state`) restores the principal. Missing, expired or malformed
sessions return `401 {code: "AUTH_REQUIRED"}`. Round, result, replay, fairness,
personal history and profile resources are owner-scoped; a foreign resource is
`403 NOT_OWNER`.

## Catalog and stakes

`GET /api/game/catalog` is public and returns `stakeOptions` in deterministic
order, exactly four entries: amounts `10%`, `25%`, `50%` and `100%` of the
authoritative configured `maxBet`, paired with booster multipliers `1`, `2`, `3`
and `4`. The legacy `stakes` bounds and `boosters` arrays remain for compatibility.
The client must render these pairs and must not derive or reorder them.

`POST /api/rounds` accepts `{theme, betAmount, boosterMultiplier}`. The server
checks both balance and the paired catalog option; forged combinations (for
example option 1 with `boosterMultiplier: 4`) return `400 INVALID_BET`.

## Round, realtime and recovery

Start returns `201 RoundView`; `GET /api/rounds/{id}` is the authoritative
snapshot. Connect the native session WebSocket at `/ws/rounds`, then use
`GET /api/rounds/{id}/events?afterSequence=N` for gaps. Cashout is
`POST /api/rounds/{id}/cashout` with an optional UUID `Idempotency-Key`.

If local storage loses the id, call `GET /api/current-user/active-round`.
It returns the current `RoundView` or `204`; then reconnect WS and replay from
the snapshot sequence. Existing rounds retain their original config snapshot.

## Result, balance and history

`GET /api/rounds/{id}/result` returns the settled result, score, reward and
`balanceAfter` (the canonical post-settlement balance). Do not calculate payout,
score or balance in the client.

`GET /api/current-user/history` is owner-only. `GET /api/history` requires an
authenticated player and is privacy-safe: entries contain `roundId`, public
`displayName` and game outcome fields, never internal user UUIDs, email or
session data.

## Profile, puzzle, wardrobe and ranking

Use `/api/current-user/profile` for profile, puzzle progress and wardrobe;
equipment mutations remain owner-scoped. Global rating is `GET /api/rating` and
tournament data is `/api/tournaments/**` with the authenticated session for
participant operations. Scenario 8 uses the offer and purchase endpoints under
`/api/current-user/upsell/lottery-tickets` and remains server-authoritative.

## Admin truthfulness

Admin draft/activate publishes the supported crash, probability and points
fields into the live config used by new rounds. FPS, delta and booster tier
controls are read-only metadata (`mutable=false`) because the current runtime
uses fixed values; attempts to change them are rejected instead of silently
ignored. No new product features are included in this branch.

## Error handling

Use the returned `code` as the stable discriminator (`AUTH_REQUIRED`,
`NOT_OWNER`, `INVALID_BET`, `INSUFFICIENT_BALANCE`, `ROUND_NOT_FINISHED`,
`ROUND_NOT_FOUND`, `INTEGRATION_UNAVAILABLE`, and the existing admin/config
codes). A `401` clears local auth state; `403`, `409` and `503` do not.
