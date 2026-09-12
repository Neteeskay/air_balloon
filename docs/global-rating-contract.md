# Global Rating contract

## Scope and ownership

Global Rating is the common ranking of all registered Core users. Its single source of truth is `users.game_score`; the rating module does not keep a second score, participant table, or score ledger. Monotonic per-user `users.game_score_version` values are aggregated only as the response snapshot watermark (`revision`).

Tournament is a different bounded context. `tournament.participants` contains only users who explicitly joined that tournament and is a projection of the same canonical score. A score event can update an existing participant, but cannot create tournament membership.

## HTTP

`GET /api/rating?page=0&size=50`

The endpoint requires the authenticated server session. Identity is taken from the session `Principal`, never from a query parameter, body, or client-supplied user id. `size` is 1..100 and `page` is zero-based.

```json
{
  "entries": [{"rank": 1, "displayName": "Анна Ветрова", "score": 5000, "currentPlayer": false}],
  "currentPlayer": {"rank": 4, "displayName": "Текущий игрок", "score": 1000, "currentPlayer": true},
  "totalParticipants": 5,
  "page": 0,
  "size": 50,
  "revision": 7
}
```

`entries` is the requested page. `currentPlayer` is always returned, even when the current user is outside the requested top page. `revision` is the sum of canonical per-user `game_score_version` values observed in the same repeatable-read snapshot, so every accepted score update changes it; it is a watermark, not a new global score store.

Ranking is deterministic: `game_score DESC`, then `updated_at ASC`, then UUID `id ASC`. All rows in `users` are included, including score `0`; there is no minimum-score filter. Only display name, score, rank, and current-player marker are exposed. Internal UUID, email, bonus balance, and session data are not exposed.

## Tournament separation

Tournament remains participant-only: `GET /api/tournaments/{id}/leaderboard?page=0&size=50` reads `tournament.participants`, returns tournament `top3`/page/current participant, and keeps its existing explicit `POST /api/tournaments/{id}/participants/me` join seam. The two endpoints must not be substituted for one another in frontend code.

## Frontend binding

The real adapter exposes `api.rating.get(page, size)` for `/api/rating`. `api.tournament.getLeaderboard` remains the only source for Tournament UI. A frontend must not derive either ranking from wallet/history or merge the two response shapes.
