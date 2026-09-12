# Frontend REAL binding contract

Этот документ — точка передачи backend → `fix/frontend-hardening`. Все HTTP calls
из браузера выполняются с `credentials: "include"`. Единственная пользовательская
identity — UUID Principal из server-side HTTP session. Не отправляйте `X-User-Id`
и не храните выбранный user id как источник авторизации.

## Binding table

| Feature | Endpoint | Method | Auth | Request | Response | Errors |
| --- | --- | --- | --- | --- | --- | --- |
| Login | `/api/auth/demo-login` | POST | No | JSON `{username,password}` | `UserState`; устанавливает session cookie | `400 INVALID_REQUEST`, `401 AUTH_REQUIRED` |
| Logout | `/api/auth/session` | DELETE | Session optional | Empty | `204` | — |
| Current user | `/api/auth/me` or `/api/current-user/state` | GET | Required | Empty | `UserState` | `401 AUTH_REQUIRED`, `404 USER_NOT_FOUND` |
| Balance | `/api/current-user/balance` | GET | Required | Empty | `{bonusBalance,serverTime}` | `401 AUTH_REQUIRED` |
| Catalog | `/api/game/catalog` | GET | No | Empty | `Catalog` described below | `503 INVALID_GAME_CONFIG/INTEGRATION_UNAVAILABLE` |
| Start round | `/api/rounds` | POST | Required | `{theme,betAmount,boosterMultiplier}` | `201 RoundView` | `400` validation, `401 AUTH_REQUIRED`, `409 INSUFFICIENT_BALANCE`, `503` integration |
| Cashout | `/api/rounds/{roundId}/cashout` | POST | Required/owner | Empty; optional `Idempotency-Key: UUID` | `RoundView` | `401`, `403 FORBIDDEN_ROUND_ACCESS`, `404`, `409` game state, `503` integration |
| Snapshot | `/api/rounds/{roundId}` | GET | Required/owner | Empty | `RoundView` | `401`, `403`, `404`, `503` |
| Replay | `/api/rounds/{roundId}/events?afterSequence=N` | GET | Required/owner | `N >= 0` | `ReplayView` | `400`, `401`, `403`, `404`, `503` |
| Result | `/api/rounds/{roundId}/result` | GET | Required/owner | Empty | `Result` | `401`, `403 NOT_OWNER`, `404`, `409 ROUND_NOT_FINISHED/REWARD_NOT_READY` |
| Scenario 8 offer | `/api/current-user/upsell/lottery-tickets/offer?roundId={roundId}` | GET | Required/owner | Empty | `OfferView` or `204` when no offer | `401`, `403`, `404` |
| Scenario 8 purchase | `/api/current-user/upsell/lottery-tickets/purchase` | POST | Required/owner | `{offerId}` and `Idempotency-Key` | `PurchaseResult` | `400`, `401`, `403`, `404`, `409` |
| Personal history | `/api/current-user/history?page=0&size=20` | GET | Required | `page >= 0`, `size 1..100` | `PersonalPage` | `400 INVALID_PAGINATION`, `401 AUTH_REQUIRED` |
| Global history | `/api/history?page=0&size=20` | GET | No | `page >= 0`, `size 1..100` | Existing global `Page` | `400 INVALID_PAGINATION` |
| Fairness | `/api/rounds/{roundId}/fairness` | GET | Required/owner | Empty | `FairnessView` | `401`, `403`, `404` |
| Game WebSocket | `/ws/rounds` | native WS | Required session | Server-only; client sends nothing | `CONNECTION_READY`, then owner-only `RoundEventView` | Handshake `401`; client message closes `1008` |
| Active tournament | `/api/tournaments/active` | GET | No | Empty | `{active,tournament?}` | — |
| Tournament leaderboard | `/api/tournaments/{id}/leaderboard?page=0&size=50` | GET | Optional; required for `currentPlayer` | Pagination | `LeaderboardResponse` | `400`, `404 TOURNAMENT_NOT_FOUND` |
| Join tournament | `/api/tournaments/{id}/participants/me` | POST | Required | Empty; never send user id | `204` | `401 AUTH_REQUIRED`, `404`, `409` tournament state |
| Tournament WebSocket | `/ws`, topic `/topic/tournaments/{id}/leaderboard` | STOMP SUBSCRIBE | Same session; public payload | SUBSCRIBE only | `LEADERBOARD_UPDATE` invalidation/snapshot frame | SEND/other topic rejected |

