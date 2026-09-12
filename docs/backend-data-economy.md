# Backend: данные, экономика и интеграция

## Исходное состояние

На момент аудита origin/main указывал на 9db3b3c (Initial project structure).
Backend содержал каталоги и .gitkeep: без pom.xml, Java-кода, моделей, миграций,
security или тестов. PostgreSQL уже был описан в Compose. Код Backend №1
и его контракты не были опубликованы в доступных ветках.

Реализация сделана в локальной ветке feature/backend-data-economy, созданной
от feat/demo-login. Существующие экраны входа и профиля сохранены.

## Стек и область ответственности

Java 21, Spring Boot 3.5.16, Spring JDBC, PostgreSQL 17, Flyway, JUnit 5.
JPA/Hibernate и auto-DDL не используются. Maven можно запускать в Docker,
поэтому локальная установка Maven не обязательна.

Этот модуль сохраняет решения Game Engine, но не рассчитывает crash, рост
коэффициента, момент cashout, сумму выплаты или достижение уровней.
Game Engine и WebSocket остаются зоной Backend №1.

## Схема БД

| Таблица | Назначение |
| --- | --- |
| users | UUID, username, display_name, bonus_balance, game_score, lottery_ticket_count, created_at, updated_at |
| game_rounds | Владелец, тема, ставка, tier/уровень бустера, коэффициенты, cashout, результат, timestamps, seed/hash, config_version, optimistic version |
| economy_transactions | Журнал BET_DEBIT/WIN_CREDIT/SCENARIO8_TICKET_PURCHASE с суммой и балансами до/после |
| score_events | LEVEL/BOOSTER/CASHOUT, ключ события, очки |
| round_rewards | Одна коллекционная награда на раунд |
| game_config_versions | Исторические JSONB-конфигурации с версией и временем |
| game_config_active | Единственная ссылка на активную конфигурацию |

Отдельной GAME_HISTORY нет: история строится по завершённым game_rounds.
roundScore вычисляется из score_events, чтобы сохранение устаревшего DTO
раунда не затёрло уже начисленные очки.

Миграции, применяемые автоматически при старте:

1. V1__data_economy.sql — таблицы, FK, CHECK, уникальность, индексы.
2. V2__initial_config.sql — исходная конфигурация с pointsPerLevel=100.
3. V3__explicit_tier_and_event_constraints.sql — явное имя booster_tier,
   проверки timestamps, состояний и ключей score events.
4. V4__core_resilience_persistence.sql — durable round events, fairness and restart data.
5. V300__tournaments.sql — tournament tables and ranking state.
6. V301__tournament_core_score_bridge.sql — score projection bridge.
7. V302__frontend_catalog_stake_bounds.sql — catalog/config bounds.
8. V303__start_idempotency.sql — start-round idempotency.
9. V304__house_edge_crash_distribution.sql — persisted crash model configuration.
10. V305__scenario8_lottery_tickets.sql — ticket counter, offers and atomic purchase ledger.

Применённые миграции не редактируются; дальнейшие изменения — новыми файлами.
Flyway проверяет checksums при каждом запуске.

## Баланс, журнал и транзакции

bonusBalance и gameScore — независимые long/BIGINT, неотрицательные.
Коэффициенты — BigDecimal/NUMERIC(20,8); движок передаёт значения с точностью
не более восьми десятичных знаков. Ставка: от 1 до 1 000 000 000 бонусов.
Правило округления выплаты должен выбрать и описать Backend №1: здесь
принимается готовый целочисленный winAmount, денежные расчёты не дублируются.

Каждая операция сначала блокирует строку раунда, затем пользователя.
Одинаковый порядок блокировок применяется в balance, score и rewards.
Транзакция короткая: SELECT FOR UPDATE, проверки, запись, commit.
Транзакции никогда не живут весь полёт. Нельзя создавать внешнюю транзакцию,
которая сначала блокирует пользователя, а затем вызывает эти сервисы.

BET_DEBIT проверяет сумму и статус CREATED, затем под блокировкой пользователя
проверяет баланс, уменьшает его и создаёт receipt. При нехватке — 409
INSUFFICIENT_BALANCE и полный rollback. Проверка и UPDATE выполняются в одной
транзакции; параллельные ставки не могут увидеть один и тот же доступный баланс.

