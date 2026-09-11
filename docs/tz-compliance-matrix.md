# Матрица соответствия ТЗ

Дата аудита: 11 сентября 2026 года. Итог учитывает опубликованный во время аудита fix/backend-frontend-contracts @ 68b99ae.

## Область и правила оценки

Источником требований является оригинальное ТЗ «Постановка задачи — Чемпионат России 2026, Продуктовое программирование», 18 страниц. Требования из ТЗ отделены от пожеланий в рабочих документах проекта.

Проверенные срезы:

| Компонент | Ветка / commit | Роль |
|---|---|---|
| Базовая ветка | origin/main @ 9db3b3c | база audit-ветки |
| Backend contracts (последний срез) | origin/fix/backend-frontend-contracts @ 68b99ae | проверен diff, включая auth/owner/score/catalog и FrontendContractIT; runtime не перепроверен |
| Backend core + data/economy + tournament | origin/integration/backend-tournament @ a3d74de | основной backend-кандидат |
| Frontend | origin/fix/frontend-hardening @ f131634 | основной frontend-кандидат |
| Расширенный admin | origin/feature/admin-backend @ 5f3176b | отдельная, пока не интегрированная опция |
| Acceptance harness | origin/feature/e2e-acceptance @ aa07c46 | независимые проверки контрактов |

Статусы:

- READY — требование реализовано в проверенном коде и не имеет известного функционального разрыва.
- PARTIAL — основная часть есть, но имеется конкретный разрыв.
- MISSING — реализация не найдена.
- NEEDS REAL E2E / NEEDS FULL-APP TEST — компоненты существуют раздельно, окончательный статус требует реальной сборки после binding/merge.

Важно: в оригинальном ТЗ сценарий 5 — изменение параметров/очков через конфигурацию. Экран результата и «Играть снова» относятся к завершению сценариев выигрыша/проигрыша, а не заменяют сценарий 5.

## Итог по обязательным сценариям

| Сценарий | Статус | Итог |
|---|---|---|
| S1. Вход, выбор темы/ставки/бустера, старт | PARTIAL | Auth и каталог появились в backend; frontend binding ещё не выполнен. UI независимо выбирает 4 ставки и 4 бустера (16 комбинаций), тогда как ТЗ описывает 4 связанных варианта. |
| S2. Успешный cashout и результат | PARTIAL | Серверная механика, выплата, продолжение полёта и frontend-экран есть. Не хватает обязательного auto-return через 10 секунд и итогового «могли бы забрать больше». Расхождение roundScore исправлено в 68b99ae и ожидает реального E2E. |
| S3. Проигрыш без cashout | NEEDS FULL-APP TEST | Backend и mock-flow реализованы; требуется настоящий frontend↔backend E2E. |
| S4. Бустер ×2/×3/×4 | NEEDS FULL-APP TEST | Серверная генерация/активация и UI присутствуют; требуется реальный E2E и проверка всех трёх значений. |
| S5. Изменение pointsPerLevel | PARTIAL | Версионная DB-конфигурация и admin API реализованы; acceptance-тест проверяет старый и новый snapshot. Однако буквальный путь ТЗ — config-файл с hot reload либо admin UI — ещё не представлен эксперту; есть готовый REST/PowerShell путь. |

## Подробная матрица обязательных требований

