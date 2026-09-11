# Acceptance и интеграционные тесты

Все `*IT` выполняются Maven Failsafe при `verify`. Строгий профиль:

```powershell
.\mvnw.cmd -Pacceptance verify
```

`CoreBackendAcceptanceDriver` выполняет demo-login с настоящей HTTP session, вызывает реальные RANDOM_PORT endpoints, продвигает настоящий Game Engine управляемыми часами, проверяет PostgreSQL ledger/score/reward/history/Tournament projection, запускает cold Core context на той же БД и повторно доставляет Core events. Game/Economy/Score/Tournament не заменяются mocks/fakes.

Матрица финального прогона:

| Набор | Cases | Результат |
|---|---:|---|
| Surefire: Core + Economy + Tournament unit | 294 | PASS |
| Failsafe: все integration/acceptance | 74 | PASS |
| Исходный Backend №3 | 37 | PASS |
| Formerly BLOCKED game checks | 18 | PASS |
| Core↔Tournament integration | 5 | PASS |

Formerly BLOCKED: GameScenariosIT — 5, GameConcurrencyIT — 4, GamePersistenceIT — 3, GameAntiCheatIT — 6. Отдельные Core↔Tournament тесты покрывают две authenticated sessions, ranking/currentPlayer, общий transaction rollback, 24 users, 100 retry level/booster и retry после cold restart.

На текущем Windows-хосте стандартный JDK `java.net.http` не может создать внутренний WEPoll loopback pipe. Поэтому test-only native WebSocket client использует Spring `StandardWebSocketClient`, а test Tomcat — NIO2. Production transport и assertions не меняются.
