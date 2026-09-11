# API / WebSocket contract

Контракт Game Engine v1. Модули users/history/admin/rewards подключает Backend №2.
Все timestamp — UTC ISO-8601; деньги и коэффициенты — JSON numbers с точным
серверным расчётом через BigDecimal. Клиент отображает значения, не рассчитывает выплату.

## REST

Аутентификация: trusted servlet Principal, имя — UUID пользователя. В `dev/demo/test`
автоматически используется demo UUID `00000000-0000-0000-0000-000000000001`.
Вне этих профилей нужен authentication-слой Backend №2. `userId` в JSON не принимается.

### Start

`POST /api/rounds`, `Content-Type: application/json`, success `201 Created`:

```json
{"theme":"GREEN","betAmount":100,"boosterMultiplier":3}
```

Только GREEN/RED, booster 1/2/3/4, ставка с максимум двумя десятичными знаками в
пределах GameConfig. Неизвестные поля запрещены. Ответ — RoundView:

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
  "winAmount":0.00,
  "roundScore":0,
  "status":"RUNNING",
  "startedAt":"2026-09-11T00:00:00Z",
  "timestamp":"2026-09-11T00:00:00Z",
  "sequence":1
}
```

Seed отсутствует всегда, crashMultiplier отсутствует до падения. Позиция бустера
выбирается сервером и может отображаться клиентом. Для x1 boosterLevel отсутствует.
Start не идемпотентен: каждый POST списывает новую ставку.

### Snapshot

`GET /api/rounds/{roundId}`, success `200 OK`, ответ — RoundView. Проверяет владельца,
догоняет состояние до текущего серверного времени. Используется после reconnect.

### Cashout

`POST /api/rounds/{roundId}/cashout`, **без тела**, success `200 OK`, ответ — RoundView.
Даже `{}` отклоняется. Сервер проверяет владельца, first level, crash и отсутствие
предыдущего cashout. После успеха появляются `cashoutMultiplier`, `cashoutAt`,
`winAmount`, status=CASHED_OUT. Шар летит дальше; finishedAt пока отсутствует.

Повторный cashout до crash: `409 ALREADY_CASHED_OUT`. После crash: `409 ROUND_ALREADY_CRASHED`.
В обоих случаях повторного начисления нет. При `503 INTEGRATION_UNAVAILABLE`
сумма могла уже зафиксироваться; GET и повтор команды завершают ожидающие эффекты.

Финальный RoundView имеет `status=FINISHED`, `crashMultiplier`, `crashedAt`,
`finishedAt`, `outcome=CASHED_OUT|LOSS`; ранее зафиксированные winAmount/cashoutAt
не изменяются. Null-поля в JSON опущены.

## WebSocket events

Native WebSocket: `ws://localhost:8080/ws/rounds` (HTTPS → `wss`). STOMP topics нет.
Principal наследуется из handshake; соединение получает только события своего
пользователя. Допустимые Origin задаются `game.allowed-origins`.

Сначала открыть соединение и дождаться `{"type":"CONNECTION_READY"}`, затем вызвать
POST start. Не отправлять клиентские игровые сообщения в WebSocket: код закрытия 1008.

Общая форма игрового события:

```json
{
  "type":"MULTIPLIER_UPDATE",
  "roundId":"00000000-0000-0000-0000-000000000123",
  "sequence":12,
  "timestamp":"2026-09-11T00:00:10.100Z",
  "data":{"multiplier":6.0300,"level":6}
}
```

| type | data |
| --- | --- |
| ROUND_STARTED | `round: RoundView` |
| MULTIPLIER_UPDATE | `multiplier, level` |
| LEVEL_REACHED | `level, multiplier, points, pointsToAward` |
| BOOSTER_ACTIVATED | `booster, level, beforeMultiplier, afterMultiplier, points, pointsToAward` |
| CASHOUT_SUCCESS | `multiplier, cashoutMultiplier, winAmount` |
| CRASH | `crashMultiplier` |
| ROUND_FINISHED | `round: RoundView` с полным финальным клиентским состоянием |

`roundId`, `sequence`, `timestamp` находятся в envelope всех игровых событий.
Доменный event дополнительно содержит userId и внутренний snapshot для Backend №2;
в WebSocket они напрямую не сериализуются.

Пример бустера: `data={"booster":3,"level":3,"beforeMultiplier":2.00,"afterMultiplier":6.00,"points":300,"pointsToAward":300}`.
После cashout LEVEL_REACHED используется для отображения, `pointsToAward=0`.
Обычные фоновые updates идут примерно 10 раз/секунду; специальные события — сразу.
Frontend интерполирует между значениями, FPS не влияет на авторитетное состояние.

`sequence` монотонен внутри roundId. Дедуплицировать повторные доставки по
`(roundId,sequence)`. После reconnect: открыть socket, буферизовать события,
получить GET snapshot, отбросить события `sequence <= snapshot.sequence`,
применить остальные. Сервер не хранит долговечный replay событий.

## Error format

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
| 401 | UNAUTHENTICATED |
| 403 | FORBIDDEN_ROUND_ACCESS |
| 404 | ROUND_NOT_FOUND |
| 409 | ROUND_NOT_RUNNING, CASHOUT_NOT_AVAILABLE_YET, ALREADY_CASHED_OUT, ROUND_ALREADY_CRASHED, INSUFFICIENT_BALANCE |
| 503 | INVALID_GAME_CONFIG, INTEGRATION_UNAVAILABLE |

Неверный YAML config останавливает startup с диагностикой вместо запуска
невалидного игрового сервера. Ошибки transport handshake используют HTTP 401/403.

Подробнее: [game-engine.md](game-engine.md).