| ID | Requirement | Required/Optional | Backend | Frontend | Test | Status | Evidence | Priority |
|---|---|---|---|---|---|---|---|---|
| S1.1 | Вход без обязательной регистрации | ОБЯЗАТЕЛЬНО | READY | PARTIAL | GameScenariosIT.scenario1; FE unit; REAL E2E pending | NEEDS FULL-APP TEST | DemoAuthController.java:27-56; real.ts:13-19 содержит waiting-заглушки | P1-01 |
| S1.2 | Несколько тестовых профилей с ненулевым балансом | ОБЯЗАТЕЛЬНО | READY | READY в mock | GameScenariosIT.scenario1; FE unit; REAL E2E pending | NEEDS FULL-APP TEST | anna/maks/liza, пароли в DemoAuthController.java:30-44; mock balance 5000 в mock.ts:12; UI профилей App.tsx:29 | — |
| S1.3 | Профиль показывает имя и баланс | ОБЯЗАТЕЛЬНО | READY | READY | GameScenariosIT.scenario1; FE unit; REAL E2E pending | NEEDS FULL-APP TEST | UserState backend; profile-panel и wallet в index.css:7 | — |
| S1.4 | Правила доступны до старта | ОБЯЗАТЕЛЬНО | N/A | READY | GameScenariosIT.scenario1; FE unit; REAL E2E pending | READY | GameHome.tsx:36 | — |
| S1.5 | GREEN — 9 уровней, RED — 12 | ОБЯЗАТЕЛЬНО | READY | READY | GameScenariosIT.scenario1; FE unit; REAL E2E pending | READY | ConfigValidator.java:20; Gameplay.tsx:7-8 | — |
| S1.6 | Выбор темы | ОБЯЗАТЕЛЬНО | READY | READY | GameScenariosIT.scenario1; FE unit; REAL E2E pending | NEEDS FULL-APP TEST | Theme в серверном раунде; Gameplay.tsx:7 | — |
| S1.7 | Ровно четыре варианта ставки | ОБЯЗАТЕЛЬНО | PARTIAL | READY в mock | GameScenariosIT.scenario1; FE unit; REAL E2E pending | NEEDS FULL-APP TEST | UI строится из catalog.stakes; 68b99ae добавил /api/game/catalog с диапазоном minimum/maximum, но не четырьмя связанными карточками | P1-01 |
| S1.8 | Ставки связаны с вариантами бустера ×1/×2/×3/×4 | ОБЯЗАТЕЛЬНО | PARTIAL | PARTIAL | GameScenariosIT.scenario1; FE unit; REAL E2E pending | PARTIAL | Gameplay.tsx:9-11 предлагает независимые selectors; GameCatalogController отдаёт диапазон и отдельные boosters | P1-01 |
| S1.9 | Недоступная по балансу ставка отключена и объяснена | ОБЯЗАТЕЛЬНО | READY | READY | GameScenariosIT.scenario1; FE unit; REAL E2E pending | NEEDS FULL-APP TEST | Сервер отклоняет недостаточный баланс; Gameplay.tsx:9 disabled/title | — |
| S1.10 | Старт активирует игру и списывает ставку | ОБЯЗАТЕЛЬНО | READY | READY в mock | GameScenariosIT.scenario1; FE unit; REAL E2E pending | NEEDS FULL-APP TEST | Транзакционный backend start/debit; GameScenariosIT.java:11-20; GameSession.start | — |
| S1.11 | Сервер авторитетен для crash, booster, payout и points | ОБЯЗАТЕЛЬНО | READY | READY как consumer | GameScenariosIT.scenario1; FE unit; REAL E2E pending | NEEDS FULL-APP TEST | RoundEngine, CrashPointGenerator, BoosterGenerator; real.ts не вычисляет исход | — |
| S1.12 | Realtime не реже 1 секунды | ОБЯЗАТЕЛЬНО | READY | READY | GameScenariosIT.scenario1; FE unit; REAL E2E pending | NEEDS FULL-APP TEST | native /ws/rounds в RealtimeConfiguration.java:33; default tick 100 ms; real reconnect в real.ts:35-52 | — |
| S2.1 | Коэффициент растёт во времени | ОБЯЗАТЕЛЬНО | READY | READY | GameScenariosIT.scenario2; FrontendContractIT; FE unit | NEEDS FULL-APP TEST | MultiplierCalculator.java:11; Flight UI | — |
| S2.2 | Cashout только после первого уровня | ОБЯЗАТЕЛЬНО | READY | READY | GameScenariosIT.scenario2; FrontendContractIT; FE unit | READY в коде | RoundEngine.java:93-110; Gameplay.tsx:27 | — |
| S2.3 | Выплата = ставка × коэффициент cashout | ОБЯЗАТЕЛЬНО | READY | READY как отображение | GameScenariosIT.scenario2; FrontendContractIT; FE unit | READY в коде | GameScenariosIT.java:30-36 | — |
| S2.4 | После cashout выплата фиксируется, шар летит до crash | ОБЯЗАТЕЛЬНО | READY | READY | GameScenariosIT.scenario2; FrontendContractIT; FE unit | READY в коде | RoundEngine не завершает раунд на cashout; Gameplay.tsx:27 | — |
| S2.5 | После cashout показать «Могли бы забрать больше» | ОБЯЗАТЕЛЬНО | READY как live state | PARTIAL | GameScenariosIT.scenario2; FrontendContractIT; FE unit | PARTIAL | Сообщение есть во время полёта, Gameplay.tsx:27, но отсутствует на ResultScreen | P1-05 |
| S2.6 | Достижение уровня даёт заметные +X points | ОБЯЗАТЕЛЬНО | READY | READY | GameScenariosIT.scenario2; FrontendContractIT; FE unit | NEEDS FULL-APP TEST | LEVEL_REACHED + pointsToAward; level-toast в index.css:13 | — |
| S2.7 | Дополнительная награда в результате | ОБЯЗАТЕЛЬНО | READY | READY | GameScenariosIT.scenario2; FrontendContractIT; FE unit | NEEDS FULL-APP TEST | HistoryService.Result + Reward; Panels.tsx:11 | — |
| S2.8 | Экран WIN: cashout/crash, выигрыш, points, reward | ОБЯЗАТЕЛЬНО | READY | READY | GameScenariosIT.scenario2; FrontendContractIT; FE unit | NEEDS FULL-APP TEST | Panels.tsx:11; score исправлен в 68b99ae, FrontendContractIT проверяет проекции | — |
| S2.9 | «Играть снова» сохраняет тему | ОБЯЗАТЕЛЬНО | N/A | READY | GameScenariosIT.scenario2; FrontendContractIT; FE unit | READY | GameHome.tsx:32 вызывает selectTheme(r.theme) | — |
| S2.10 | Через 10 секунд бездействия вернуться к теме/ставке | ОБЯЗАТЕЛЬНО | N/A | MISSING | GameScenariosIT.scenario2; FrontendContractIT; FE unit | PARTIAL | Автоперехода на result screen нет; найден только переход к результату через 1,3 с в GameHome.tsx:25 | P1-06 |
| S3.1 | Crash без cashout теряет ставку | ОБЯЗАТЕЛЬНО | READY | READY | GameScenariosIT.scenario3; mock tests | NEEDS FULL-APP TEST | GameScenariosIT.java:51-60; mock-flow LOSE | — |
| S3.2 | Очки за достигнутые уровни сохраняются | ОБЯЗАТЕЛЬНО | READY | READY как отображение | GameScenariosIT.scenario3; mock tests | NEEDS FULL-APP TEST | score_events + history; GameScenariosIT.java:60 | — |
| S3.3 | Экран LOSS: crash, points, reward, play again | ОБЯЗАТЕЛЬНО | READY | READY | GameScenariosIT.scenario3; mock tests | NEEDS FULL-APP TEST | HistoryService + Panels.tsx:11 | — |
| S4.1 | Booster level выбирает сервер до раунда и не раскрывает заранее | ОБЯЗАТЕЛЬНО | READY | READY как consumer | GameScenariosIT.scenario4; GameEngineTest | NEEDS FULL-APP TEST | BoosterGenerator; RoundView скрывает reveal до FINISHED | — |
| S4.2 | ×2/×3/×4 активируется только до cashout | ОБЯЗАТЕЛЬНО | READY | READY | GameScenariosIT.scenario4; GameEngineTest | NEEDS FULL-APP TEST | RoundEngine.java:62-69; frontend rules и visual state | — |
| S4.3 | Booster влияет на коэффициент и payout | ОБЯЗАТЕЛЬНО | READY | READY как отображение | GameScenariosIT.scenario4; GameEngineTest | NEEDS FULL-APP TEST | GameScenariosIT.java:64-77 | — |
| S4.4 | Booster добавляет points и имеет визуальную обратную связь | ОБЯЗАТЕЛЬНО | READY | READY | GameScenariosIT.scenario4; GameEngineTest | NEEDS FULL-APP TEST | score event; has-booster style и toast | — |
| S4.5 | После cashout booster больше не активируется | ОБЯЗАТЕЛЬНО | READY | READY как consumer | GameScenariosIT.scenario4; GameEngineTest | NEEDS FULL-APP TEST | engine state machine + acceptance test | — |
| S5.1 | Параметры меняются без перекомпиляции | ОБЯЗАТЕЛЬНО | PARTIAL | N/A | GameScenariosIT.scenario5; config tests | PARTIAL | pointsPerLevel работает; config validator допускает значения, которые затем отклоняет engine; admin UI/file hot reload отсутствует | P1-08 / P2-09 |
| S5.2 | Защищённый доступ к конфигурации | ОБЯЗАТЕЛЬНО | READY | N/A | GameScenariosIT.scenario5; config tests | READY | AdminAccessConfig.java:20-29, X-Admin-Token | — |
| S5.3 | Изменение pointsPerLevel применяется к новому раунду | ОБЯЗАТЕЛЬНО | READY | N/A | GameScenariosIT.scenario5; config tests | READY | GameScenariosIT.java:90-103 | — |
| S5.4 | Текущий раунд сохраняет свой config snapshot | ОБЯЗАТЕЛЬНО | READY | N/A | GameScenariosIT.scenario5; config tests | READY | GameScenariosIT.java:100-101 | — |
| X.1 | Глобальная история всех пользователей | ОБЯЗАТЕЛЬНО | READY | PARTIAL | REAL E2E pending | PARTIAL | PublicController.java:15; HistoryService.java:28-40; UI подписана «Ваши завершённые игры», mock фильтрует профиль | P1-07 |
| X.2 | Мобильная ширина 320–1920 px | ОБЯЗАТЕЛЬНО | N/A | READY в CSS | REAL E2E pending | NEEDS FULL-APP TEST | min-width 320 и breakpoints 900/600 в index.css:2,18-20 | P2-07 |
| X.3 | Chrome, Safari, Firefox | ОБЯЗАТЕЛЬНО | N/A | NOT TESTED | REAL E2E pending | NEEDS FULL-APP TEST | автоматизированной browser matrix и реального Safari-прогона не найдено | P2-07 |