WIN_CREDIT требует сохранённый cashout, совпадение winAmount и ранее списанную
ставку. Один раунд получает максимум один WIN_CREDIT, включая нулевой выигрыш.
Math.addExact защищает long от переполнения.

UNIQUE(round_id,type) в economy_transactions гарантирует, что повторная операция
не появится даже при ошибке вызывающего кода. Повтор с той же суммой возвращает
исходный BalanceChange с replayed=true и исходным balanceAfter. Это receipt,
а не актуальный баланс: для актуального значения используйте getBalance.
Повтор с другой суммой — 409 IDEMPOTENCY_CONFLICT. Другой userId — 409
ROUND_USER_MISMATCH. Ошибки BET_ALREADY_DEBITED/WIN_ALREADY_CREDITED заменены
успешным идемпотентным ответом, а не вторым списанием.

Scenario 8 не изменяет crash-математику: только завершённый WIN с ticketCount>0
создаёт owner-only offer. Покупка атомарно списывает цену, уменьшает остаток
билетов и начисляет приз; цена и ticketCount берутся из сохранённого offer,
а не из запроса. Повтор с тем же Idempotency-Key возвращает исходный receipt.

## Очки

ScoreService предоставляет awardLevelPoints, awardBoosterPoints и
awardCashoutPoints. Вызов принимает points для совместимости с движком,
но сверяет их с конфигурацией именно этого раунда. Нельзя начислить
произвольные очки, очки недопустимого уровня или неактивированного бустера.

Ключи уникальности:

- LEVEL: (roundId, LEVEL, номер уровня).
- BOOSTER: (roundId, BOOSTER, tier 2/3/4).
- CASHOUT: (roundId, CASHOUT, 0).

Первое событие обновляет game_score; повтор возвращает ScoreChange(replayed=true).
Новые события для FINISHED отклоняются, повторы старых остаются безопасными.
Точный момент достижения уровня определяет Game Engine, а не ScoreService.

## Модель раунда и конкурентные изменения

GameRound — неизменяемый record данных. Состояния:
CREATED, RUNNING, CASHED_OUT, CRASHED, FINISHED.
Это состояния сохранения; realtime lifecycle реализует Backend №1.

RoundRepository.save принимает version=-1 для создания. После каждого save
нужно использовать возвращённый record: он содержит актуальную version,
timestamps в точности PostgreSQL и roundScore. Повторное сохранение старой
version вызывает 409 ROUND_VERSION_CONFLICT. Начальные параметры, configVersion,
зафиксированный cashout и итог нельзя перезаписать; регресс статуса запрещён.

В отличие от первоначального примера, поле выбора бустера называется
boosterTier (1–4). Реальное усиление — config.boosterValues().get(tier - 1).
Например, tier=3 может иметь значение 5 после изменения настроек.
История возвращает и boosterTier, и boosterMultiplier из версии раунда.

Не записывайте currentMultiplier каждый tick. Сохраняйте только значимые события:
создание, старт, активацию бустера, cashout, crash, окончание.

## Интеграционные интерфейсы

Все типы находятся под ru.hackathon.airballoon.

| Контракт | Реальная реализация |
| --- | --- |
| config.GameConfigProvider | PostgresGameConfigProvider |
| economy.BalanceService | PostgresBalanceService |
| game.RoundRepository | PostgresRoundRepository |
| score.ScoreService | PostgresScoreService |
| reward.RewardService | PostgresRewardService |

GameConfigProvider.getCurrentConfig() возвращает ConfigSnapshot(version,
updatedAt, config), а не голый GameConfig: версию нужно записать в раунд.
getVersion(version) читает настройки уже начатого раунда.

В economy.RoundTransactions есть три готовые атомарные границы:

- createAndDebit(created): сохраняет CREATED и списывает ставку.
- saveCashoutAndCredit(decided): сохраняет решение cashout, начисляет выигрыш
  и бонус очков за cashout.
- finishAndReward(finished): сохраняет FINISHED, проверяет/выполняет
  идемпотентное начисление выигрыша при cashout и сохраняет награду.

Поскольку ledger имеет FK на round, порядок создания — save затем debit
внутри ОДНОЙ транзакции. Это отличается от псевдокода debit затем save в задании.
При ошибке списания новый раунд также откатывается.

