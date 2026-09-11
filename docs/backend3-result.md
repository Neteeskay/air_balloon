# BACKEND №3 — TOURNAMENT & INTEGRATION RESULT

Дата проверки: 11 сентября 2026. Рабочая ветка: `codex/3bec`. Изменения оставлены в рабочем дереве, без commit/merge. Итог: **tournament-модуль проверен; полная игровая интеграция BLOCKED**.

1. **Исходное состояние проекта.** Commit `9db3b3c`, пустой backend scaffold, Java 21/Spring Boot 3 только в README. Нет build, application, engine, user/score/balance/config/reward/persistence, API, WebSocket, тестов и миграций. Compose содержит только PostgreSQL. Подробно: [аудит](backend3-audit.md).

2. **Что реализовано.** Запускаемый Spring Boot backend, tournament domain и PostgreSQL projection, leaderboard REST, top3/current player, masking, Clock/timer, STOMP updates, demo seed/simulator, integration/acceptance/security/concurrency suites, Maven Wrapper и строгий acceptance runner. Игровая математика и экономика не создавались.

3. **Созданные файлы.** 61 файл: 28 production Java, 21 test Java, 4 build/wrapper, 2 resources, 5 documents/result artifacts, 1 runner. Полный список в конце отчёта; точные пути также есть в `git status --short --untracked-files=all`.

4. **Изменённые файлы.** Только существующие `backend/README.md` и `docs/API_CONTRACT.md`. Пустые пакеты Backend №1/№2, Compose, frontend, исходные архитектурные документы не переписывались.

5. **Tournament architecture.** Spring JDBC repository → transactional service → scoped REST API; DI ports для общего score/current user/transport. ApplicationEvent используется без Kafka/RabbitMQ. Производитель score и projection могут работать в общей DB-транзакции.

6. **Tournament lifecycle.** Status вычисляется из дат: before start=PLANNED, [start,end)=ACTIVE, at/after end=FINISHED. Сохранённого status, противоречащего датам, нет. Завершённый рейтинг доступен и заморожен. Поздние события после cutoff игнорируются.

7. **Entities/tables.** `Tournament`, `TournamentParticipant`; `tournament.tournaments` и `tournament.participants`; миграция V300. UUID PK, FK participant→tournament, проверки дат/неотрицательных score/version, ranking index. FK на ещё отсутствующую users schema не выдуман.

8. **Leaderboard API.** `GET /api/tournaments/active`; `GET /api/tournaments/{id}/leaderboard?page=0&size=50`; дополнительно `POST /api/tournaments/{id}/participants/me`. No active → 200 `{active:false}`. Pagination 1–100, typed errors. Optional admin CRUD отложен (P1).

9. **Top 3.** Отдельный SQL LIMIT 3, возвращается независимо от страницы. Пустой/<3 список корректен.

10. **Current player.** UUID из проверенного Principal через заменяемый `CurrentPlayerResolver`. Отдельная запись/позиция вне страницы. Anonymous/unjoined → null. Production auth отсутствует, `X-Test-Principal` работает исключительно в тестах.

11. **Ranking/sorting.** `score DESC, updated_at ASC, user_id ASC`; позиции последовательные. LIMIT/OFFSET и индекс; current rank = count(участников выше)+1. REST ответ читается из одного REPEATABLE_READ snapshot. PostgreSQL row locks и versioned UPSERT защищают конкурентные обновления.

12. **Username masking.** Flag `maskOtherPlayerNames`; первые три Unicode code point чужих имён заменяются `***`, короткие имена полностью скрываются, своё имя сохраняется. Проверены on/off и поддельная identity.

13. **Timer.** Инъецируемый Clock; startsAt/endsAt/serverTime/secondsRemaining, frontend countdown. Проверены точные границы и ноль после окончания; повторная проверка expiry после row lock.

14. **Realtime.** Общий STOMP `/ws`, topic `/topic/tournaments/{id}/leaderboard`. После commit отправляются top20 + changedPlayer + revision. Имена не публикуются в общий topic. Дубликаты/rollback не отправляются, клиентские SEND запрещены. После reconnect нужен GET.

15. **Demo participants.** 24 именованных участника, ежедневный UTC турнир «Воздушная гонка». Детерминированные UUID и идемпотентный seed. Только demo/dev и никогда prod. Restart не обнуляет scores/versions.

16. **Demo simulator.** По умолчанию выключен; flag `demoTournamentSimulationEnabled`, интервал 5000 ms, +50/+100/+200. В тесте выполнена отдельная итерация и проверено, что выключенный scheduler tick ничего не меняет. С реальным PlayerScoreSource fake не включается.

17. **ScoreService integration.** Реализованы `PlayerScoreSource`, `PlayerScore`, `ScoreChanged`, синхронный adapter listener. Tournament сохраняет **полный общий gameScore**, не рассчитывает points и не ведёт отдельный ledger. Проверены duplicate/stale versions, корректировки вниз и rollback. Реальный ScoreService ещё отсутствует: его интеграция BLOCKED.

