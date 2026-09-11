# Acceptance и интеграционные тесты

## Что проверяется реально

Все классы `*IT` запускаются Maven Failsafe при `verify`. Tournament tests используют `@SpringBootTest(RANDOM_PORT)`, реальные HTTP-запросы и STOMP WebSocket-клиент, Spring JDBC/Flyway и PostgreSQL. Testcontainers PostgreSQL 17 Alpine — дефолтный провайдер; отсутствие Docker не превращается в silent skip. Альтернатива — явно заданный внешний **тестовый** PostgreSQL. H2 не используется.

`TournamentIntegrationSupport` подключает test-only источник готовых score snapshots и filter с `X-Test-Principal` для проверки персонализированного ответа. Эти fake проверяют адаптерные границы модуля, не доказывают готовность реального ScoreService/auth. В jar их нет. `GameAcceptanceSupport` запускает отдельный Spring context **без этих fake**, чтобы после подключения реальных Backend №1/№2 проверять именно их.

Текущий результат: 16 unit + 39 Failsafe cases = 55. Выполнено успешно 37; 18 игровых проверок BLOCKED, в обычном режиме представлены JUnit skipped. Из шести acceptance cases одна tournament acceptance выполнена, пять игровых сценариев заблокированы. Точные результаты финального запуска сохранены в [backend3-test-results.json](backend3-test-results.json).

## Обязательные сценарии 1–5

| Scenario | Автоматические assertions | Текущий статус |
|---|---|---|
| 1 Bet + Start | 1000→900; один BET_DEBIT; RUNNING; GREEN=9, RED=12; booster=2; ROUND_STARTED; cashout пока закрыт | BLOCKED |
| 2 Successful cashout | Level1 открывает cashout; server multiplier; win=bet×multiplier; один WIN_CREDIT; полёт до level2 и crash; WIN; неизменный win/balance; score, reward, history | BLOCKED |
| 3 Loss | Без cashout; FINISHED/LOSS; win=0; balance=900; level points сохранены; reward/history; нет WIN_CREDIT | BLOCKED |
| 4 x3 booster | Booster level2; after=before×3; ровно одна активация/points; boosted cashout; WIN; отдельный ранний cashout исключает поздний booster | BLOCKED |
| 5 Game config | GET/изменение/повторный GET config; старый round snapshot=100, новый=500; первый level даёт именно +100/+500; исходный config восстанавливается | BLOCKED |

Тесты написаны в `acceptance/GameScenariosIT.java`. Они **не используют случайную удачу**. `BackendAcceptanceDriver.SeedProfile` требует:

- `LATE_CRASH_AFTER_LEVEL_3`: crash после level3, пауза/шаги управляются тестом.
- `X3_BOOSTER_AT_LEVEL_2_LATE_CRASH`: booster на level2, crash позже, есть время для cashout.

Числовые fixed seeds пока не указаны: Backend №1 не предоставил crash/seed API, а придумывать seed для несуществующего движка нельзя. Backend №1 должен сопоставить эти профили своим реальным seed/demo hooks и гарантировать одинаковый crash point для control/forged запусков. `reachLevel`/`reachCrash` должны двигать настоящий engine/clock и ждать завершения его обработки. Тест не имитирует игровую математику.

## Остальные suites

| Пакет / класс | Cases | Что проверяет |
|---|---:|---|
| unit / TournamentDomainTest | 4 | Границы status, countdown, валидация domain/score |
| unit / UsernameMaskerTest | 8 | Имена, короткие/пустые, Unicode |
| unit / TournamentServiceTest | 4 | Pagination validation, 404, expiry после lock, ошибка broadcast после commit |
| integration / LeaderboardIT | 11 | HTTP API, top3/page/current, deterministic ties, masking, score versions/corrections, rollback, cutoff, join, ошибки |
| integration / LeaderboardWebSocketIT | 2 | Настоящий STOMP, changedPlayer вне top20, новое место/score/revision, отсутствие frames от rollback/duplicate |
| integration / DemoAndRecoveryIT | 2 | 24 demo users, idempotent seed, simulation on/off, реальный restart context, защита prod |
| acceptance / TournamentAcceptanceIT | 1 | 1000/900/800/700 → current 1200, позиция 4→1 через HTTP + live STOMP |
| security / TournamentSecurityIT | 3 | Анонимный join, поддельная identity, score/userId в body, клиентский SEND в topic |
| concurrency / TournamentConcurrencyIT | 2 | 50 shuffled/duplicate events одного player; 50 concurrent players; версия/score/revision/ranking |
| acceptance / GameScenariosIT | 5 | Обязательные сценарии, BLOCKED |
| security / GameAntiCheatIT | 6 | 4 forged fields с server/control проверкой, чужой cashout, cashout до level1; BLOCKED |
| concurrency / GameConcurrencyIT | 4 | 50 cashouts, 10 bets, повторные level/booster events; BLOCKED |
| integration / GamePersistenceIT | 3 | Global history трёх пользователей с WIN/LOSS/pagination, reward idempotency, полный recovery; BLOCKED |

