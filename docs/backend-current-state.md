# Air Balloon — актуальное состояние backend

Документ описывает authoritative backend с интегрированной, частично реализованной Admin Panel
в ветке `integration/backend-admin-base`. Backend-основа сохранена от
`integration/backend-complete` (`1d69c1e39147c641824d2e2913d9a8033f8bd3c5`).

## Компоненты

- Core Game: GREEN (9 уровней) и RED (12), ставки, запуск раунда, Crash, cashout, результат и история.
- Crash Math: server-side `alpha`, `minCrashMultiplier`, `maxCrashMultiplier`, версионированная конфигурация и commitment/reveal fairness.
- Booster: уровни ×1–×4; позиция и уровень доступны с начала раунда, активация и бонус считаются сервером.
- Cashout: `cashoutPreviewAmount` вычисляется backend-ом; preview и settlement используют общий `PayoutCalculator`.
- Scenario 8: WIN-only offer, атомарная покупка с идемпотентностью; отказ не меняет экономику.
- Puzzle/Profile: WIN даёт один фрагмент следующему незавершённому пазлу, LOSS — нет; `PUZZLE_1/2/3` требуют 12/8/6 фрагментов и открывают `CLOUD_SCARF`/`SPACE_HAT`/`TRAVELER_COSTUME`; wardrobe/equipment хранятся на сервере.
- Global Rating: все зарегистрированные пользователи, источник `users.game_score`, включая нулевые значения; пагинация и revision.
- Tournament: leaderboard содержит только явно зарегистрированных участников; score event не создаёт membership.
- Player Character: детерминированная post-round классификация в Result DTO. Приоритет: `BOOSTER_HUNTER` → `CLOSE_CALL` → `COLD_BLOODED` → `CAUTIOUS` → `GREEDY` → `ADVENTURER`.

## Основные API

- Auth/current user: `/api/auth/*`, `/api/current-user/profile`, `/api/current-user/wardrobe`, `/api/current-user/avatar/equipment`.
- Game: `POST /api/rounds`, `/api/rounds/{id}/cashout`, `/api/rounds/{id}/result`, `/api/rounds/{id}`, `/api/history`.
- Scenario 8: `/api/current-user/upsell/lottery-tickets/offer` и `/purchase`.
- Rating/Tournament: `/api/rating`, `/api/tournaments/{id}/leaderboard` и связанные endpoints из `docs/API_CONTRACT.md`.

Все current-user операции используют authenticated principal и проверяют ownership. Клиент не может изменить crash result, score, puzzle progress, unlock или character.

## Admin Panel — PARTIALLY IMPLEMENTED / IN DEVELOPMENT

Работают Bearer-authentication администратора, серверные сессии с SHA-256 hash/TTL/revocation,
BCrypt-пароли, demo-only `admin/admin`, audit log и REST API для current/metadata/validate,
DRAFT/activate, versions/detail/diff/rollback. Frontend доступен по `#/admin` и содержит Login,
Overview, Config Editor, Versions и Audit. Admin exception handler изолирован пакетом
`ru.hackathon.airballoon.admin` и не меняет player error contract.

Admin activation публикует новую запись в `game_config_versions` и переключает
`game_config_active`. Уже начатый раунд сохраняет свой config snapshot; новый раунд получает
новую версию. Compatibility layer сохраняет отсутствующие в текущем Admin DTO поля live-config,
включая min/max bet, update interval, fixed seed, Scenario 8 и раздельные x2/x3/x4 bonuses,
когда старый единый `pointsXNBonus` не менялся. Перед публикацией итоговый config проходит
authoritative `ConfigValidator`.

### ADMIN REMAINING WORK

| Параметр/раздел | Backend support | Frontend missing | API missing | Рекомендуемый следующий шаг |
|---|---:|---:|---:|---|
| Crash `alpha`, `minCrashMultiplier`, `maxCrashMultiplier` | YES | NO | NO | Сохранить текущий contract и расширить boundary-tests |
| GREEN/RED fixed counts и booster probabilities | YES | NO | NO | Сохранить фиксированные 9/12 уровней и basis-point mapping |
| GREEN/RED thresholds и раздельные points по уровням | Частично: thresholds приходят из deployment config, live DB хранит uniform points | YES | YES | Сначала определить authoritative live-config contract, затем добавить API/UI |
| Booster values | Backend требует ровно `[1,2,3,4]` | NO (поля есть, но значения фиксированы) | NO | Не разрешать произвольные значения без изменения engine contract |
| Scoring: `pointsPerLine`, cashout | YES | NO | NO | Текущий editor готов |
| Scoring: отдельные x2/x3/x4 bonuses | YES | YES | YES (есть только legacy `pointsXNBonus`) | Добавить три поля end-to-end; до этого untouched значения сохраняются |
| Scenario 8: enabled/minWinAmount/price/ticketCount | YES | YES | YES | Добавить DTO/metadata/storage/UI отдельной Admin-задачей; сейчас значения сохраняются |
| Min/max bet, update interval, fixed-seed controls | YES | YES | YES | Добавить только после product/security решения; сейчас значения сохраняются |
| FPS/delta | Runtime напрямую использует update interval/growth rate | Частично | Частично | Согласовать UI-поля с фактическим runtime contract |

Продолжать разработку Admin Panel следует в `feature/admin-complete`, созданной от
`integration/backend-admin-base`, а не от устаревшей `integration/admin-panel`.

## Database and tests

Миграции Flyway: `V1`–`V309`; `V306__puzzle_avatar_rewards.sql` остаётся неизменённой, а authoritative mapping обновляется через `V309__puzzle_definition_mapping.sql`,
а Admin Panel добавлена как `V307__admin_panel.sql`. Player Character и Global Rating отдельных
миграций не требуют. Integration/acceptance tests по умолчанию используют изолированный PostgreSQL
Testcontainer; внешний test DB подключается только через `TEST_DATABASE_URL`,
`TEST_DATABASE_USER`, `TEST_DATABASE_PASSWORD`.

Fresh migration `V1 → V307` и upgrade `V306 → V307` проверяются на PostgreSQL 17. Upgrade сохраняет
users, balances, rounds, score, Scenario 8 offers/tickets, Puzzle progress, wardrobe, equipment,
Global Rating source data и Tournament participants. Flyway validation проверяет отсутствие duplicate
versions/checksum errors. Production/non-demo migration не создаёт default admin credentials.

## Известные ограничения

- Полный acceptance с Docker требует доступного Docker daemon.
- Demo authentication и seed users предназначены для локального/demo профиля; production identity provider не добавляется этой сборкой.
- Admin Panel пока покрывает не все актуальные live-config параметры; полный перечень приведён в
  `ADMIN REMAINING WORK` выше.