Facade использует optimistic locking и не скрывает конфликт версии.
После неизвестного исхода сохранения сначала перечитайте раунд. Если cashout
или finish уже зафиксирован, не пытайтесь вернуть старую version в save:
низкоуровневые debit/credit/score/reward можно безопасно повторять.

Backend №1 должен:

1. Получить snapshot один раз перед созданием раунда и сохранить его в памяти.
2. Самостоятельно определить crashMultiplier, boosterLevel и seed/hash.
3. Создать GameRound с version=-1, status=CREATED и snapshot.version().
4. Вызвать createAndDebit, затем сохранить RUNNING со startedAt.
5. На пересечении уровня вызвать awardLevelPoints с очками snapshot.config().
6. При бустере сохранить boosterActivated=true и начислить очки в одной
   короткой внешней @Transactional-операции, сохраняя порядок round -> user.
7. Принять решение cashout на сервере, вычислить целочисленный winAmount и
   вызвать saveCashoutAndCredit с актуальной version.
8. После crash сохранить его время/статус; при окончании вызвать
   finishAndReward с последней version, cashout-полями и finishedAt.
9. Продолжать полёт после cashout и не менять зафиксированную выплату.
10. На сбое процесса отдельно решить восстановление in-memory game loop.

Пример чтения:

~~~java
ConfigSnapshot snapshot = gameConfigProvider.getCurrentConfig();
GameConfig config = snapshot.config();
// Engine creates a new GameRound(..., snapshot.version(), -1, ...).
GameRound persisted = roundTransactions.createAndDebit(createdRound);
// Always keep the returned persistence version for the next save.
~~~

Расчёты cashout/краха не могут быть переданы публичным HTTP-клиентом:
мутации экономики доступны только как внутренние Java-сервисы.
У будущих engine endpoints должна быть своя проверка прав на userId.

## Конфигурация и валидация

GameConfig — immutable record, списки копируются через List.copyOf.
Исторические версии через API никогда не изменяются.
PUT создаёт новую версию и атомарно переключает единственный active pointer.
expectedVersion защищает от потери правок двух администраторов.

| Настройки | Проверка |
| --- | --- |
| gameId / gameName / gameType | латинский id до 64; имя 1–100; тип CRASH |
| active | boolean |
| greenLevelCount / redLevelCount | строго 9 / 12 |
| min / maxCrashMultiplier | 0 < min <= max <= 1 000 000; <= 8 знаков; равенство только fixed-seed |
| growthRate | конечное число 0.0001–10 |
| alpha | конечное число 0 <= alpha < 1 |
| updateIntervalMs | 16–1000 ms |
| boosterValues | четыре целых 1–100, первое=1 |
| green/redBoosterWeights | 9/12 неотрицательных целых, сумма 10 000 |
| pointsPerLevel, pointsCashoutBonus, pointsX2/X3/X4Bonus | 0–1 000 000 |
| fixedSeedEnabled / fixedSeed | включение только при app.allow-fixed-seed=true и непустом seed |

Вес 100 означает вероятность 1%; 10 000 — 100%. Это целочисленные веса,
а не float-вероятности. Само сэмплирование реализует движок.
growthRate, alpha и пределы хранятся/валидируются здесь; выбранную математическую
модель и смысл изменения этих параметров должен описать Backend №1.

Config cache намеренно отсутствует: чтение текущей версии — один запрос в начале
раунда. Поэтому инвалидация не нужна и все процессы сразу видят сохранённый PUT.
На realtime tick обращаться к провайдеру не нужно.

По умолчанию fixedSeedEnabled=false. Разрешение включать его задано в
application-demo.yml. Перед переносом demo-БД в иной профиль отключите
fixedSeedEnabled, поскольку чтение такой конфигурации вне demo будет отклонено.

## Admin API и сценарий №5

GET /api/admin/config возвращает snapshot.
PUT /api/admin/config принимает полный объект:
{ "expectedVersion": 1, "config": { ...все поля GameConfig... } }.
Оба требуют X-Admin-Token. При пустом ADMIN_TOKEN доступ закрыт.
В локальном Compose демонстрационный токен local-demo-admin; это не production-секрет.
Проверка выполняется для выбранного MVC AdminController, включая URL-кодирование пути.

