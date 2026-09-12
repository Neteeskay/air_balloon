# Tournament и live leaderboard

Tournament встроен в финальный Core как пакет `ru.hackathon.airballoon.tournament`. Он использует общий Spring Boot process, PostgreSQL, Flyway, HTTP session и UUID `Principal`.

## Score source

`participants.score` — projection полного canonical `users.game_score`, а не отдельный ledger. Tournament не вычисляет level, booster или cashout points. Это не глобальный рейтинг: в `participants` находятся только явно присоединившиеся пользователи.

```text
Core GameEngine
→ PostgresRoundEventStore
→ PostgresScoreService
→ score_events + users.game_score + game_score_version
→ ScoreChanged(PlayerScore)
→ TournamentService
→ tournament.participants
→ AFTER_COMMIT STOMP
```

`CorePlayerScoreSource.find(UUID)` используется при явном join. Score event и projection выполняются в одной PostgreSQL-транзакции. Повторный `(round_id,type,event_key)` возвращает прежний результат; Tournament UPSERT принимает только большую `score_version`. Score event обновляет существующую membership-запись и не создаёт участника автоматически.

## Lifecycle и leaderboard

- `PLANNED`: `now < startsAt`;
- `ACTIVE`: `startsAt <= now < endsAt`;
- `FINISHED`: `now >= endsAt`.

Status и `secondsRemaining` вычисляются по server `Clock`. Ranking deterministic: `score DESC`, затем более ранний `updated_at`, затем UUID. REST возвращает независимые `top3`, page `participants`, `currentPlayer`, total и revision. Другие usernames маскируются; current player получает своё полное имя.

## Identity

`POST /api/auth/demo-login` создаёт server HTTP session. Core восстанавливает UUID `Principal`, а Tournament использует только его. `X-User-Id`, username, query/body player id не являются trusted identity.

## HTTP

| Method | Path | Назначение |
|---|---|---|
| GET | `/api/tournaments/active` | Текущий active tournament |
| GET | `/api/tournaments/{id}/leaderboard?page=0&size=50` | Top-3, page и session-specific currentPlayer |
| POST | `/api/tournaments/{id}/participants/me` | Join canonical session user |

Глобальный рейтинг — отдельный контракт `GET /api/rating?page=0&size=50`; он читает всех пользователей из `users`, включая score `0`. Подробнее: [global-rating-contract.md](global-rating-contract.md).

## WebSocket и reconnect

STOMP endpoint: `/ws`.

Topic: `/topic/tournaments/{tournamentId}/leaderboard`.

`LEADERBOARD_UPDATE` содержит `tournamentId`, `revision`, `topPlayers`, `changedPlayer`, total и `updatedAt`, но не usernames или viewer-specific data. Client SEND запрещён.

Reconnect protocol:

1. подписаться;
2. получить REST snapshot;
3. отбросить frames с `revision <= snapshot.revision`;
4. при gap повторить GET.

## Database

`V300__tournaments.sql` создаёт `tournament.tournaments`, `tournament.participants` и lifecycle/ranking indexes. `V301__tournament_core_score_bridge.sql` добавляет canonical `users.game_score_version` и score ranking index.

## Demo и tests

Профиль `demo` создаёт 24 canonical Core users. Первые три доступны через demo-login; demo initializer явно добавляет все 24 профиля в дневной Tournament. Это fixture, а не автоматическое участие по score event. Глобальный рейтинг видит все 24 пользователя независимо от Tournament membership.

Финальный strict-run: 294 Surefire + 74 Failsafe = 368 PASS, 0 skipped. Подробности: [backend-tournament-integration.md](backend-tournament-integration.md) и [acceptance-tests.md](acceptance-tests.md).