Async проверки используют Awaitility, broker subscription registry, blocking queues, CountDownLatch и bounded Futures. `Thread.sleep` нет. Tournament ranking текущего игрока получает реальную позицию даже за пределами страницы/top20. Конкурентные score tests проверяют PostgreSQL UPSERT/row locks, не in-memory сортировку.

## Команды

Из `backend` (JDK 21):

```powershell
.\mvnw.cmd test
.\mvnw.cmd verify
.\mvnw.cmd verify -Pacceptance
```

Linux/macOS: замените `.\mvnw.cmd` на `sh mvnw`. Обычный `verify` должен быть зелёным для доступного tournament-модуля, с 18 явно объяснёнными skipped. Строгий `-Pacceptance` обязан завершаться ненулевым exit code, пока real driver отсутствует. Нельзя трактовать skipped как PASS.

Отдельно tournament suite:

```powershell
.\mvnw.cmd verify '-Dit.test=LeaderboardIT,LeaderboardWebSocketIT,TournamentConcurrencyIT,DemoAndRecoveryIT,TournamentSecurityIT,TournamentAcceptanceIT'
```

Runner из корня репозитория:

```powershell
.\scripts\test-backend.ps1 -Suite unit
.\scripts\test-backend.ps1 -Suite tournament
.\scripts\test-backend.ps1 -Suite all
.\scripts\test-backend.ps1 -Suite acceptance
```

Runner печатает `SCENARIO 1 ...` до `SCENARIO 5 ...` по новым JUnit XML, не переиспользует старый отчёт при сбое сборки. Сейчас ожидаются пять BLOCKED. Maven exit code сохраняется. В строгом режиме JUnit отображает 18 assertion failures с текстом BLOCKED — это сигнал отсутствующих prerequisites, а не 18 обнаруженных игровых багов.

По умолчанию Testcontainers сам поднимает изолированный PostgreSQL. Если Docker нет:

```powershell
$env:TEST_DATABASE_URL = 'jdbc:postgresql://127.0.0.1:55432/air_balloon_test'
$env:TEST_DATABASE_USER = 'postgres'
$env:TEST_DATABASE_PASSWORD = 'your-test-password'
.\mvnw.cmd verify
```

Нужна отдельная тестовая БД: suite удаляет tournament fixtures. Внешнюю БД тесты не запускают и не останавливают. Testcontainers container управляется test JVM/Ryuk.

На проверочной Windows-среде обнаружена ошибка JBR 21 `UnixDomainSockets.connect: Invalid argument` из-за пути temporary sockets. Для этого запуска передан JVM аргумент `-Djdk.net.unixdomain.tmpdir=<существующая папка с коротким ASCII-путём>` через Maven `-DargLine=...`. Это workaround среды, не изменение приложения. Native PostgreSQL initdb на кириллическом пути также потребовал ASCII-пути `-D` и `-L`.

## Подключение Backend №1/№2

1. Backend №1 предоставляет GameEngine, game HTTP/WebSocket контракты, deterministic seed/clock hooks, round ownership и командную идемпотентность.
2. Backend №2 предоставляет реальные users/balance/score/ledger, GameConfig API/snapshot, RoundRepository/history, reward и транзакции; реализует `PlayerScoreSource` и публикует `ScoreChanged` в общей транзакции.
3. В `src/test` реализуется **один** `BackendAcceptanceDriver`; зарегистрировать его через test `@Configuration`/`@Bean`, явно импортированную в `GameAcceptanceSupport`. Не включать его в production.
4. Driver вызывает реальные HTTP endpoints для start/cashout/config/history/leaderboard, реальные repositories для ledger/reward/score assertions. Не заменять эти модули mocks/fakes. Test fixtures/reset и deterministic stepping могут вызывать реальные сервисы напрямую.
5. `resetFixtures` очищает только выделенную test DB между game cases. После `restartApplicationPreservingDatabase` driver должен обновить base URL и ссылки на новый context, сохраняя PostgreSQL. Recovery assertions затем снова идут через актуальный driver.
6. После появления конкретных DTO имен/полей адаптировать только driver и точечные assertions для согласованного error/event vocabulary. Test допускает `ROUND_ALREADY_RUNNING` вместо `INSUFFICIENT_BALANCE` при запрещённых параллельных round; итог всё равно один debit и нулевой, не отрицательный баланс.
7. Запустить `verify -Pacceptance`; снять BLOCKED можно только после реального успешного прогона всех соответствующих cases.

До появления этих реализаций BACKEND INTEGRATION READY = NO. Проверенный tournament adapter контракт не доказывает корректность экономики, anti-cheat Game Engine или наград.