## Дополнительные сценарии

| ID | Дополнительный сценарий | Backend | Frontend | Статус | Влияние на обязательный MVP |
|---|---|---|---|---|---|
| S6 | Live-рейтинг | READY | MISSING | PARTIAL | Не блокирует S1–S5 |
| S7 | Турнирная таблица | READY | MISSING | PARTIAL | Не блокирует S1–S5 |
| S8 | Upsell / предложение продукта | MISSING | MISSING | MISSING | Не блокирует S1–S5 |

Backend турнира предоставляет active tournament, leaderboard, join, top-3, currentPlayer, pagination и STOMP topic /topic/tournaments/{id}/leaderboard. Публичное обновление имеет revision и updatedAt; при пропуске revision клиент должен перечитать REST snapshot. Отдельный frontend-клиент турнира не найден.

## Архитектура, данные и надёжность

| Область | Статус | Evidence / вывод |
|---|---|---|
| Server-authoritative game engine | READY | RoundEngine, elapsed-time multiplier, deterministic threshold traversal |
| Экономика | READY | BIGINT bonus units, ledger/idempotency, atomic start/debit, payout |
| Единственный источник игровых очков | READY IN CODE / NEEDS REAL E2E | 68b99ae добавил cashoutPoints в engine snapshot; FrontendContractIT проверяет round/result/history/ledger/user/tournament |
| Provably fair MVP | READY | SHA-256 commitment до старта, reveal после crash, канонический формат и verifier |
| Независимый verifier в браузере | MISSING, optional | Node verifier и tests есть; UI честно сообщает, что client-side crypto verification ещё нет |
| Reconnect / replay | PARTIAL | backend sequence/eventId/serverTime/replay/snapshot готовы; frontend запрашивает replay, но игнорирует ответ и всегда берёт snapshot |
| Restart recovery | READY в коде | PostgreSQL snapshots/events/checkpoints + startup recovery; требуется реальный restart E2E |
| Турнирная консистентность | READY в backend | cumulative game_score + versioned projection + tournament revision |
| Admin/config | PARTIAL | DB versioning, token, old-round snapshot работают; есть разрыв validators и отсутствует буквальный UI/file workflow |
| Docker full app | NEEDS FULL-APP TEST | compose/proxy есть в backend-кандидате, но актуальный frontend находится в отдельной ветке |

