# Air Balloon — актуальное состояние backend

Документ описывает authoritative backend-основу ветки `integration/backend-complete`.
Admin UI и новые admin-функции в эту сборку не входят.

## Компоненты

- Core Game: GREEN (9 уровней) и RED (12), ставки, запуск раунда, Crash, cashout, результат и история.
- Crash Math: server-side `alpha`, `minCrashMultiplier`, `maxCrashMultiplier`, версионированная конфигурация и commitment/reveal fairness.
- Booster: уровни ×1–×4; позиция и уровень доступны с начала раунда, активация и бонус считаются сервером.
- Cashout: `cashoutPreviewAmount` вычисляется backend-ом; preview и settlement используют общий `PayoutCalculator`.
- Scenario 8: WIN-only offer, атомарная покупка с идемпотентностью; отказ не меняет экономику.
- Puzzle/Profile: WIN даёт один фрагмент, LOSS — нет; `SKY_JOURNEY` (6 фрагментов) открывает `CLOUD_SCARF`; wardrobe/equipment хранятся на сервере.
- Global Rating: все зарегистрированные пользователи, источник `users.game_score`, включая нулевые значения; пагинация и revision.
- Tournament: leaderboard содержит только явно зарегистрированных участников; score event не создаёт membership.
- Player Character: детерминированная post-round классификация в Result DTO. Приоритет: `BOOSTER_HUNTER` → `CLOSE_CALL` → `COLD_BLOODED` → `CAUTIOUS` → `GREEDY` → `ADVENTURER`.

## Основные API

- Auth/current user: `/api/auth/*`, `/api/current-user/profile`, `/api/current-user/wardrobe`, `/api/current-user/avatar/equipment`.
- Game: `POST /api/rounds`, `/api/rounds/{id}/cashout`, `/api/rounds/{id}/result`, `/api/rounds/{id}`, `/api/history`.
- Scenario 8: `/api/current-user/upsell/lottery-tickets/offer` и `/purchase`.
- Rating/Tournament: `/api/rating`, `/api/tournaments/{id}/leaderboard` и связанные endpoints из `docs/API_CONTRACT.md`.

Все current-user операции используют authenticated principal и проверяют ownership. Клиент не может изменить crash result, score, puzzle progress, unlock или character.

## Database and tests

Миграции Flyway: `V1`–`V306`, последняя — `V306__puzzle_avatar_rewards.sql`; Player Character и Global Rating миграций не требуют. Integration/acceptance tests по умолчанию используют изолированный PostgreSQL Testcontainer; внешний test DB подключается только через `TEST_DATABASE_URL`, `TEST_DATABASE_USER`, `TEST_DATABASE_PASSWORD`.

Upgrade path `V305 → V306` сохраняет существовавшие до V306 данны: пользователей, балансы, раунды, score и Scenario 8 tickets. V306 создаёт puzzle progress и wardrobe/equipment; их сохранность при повторном запуске проверяется persistence/recovery-тестами. Production credentials не используются тестами.

## Известные ограничения

- Полный acceptance с Docker требует доступного Docker daemon.
- Demo authentication и seed users предназначены для локального/demo профиля; production identity provider не добавляется этой сборкой.
- Frontend binding и Admin UI подключаются отдельными последующими задачами.