PowerShell для изменения настройки в работающем локальном приложении:

~~~powershell
$api = 'http://127.0.0.1:8080/api/admin/config'
$headers = @{ 'X-Admin-Token' = 'local-demo-admin' }
$current = Invoke-RestMethod -Uri $api -Headers $headers
$current.config.pointsPerLevel = 500
$body = @{ expectedVersion = $current.version; config = $current.config } | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method Put -Uri $api -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))
~~~

Новый getCurrentConfig возвращает 500; getVersion старого раунда — 100.
Тест scenarioFiveAdminHttpToNewRoundAndOldSnapshot выполняет GET -> PUT -> GET,
создаёт новый реальный persisted round и начисляет +500 через ScoreService,
а старому раунду начисляет +100. Игровой движок в этом тесте заменён
последовательными вызовами контрактов, а не вторым realtime engine.

## История и результат

GET /api/history?page=0&size=20 — завершённые игры всех пользователей.
size ограничен 1–100, page 0–1 000 000. Сортировка finishedAt DESC, id.
items и total читаются в одном repeatable-read snapshot.
Индексы: finished_at DESC/id и user_id/finished_at.

WIN определяется наличием успешного cashout, поэтому последующий crash не
превращает победу в LOSS. Незавершённые раунды не показываются.
GET /api/rounds/{id}/result возвращает результат, коэффициенты, баланс выигрыша,
очки, configVersion и сохранённую награду. До окончания — 409 ROUND_NOT_FINISHED.
Ни результат, ни история не раскрывают server seed или crash активного раунда.

## Награды

Каждый завершённый оплаченный раунд, включая проигрыш, получает один
коллекционный предмет. Редкость: COMMON 70%, RARE 20%, EPIC 8%, LEGENDARY 2%.
COMMON даёт CLOUD или FEATHER с равными шансами; остальные — STAR, MOON, MOUNTAIN.
Предметы — коллекционный прогресс, они не меняют бонусный баланс и не дают
дополнительного множителя. UI коллекции/обмен предметов в этот модуль не входят.

SecureRandom используется только при первой генерации под блокировкой раунда.
Награда записывается с UNIQUE(round_id). Все повторы, включая параллельные,
возвращают ту же запись. GET результата не генерирует награды.
Отдельный deterministic seed для наград не вводился: воспроизводимость
повторных запросов обеспечивается сохранением выбранной награды.

## Демо и API пользователя

В профиле demo создаются anna, maks, liza с начальными 5000 бонусами и 0 очками.
UUID стабилен: UUID.nameUUIDFromBytes(UTF8("air-balloon:demo:" + username)).
ON CONFLICT(username) DO NOTHING предотвращает дубликаты и восстановление
потраченного баланса при перезапуске.

GET /api/demo/users (только demo) возвращает эти три серверных профиля и UUID.
GET /api/users/{id}/state возвращает username, displayName, bonusBalance,
gameScore, lotteryTicketCount, createdAt, updatedAt.

Существующие frontend-пароли anna/balloon1, maks/balloon2, liza/balloon3
по-прежнему демонстрационные: серверную auth/регистрацию этот модуль не добавляет.
Текущий экран профиля ещё использует клиентские demo-данные. Для интеграции
frontend должен сопоставить login с username из /api/demo/users, сохранить
userId и читать /api/users/{id}/state. Через Vite и Nginx уже настроен /api proxy.
Публичные user state endpoints — API прототипа, а не гарантия авторизации.

## Формат ошибок

{ "code": "...", "message": "...", "timestamp": "ISO-8601 UTC" }

400: INVALID_REQUEST, INVALID_GAME_CONFIG, INVALID_AMOUNT, INVALID_SCORE_EVENT,
INVALID_ROUND, INVALID_PAGINATION.
403: ADMIN_ACCESS_DENIED.
404: USER_NOT_FOUND, ROUND_NOT_FOUND, CONFIG_NOT_FOUND.
409: INSUFFICIENT_BALANCE, IDEMPOTENCY_CONFLICT, ROUND_USER_MISMATCH,
INVALID_BET, INVALID_WIN, BET_NOT_DEBITED, ROUND_VERSION_CONFLICT,
IMMUTABLE_ROUND_DATA, CONFIG_VERSION_CONFLICT, GAME_INACTIVE,
BALANCE_LIMIT, SCORE_LIMIT, ROUND_NOT_FINISHED, REWARD_NOT_READY, DATA_CONFLICT.

