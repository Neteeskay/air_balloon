# Backend Tournament integration

## Source и target

- Core: `integration/backend-core` @ `fd0846e92cc8c83330c07beba682dfec60c4542f`
- Tournament: `feature/backend-tournament` @ `a5d32bb2222f26d314cda03eefcdf9ee9bcf2306`
- Target: `integration/backend-tournament`

Tournament встроен в один Spring Boot backend. Отдельного Tournament container или второго пользовательского identity/score ledger нет.

## Identity

`POST /api/auth/demo-login` создаёт server HTTP session. `DemoSessionPrincipalFilter` восстанавливает UUID `Principal`. Game REST/native WS и Tournament REST используют этот UUID. Tournament не доверяет `X-User-Id`, username, query/body player id.

`currentPlayer` вычисляется только по UUID текущей session. Имена других игроков могут маскироваться; имя текущего игрока возвращается без маскирования. Public Tournament STOMP frames не содержат viewer-specific identity или usernames, поэтому после reconnect клиент выполняет персонализированный REST snapshot.

## Authoritative score flow

```text
GameService / RoundEngine
→ PostgresRoundEventStore (stable eventId = roundId:sequence)
→ PostgresScoreService
→ score_events + users.game_score + users.game_score_version
→ ScoreChanged(PlayerScore)
→ TournamentService
→ tournament.participants
→ AFTER_COMMIT LEADERBOARD_UPDATE
```

Tournament не вычисляет level, booster или cashout points. `CorePlayerScoreSource` читает canonical `users` snapshot для явного join.

## Atomicity и idempotency

`PostgresRoundEventStore.append`, score insert, user total/version и Tournament projection существующего участника выполняются одним datasource/transaction manager. Синхронный `ScoreChanged` listener присоединяется к этой транзакции; rollback удаляет все четыре изменения. Event не создаёт membership: новый участник появляется только через явный join. STOMP publish выполняется только `AFTER_COMMIT`.

Защита имеет два слоя:

- `core_round_events`: unique `(round_id, sequence)` и stable `event_id = roundId:sequence`;
- `score_events`: unique `(round_id, type, event_key)`, где `event_key` — level, booster multiplier или `0` для cashout.

Tournament UPSERT принимает только большую `score_version`. Повторная доставка старого события не меняет score, revision и не публикует frame. Это проверено 100 повторными доставками level и booster и повтором после cold restart.

## Database

Flyway `V300__tournaments.sql` создаёт `tournament.tournaments`, `tournament.participants`, lifecycle/ranking indexes и PK `(tournament_id, user_id)`. `V301__tournament_core_score_bridge.sql` добавляет `users.game_score_version` с `NOT NULL`, default `0`, non-negative check и canonical score index.

## WebSocket и reconnect

- Game native WS: `/ws/rounds`, authenticated session principal, per-user isolation.
- Tournament STOMP: `/ws`, topic `/topic/tournaments/{id}/leaderboard`.
- Client SEND в Tournament broker запрещён.
- Reconnect: subscribe → GET leaderboard snapshot → игнорировать frames `revision <= snapshot.revision`; при gap выполнить GET повторно.

## Demo и acceptance

Профиль `demo` создаёт 24 canonical UUID users. Первые три (`anna`, `maks`, `liza`) доступны через demo-login; demo initializer явно добавляет все 24 в дневной Tournament без отдельного Tournament identity. Это fixture и не означает автоматическое участие по score event. Global Rating читает все 24 профиля независимо от membership.

```powershell
.\mvnw.cmd -Pacceptance verify
```

Результат интеграции: 294 Surefire + 74 Failsafe = 368 PASS, 0 failures/errors/skips. Детали: [acceptance-tests.md](acceptance-tests.md).