18. **Backend №1 integration.** Есть точки подключения единого realtime transport и test-only `BackendAcceptanceDriver`. Engine, rounds, deterministic hooks и API отсутствуют. Реальные игровые команды не проверены.

19. **Backend №2 integration.** Готовы ports/event contract и PostgreSQL migration. Общие user/economy/score/config/history/reward реализации отсутствуют; требуются их DI adapter и test driver. В production нет заменяющих их фейковых сервисов.

20. **Scenario 1 Bet + Start: BLOCKED.** Assertions GREEN/RED, 1000→900, один debit, RUNNING, booster и ROUND_STARTED написаны. Нужны реальные start/user/ledger/event APIs.

21. **Scenario 2 Cashout: BLOCKED.** Assertions server multiplier/win, один credit, continued flight, crash, WIN, score/reward/history написаны. Нужны engine seed hook и economy/persistence.

22. **Scenario 3 Loss: BLOCKED.** Assertions FINISHED/LOSS, zero win, потерянная ставка, сохранённые level points/reward/history написаны. Нужны game/data модули.

23. **Scenario 4 Booster x3: BLOCKED.** Проверки before×3, одной активации/points, boosted cashout и отсутствия позднего booster после раннего cashout написаны. Нужен controlled seed Backend №1.

24. **Scenario 5 Config: BLOCKED.** Проверки Admin config 100→500 и разных snapshots старого/нового round написаны. Нужны GameConfigProvider, Admin API и engine level hook.

25. **Anti-cheat.** Tournament security: **3 PASS** (identity/body/SEND). Game anti-cheat: **6 BLOCKED** (4 forged fields + ownership + early cashout). Общий anti-cheat backend не объявляется PASS.

26. **Concurrency.** Tournament: **2 PASS**, включая 50 duplicate/out-of-order score events и 50 concurrent players. Game concurrency: **4 BLOCKED**. Это функциональная стресс-проверка SQL-интеграции, не производственный нагрузочный benchmark.

27. **Double cashout: BLOCKED.** Подготовлены 50 одновременных запросов, один WIN_CREDIT, один effective CASHOUT и точный итоговый баланс. Engine/ledger отсутствуют.

28. **Parallel bet: BLOCKED.** Подготовлены 10 ставок по 100 при balance=100, один успешный start/debit, balance=0. Engine/balance/transaction implementation отсутствуют.

29. **Global history: BLOCKED.** Подготовлены три пользователя, WIN/LOSS, multiplier, newest first и pagination assertions. History API/round persistence отсутствуют.

30. **Reward idempotency: BLOCKED.** Подготовлены repeated generation, одинаковый reward и count=1. RewardService/repository отсутствуют.

31. **Tournament realtime: PASS.** Два отдельных WebSocket tests плюс HTTP/STOMP acceptance 700→1200, position 4→1. Проверены changedPlayer за пределами top20, revision, отсутствие rollback/duplicate broadcast. Клиент реально подписывается на broker.

32. **Unit tests: 16 PASS.** Domain=4, masking=8, service=4.

33. **Integration tests.** Maven Failsafe запускает **39 cases**, в том числе acceptance. Вне acceptance-пакета — **33 cases: 20 PASS, 13 BLOCKED**. PostgreSQL настоящий, HTTP/WebSocket настоящие. Для этого хоста использован внешний локальный PostgreSQL 17.6, не Testcontainers runtime.

34. **Acceptance tests: 6 cases.** Tournament acceptance **1 PASS**; mandatory game scenarios **5 BLOCKED**.

35. **Полный test suite.** `verify`: **55 total, 37 PASS, 18 BLOCKED/skipped, 0 failures/errors**, exit 0. Строгий `verify -Pacceptance`: **37 PASS и 18 явных BLOCKED prerequisites**, exit 1 (JUnit отображает BLOCKED как assertion failures). Строгая приёмка всей игры не пройдена. Maven Wrapper и runner реально запускались.

36. **Команды запуска.** PostgreSQL: `docker compose up -d postgres`; из backend: `.\mvnw.cmd spring-boot:run '-Dspring-boot.run.profiles=demo'`. Unit: `.\mvnw.cmd test`. Все tests: `.\mvnw.cmd verify`. Linux/macOS: `sh mvnw ...`. Docker Compose запуск в текущей среде не проверен: Docker отсутствует.

37. **Acceptance command.** Из backend: `.\mvnw.cmd verify -Pacceptance`; из корня: `.\scripts\test-backend.ps1 -Suite acceptance`. Проверенный runner выдал SCENARIO 1–5 BLOCKED и сохранил exit 1. Инструкции для внешнего test PostgreSQL и environment workaround: [acceptance-tests.md](acceptance-tests.md).

