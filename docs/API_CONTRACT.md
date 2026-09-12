# API / WebSocket contract

Контракт Game Engine v1 с дополнениями Game Resilience. Модули users/history/admin/rewards подключает Backend №2.
Все timestamp — UTC ISO-8601; деньги и коэффициенты — JSON numbers с точным
серверным расчётом через BigDecimal. Клиент отображает значения, не рассчитывает выплату.

## Backend №2: HTTP API

JSON, даты UTC ISO-8601, идентификаторы UUID, бонусы/очки long.
Для значений > Number.MAX_SAFE_INTEGER frontend должен учитывать точность JS.

Аутентификация: trusted servlet Principal, имя — UUID пользователя. В `test/dev`
доступен технический principal для тестов движка. Профиль `demo` использует
`POST /api/auth/demo-login` и серверную cookie-сессию; этот же UUID читает balance,
запускает раунд и проходит WebSocket handshake. `userId` в JSON не принимается.

Demo credentials: `anna/balloon1`, `maks/balloon2`, `liza/balloon3`.
`GET /api/auth/me` возвращает текущее состояние пользователя,
`DELETE /api/auth/session` завершает сессию (`204`). Отсутствующая, истёкшая или
повреждённая session на любом private endpoint даёт `401 AUTH_REQUIRED`; она не
маскируется под `503`. UUID из header/query/body никогда не выбирает пользователя.

### Player catalog

`GET /api/game/catalog` публично возвращает безопасный pre-round catalog из
активной versioned PostgreSQL-конфигурации и фактической engine-конфигурации:

```json
{
  "configVersion": 1,
  "gameId": "air-balloon",
  "gameName": "Воздушный Шар",
  "active": true,
  "themes": [
    {"theme":"GREEN","levels":9,"active":true},
    {"theme":"RED","levels":12,"active":true}
  ],
  "stakes": {"minimum":1,"maximum":1000,"decimalPlaces":0},
  "stakeOptions": [
    {"amount":100,"boosterMultiplier":1,"active":true},
    {"amount":250,"boosterMultiplier":2,"active":true},
    {"amount":500,"boosterMultiplier":3,"active":true},
    {"amount":1000,"boosterMultiplier":4,"active":true}
  ],
  "boosters": [
    {"multiplier":1,"extraCost":0,"active":true},
    {"multiplier":2,"extraCost":0,"active":true},
    {"multiplier":3,"extraCost":0,"active":true},
    {"multiplier":4,"extraCost":0,"active":true}
  ],
  "serverTime": "2026-09-11T12:00:00Z"
}
```

`stakeOptions` — ровно четыре готовые пары в детерминированном порядке; amounts
берутся backend-ом как 10%, 25%, 50% и 100% от `maxBet`. Клиент не строит пары
самостоятельно. `stakes` описывает полный допустимый диапазон для legacy-клиентов. В текущей
целочисленной PostgreSQL economy `decimalPlaces=0`. Booster не имеет отдельной
цены, поэтому `extraCost=0`; ставка списывается ровно один раз независимо от
варианта. Catalog не содержит weights/probabilities, seed, crash point или
будущую позицию booster. Advertised theme/stake/booster валидируются тем же
`GameConfig`, который использует `POST /api/rounds`.

### Start

`POST /api/rounds`, `Content-Type: application/json`, success `201 Created`:

```json
{"theme":"GREEN","betAmount":100,"boosterMultiplier":3}
```

Только GREEN/RED и одна из четырёх связанных пар `catalog.stakeOptions`.
Несвязанная комбинация (например amount из option 1 с booster ×4) отклоняется
`400 INVALID_BET`; баланс дополнительно проверяется сервером.
Границы ставки являются частью versioned PostgreSQL GameConfig. В PostgreSQL-контуре бонусы целочисленные, поэтому ставка
с дробной частью отклоняется; winAmount вычисляется движком с округлением вниз
до целого бонуса. Неизвестные поля запрещены. Ответ — RoundView:

