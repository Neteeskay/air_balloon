# BACKEND DATA/ECONOMY IMPLEMENTATION RESULT

Дата: 11 сентября 2026. Ветка: feature/backend-data-economy.
Результат: слой данных и экономики реализован и запущен локально.
Новых коммитов и push не выполнялось. HEAD остаётся a5ce2ea.

## 1. Исходное состояние

В доступном origin/main (9db3b3c) был только каркас backend без Java-кода,
pom.xml, migrations, entities/repositories/services/controllers, security и тестов.
PostgreSQL был описан в Compose. Backend №1 ещё не опубликован в доступных ветках.
Ветка создана от локального frontend/Docker результата feat/demo-login.

## 2. Что реализовано

Spring Boot 3.5.16 / Java 21, PostgreSQL 17 / JDBC / Flyway.
Три demo users; транзакционный баланс и журнал; идемпотентные очки;
сохранение раундов с optimistic locking; versioned config / Admin API;
глобальная пагинированная история; постоянные награды; user state API.
Docker Compose с healthchecks и proxy /api через Nginx/Vite.

## 3. Созданные файлы

- backend/.dockerignore
- backend/Dockerfile
- backend/pom.xml
- backend/src/main/java/ru/hackathon/airballoon/AirBalloonApplication.java
- backend/src/main/java/ru/hackathon/airballoon/admin/AdminAccessConfig.java
- backend/src/main/java/ru/hackathon/airballoon/admin/AdminController.java
- backend/src/main/java/ru/hackathon/airballoon/common/ApiErrors.java
- backend/src/main/java/ru/hackathon/airballoon/common/BusinessException.java
- backend/src/main/java/ru/hackathon/airballoon/common/PublicController.java
- backend/src/main/java/ru/hackathon/airballoon/config/ConfigSnapshot.java
- backend/src/main/java/ru/hackathon/airballoon/config/ConfigValidator.java
- backend/src/main/java/ru/hackathon/airballoon/config/GameConfig.java
- backend/src/main/java/ru/hackathon/airballoon/config/GameConfigProvider.java
- backend/src/main/java/ru/hackathon/airballoon/config/PostgresGameConfigProvider.java
- backend/src/main/java/ru/hackathon/airballoon/economy/BalanceChange.java
- backend/src/main/java/ru/hackathon/airballoon/economy/BalanceService.java
- backend/src/main/java/ru/hackathon/airballoon/economy/PostgresBalanceService.java
- backend/src/main/java/ru/hackathon/airballoon/economy/RoundTransactions.java
- backend/src/main/java/ru/hackathon/airballoon/game/GameRound.java
- backend/src/main/java/ru/hackathon/airballoon/game/PostgresRoundRepository.java
- backend/src/main/java/ru/hackathon/airballoon/game/RoundRepository.java
- backend/src/main/java/ru/hackathon/airballoon/history/HistoryService.java
- backend/src/main/java/ru/hackathon/airballoon/reward/PostgresRewardService.java
- backend/src/main/java/ru/hackathon/airballoon/reward/Reward.java
- backend/src/main/java/ru/hackathon/airballoon/reward/RewardService.java
- backend/src/main/java/ru/hackathon/airballoon/score/PostgresScoreService.java
- backend/src/main/java/ru/hackathon/airballoon/score/ScoreChange.java
- backend/src/main/java/ru/hackathon/airballoon/score/ScoreService.java
- backend/src/main/java/ru/hackathon/airballoon/user/DemoBootstrap.java
- backend/src/main/java/ru/hackathon/airballoon/user/DemoUsersController.java
- backend/src/main/java/ru/hackathon/airballoon/user/UserService.java
- backend/src/main/java/ru/hackathon/airballoon/user/UserState.java
- backend/src/main/resources/application-demo.yml
- backend/src/main/resources/application.yml
- backend/src/main/resources/db/migration/V1__data_economy.sql
- backend/src/main/resources/db/migration/V2__initial_config.sql
- backend/src/main/resources/db/migration/V3__explicit_tier_and_event_constraints.sql
- backend/src/test/java/ru/hackathon/airballoon/ConfigValidatorTest.java
- backend/src/test/java/ru/hackathon/airballoon/EconomyIntegrationTest.java
- backend/src/test/resources/valid-config.json
- docker-compose.backend-test.yml
- docs/backend-data-economy.md

- docs/backend-implementation-result.md (этот отчёт)

## 4. Изменённые файлы