38. **Ограничения.** Нет production auth, game/economy/score source, admin tournament CRUD, durable event outbox, многосерверного брокера или нагрузочного SLA. Рейтинг включает lifetime score на момент вступления/последнего принятого события, не только очки за период турнира. Freeze использует processing cutoff. UUID публичны; masking не является анонимизацией идентификаторов. Встроенный broker предполагает одну instance. Default demo без simulation не создаёт новый турнир в полночь до рестарта. Индекс/SQL рассчитаны на хакатонный размер.

39. **Blockers Backend №1.** GameEngine/GameRound; реальные start/cashout/round endpoints; server multipliers/crash/levels/booster/lifecycle; deterministic paused-clock seed hooks двух профилей; ownership/idempotency/events; адаптация game части test driver. Никакая crash математика не продублирована.

40. **Blockers Backend №2.** UserService, BalanceService, ScoreService с persisted version, ledger и транзакции, GameConfigProvider/Admin API/snapshot, RoundRepository/history, RewardService; `PlayerScoreSource` и score event producer; data часть test driver. Без них экономические assertions нельзя выполнить.

41. **Финальный статус:**

```text
TOURNAMENT CORE: PASS
LEADERBOARD: PASS
LIVE RATING: PASS
DEMO PLAYERS: PASS

SCENARIO 1: BLOCKED
SCENARIO 2: BLOCKED
SCENARIO 3: BLOCKED
SCENARIO 4: BLOCKED
SCENARIO 5: BLOCKED

ANTI-CHEAT: BLOCKED (tournament security PASS)
CONCURRENCY: BLOCKED (tournament concurrency PASS)
GLOBAL HISTORY: BLOCKED
REWARD IDEMPOTENCY: BLOCKED
TOURNAMENT UPDATE: PASS

BACKEND INTEGRATION READY: NO
```

## Полный перечень созданных файлов

Пути Java ниже относительно `backend/src/main/java/ru/hackathon/airballoon/`:

```text
AirBalloonApplication.java
websocket/WebSocketConfiguration.java
tournament/api/LeaderboardEntry.java
tournament/api/LeaderboardResponse.java
tournament/api/LeaderboardUpdate.java
tournament/api/TournamentController.java
tournament/api/TournamentErrorHandler.java
tournament/api/TournamentException.java
tournament/api/TournamentView.java
tournament/config/LeaderboardTransportConfiguration.java
tournament/config/TournamentConfiguration.java
tournament/config/TournamentProperties.java
tournament/demo/DemoConfiguration.java
tournament/demo/DemoLifecycle.java
tournament/demo/DemoScoreSource.java
tournament/demo/DemoTournament.java
tournament/domain/Tournament.java
tournament/domain/TournamentParticipant.java
tournament/domain/TournamentStatus.java
tournament/domain/UsernameMasker.java
tournament/persistence/TournamentRepository.java
tournament/port/CurrentPlayerResolver.java
tournament/port/LeaderboardPublisher.java
tournament/port/PlayerScore.java
tournament/port/PlayerScoreSource.java
tournament/port/ScoreChanged.java
tournament/service/TournamentEvents.java
tournament/service/TournamentService.java
```

Tests относительно `backend/src/test/java/ru/hackathon/airballoon/`:

```text
acceptance/BackendAcceptanceDriver.java
acceptance/GameAcceptanceSupport.java
acceptance/GameScenariosIT.java
acceptance/TournamentAcceptanceIT.java
concurrency/GameConcurrencyIT.java
concurrency/TournamentConcurrencyIT.java
integration/DemoAndRecoveryIT.java
integration/GamePersistenceIT.java
integration/LeaderboardIT.java
integration/LeaderboardWebSocketIT.java
security/GameAntiCheatIT.java
security/TournamentSecurityIT.java
support/LiveSubscription.java
support/MutableClock.java
support/PostgresSupport.java
support/TestPlayerScores.java
support/TournamentIntegrationSupport.java
support/TournamentTestConfiguration.java
unit/TournamentDomainTest.java
unit/TournamentServiceTest.java
unit/UsernameMaskerTest.java
```

Остальные файлы относительно корня репозитория:

```text
backend/pom.xml
backend/mvnw
backend/mvnw.cmd
backend/.mvn/wrapper/maven-wrapper.properties
backend/src/main/resources/application.yml
backend/src/main/resources/db/migration/V300__tournaments.sql
scripts/test-backend.ps1
docs/backend3-audit.md
docs/tournament.md
docs/acceptance-tests.md
docs/backend3-result.md
docs/backend3-test-results.json
```

Локальные Maven/PG binaries, test DB и логи находятся в игнорируемом `tmp`; jar и JUnit XML — в игнорируемом `backend/target`. Эти файлы не входят в изменения репозитория. Временный PostgreSQL после проверки остановлен.
