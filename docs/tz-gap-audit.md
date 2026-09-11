# Gap-аудит проекта Air Balloon

Дата: 11 сентября 2026 года. Последняя учтённая backend-ветка: fix/backend-frontend-contracts @ 68b99ae.

## Executive summary

Обязательное ядро игры реализовано: server-authoritative round engine, crash/cashout, boosters, экономика, points, история, fairness commitment/reveal, восстановление, runtime-конфигурация и сценарий изменения pointsPerLevel. Критических P0-дефектов в проверенных срезах не найдено.

Проект находится между состояниями «компоненты готовы раздельно» и «единое приложение проверено». Frontend fix/frontend-hardening @ f131634 полностью работает в mock-режиме, но real.ts сознательно не связывает auth и каталог. Backend fix/backend-frontend-contracts @ 68b99ae добавил /api/game/catalog, 401/owner fixes, personal history и согласованный cashout score. Catalog отдаёт диапазон ставок и отдельные бустеры; четыре связанные пары ставка/бустер ещё не представлены. Это FIX IN PROGRESS / NOT YET INTEGRATED и не является причиной блокировать текущий merge/integration.

Открытые gaps: P0 = 0, P1 = 5, P2 = 10, P3 = 5. P1-02/03/04 закрыты в новом коде и не входят в эти числа. READY IN CODE означает наличие реализации, а не выполненный здесь REAL E2E.

## Состояние модулей

| Модуль | Статус | Краткий вывод |
|---|---|---|
| AUTH | PARTIAL / FIX IN PROGRESS | Demo login/session + 401/owner fix есть в 68b99ae; real frontend adapter не подключён |
| GAME | READY IN CODE / NEEDS FULL-APP TEST | Механика S1–S4 и строгие переходы реализованы |
| ECONOMY | READY IN CODE / NEEDS REAL E2E | Debit/credit/ledger/idempotency; расхождение roundScore исправлено в 68b99ae |
| FAIRNESS | READY для MVP | Commitment/reveal + server/Node verification достаточны по минимальному требованию ТЗ |
| RECONNECT | PARTIAL | Backend replay полноценный; frontend использует безопасный snapshot fallback, но не применяет replay |
| PERSISTENCE | READY IN CODE / NEEDS RESTART TEST | PostgreSQL round state/events, balances, history, config, score |
| TOURNAMENT | PARTIAL | Backend готов; frontend S6/S7 отсутствует |
| FRONTEND | PARTIAL / NEEDS BINDING | Mock-flow готов и собирается; real auth/catalog не подключены |
| MOBILE | PARTIAL / NEEDS DEVICE TEST | Responsive CSS есть; реальных mobile/browser/performance evidence нет |
| DOCKER | NEEDS FULL-APP TEST | Backend compose и Nginx routing есть; актуальный frontend ещё в другой ветке |

## P0 — критические блокеры

Не найдено. Аудит не блокирует integration/full-app.

## P1 — серьёзные открытые gaps

Порог P0 зарезервирован для отсутствующего обязательного ядра или невозможности продолжать интеграцию. Незавершённая связка компонентов не записана как P0. Известные UX-разрывы S1/S2 требуют исправления до полного соответствия ТЗ, но не требуют останавливать merge.

### P1-01. Real frontend не связан с auth и каталогом

- Priority: P1
- Requirement: пользователь должен войти, увидеть четыре допустимые ставки и запустить реальный серверный раунд.
- Observed: frontend/src/api/real.ts:13-19 возвращает currentUser = null, а login и catalog.get направлены в waiting-заглушку. Backend demo auth и /api/game/catalog теперь существуют. Каталог задаёт диапазон minimum/maximum, а не массив четырёх ставок; UI выбирает ставки и boosters независимо, создавая 16 комбинаций вместо четырёх связанных вариантов ТЗ.
- Expected: real adapter использует /api/auth/demo-login, /api/auth/me, /api/auth/session и согласованный endpoint/contract каталога; варианты UI согласованы с серверными bounds и представлены четырьмя связанными парами стоимость/booster. Конкретный JSON-массив на сервере — рекомендуемый способ, а не отдельное требование ТЗ.
- Evidence: fix/frontend-hardening @ f131634, real.ts:13-19; fix/backend-frontend-contracts @ 68b99ae, DemoAuthController и GameCatalogController; Gameplay.tsx:9-11.
- Recommended fix: связать adapter с опубликованным контрактом, согласовать четыре пары, поля points/thresholds (новый catalog не равен frontend Catalog) и добавить adapter tests. Статус: NOT YET INTEGRATED.