- .env.example
- README.md
- backend/README.md
- docker-compose.yml
- docs/API_CONTRACT.md
- frontend/README.md
- frontend/nginx.conf
- frontend/vite.config.ts

Исходники, секреты пользователей и внешняя ветка Backend №1 не перезаписывались.
Новых внешних сообщений/PR/публикаций нет.

## 5–6. Database schema и migrations

users, game_rounds, economy_transactions, score_events, round_rewards,
game_config_versions, game_config_active.
Отдельная таблица истории не нужна; roundScore вычисляется из score_events.

- V1__data_economy.sql: таблицы, FK, CHECK, уникальность, индексы.
- V2__initial_config.sql: начальная конфигурация pointsPerLevel=100.
- V3__explicit_tier_and_event_constraints.sql: booster_tier и ограничения событий.

Все три применены на чистой локальной БД. flyway_schema_history: success=true
для каждой версии. Ранее применённые миграции не изменялись.

## 7–11. User, ledger, идемпотентность и защита баланса

Бонусы и очки независимы: long/BIGINT, CHECK >= 0.
Ledger сохраняет UUID операции, user/round, тип, amount, balance_before/after,
createdAt. UNIQUE(round_id,type) для BET_DEBIT/WIN_CREDIT.
Короткие транзакции блокируют round -> user; баланс проверяется под блокировкой.
Повтор возвращает исходный receipt с replayed=true. Повтор с другой суммой
отклоняется. Переполнение long также отклоняется с rollback.
Два параллельных списания по 100 при балансе 100: ровно одно успешно, баланс 0.
Два параллельных списания/начисления одного round: одна запись, одно изменение.

## 12. Score

События LEVEL/BOOSTER/CASHOUT имеют уникальные ключи round/type/event.
Очки проверяются по версии конфигурации раунда. Повторы не удваивают gameScore.
roundScore — агрегат записанного журнала, а не значение из устаревшего DTO.
Неактивированный booster, неверный уровень/points и переполнение отклоняются.

## 13–15. Конфигурация, валидация и версии

Неизменяемые records GameConfig/ConfigSnapshot, копии списков.
Новая запись версии и переключение active pointer — одна транзакция.
expectedVersion защищает одновременное редактирование.
Нет локального cache: новая конфигурация сразу видна новым раундам,
а старые читают свою configVersion.
Проверяются уровни 9/12, пределы коэффициентов и роста, веса с суммой 10000,
boosterValues, неотрицательные ограниченные очки и разрешение fixed seed в demo.

boosterTier — номер варианта 1..4, boosterMultiplier в history —
реальное усиление из исторической версии конфигурации.

## 16–17. Admin API и обязательный сценарий №5

GET/PUT /api/admin/config с X-Admin-Token.
HTTP integration test выполняет GET(100), PUT(500), GET(500), чтение provider,
создание нового persisted GameRound и начисление +500 через ScoreService.
Старому раунду по-прежнему начисляется +100.
Реальный HTTP smoke test на контейнере также выполнил 100 -> 500,
перезапустил backend, подтвердил сохранение 500, затем восстановил 100.
Локальная активная версия после проверки — 3, pointsPerLevel=100.

## 18. История

GET /api/history: раунды всех пользователей, только completed.
Пагинация 1–100, finishedAt DESC/id; items/total в repeatable-read snapshot.
Успешный cashout остаётся WIN после crash. Незавершённый раунд не попадает в список.
Начальная demo-история пустая; искусственные результаты в рабочую БД не добавлялись.

## 19. Награды

Одна сохранённая награда на завершённый оплаченный round, включая LOSS.
COMMON 70% (CLOUD/FEATHER), RARE 20% (STAR), EPIC 8% (MOON),
LEGENDARY 2% (MOUNTAIN).
Случайность применяется один раз под блокировкой; UNIQUE(round_id).
GET не генерирует награду. Повтор и параллельный запрос возвращают ту же запись.
Это коллекционный прогресс без обмена на бонусы; UI коллекции ещё отсутствует.

## 20. Демо-пользователи

| username | UUID | Начальный balance | gameScore |
| --- | --- | --- | --- |
| anna | 90132a44-8931-3c85-873b-efaa829567e6 | 5000 | 0 |
| maks | 5c8b44c2-11a6-34ac-9d70-1ebd499faf9c | 5000 | 0 |
| liza | 608adbff-35ad-3bc0-9305-58fb05f26446 | 5000 | 0 |

Bootstrap только в demo profile; ON CONFLICT не пополняет баланс и не создаёт
дубликаты после повторного запуска. Имена совпадают с frontend demo users.
Серверная auth не добавлялась; frontend пароли остаются локальной имитацией.