```json
{
  "id":"00000000-0000-0000-0000-000000000123",
  "theme":"GREEN",
  "betAmount":100.00,
  "boosterMultiplier":3,
  "boosterLevel":3,
  "boosterActivated":false,
  "currentMultiplier":1.0000,
  "currentLevel":0,
  "totalLevels":9,
  "levelThresholds":[1.2,1.5,2,3,4,6,8,10,12],
  "cashoutAvailable":false,
  "cashoutPreviewAmount":100.00,
  "winAmount":0.00,
  "roundScore":0,
  "status":"RUNNING",
  "startedAt":"2026-09-11T00:00:00Z",
  "timestamp":"2026-09-11T00:00:00Z",
  "roundId":"00000000-0000-0000-0000-000000000123",
  "serverTime":"2026-09-11T00:00:00Z",
  "cashoutPerformed":false,
  "fairnessCommitment":"sha256:fb553c3b8fce90e8b7b024d5917254fb402b22b343ebf2cf96209cb8f6008456",
  "sequence":1
}
```

Seed отсутствует на верхнем уровне всегда; `fairnessReveal.serverSeed` появляется
после падения. crashMultiplier отсутствует до падения. Для x2/x3/x4
`boosterLevel` возвращается уже в `POST /api/rounds`, snapshot и
`ROUND_STARTED` (REST replay/WebSocket), потому что позиция выбирается сервером
до старта и входит в исходный commitment. Для x1 поле `boosterLevel` отсутствует
и в proof трактуется как `null`. Публичность позиции не раскрывает ни seed, ни
будущий crashMultiplier.
Start не идемпотентен: каждый POST списывает новую ставку.

### Snapshot

`GET /api/rounds/{roundId}`, success `200 OK`, ответ — RoundView. Проверяет владельца,
догоняет состояние до текущего серверного времени. Используется после reconnect.
`roundId` — alias прежнего `id`, `sequence` — cursor snapshot. `cashoutPerformed`
явно указывает, зафиксирована ли выплата. `serverTime` — текущее время сервера,
а `timestamp` — время последнего изменения состояния. Пока `status=RUNNING`,
`cashoutPreviewAmount` содержит authoritative сумму, которую сервер выплатил бы
при cashout в представленном snapshot state. Поле рассчитывается transiently и
не вызывает отдельной записи или чтения PostgreSQL на tick.

### Cashout

`POST /api/rounds/{roundId}/cashout`, **без тела**, success `200 OK`, ответ — RoundView.
Даже `{}` отклоняется. Сервер проверяет владельца, first level, crash и отсутствие
предыдущего cashout. После успеха появляются `cashoutMultiplier`, `cashoutAt`,
`winAmount`, status=CASHED_OUT. Шар летит дальше; finishedAt пока отсутствует.
`roundScore` сразу включает cashout bonus из immutable config version раунда.
`cashoutPreviewAmount` после фиксации опускается. Фактический `winAmount` может
быть немного больше последнего показанного preview, если authoritative multiplier
вырос между последним realtime event и обработкой команды сервером; клиентский
timestamp не участвует в settlement.

Повторный cashout до crash: `409 ALREADY_CASHED_OUT`. После crash: `409 ROUND_ALREADY_CRASHED`.
В обоих случаях повторного начисления нет. При `503 INTEGRATION_UNAVAILABLE`
сумма могла уже зафиксироваться; GET и повтор команды завершают ожидающие эффекты.

Опциональный header `Idempotency-Key: UUID` сохраняет первый успешный результат
cashout в пределах раунда. С тем же key возвращается тот же cashout snapshot даже
после crash (со свежим serverTime); для актуального статуса использовать GET.
Другой key/без key — прежние 409. Key хранится вместе с checkpoint в пределах
finished-retention, default 24h. Неверный формат header: 400 INVALID_REQUEST.

Финальный RoundView имеет `status=FINISHED`, `crashMultiplier`, `crashedAt`,
`finishedAt`, `outcome=CASHED_OUT|LOSS`; ранее зафиксированные winAmount/cashoutAt
не изменяются. Добавляется `fairnessReveal` с proof. Null-поля в JSON опущены.

### Fairness

`GET /api/rounds/{roundId}/fairness`, 200, только владелец.
До crash: `status=COMMITTED`, `roundId`, `commitment`, `algorithm=SHA-256`,
`format=air-balloon-fairness:v1`. После crash: `status=REVEALED` и дополнительно
`serverSeed` (decimal string), `crashMultiplier`, `boosterLevel`, `verified`,
`canonicalInput`. Seed/result до падения отсутствуют, даже после cashout.
Проверять по первоначальному commitment: [точный формат и verifier](fairness.md).

### Replay