## Математическая модель

Документ game-engine.md (раздел «Математика») и CrashPointGenerator/MultiplierCalculator согласованы по формулам crash и elapsed-time growth. PDF, физические страницы 8 и 14, прямо разрешает собственную модель и соответствующие ей параметры.

Фактическая реализация:

- crash = min + (max − min) × u^alpha, округление вниз до 4 знаков и clamp;
- multiplier = 1 + growthPerSecond × elapsedSeconds, затем применяется активный booster;
- переходы уровней обрабатываются по границам, поэтому редкий scheduler tick не пропускает уровень или booster;
- GREEN содержит 9 thresholds, RED — 12;
- engine snapshot фиксирует конфигурацию раунда.

Известное расхождение: versioned config хранит updateIntervalMs, но DataGameConfigAdapter.java:40-51 не передаёт его в engine/scheduler; scheduler использует deployment tick. Отдельные fps/delta в интегрированной модели отсутствуют. Отсутствие имён fps/delta само по себе не нарушение ТЗ при документированной собственной модели; неработающий updateIntervalMs — фактический разрыв. Также game-engine.md описывает floorTo2Decimals и decimal balance units, тогда как integrated DataGameConfigAdapter задаёт economyScale=0: выплата округляется до целого бонуса. Историческая инструкция «demo не требует PostgreSQL» устарела относительно текущего backend README.