## 21–22. Java-контракты и REST

GameConfigProvider, BalanceService, RoundRepository, ScoreService, RewardService
имеют реальные PostgreSQL-реализации. RoundTransactions предоставляет атомарные
createAndDebit, saveCashoutAndCredit, finishAndReward.
Обязательный порядок create: save затем debit в одной транзакции из-за FK.

REST: GET /api/demo/users (demo), GET /api/users/{id}/state,
GET /api/history, GET /api/rounds/{id}/result,
GET/PUT /api/admin/config.
Новая auth, публичные мутации баланса, WebSocket и engine endpoints не добавлены.
Ошибки: единый JSON code/message/timestamp, без SQL-деталей.

## 23–25. Тесты и результаты

| Набор | Тестов | Failures | Errors | Skipped |
| --- | ---: | ---: | ---: | ---: |
| ConfigValidatorTest | 23 | 0 | 0 | 0 |
| EconomyIntegrationTest | 35 | 0 | 0 | 0 |
| Всего | 58 | 0 | 0 | 0 |

Отчёты реально выполненного прогона: backend/target/surefire-reports.
Интеграционные тесты выполнялись в Maven/Java 21 контейнере на PostgreSQL 17,
а не H2 или mock repositories.

Интеграционные проверки:

- winningRoundRemainsWinAfterCrash
- successfulCreditAndReplay
- scenarioFiveAdminHttpToNewRoundAndOldSnapshot
- sameBetParallelRetryDebitsOnce
- scoreAndBalanceAreIndependentAndLevelReplayIsSafe
- insufficientBalanceRollsBackRoundCreation
- historyIncludesAllUsersSortedAndPaginated
- rewardIsPersistedAndReadDoesNotRegenerate
- bootstrapIsIdempotentAndNeverRefillsSpentBalance
- bootstrapCreatesThreeProfilesWith5000
- parallelWinCreditsOnce
- invalidScoreEventRejected
- parallelRewardGeneratesOnlyOne
- twoParallelBetsCannotOverdraw
- fullIntegrationScenario
- scoreOverflowRollsBackWithoutEvent
- rewardAndResultUnavailableBeforeFinish
- failedFinishRollsBackRewardAndResult
- databaseEnforcesScoreRewardUniquenessAndOwnership
- debitIsAtomicAndReceiptIsSaved
- boosterAndCashoutPointsAreIdempotent
- configConcurrentEditorsCannotLoseUpdate
- configUpdatesPreserveOldRoundSnapshot
- invalidConfigAndStaleVersionRejected
- parallelLevelEventAwardsOnce
- cannotCreditWithoutCashoutOrWithWrongOwner
- userStateAndErrorApi
- duplicateWithDifferentAmountRejected
- demoListingAndEncodedAdminPath
- databaseConstraintsRejectNegativeAndDuplicateLedger
- staleRoundSaveCannotOverwrite
- sameBetSequentialRetryReturnsOriginalReceipt
- transactionFailureRollsBackCashoutBalanceAndScore
- adminRejectsAnonymousAndBadPayload
- winOverflowRollsBackWithoutLedgerEntry

Unit-проверки: корректный конфиг, 20 неверных параметров, immutable списки,
доступность fixed seed только в demo.
Пять обязательных concurrency cases проверены, дополнительно проверены
конкурентные изменения config и откаты cashout/finish/overflow.

Сквозной сценарий сервисов: баланс 1000 -> ставка100 -> 900;
level +100, booster +300 -> score400; cashout600 -> баланс1500;
завершение -> reward/history; config500 -> новый level +500.
Game Engine в этом сценарии заменён явной последовательностью вызовов контрактов.

## 26. Запуск тестов

Из корня репозитория:

~~~bash
docker compose -f docker-compose.backend-test.yml -p balloon-economy-test run --rm backend-test
~~~

Тестовая БД находится в tmpfs, имя balloon_test; перед тестами есть защитная проверка.
Нельзя одновременно запускать два прогона в одной test DB.
Для самостоятельного Maven: mvn -B test в backend с DB_URL/POSTGRES_USER/
POSTGRES_PASSWORD отдельной тестовой БД.

## 27. Запуск проекта и локальные адреса

~~~bash
docker compose up -d --build --wait
~~~

Текущий оставленный стенд запущен как air-balloon-economy-local:

- Frontend + Nginx: http://127.0.0.1:5174
- Backend health: http://127.0.0.1:8080/actuator/health
- Серверные профили: http://127.0.0.1:5174/api/demo/users
- Global history: http://127.0.0.1:5174/api/history
- PostgreSQL: 127.0.0.1:5433