### P1-05. На итоговом WIN-экране нет максимума, который можно было забрать

- Priority: P1
- Requirement: после продолжения полёта до crash пользователь должен увидеть «Могли бы забрать больше» с итоговой возможной суммой/коэффициентом.
- Observed: текст есть только в live-блоке после cashout, Gameplay.tsx:27. ResultScreen в Panels.tsx:11 показывает cashout/crash, но не потенциальный максимум.
- Expected: итоговый WIN содержит понятное сравнение фактического выигрыша и потенциального выигрыша на crash/допустимом последнем моменте.
- Evidence: fix/frontend-hardening @ f131634, Gameplay.tsx:27 и Panels.tsx:11.
- Recommended fix: уточнить серверный contract potentialWin/potentialMultiplier и отобразить его на ResultScreen.

### P1-06. Нет обязательного auto-return через 10 секунд

- Priority: P1
- Requirement: после 10 секунд бездействия на результате вернуть пользователя к выбору темы или ставки.
- Observed: GameHome.tsx:25 имеет только задержку 1,3 секунды перед открытием результата. ResultScreen переходит дальше лишь по кнопкам.
- Expected: таймер 10 секунд, очищаемый при unmount/действии пользователя; выбранная тема сохраняется.
- Evidence: fix/frontend-hardening @ f131634, GameHome.tsx:25,32; Panels.tsx:11.
- Recommended fix: добавить доступный countdown/auto-return и unit test с fake timers.

### P1-07. Глобальная история визуально и в mock выдаётся за персональную

- Priority: P1
- Requirement: обязательная общая история игр всех пользователей прототипа.
- Observed: backend /api/history действительно глобален, но UI подписан «Ваши завершённые игры»; mock.ts:111-113 фильтрует только текущий профиль.
- Expected: единая семантика «История всех игроков» и mock/real contract с одинаковым scope. Персональная история может быть отдельным необязательным фильтром.
- Evidence: PublicController.java:15; HistoryService.java:28-40; Panels.tsx:17; mock.ts:111-113.
- Recommended fix: переименовать экран и сделать mock global; при добавлении personal history не смешивать endpoints.

### P1-08. Admin сохраняет параметры, несовместимые с engine

- Priority: P1
- Requirement: изменения конфигурации должны валидироваться и применяться к новым раундам.
- Observed behavior: ConfigValidator допускает произвольные boosterValues в пределах 1–100, minCrash > 0, growthRate до 100 и scale crash до 8. DataGameConfigAdapter принимает только [1,2,3,4], а engine требует minCrash >= 1, growth <= 10 и scale <= 4. Валидный для PUT конфиг может остановить catalog/start с INVALID_GAME_CONFIG.
- Expected behavior: PUT отклоняет несовместимый config до сохранения; все объявленные editable параметры реально поддержаны.
- Evidence: ConfigValidator.java:20-30; DataGameConfigAdapter.java:40-43; game/domain/GameConfig.java:27-37, одинаковый разрыв сохраняется в 68b99ae.
- Recommended fix: единая validation policy до commit config version; тест PUT → catalog → start на граничных значениях. Отдельно реализовать editable booster values либо честно ограничить их в admin и описать отклонение от группы настроек ТЗ.

## P2 — существенный hardening

### P2-01. updateIntervalMs не управляет фактическим tick