`GET /api/rounds/{roundId}/events?afterSequence=15`, 200, только владелец.
Ответ содержит `roundId`, `events` с sequence>15, `oldestAvailableSequence`,
`latestSequence`, `snapshotRequired`, `serverTime`. Events используют тот же
envelope, что WebSocket, без внутренних snapshot/userId/config/seed.
При `snapshotRequired=true` вернуть UI к GET snapshot: начало буфера могло быть
удалено, cursor мог опередить сервер или replay истёк. Невалидный/отрицательный
cursor: 400. Default limit=256 всех событий на round, finished replay TTL=15m.

### Data / Economy endpoints

| Метод | URL | Ответ |
| --- | --- | --- |
| GET | /api/demo/users | UserState[] из трёх пользователей; только demo |
| GET | /api/current-user или /api/current-user/state | UserState текущего Principal; auth |
| GET | /api/current-user/balance | `{bonusBalance,serverTime}` текущего Principal; auth |
| GET | /api/users/{id}/state | Compatibility: только если `{id}` равен текущему Principal; иначе 403 |
| GET | /api/current-user/history?page=0&size=20 | PersonalPage только текущего Principal; auth |
| GET | /api/history?page=0&size=20 | Global history `{items,page,size,total}`; authenticated, privacy-safe |
| GET | /api/current-user/active-round | Active owner snapshot or `204 No Content` for reconnect recovery |
| GET | /api/rounds/{id}/result | Private завершённый result владельца; auth; чужой round → 403 |
| GET | /api/admin/config | {version, updatedAt, config} |
| PUT | /api/admin/config | Принимает {expectedVersion, config}, возвращает новый snapshot |

Admin endpoints требуют X-Admin-Token. Локальное Compose-значение:
local-demo-admin. Пустой ADMIN_TOKEN в standalone закрывает доступ.
Мутации экономики — внутренние Java-сервисы, публичных POST для balance/score нет.

Native WebSocket: `ws://localhost:8080/ws/rounds` (HTTPS → `wss`). STOMP topics нет.
Principal наследуется из handshake; соединение получает только события своего
пользователя. Допустимые Origin задаются через `CORS_ALLOWED_ORIGINS` либо
автоматически выводятся из `FRONTEND_SCHEME`, `FRONTEND_HOST` и
`FRONTEND_PORT` в `.env`.

Сначала открыть соединение и дождаться `{"type":"CONNECTION_READY"}`, затем вызвать
POST start. Не отправлять клиентские игровые сообщения в WebSocket: код закрытия 1008.

Общая форма игрового события:

```json
{
  "type":"MULTIPLIER_UPDATE",
  "roundId":"00000000-0000-0000-0000-000000000123",
  "sequence":12,
  "eventId":"00000000-0000-0000-0000-000000000123:12",
  "timestamp":"2026-09-11T00:00:10.100Z",
  "serverTime":"2026-09-11T00:00:10.100Z",
  "data":{"multiplier":6.0300,"level":6,"cashoutPreviewAmount":603}
}
```

| type | data |
| --- | --- |
| ROUND_STARTED | `round: RoundView`, `fairnessCommitment`, `cashoutPreviewAmount` |
| MULTIPLIER_UPDATE | `multiplier, level, cashoutPreviewAmount` до cashout |
| LEVEL_REACHED | `level, multiplier, cashoutPreviewAmount, points, pointsToAward` до cashout |
| BOOSTER_ACTIVATED | `booster, level, beforeMultiplier, afterMultiplier, cashoutPreviewAmount, points, pointsToAward` |
| CASHOUT_SUCCESS | `multiplier, cashoutMultiplier, winAmount` |
| CRASH | `crashMultiplier`, `fairnessReveal` |
| ROUND_FINISHED | `round: RoundView` с полным финальным состоянием, `fairnessReveal` |

`roundId`, `sequence`, `eventId`, `timestamp`, `serverTime` находятся в envelope всех игровых событий.
Доменный event дополнительно содержит userId и внутренний snapshot для Backend №2;
в WebSocket они напрямую не сериализуются.

Пример бустера: `data={"booster":3,"level":3,"beforeMultiplier":2.00,"afterMultiplier":6.00,"points":300,"pointsToAward":300}`.
После cashout LEVEL_REACHED используется для отображения, `pointsToAward=0`.
Обычные фоновые updates идут примерно 10 раз/секунду; специальные события — сразу.
Frontend отображает последнее серверное `cashoutPreviewAmount` без расчёта
`stake × multiplier`; при разрыве связи сумма замораживается до snapshot/replay.
FPS не влияет на авторитетное состояние.