Для воспроизведения этих портов в PowerShell:

~~~powershell
$env:FRONTEND_PORT = '5174'
$env:POSTGRES_PORT = '5433'
docker compose -p air-balloon-economy-local up -d --build --wait
~~~

Проверено: сборка frontend/backend, health UP, HTTP 200,
Nginx -> backend /api proxy, анонимный admin ->403, сохранение config после restart,
три неизменных demo-профиля, три успешные миграции.
Backend работает как непривилегированный Linux-пользователь.
Порты опубликованы только на loopback. Все три сервиса оставлены работающими.

## 28. Environment

POSTGRES_DB=air_balloon; POSTGRES_USER=air_balloon;
POSTGRES_PASSWORD=change_me (demo);
POSTGRES_PORT=5432 по умолчанию, на текущем стенде 5433;
BACKEND_PORT=8080; FRONTEND_PORT=5173 по умолчанию, здесь 5174;
SPRING_PROFILES_ACTIVE=demo; ADMIN_TOKEN=local-demo-admin (локальный пример).
DB_URL внутри Compose: jdbc:postgresql://postgres:5432/air_balloon.
Standalone без ADMIN_TOKEN закрывает Admin API.

## 29. Действия Backend №1

Получать ConfigSnapshot перед созданием round и хранить configVersion.
Самостоятельно считать crash/booster/cashout/win и отправлять события.
Использовать возвращённую после save version; при конфликте перечитывать round.
Сохранять start/cashout/finish через короткие атомарные границы; не вызывать
PostgreSQL на каждом tick. Не менять active snapshot в середине полёта.
Согласовать domain DTO/state machine и API с текущими контрактами.
Подробная последовательность и ограничения retries — docs/backend-data-economy.md.

## 30. Ограничения и восстановление среды

Кода Backend №1 в доступных ветках нет, поэтому реальная интеграция с его движком
и полный игровой цикл через браузер пока не проверены.
Frontend-профиль ещё показывает локальные demo-данные: user state API подготовлен
для подключения, но серверная авторизация в scope Backend №2 не входит.
Нет восстановления in-memory раунда после падения процесса, турнира, рейтинга,
upsell, платежей, Admin UI или Swagger (в исходном проекте его не было).

Во время работы Docker Desktop упал на недоступных AF_UNIX sockets.
Восстановлен переносом только служебных runtime-каталогов под резервные имена:

- C:/Users/Raisw/AppData/Local/Docker/run.stale-20260911-1428
- C:/Users/Raisw/AppData/Local/Docker/run.stale-20260911-1431
- C:/Users/Raisw/AppData/Local/docker-secrets-engine.stale-20260911-1431

Каталоги содержат прежние служебные sockets; ничего из них не удалялось.
Reset to factory defaults не выполнялся, Docker volumes и образы сохранены.
Связанное сообщение в трекере производителя:
[Сообщение о сбое Docker](https://github.com/docker/desktop-feedback/issues/460)

## 31. Итог

| Проверка | Статус | Основание |
| --- | --- | --- |
| POSTGRESQL/MIGRATIONS | PASS | Чистая БД, Flyway V1–V3 success=true |
| BALANCE | PASS | Debit/credit, недостаток, overflow, rollback |
| BET IDEMPOTENCY | PASS | Последовательные/параллельные повторы |
| WIN IDEMPOTENCY | PASS | Последовательные/параллельные повторы |
| SCORE | PASS | Отдельный счёт, события, повторы, overflow |
| GAME CONFIG | PASS | Валидация, версии, независимые snapshots |
| ADMIN CONFIG API | PASS | HTTP GET/PUT, 403, encoded path, conflict |
| HISTORY | PASS | Три пользователя, pagination/order, WIN after crash |
| REWARDS | PASS | Persist once, repeat/concurrent GET, constraints |
| DEMO USER | PASS | Три по 5000, повтор без refill/дубликатов |
| CONCURRENCY SAFETY | PASS | Все пять заданных конкурентных сценариев |
| SCENARIO 5 CONFIG CHANGE | PASS | HTTP100->500, новый round500 / старый100 |
| READY FOR GAME ENGINE INTEGRATION | YES | Реальные Java-сервисы протестированы; интеграция с кодом коллеги ещё предстоит |

Все PASS относятся к реально выполненным проверкам слоя Backend №2.
Готовность всего игрового MVP этим отчётом не заявляется.