- Priority: P2
- Requirement: документация/config должны правдиво описывать изменяемые параметры математической модели.
- Observed: versioned GameConfig хранит updateIntervalMs, но DataGameConfigAdapter.java:40-51 его не передаёт; scheduler использует deployment game.tick-millis. Поля fps/delta в интегрированной модели отсутствуют.
- Expected: либо runtime config реально управляет cadence, либо параметр удалён/помечен deployment-only и документация обновлена.
- Evidence: GameConfig.java:9-12; DataGameConfigAdapter.java:40-51.
- Recommended fix: выбрать один source of truth и добавить config-to-engine test.

### P2-02. Frontend не применяет bounded replay

- Priority: P2
- Requirement: после reconnect корректно обработать sequence gap и восстановить события.
- Observed: GameSession.recover вызывает getReplay, но игнорирует ответ и всегда загружает snapshot. Корректность сохраняется, но replay contract не используется.
- Expected: применить последовательные events, а snapshot брать при snapshotRequired/gap/ошибке.
- Evidence: frontend/src/game/session.ts:59-75.
- Recommended fix: реализовать event reducer replay и тесты duplicate/out-of-order/gap; оставить snapshot fallback.

### P2-03. Начисление points после cashout неоднозначно относительно ТЗ

- Priority: P2
- Requirement: полёт продолжается до crash, а достигнутые уровни дают points.
- Observed: проектные правила прямо говорят «После cashout очки заморожены»; engine не выдаёт последующие level/booster points. ТЗ явно запрещает позднюю активацию booster, но не так явно отменяет level points.
- Expected: зафиксированное продуктовое решение и одинаковое описание в ТЗ-mapping, rules и tests.
- Evidence: GameHome.tsx:36; RoundEngine state machine.
- Recommended fix: подтвердить с командой/жюри; при сохранении freeze описать как осознанную интерпретацию, иначе начислять только последующие level points без booster.

### P2-04. Нет 4-секундного mini-onboarding рядом с cashout

- Priority: P2
- Requirement: при первом запуске игры примерно на 4 секунды объяснить действие.
- Observed: есть постоянная подпись «Доступно после первого уровня/Зафиксировать текущий коэффициент», но отдельный timed onboarding не найден.
- Expected: одноразовая подсказка около кнопки, скрываемая через 4 секунды и не мешающая нажатию.
- Evidence: Gameplay.tsx:27.
- Recommended fix: добавить tooltip state + fake-timer/accessibility test.

### P2-05. Нет server-side discovery активного раунда пользователя

- Priority: P2
- Requirement: восстановление незавершённой игры желательно и должно быть надёжным при потере клиентского state.
- Observed: frontend хранит roundId в localStorage и может восстановить его; отдельный endpoint active round by current user не найден.
- Expected: GET /api/rounds/active или поле activeRoundId в /api/auth/me/state.
- Evidence: GameHome.tsx:18,24; backend RoundController имеет только lookup by known roundId.
- Recommended fix: добавить self-scoped discovery. Это optional recovery enhancement и не блокирует MVP.

### P2-06. Java long отображается frontend Number

- Priority: P2
- Requirement: balance/score/sequence не должны тихо терять точность.
- Observed: frontend contracts используют number, включая server long values; защита Number.isSafeInteger есть лишь для incoming event sequence.
- Expected: согласованные лимиты меньше Number.MAX_SAFE_INTEGER либо string/bigint transport для денежных/score полей.
- Evidence: frontend/src/api/types.ts; real.ts:49.
- Recommended fix: зафиксировать API bounds или перейти на decimal strings для long values.

### P2-07. Нет реального mobile/browser/performance evidence