## Проверки этого аудита

| Параметр из брифа | Документированная/фактическая модель | Вывод |
|---|---|---|
| alpha | distributionParameter = DB alpha, степень u в crash formula | Соответствует game-engine.md |
| min_crash_multiplier | DB minCrashMultiplier → engine minCrashMultiplier | Передаётся; диапазоны validators расходятся, P1-08 |
| max_multiplier | DB maxCrashMultiplier → engine maxCrashMultiplier | Передаётся; допустимый scale validators расходится |
| multiplier_growth_rate | DB growthRate → engine growthPerSecond | Линейный elapsed-time рост; диапазоны validators расходятся |
| fps | Нет отдельного поля; game.tick-millis задаёт server cadence, CSS отдельно анимирует UI | При собственной модели допустимо; updateIntervalMs не применяется, P2-01 |
| delta | Нет отдельного fixed-step поля; delta времени вычисляется из Clock/start timestamp | Документированная elapsed-time модель, не отсутствие роста |

Evidence paths без полного префикса в матрице относятся к проверенным деревьям: frontend/src для React/TS, backend/src/main/java для Java, backend/src/test/java для тестов. Основной полный обзор выполнен на a3d74de/f131634; исправления 68b99ae проверены по diff и исходникам regression tests.

| Проверка | Результат |
|---|---|
| Frontend npm install | PASS |
| Frontend typecheck | PASS |
| Frontend lint | PASS |
| Frontend unit tests | PASS — 5 файлов, 18 тестов |
| Frontend production build | PASS — JS 262,27 kB, gzip 81 kB; CSS 24,10 kB, gzip 6,15 kB |
| Acceptance harness TypeScript | PASS |
| Acceptance harness self-check | PASS — 9 тестов |
| Backend compile | PASS |
| Backend PostgreSQL verify | NOT RERUN — Docker daemon недоступен на хосте; повторная test compilation также упёрлась в host AccessDenied на spring-messaging jar |
| Docker Compose runtime | NOT RUN — Docker Desktop daemon/pipe недоступен, это ограничение окружения, не дефект проекта |

Исторические тестовые отчёты и repository docs учитывались только как evidence реализации, но не выдаются за независимый runtime PASS этого аудита.


## DB, realtime и тесты по каждому сценарию

