# GAME ENGINE IMPLEMENTATION RESULT

Дата: 2026-09-11. Ветка: `codex/game-engine`. Область: Backend Developer №1,
Game Engine + realtime. Реализация и тесты завершены; изменения не закоммичены.

## 1. Что было до изменений

Исходный `9db3b3c`: только каркас монорепозитория, README и документы. В backend
не было Java-кода, build system, controllers/services/domain/repositories,
GameRound, DTO, математической модели, WebSocket или тестов. API был TBD.
Заявлены Java 21 + Spring Boot 3, React, PostgreSQL. Compose содержал только БД.
Полный аудит проведён перед созданием кода; повторно использованы правила
механики, 9/12 уровней и существующая граница Backend/Game — Backend/Data.

## 2. Что реализовано

Серверное ядро одного раунда: immutable domain/config snapshots, state machine,
воспроизводимый crash и booster, рост по времени, уровни/очки, денежный cashout,
продолжение полёта до crash, per-round concurrency, очередь повторов внешних
эффектов, REST, приватный WebSocket, scheduler, demo adapters и документация.
Сборка Java 21 / Spring Boot 3.5.16 через Maven Wrapper 3.9.11.

## 3. Какие файлы созданы

52 новых файла. Ниже полный список, пути относительно корня репозитория.

```text
backend/pom.xml
backend/mvnw
backend/mvnw.cmd
backend/.mvn/wrapper/maven-wrapper.properties
backend/src/main/java/ru/airballoon/AirBalloonApplication.java
backend/src/main/java/ru/airballoon/game/
  application/GameService.java
  application/port/BalanceService.java
  application/port/GameConfigProvider.java
  application/port/GameEventPublisher.java
  application/port/RewardService.java
  application/port/RoundRepository.java
  application/port/SeedSource.java
  domain/BoosterGenerator.java
  domain/CrashPointGenerator.java
  domain/GameConfig.java
  domain/GameError.java
  domain/GameEvent.java
  domain/GameException.java
  domain/GameRound.java
  domain/LevelCalculator.java
  domain/MultiplierCalculator.java
  domain/RoundEngine.java
  domain/RoundStateMachine.java
  domain/RoundStatus.java
  domain/RoundTransition.java
  domain/Theme.java
  infrastructure/config/DemoAdaptersConfiguration.java
  infrastructure/config/EngineConfiguration.java
  infrastructure/config/GameProperties.java
  infrastructure/memory/FakeBalanceService.java
  infrastructure/memory/InMemoryGameConfigProvider.java
  infrastructure/memory/InMemoryRoundRepository.java
  infrastructure/realtime/RealtimeConfiguration.java
  infrastructure/realtime/RoundWebSocketHandler.java
  infrastructure/web/ApiExceptionHandler.java
  infrastructure/web/CurrentUser.java
  infrastructure/web/RoundController.java
  infrastructure/web/RoundView.java
backend/src/main/resources/application.yml
backend/src/main/resources/application-demo.yml
backend/src/test/java/ru/airballoon/game/
  ConcurrencyTest.java
  GameEngineTest.java
  IntegrationSupport.java
  RandomAndConfigTest.java
  RealtimeIT.java
  RoundApiIT.java
  TestSupport.java
  infrastructure/config/EngineConfigurationTest.java
backend/src/test/resources/application-test.yml
docs/game-engine.md
docs/game-engine-result.md
scripts/game-engine-smoke.ps1
```

## 4. Какие файлы изменены

- `backend/README.md`: добавлены команды сборки/запуска и ссылки на контракты.
- `docs/API_CONTRACT.md`: заполнен раздел Game Engine REST/WS/errors.

Миграции, PostgreSQL, пользовательские модули, баланс storage, history/admin,
frontend и Docker Compose не изменены. Существующих shared Java interfaces
не было, поэтому дублирования интерфейсов Backend №2 нет.

## 5. Архитектура Game Engine

`domain.RoundEngine` — чистые math/lifecycle функции; `application.GameService` —
серверные часы, сериализация и вызов портов. `infrastructure` содержит Spring,
REST, WebSocket, scheduler и memory adapters. Domain/application не импортируют
Spring, Jackson или persistence frameworks. Constructor injection, immutable
DTO, конфигурация snapshot на весь раунд.

## 6. State machine

```text
CREATED → RUNNING → CASHED_OUT → CRASHED → FINISHED
                 ↘ CRASHED → FINISHED
```

Cashout не заканчивает полёт. `finishedAt` возникает только после crash. После
cashout win/cashoutMultiplier не меняются, новый booster не активируется,
уровни визуально продолжаются с нулевыми начислениями. Все недопустимые переходы
проверены автоматически. Финальный outcome — CASHED_OUT либо LOSS.