`sequence` монотонен внутри roundId. Дедуплицировать повторные доставки по
`(roundId,sequence)`. После reconnect: открыть socket, буферизовать события,
получить GET snapshot, отбросить события `sequence <= snapshot.sequence`,
применить остальные по порядку. Разрыв sequence требует replay или нового snapshot.
Replay ограничен по размеру и TTL. В `test/dev` memory adapters не переживают
рестарт JVM; в PostgreSQL-контуре tail и checkpoints сохраняются между рестартами.
Подробный протокол, retention и контракты: [reconnect-recovery.md](reconnect-recovery.md).

UserState: userId, username, displayName, bonusBalance, gameScore, createdAt, updatedAt.
Frontend не передаёт userId для current state/balance/history.

history.items: roundId, username, theme, betAmount, boosterTier,
boosterMultiplier (значение из версии конфигурации раунда), cashoutMultiplier,
crashMultiplier, winAmount, roundScore, result (WIN/LOSS), finishedAt.
size=1..100; сортировка finishedAt DESC, id. История глобальная.
WIN означает успешный cashout, в том числе после последующего crash.

Personal history: `items,page,size,total,serverTime`; item содержит `roundId,theme,
betAmount,boosterMultiplier,cashoutMultiplier,crashMultiplier,winAmount,score,
result,reward,completedAt`. `size=1..100`, сортировка та же. Ни `userId`, ни
username в personal item нет; SQL обязательно фильтрует `user_id` по Principal.

```json
{
  "code":"CASHOUT_NOT_AVAILABLE_YET",
  "message":"Reach the first level before cashout",
  "timestamp":"2026-09-11T00:00:01Z",
  "path":"/api/rounds/00000000-0000-0000-0000-000000000123/cashout"
}
```

| HTTP | Codes |
| --- | --- |
| 400 | INVALID_REQUEST, INVALID_THEME, INVALID_BOOSTER, INVALID_BET |
| 401 | AUTH_REQUIRED (нет/invalid/expired session); UNAUTHENTICATED только internal compatibility |
| 403 | FORBIDDEN_ROUND_ACCESS, NOT_OWNER |
| 404 | ROUND_NOT_FOUND |
| 409 | ROUND_NOT_RUNNING, CASHOUT_NOT_AVAILABLE_YET, ALREADY_CASHED_OUT, ROUND_ALREADY_CRASHED, INSUFFICIENT_BALANCE |
| 503 | INVALID_GAME_CONFIG, INTEGRATION_UNAVAILABLE |

Неверный YAML config останавливает startup с диагностикой вместо запуска
невалидного игрового сервера. Ошибки transport handshake используют HTTP 401/403.

Подробнее: [game-engine.md](game-engine.md).

result: roundId, result, betAmount, cashoutMultiplier, crashMultiplier,
winAmount, score, configVersion, reward, completedAt, serverTime. Endpoint private:
только owner Principal получает result.
result/personal reward: id, type, rarity, createdAt. Internal round/user foreign
keys не сериализуются в frontend-facing reward DTO.
До завершения — 409 ROUND_NOT_FINISHED.

Полная схема GameConfig, ограничения, Java-интерфейсы и порядок транзакций:
[backend-data-economy.md](backend-data-economy.md).

## Ошибки

~~~json
{
  "code": "INSUFFICIENT_BALANCE",
  "message": "Недостаточно бонусов",
  "timestamp": "2026-09-11T00:00:00Z"
}
~~~

400 — ошибка запроса/валидации; 403 — доступ к admin; 404 — объект отсутствует;
409 — бизнес-конфликт/устаревшая версия/ограничение БД; 503 — только реально
недоступная интеграция или невалидная authoritative конфигурация.
Полный список кодов — в документе backend-data-economy.md.
Повтор debit/credit/score/reward с теми же параметрами возвращает успех,
с другой суммой/очками — IDEMPOTENCY_CONFLICT.

## Tournament HTTP API