SQL-детали не возвращаются клиенту при нарушении ограничений.
Повторы корректных debit/credit/score/reward — успех, а не бизнес-ошибка.

## Запуск и тестирование

Из корня репозитория:

~~~bash
docker compose up -d --build --wait
~~~

По умолчанию: frontend http://127.0.0.1:5173, backend http://127.0.0.1:8080,
PostgreSQL 127.0.0.1:5432. Порты опубликованы только на loopback.
Frontend ожидает healthy backend, backend — healthy PostgreSQL.
PostgreSQL использует именованный volume; остановка Compose без -v его сохраняет.
Первая сборка требует доступ к Docker Hub и Maven Central.

Для параллельной работы с Vite на 5173:

~~~powershell
$env:FRONTEND_PORT = '5174'
$env:POSTGRES_PORT = '5433'
docker compose -p air-balloon-economy-local up -d --build --wait
~~~

Остановка этого локального стенда:
docker compose -p air-balloon-economy-local stop
(при обновлениях используйте те же FRONTEND_PORT/POSTGRES_PORT).

Тесты на отдельном настоящем PostgreSQL 17:

~~~bash
docker compose -f docker-compose.backend-test.yml -p balloon-economy-test run --rm backend-test
~~~

Либо при Java 21/Maven 3.9 и отдельной БД balloon_test: mvn -B test в backend.
Нужны DB_URL, POSTGRES_USER, POSTGRES_PASSWORD тестовой БД.
Интеграционные тесты намеренно завершаются ошибкой, если current_database()
отличается от balloon_test. Перед каждым тестом очищаются только данные этой БД.
Не направляйте тесты на рабочую БД.

Отчёты: backend/target/surefire-reports. Unit: ConfigValidatorTest;
integration: EconomyIntegrationTest. Mockito предупреждение об агенте не
является ошибкой; внешние сервисы в этих интеграционных тестах не замоканы.

Остановка тестовой БД:
docker compose -f docker-compose.backend-test.yml -p balloon-economy-test down
Тестовые данные находятся в tmpfs и будут утрачены; Maven cache volume остаётся.
Не запускайте несколько интеграционных прогонов одновременно в одном test project.

## Переменные окружения

| Переменная | По умолчанию / назначение |
| --- | --- |
| POSTGRES_DB | air_balloon |
| POSTGRES_USER | air_balloon |
| POSTGRES_PASSWORD | change_me, локальный demo |
| POSTGRES_PORT | 5432 — порт на host |
| DB_URL | JDBC URL; Compose задаёт postgres:5432 |
| BACKEND_PORT | 8080 — host в Compose, HTTP port при запуске jar |
| FRONTEND_PORT | 5173 |
| SPRING_PROFILES_ACTIVE | demo в Compose; без demo bootstrap не создаётся |
| ADMIN_TOKEN | local-demo-admin только в Compose; standalone пусто = доступ закрыт |

Swagger/OpenAPI в исходном проекте не было; REST-контракты описаны в
docs/API_CONTRACT.md. Swagger-зависимость не добавлена.

## Ограничения и передача Backend №1

Game Engine ещё отсутствует в доступной ветке. Проверена готовность Java-контрактов,
транзакций, persistence и API. Полный пользовательский полёт/cashout через
браузер невозможно проверить до подключения движка и его endpoints.

У раундов нет записи каждого tick, автоматического возобновления полёта после
падения процесса, realtime событий или фоновой финализации. Это часть engine.
Нужно согласовать имена DTO/статусы и выбранную crash-математику с коллегой.
Границы save/debit/credit должны остаться атомарными при адаптации.

Набор исходных данных не содержит вымышленных завершённых игр. Поэтому история
сразу после старта пустая; в тестах создаются раунды всех трёх пользователей.

Авторизация игроков, рейтинг, турниры, upsell, платежи и WebSocket не реализованы.
Admin UI также не входит в текущий модуль: настройка доступна через HTTP API.