## 7. Математическая модель

Рост: `floor4((1 + growthPerSecond × elapsedSeconds) × activeBoosterFactor)`.
Время — серверные миллисекунды; defaults growth=0.10. Cashout:
`floor2(betAmount × authoritativeMultiplier)` через BigDecimal/RoundingMode.DOWN.

Crash: `floor4(min + (max-min) × u^distributionParameter)`, с clamp по границам.
`u` получается из seed и server-only salted SplittableRandom. Параметры
валидируются; defaults диапазон 1.01–30.00, distribution=2.0.
Все математические границы между тиками обрабатываются, даже если tick редкий.

## 8. Booster

x1 — без позиции и активации. x2/x3/x4 — weighted server selection по 9/12 весам
темы, нормализация делением на суммарный вес. На первом пересечении уровня до
cashout умножается текущий коэффициент; x3 на 2 даёт 6. Дополнительные очки:
`boosterPointsPerMultiplier × (boosterMultiplier-1)`; default x3 = 300.
Обрабатываются уровни, перескоченные бустером, и немедленный crash от скачка.

## 9. Cashout/crash race

Отдельный ReentrantLock на roundId. Серверное время читается после получения
lock; engine сначала достигает всех границ до момента обработки команды.
При совпадении с crash выигрывает crash. При совпадении с активацией сначала
применяется booster. Конкурентные cashout дают ровно одну выплату.
Повторный внешний эффект использует ту же сумму и roundId. Ошибки сохранения
и потерянный ответ credit протестированы; идемпотентность — обязанность порта.

## 10. WebSocket/realtime

Spring native JSON WebSocket, серверный scheduler каждые 100 ms. Клиент ждёт
CONNECTION_READY до старта. События отправляются только владельцу по UUID Principal.
Конфиг ограничивает origins, client game messages закрывают socket с 1008.
Seed не сериализуется, crash point открывается только при crash. Для reconnect
есть GET snapshot, roundId/sequence позволяют дедуплицировать доставки.

## 11. Fixed seed

NORMAL — SecureRandom на сервере. FIXED_SEED — только явные test/dev/demo профили;
prod или комбинация prod+dev отклоняются. JSON с seed отклоняется. Demo config:
seed=42, crash=8.42, boosterLevel=3/threshold=2.00. Одинаковые config/theme/booster/seed
воспроизводят результаты. Тесты проверяют как воспроизводимость, так и различие
результатов разных seed и диапазоны распределения.

## 12. Контракты для Backend №2

`GameConfigProvider`, `RoundRepository`, `BalanceService`, `RewardService`,
`GameEventPublisher`, `SeedSource` находятся в application/port.
Balance использует BigDecimal в единицах баланса; debit/credit требуют
идемпотентности по roundId и типу операции. Repository принимает полный snapshot
с config/seed/sequence. Reward hook идемпотентен по roundId.
Spring `GameEvent` предоставляет pointsToAward для score consumers.
Замещение fake balance через DI проверено отдельным тестом.

## 13. REST endpoints

| Метод | URL | Success |
| --- | --- | --- |
| POST | `/api/rounds` | 201 RoundView |
| GET | `/api/rounds/{roundId}` | 200 RoundView |
| POST, пустое тело | `/api/rounds/{roundId}/cashout` | 200 RoundView |

Start принимает только `{theme,betAmount,boosterMultiplier}`.
Ошибки имеют `{code,message,timestamp,path}`. API существовал только как TBD;
Swagger не было. Полный wire contract оформлен в `docs/API_CONTRACT.md`.

## 14. WebSocket topics/events

Endpoint `/ws/rounds`, native JSON, STOMP topics не используются.
Envelope: `{type,roundId,sequence,timestamp,data}`.
Events: ROUND_STARTED, MULTIPLIER_UPDATE, LEVEL_REACHED, BOOSTER_ACTIVATED,
CASHOUT_SUCCESS, CRASH, ROUND_FINISHED. Отдельное транспортное приветствие:
CONNECTION_READY. Финальное событие содержит `data.round` с RoundView.

## 15. Tests: сколько, сценарии, результат

Фактически выполнено **109 test invocations, 58 test methods** с учётом
параметризованных сценариев и повторных прогонов гонок.
**Failures: 0; Errors: 0; Skipped: 0. BUILD SUCCESS.**
Среда: Windows, Eclipse Temurin JDK 21.0.12.1, Maven Wrapper 3.9.11,
Spring Boot 3.5.16. Проверена сборка executable JAR.