Tournament использует тот же authenticated UUID `Principal`, что Game Engine.
Клиент не передаёт `userId` ни в query, ни в body, ни в заголовке.

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/tournaments/active` | `200 {active:false}` или `{active:true,tournament}` |
| GET | `/api/tournaments/{id}/leaderboard?page=0&size=50` | `{tournament,top3,participants,currentPlayer,totalParticipants,page,size,updatedAt}` |
| POST | `/api/tournaments/{id}/participants/me` | `204`; UUID и score читаются сервером из session/Core |

Tournament: `id,name,description,status,startsAt,endsAt,secondsRemaining,serverTime,revision`.
Leaderboard entry: `position,userId,username,score`. Top-3 и `currentPlayer` не
зависят от выбранной страницы; размер страницы — 1–100. Имена других участников
маскируются, имя текущего игрока возвращается без маскирования.

Tournament errors: `{code,message}`. Коды: `INVALID_ARGUMENT`,
`INVALID_PAGINATION`, `AUTH_REQUIRED`, `TOURNAMENT_NOT_FOUND`,
`PLAYER_NOT_FOUND`, `TOURNAMENT_NOT_ACTIVE`, `SCORE_SOURCE_UNAVAILABLE`.

## Global Rating HTTP API

Global Rating is intentionally separate from Tournament and reads all registered
users from canonical `users.game_score`, including users with score `0`.

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/rating?page=0&size=50` | `{entries,currentPlayer,totalParticipants,page,size,revision}` |

The endpoint requires the session `Principal`. Entries are ordered by
`game_score DESC, updated_at ASC, id ASC`; `currentPlayer` is returned even when
the player is outside the requested page. The response does not expose internal
user UUIDs, balances, email, or session data. See
[global-rating-contract.md](global-rating-contract.md).

## Tournament WebSocket

STOMP endpoint: `/ws`; topic:
`/topic/tournaments/{tournamentId}/leaderboard`. Это отдельный канал от native
Game WebSocket `/ws/rounds`. Handshake использует ту же HTTP session и UUID
`Principal`; клиентские SEND запрещены.

`LEADERBOARD_UPDATE` содержит `type`, `tournamentId`, `revision`, `topPlayers`,
`changedPlayer`, `totalParticipants`, `updatedAt`; broadcast не содержит имён.
Reconnect: подписаться, выполнить HTTP GET snapshot, отбросить frames с
`revision <= snapshot.revision`, затем применять большие revision; при gap
повторить GET. Countdown считается по `endsAt` и `serverTime`.

## Internal score adapter

`PlayerScoreSource.find(UUID)` читает canonical `users.id`, `display_name`,
`game_score` и устойчивую `score_version`. После атомарного authoritative score
update Core публикуется `ScoreChanged(PlayerScore)`. Tournament не пересчитывает
level, booster или cashout points; duplicate/retry отсекается версией и уникальным
идентификатором score event.

Authoritative per-round total — сумма immutable `score_events` этого round:
level points + activated booster tier bonus + successful cashout bonus. Engine
включает те же versioned config values в snapshot в момент события. Поэтому после
completion `RoundView.roundScore == result.score == personalHistory.items[].score
== SUM(score_events.points)`. `users.game_score` — cumulative сумма всех принятых
score events пользователя, а Tournament проецирует именно этот cumulative total.

## Frontend binding

Nginx проксирует `/api/`, `/ws` и `/ws/rounds` в единый backend. Frontend
использует cookie session после `/api/auth/demo-login`; canonical UUID не
передаётся клиентом как доверенный header. Game и Tournament работают поверх
одного Principal, одной PostgreSQL и одного authoritative score.

## Scenario 8 — «Закрепи успех»

После завершённого WIN frontend запрашивает `GET /api/current-user/upsell/lottery-tickets/offer?roundId=...`.
Backend проверяет сохранённый cashout, пользователя и конфигурацию и возвращает снимок
`{offerId, roundId, price, ticketCount, minWinAmount, expiresAt, status}`. LOSS,
неeligible WIN и отключённая функция дают `204 No Content`. Offer принадлежит user+round
и действует 10 минут.

Покупка: `POST /api/current-user/upsell/lottery-tickets/purchase` с `Idempotency-Key`
и телом `{offerId}`. Цена и количество из тела не принимаются. Ответ содержит новый
`bonusBalance` и `lotteryTicketCount`; повтор с тем же ключом возвращает тот же результат,
другой ключ для consumed offer отклоняется. Debit, credit билетов и ledger-запись
атомарны.