| Scenario | DATABASE | REALTIME | TESTS | Итог |
|---|---|---|---|---|
| S1 | users, balances, ledger, game_rounds и core snapshots | ROUND_STARTED, /ws/rounds | GameScenariosIT.scenario1BetAndStart; FrontendContractIT catalog/auth | PARTIAL; four paired options + real binding |
| S2 | payout ledger, score_events, reward, finished round | CASHOUT_SUCCESS → CRASH → ROUND_FINISHED | scenario2SuccessfulCashout; cashoutAndBoosterScoreMatchesEveryDtoAndTournamentProjection | PARTIAL: итоговый максимум/auto-return |
| S3 | потеря ставки, level score, reward, history | CRASH → ROUND_FINISHED | scenario3Loss; noCashoutScoreMatchesRoundResultHistoryLedgerAndUserTotal | NEEDS REAL E2E |
| S4 | booster score idempotency | BOOSTER_ACTIVATED, LEVEL_REACHED | scenario4Booster; GameEngineTest | NEEDS REAL E2E |
| S5 | game_config_versions и config snapshot раунда | новые pointsToAward следующего раунда | scenario5RuntimeConfig | PARTIAL: API работает; demo workflow/validator gaps |

## Классификация и дополнительные traceability rows

Отдельный экран выбора темы — ДОПОЛНИТЕЛЬНО. Переключатель RED/GREEN на экране ставки соответствует ТЗ. Native mobile app не требуется.

| ID | Requirement | Required/Optional | Backend | Frontend | Test | Status | Evidence | Priority |
|---|---|---|---|---|---|---|---|---|
| H1 | Global history | ОБЯЗАТЕЛЬНО | READY | PARTIAL | FrontendContractIT.currentUserResultHistoryAndRoundMutationArePrincipalScoped | PARTIAL | 68b99ae PublicController; FE Panels.tsx:17 | P1-07 |
| H2 | Personal history | ДОПОЛНИТЕЛЬНО | READY в 68b99ae | MISSING отдельный real-screen | тот же FrontendContractIT | PARTIAL | /api/current-user/history, Principal scope | P3 |
| A1 | User A/B balance, round, result isolation | ОБЯЗАТЕЛЬНО (security) | READY в 68b99ae | NEEDS BINDING | FrontendContractIT owner/auth tests | NEEDS REAL E2E | CurrentUser + PublicController + RoundController | Retest closed P1-02/03 |
| G1 | Start/crash/growth/levels/cashout/booster/result | ОБЯЗАТЕЛЬНО | READY | READY mock | GameEngineTest, GameScenariosIT | NEEDS REAL E2E | RoundEngine, CrashPointGenerator, MultiplierCalculator | — |
| E1 | Debit/payout/insufficient funds/duplicate protection | ОБЯЗАТЕЛЬНО | READY | Consumer | EconomyIntegrationTest, concurrency tests | NEEDS REAL E2E | ledger + transactional adapters | — |
| F1 | Commitment, hidden seed, reveal, tamper detection | ОБЯЗАТЕЛЬНО (MVP hash/docs) | READY | READY display | FairnessTest; harness self-check PASS | READY in code | RoundFairness; FairnessView | — |
| F2 | Browser verifier | ДОПОЛНИТЕЛЬНО | Node verifier READY | MISSING | tamper self-check PASS | PARTIAL | Panels.tsx:28 | P3-03 |
| R1 | Active round backend restart recovery | ДОПОЛНИТЕЛЬНО | READY | known roundId recovery | RecoveryTest, ReconnectIT | NEEDS REAL E2E | startup recovery + PostgreSQL checkpoints | P2-05 |
| R2 | Completed results survive restart | ОБЯЗАТЕЛЬНО для выбранного durable demo | READY | Consumer | DemoAndRecoveryIT, economy tests | NEEDS REAL E2E | PostgreSQL volume + persisted rounds/score | — |
| T1 | top-3/currentPlayer/masking/timer/24 demo users | ДОПОЛНИТЕЛЬНО | READY | MISSING | TournamentAcceptanceIT, CoreTournamentDemoIT | PARTIAL | TournamentService/View, TournamentDemoUsersBootstrap | P3-04 |
| T2 | Tournament idempotency/persistence | ДОПОЛНИТЕЛЬНО | READY | MISSING | CoreTournamentScoreIntegrationIT, TournamentConcurrencyIT | PARTIAL | game_score_version + revision | P3-04 |
| W1 | Game sequence/eventId/serverTime/replay/snapshot | ЖЕЛАТЕЛЬНО (resilience) | READY | snapshot fallback | ReconnectIT, ReplayCleanupTest; FE session tests | PARTIAL | /ws/rounds; session.ts:68 | P2-02 |
| W2 | Separate tournament realtime | ДОПОЛНИТЕЛЬНО | READY | MISSING | LeaderboardWebSocketIT | PARTIAL | /ws STOMP, /topic/tournaments/{id}/leaderboard | P3-04 |
| UX1 | Mini-onboarding 4 seconds at first launch | ОБЯЗАТЕЛЬНО по тексту UI | N/A | MISSING | test absent | MISSING | PDF p.8; Gameplay.tsx:27 | P2-04 |
| UX2 | Level/booster sound | ОБЯЗАТЕЛЬНО по тексту UI, вне core-flow | N/A | MISSING | test absent | MISSING | PDF p.8; sound implementation not found | P2-10 |
| UX3 | Multiplier style by level | ОБЯЗАТЕЛЬНО по тексту UI, polish | N/A | PARTIAL | test absent | PARTIAL | PDF p.8; index.css:13 | P3-01 |
| UX4 | Loading/error/retry/accessibility | ЖЕЛАТЕЛЬНО; usable UI обязательно | READY error DTO | PARTIAL | 18 FE tests PASS | PARTIAL | catalog error может соседствовать с loader; focus/dialog/reduced motion есть; device QA pending | P2-07 |
| C1 | Full admin UI | ДОПОЛНИТЕЛЬНО | отдельная branch | MISSING | not build-verified | PARTIAL | feature/admin-backend @ 5f3176b | P3-06 |
| C2 | Config file hot reload либо admin workflow | ОБЯЗАТЕЛЬНО | REST PUT READY; file watcher отсутствует | admin UI отсутствует | API scenario5 exists | PARTIAL | PDF p.14,16; token API + PowerShell checklist | P2-09 |
| D1 | Docker + env + migrations + README | ОБЯЗАТЕЛЬНО (воспроизводимый запуск) | READY components | NOT YET INTEGRATED | runtime not run | NEEDS REAL E2E | compose healthy dependencies, PostgreSQL17, Nginx | full-app checklist |
| D2 | Architecture/math/config/features/limitations docs | ОБЯЗАТЕЛЬНО | PARTIAL | PARTIAL | source/doc comparison | PARTIAL | stale game-engine.md vs integrated adapter | P2-08 |