| Suite | Invocations | Что проверяется |
| --- | ---: | --- |
| GameEngineTest | 28 | cashout gate, latest time, loss, продолжение полёта, деньги, все boosters, уровни, state machine, clock/config |
| ConcurrencyTest | 46 | одновременные cashout/tick/crash/booster, граница ±1 ms, независимость lock, отказы credit/save/event |
| RandomAndConfigTest | 8 | reproducibility, диапазоны, разные seed, нормализация, невалидные и immutable configs |
| EngineConfigurationTest | 5 | profile gate, missing seed, NORMAL, DI replacement, отсутствие prod fake |
| RoundApiIT | 19 | полный HTTP сценарий, клиентские trust fields, owner, JSON validation, error format |
| RealtimeIT | 3 | реальный socket, полный lifecycle, порядок, изоляция, команды/Origin/Principal |
| **Итого** | **109** | **Все прошли** |

Детерминированная интеграция: `1000 → debit 100 → 900 → booster 2×3=6 →
cashout 6.03 → win 603 → balance 1503 → дальнейший рост → crash 8.42 → FINISHED`.
Выплата и booster однократны, выигрыш сохраняется после crash. Loss без cashout
проверен отдельно. Unit/race tests не используют Thread.sleep.

Дополнительно фактически выполнен smoke-тест упакованного JAR с обычными часами,
реальным scheduler, HTTP и WebSocket: **SMOKE PASS**. Зафиксирован результат
cashout=6.0105, win=601.05, crash=8.42; после cashout были updates, затем один
CRASH и ROUND_FINISHED. Коэффициент smoke cashout закономерно зависит от сетевой
задержки; deterministic integration выше не зависит от неё.

BLOCKED-проверок нет. Интеграция с PostgreSQL не выполнялась: это согласованная
область Backend №2, для текущих сценариев использованы fake adapters.

## 16. Команды запуска тестов

```powershell
cd backend
.\mvnw.cmd -B verify
# Отдельный integration suite:
.\mvnw.cmd '-Dtest=RoundApiIT,RealtimeIT' test
```

JUnit XML/text results находятся в `backend/target/surefire-reports/`.
Smoke для работающего demo: `./scripts/game-engine-smoke.ps1 -BaseUrl http://localhost:8080`.

## 17. Команды локального запуска

```powershell
cd backend
.\mvnw.cmd spring-boot:run '-Dspring-boot.run.profiles=demo'
# Или NORMAL seeds:
.\mvnw.cmd spring-boot:run '-Dspring-boot.run.profiles=dev'
```

Альтернатива из корня после verify:
`java -jar backend/target/backend-0.1.0-SNAPSHOT.jar --spring.profiles.active=demo`.
Linux/macOS: `sh mvnw` вместо `.\mvnw.cmd`. Нужен JDK 21+; первоначальная
загрузка зависимостей требует Maven Central. PostgreSQL для demo не нужен.

## 18. Что подключить Backend №2

Реальные Spring beans config/repository/balance/reward; проверенный UUID Principal
для HTTP и handshake; score consumer с идемпотентностью `(roundId,sequence)`;
историю из финальных snapshot. Реализации должны быть видны component scan/import.
Идемпотентное начисление является обязательной частью BalanceService.
Если нужна работа через перезапуски, подключить durable outbox, reconciliation
debit/start и восстановление активных сессий. Для нескольких JVM нужен owner/fencing.
Изменений математического engine для подстановки базовых портов не требуется.

## 19. Известные ограничения

Один authoritative JVM; in-memory очередь повторов и сессии без TTL; нет
восстановления незавершённых settlement после падения процесса и долговечного
WS replay. Сам по себе PostgreSQL adapter эти ограничения не устраняет.
Start не идемпотентен между HTTP запросами. Длительные блокирующие адаптеры могут
замедлять scheduler. Production auth, persistence/rewards/admin/history не
реализованы в соответствии с разделением ответственности. Математика простая,
без гарантии RTP/provably fair. Полные пояснения в `docs/game-engine.md`.

## 20. Итоговый статус

| Компонент | Статус |
| --- | --- |
| GAME ENGINE CORE | PASS |
| CASHOUT | PASS |
| CRASH | PASS |
| BOOSTER | PASS |
| REALTIME | PASS |
| FIXED SEED | PASS |
| RACE SAFETY | PASS — один authoritative JVM |
| READY FOR BACKEND №2 INTEGRATION | YES |

PASS основан на реально выполненных verify и smoke. Статус интеграционной
готовности относится к согласованным портам для хакатонного backend, а не к
готовности распределённого production-сервиса с durable transactions.