- Priority: P2
- Requirement: 320–1920 px, Chrome/Safari/Firefox, плавная работа; рекомендовано 60 FPS на среднем смартфоне.
- Observed: responsive CSS и reduced-motion есть, но real-device, Safari/Firefox и FPS-профили не найдены.
- Expected: зафиксированный smoke на 320/375/768/1440/1920, iOS Safari/Android Chrome/Firefox и performance trace.
- Evidence: index.css:2,16-21; frontend hardening checklist покрывает viewport вручную, но не реальные устройства.
- Recommended fix: выполнить checklist после full-app binding и приложить скриншоты/метрики. Статус: NEEDS PERFORMANCE TEST, не известный runtime defect.

### P2-08. Документация модели и запуска устарела относительно integrated backend

- Priority: P2
- Requirement: описать фактическую математику, округление, стек и воспроизводимый запуск.
- Observed behavior: game-engine.md описывает floorTo2Decimals, decimal balance units, growth default 0.10 и demo без PostgreSQL. Integrated DataGameConfigAdapter использует economyScale=0, DB growth/config и PostgreSQL. Формулы crash и elapsed growth совпадают с реализацией.
- Expected behavior: единый документ разделяет standalone/dev и integrated/demo, объясняет integer bonus payout и актуальные источники параметров.
- Evidence: docs/game-engine.md, разделы «Запуск»/«Математика»; DataGameConfigAdapter.java:44-51; backend/README.md.
- Recommended fix: обновить документацию поверх full-app; явно сопоставить alpha/min/max/growth и deployment tick. Отсутствие имён fps/delta допустимо по PDF при собственной модели.

### P2-09. S5 имеет REST-путь, но не буквальный config-file/admin-UI workflow

- Priority: P2
- Requirement: PDF p.14,16 предлагает config-файл с hot reload либо административный интерфейс; эксперт проходит сценарий без помощи команды.
- Observed behavior: versioned DB config и защищённый PUT работают; file watcher и интегрированный admin UI не найдены. PowerShell-вызов из checklist позволяет менять pointsPerLevel, но не равен готовому UI/file workflow.
- Expected behavior: предоставлен самообслуживаемый путь эксперта, соответствующий выбранному варианту ТЗ.
- Evidence: AdminController.java:9-13; feature/admin-backend существует отдельно; PDF scenario5.
- Recommended fix: оформить минимальный workflow редактирования JSON с применением через API либо интегрировать уже существующий admin. Полноценная новая админка не требуется; подтвердить приемлемость REST-инструмента перед demo.

### P2-10. Нет звуковой обратной связи

- Priority: P2
- Requirement: текст UI-раздела PDF p.8 явно описывает звук при пересечении уровня; это часть полного соответствия, хотя не ломает основной игровой цикл.
- Observed behavior: звуковые assets/API в frontend не найдены.
- Expected behavior: короткие звуки уровня/booster с mute и включением после user gesture.
- Evidence: frontend source audit; PDF p.8.
- Recommended fix: добавить минимальный sound feedback и проверить mobile autoplay/mute. Не считать звук дополнительным сценарием S6–S8.

## P3 — полировка и дополнительные функции

### P3-01. Визуальное состояние коэффициента слабо меняется по уровням

- Priority: P3
- Requirement: рост риска/уровней должен быть визуально считываемым.
- Observed: multiplier меняется численно, уровни отмечаются, но отдельная ступенчатая смена стиля multiplier не найдена.
- Expected: умеренная смена цвета/интенсивности без вреда accessibility.
- Evidence: index.css:13.
- Recommended fix: вычислять presentation tier из currentLevel, сохраняя contrast и reduced motion.

### P3-03. Нет независимого fairness verifier в браузере

- Priority: P3
- Requirement: minimum ТЗ допускает hash + документацию; полный client verifier — усиление доверия.
- Observed: backend и Node verifier есть, UI только показывает commitment/reveal и честно не доверяет server verified.
- Expected: локальное SHA-256 сравнение Web Crypto API после reveal.
- Evidence: Panels.tsx:28; RoundFairness.java:15-33; scripts/verify-fairness.mjs.
- Recommended fix: перенести канонизацию в browser utility и проверить tampering vectors.

### P3-04. Нет frontend для live rating и tournament