Турнирный update имеет revision/updatedAt, но не отдельные eventId/serverTime и не event replay. REST TournamentView содержит serverTime/revision. Это snapshot/invalidation protocol с REST resync, а не игровой sequence-протокол; отсутствие одинаковых полей само по себе не дефект.

## Путь эксперта

| Шаг | Статус |
|---|---|
| Open site | NEEDS FULL-APP TEST |
| Login | NEEDS FULL-APP TEST |
| Choose theme | READY |
| Choose stake | PARTIAL — paired options/catalog mapping |
| Start | NEEDS FULL-APP TEST |
| Play | NEEDS FULL-APP TEST |
| Cashout | NEEDS FULL-APP TEST |
| Crash | NEEDS FULL-APP TEST |
| Result | PARTIAL — максимум/auto-return |
| History | PARTIAL — global UI scope |
| Tournament | MISSING frontend, ДОПОЛНИТЕЛЬНО |

## Изменения, закрытые во время аудита

В 68b99ae добавлены стабильный AUTH_REQUIRED/401, owner checks для state/result, personal history, catalog и cashoutPoints в engine snapshot. Ранее найденные P1-02/P1-03/P1-04 закрыты в коде и вынесены из открытого счётчика; FrontendContractIT содержит соответствующие regression tests. Их runtime PASS в этом аудите не заявляется. Ни одна интеграционная ветка не изменялась аудитом.