## DTO shapes

`UserState`: `userId,username,displayName,bonusBalance,gameScore,lotteryTicketCount,createdAt,updatedAt`.

`OfferView`: `offerId,roundId,price,ticketCount,minWinAmount,expiresAt,status`.
`PurchaseResult`: `offerId,roundId,price,ticketCount,bonusBalance,lotteryTicketCount,replayed`.

`Catalog`: `configVersion,gameId,gameName,active,themes,stakes,boosters,serverTime`.
`themes[]`: `theme,levels,active`; current values are GREEN/9 and RED/12.
`stakes`: `minimum,maximum,decimalPlaces`; this is the complete accepted range.
`boosters[]`: `multiplier,extraCost,active`; current multipliers are 1,2,3,4 and
`extraCost=0`. Never hardcode these values in frontend.

`RoundView`: stable fields are `id/roundId,theme,betAmount,boosterMultiplier,
boosterLevel?,boosterActivated,currentMultiplier,currentLevel,totalLevels,
levelThresholds,cashoutAvailable,cashoutPreviewAmount?,cashoutMultiplier?,winAmount,roundScore,status,
outcome?,crashMultiplier?,startedAt,cashoutAt?,crashedAt?,finishedAt?,timestamp,
sequence,serverTime,cashoutPerformed,fairnessCommitment,fairnessReveal?`.

`Result`: `roundId,result,betAmount,cashoutMultiplier?,crashMultiplier,winAmount,
score,configVersion,playerCharacter,reward,completedAt,serverTime`. `playerCharacter` is
the backend-selected `{code,title,description}` for this completed round.

`PersonalPage`: `items,page,size,total,serverTime`. `items[]`: `roundId,theme,
betAmount,boosterMultiplier,cashoutMultiplier?,crashMultiplier,winAmount,score,
result,reward?,completedAt`. Personal items deliberately contain no user selector.

`FairnessView` is COMMITTED before crash and REVEALED after crash. Do not expect
`serverSeed`, `crashMultiplier` or canonical proof before reveal. For x2/x3/x4
`boosterLevel` is intentionally available from the start snapshot; x1 has no
position. This does not change fairness reveal or crash secrecy.

`cashoutPreviewAmount` is the authoritative amount payable if cashout were
accepted at the represented RUNNING server state. Bind it directly from start or
snapshot and from each live `MULTIPLIER_UPDATE`, `LEVEL_REACHED` and
`BOOSTER_ACTIVATED`; never derive it in React. Before Level 1 the CTA remains
disabled even though a preview may be present. During disconnect retain the last
confirmed value without extrapolation, then replace it from snapshot/replay.
After cashout use `winAmount`. It may be slightly greater than the last displayed
preview because settlement advances the round at server receipt time.

## Auth and ownership behavior

- Missing, unknown, expired or malformed session → `401 AUTH_REQUIRED`.
- Authenticated non-owner of state/result/round → `403 NOT_OWNER` or
  `403 FORBIDDEN_ROUND_ACCESS`.
- `/api/users/{id}/state` exists only for compatibility: `{id}` must equal the
  logged-in Principal. New frontend code uses `/api/current-user/state`.
- Result, snapshot, fairness, replay and cashout are owner-only. Global history is
  intentionally public and separate from personal history.
- On any `401`, clear local authenticated UI state and return to login. Do not do
  this for `403`, `409` or `503`.

## Score binding

For a completed round:

```text
RoundView.roundScore
= Result.score
= PersonalHistoryItem.score
= SUM(score_events.points for round)
```

The total includes reached level points, activated booster tier bonus and cashout
bonus when applicable. `UserState.gameScore` is cumulative across rounds.
Tournament `currentPlayer.score` projects that cumulative value without computing
game components again.

## Reconnect order

Game: connect `/ws/rounds` → wait for `CONNECTION_READY` → GET snapshot → discard
events with `sequence <= snapshot.sequence` → replay gaps when needed.

Tournament: STOMP subscribe → GET leaderboard snapshot → discard frames with
`revision <= snapshot.revision`; on a revision gap, GET the snapshot again.