- Priority: P3
- Requirement: S6/S7 являются дополнительными.
- Observed: backend active tournament/leaderboard/STOMP готов; React screens/client отсутствуют.
- Expected: optional leaderboard screen/top-3/current player/timer с REST resync по revision.
- Evidence: TournamentController.java:26-34; LeaderboardUpdate.java:7-10; frontend source audit.
- Recommended fix: реализовывать после стабилизации S1–S5.

### P3-05. S8 upsell отсутствует

- Priority: P3
- Requirement: дополнительный сценарий предложения продукта.
- Observed: backend/frontend flow не найден.
- Expected: неблокирующая карточка/CTA после результата, если команда выбирает этот bonus scope.
- Evidence: repository-wide search.
- Recommended fix: оставить вне MVP либо оформить отдельным feature.

### P3-06. Расширенный admin пока существует отдельно

- Priority: P3
- Requirement: web admin, rollback/diff и расширенная конфигурация желательны, но minimum закрывает config/API.
- Observed: feature/admin-backend @ 5f3176b содержит расширенный admin, однако ветка не интегрирована с current backend и не является самостоятельно build-verified.
- Expected: либо не включать её в demo и использовать обязательный token API, либо позже аккуратно перенести поверх integration/full-app.
- Evidence: feature/admin-backend tree; интегрированная ветка уже имеет AdminController/AdminAccessConfig.
- Recommended fix: не cherry-pick вслепую; сначала сравнить model/migrations и сохранить working S5.

## Закрыто новым backend-кодом, требует REAL E2E retest

Эти находки не входят в открытые P1:

| ID | Было в a3d74de/fd0846e | Исправление в 68b99ae | Проверка |
|---|---|---|---|
| P1-02 | auth/me мог превращать 401 в 503 | единый GameException AUTH_REQUIRED и mapping 401 | FrontendContractIT.missingInvalidAndExpiredSessionsHaveStable401Contract |
| P1-03 | state/result читались по чужому UUID | self routes + Principal owner checks + personal history | currentUserResultHistoryAndRoundMutationArePrincipalScoped |
| P1-04 | cashout bonus отсутствовал в roundScore | cashoutPoints в GameConfig/engine snapshot | cashoutAndBoosterScoreMatchesEveryDtoAndTournamentProjection |

Проверен source diff и regression-test assertions. Новый PostgreSQL-набор здесь не запускался. Для исторических active snapshots отдельно нужен upgrade/restart тест: изменение record GameConfig не пересчитывает автоматически старые уже завершённые данные.

## Что уже подтверждено проверками

- Frontend: typecheck, lint, 18 unit tests и production build — PASS.
- Acceptance harness: TypeScript и 9 self-checks — PASS.
- Backend main sources: compile — PASS.
- Backend full PostgreSQL verify и Docker full app в этом аудите не выполнялись: Docker Desktop daemon недоступен; повторная test compilation встретила host AccessDenied при закрытии spring-messaging jar. Это ограничение окружения, не evidence дефекта проекта.

## Full-app items, которые нельзя честно закрыть до merge/binding и реального запуска

1. Реальный cookie-session login/logout и 401 UX.
2. Mapping player catalog (bounds/themes/boosters) в четыре связанные карточки и правила.
3. S1–S4 в режиме VITE_API_MODE=real.
4. WebSocket /ws/rounds через Nginx, reconnect и sequence gap.
5. Согласованность balance/result/history/user score/tournament после cashout.
6. Restart recovery с работающим PostgreSQL.
7. Runtime S5 через admin API в поднятом compose.
8. Chrome/Firefox/Safari и реальные mobile viewports.
9. FPS/latency при настоящем realtime.
10. Tournament REST + отдельный STOMP channel после frontend-интеграции.

## Решение аудита

Аудит не должен останавливать integration/full-app: архитектура и обязательное backend-ядро достаточны для продолжения. После merge нужен короткий hardening-cycle по P1 и чек-лист реального приложения. Производственный код в audit-ветке не менялся.
