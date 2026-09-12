# FINAL TZ DELTA AUDIT

Дата проверки: 2026-09-12  
Режим: audit only; production-код не изменялся.

## SOURCE

- Frozen branch: `release/demo-final`
- Frozen SHA: `236fdf06fc039bd581de6535266cb7005c827042`
- Tag: `demo-final-2026-09-11`
- Source of truth: оригинальный PDF «Постановка задачи — Чемпионат России 2026 — Продуктовое программирование — Воздушный Шар».

Проверялись только буквальные и визуальные дельты, перечисленные в задаче. Auth, economy, Game Engine, WebSocket, replay/reconnect, fairness, Tournament backend, database и idempotency повторно не аудировались.

## MINI ONBOARDING CASHOUT

Requirement: PDF, стр. 7, мини-онбординг должен показывать возле «Забрать» текст `Нажми 'Забрать' до того, как шар лопнет`, анимированную стрелку, направленную на кнопку, около 4 секунд с плавным скрытием.

| Проверка | Результат | Фактическое состояние |
|---|---|---|
| TEXT | DIFFERENT | В `frontend/src/app/Gameplay.tsx:29` показано `Забрать выигрыш можно после первого уровня`. Смысл связан с доступностью cashout, но это не требуемая формулировка. |
| ANIMATED ARROW | NO | В DOM есть только текстовый блок; отдельной стрелки или animation для неё нет. Символ `↙` внутри самой кнопки не является анимированной стрелкой-подсказкой. |
| ARROW POINTS TO CASHOUT | NO | Отдельный указатель отсутствует. |
| ~4 SEC | YES | `GameHome.tsx:32` скрывает подсказку через 4000 мс с cleanup таймера. |
| FIRST RUN ONLY | YES | `GameHome.tsx:12,37-39` использует профильный ключ localStorage и не показывает подсказку повторно. |

STATUS: `REQUIRED GAP` из-за отсутствующей обязательной анимированной стрелки; текст отдельно классифицирован как `MINOR LITERAL MISMATCH`.

## MULTIPLIER VISUAL STATES

Requirement: PDF, стр. 7, коэффициент должен быть чёрным до первого уровня, жёлтым между первым и вторым, жёлтым с подсветкой между вторым и третьим, а после третьего — жёлтым с подсветкой и увеличенным шрифтом.

Проверка frozen JSX/CSS: `Gameplay.tsx:23` выводит один `<strong data-testid="multiplier">` без классов состояния; `styles/index.css:13` задаёт ему постоянный `color: var(--accent)` и постоянный `font-size: clamp(40px, 5vw, 68px)`. В CSS нет level-dependent glow или увеличения после третьего уровня.

| Состояние | Результат |
|---|---|
| BEFORE LEVEL 1 | MISMATCH — цвет темы (зелёный/красный), не чёрный. |
| LEVEL 1–2 | MISMATCH — цвет темы, не жёлтый. |
| LEVEL 2–3 | MISMATCH — нет обязательной жёлтой подсветки/glow. |
| LEVEL 3+ | MISMATCH — нет glow и отдельного увеличения шрифта. |

STATUS: `REQUIRED GAP`. Числовой рост, движение шара и markers уровней не засчитывались как замена states коэффициента.

## REWARD / RULES

Requirement: PDF, стр. 10, после каждого раунда должна быть дополнительная игровая награда; команда выбирает механику её получения и использования и объясняет её в правилах. Награда должна отображаться на result screen.

| Проверка | Результат | Фактическое состояние |
|---|---|---|
| REWARD SHOWN IN RESULT | YES | `Panels.tsx:11` выводит `Награда`; backend выдаёт тип/редкость, например `CLOUD · COMMON`. |
| RULES EXPLAIN HOW REWARD IS EARNED | NO | В `GameHome.tsx:53` есть только `Итоговые очки, бонусы и награды определяет сервер`; момент/условие получения не описаны. |
| RULES EXPLAIN WHAT REWARD IS | NO | Не объяснено, что такое `CLOUD/FEATHER/STAR/MOON/MOUNTAIN` и что означает редкость. |
| RULES EXPLAIN HOW/WHY IT IS USED | NO | В пользовательском UI нет инвентаря, коллекции или иного потребителя награды; роль в прогрессе не объяснена. |

STATUS: `REQUIRED GAP`: reward отображается, но usage mechanic не реализован/не объяснён. Отдельная документационная часть также является `DOCUMENTATION GAP`.

## ROOT README

Requirement: PDF, стр. 16, root `README.md` должен содержать запуск, стек и демонстрационные доступы; эксперт должен запустить прототип без обращения к команде.

| Проверка | Результат | Основание |
|---|---|---|
| RUN INSTRUCTIONS | PARTIAL | `README.md:26-29` содержит Docker-команду, URL и автоматический запуск миграций, но не описывает prerequisites (Docker Desktop/Compose) и не даёт пошаговой подготовки env (`.env.example` только упомянут). |
| STACK | PASS | `README.md:5-11` явно перечисляет frontend, backend, PostgreSQL/Flyway, WebSocket и Docker/Nginx. |
| DEMO CREDENTIALS | PASS | `README.md:30-32` содержит `anna/balloon1`, `maks/balloon2`, `liza/balloon3` и стартовые 5000 бонусов. |
| URL | PASS | `README.md:27` содержит frontend `http://127.0.0.1:5173` и backend `http://127.0.0.1:8080`. |

STATUS: `DOCUMENTATION GAP` (run instructions partial). Расширенная инструкция есть в `docs/demo-final/README.md`, но root README всё ещё неполон.

## RULES VS REAL GAME

Requirement: PDF, стр. 5-6 и стр. 8-10, пользовательские правила должны объяснять четыре варианта ставки, связанные boosters, списание ставки, рост коэффициента, cashout после первого уровня, crash/потерю ставки, points, активацию booster, запрет активации после cashout и reward.

RULES MATCH FINAL GAME: `PARTIAL`.

Фактические несовпадения/пропуски:

1. Правила не перечисляют четыре пары «ставка + связанный booster» и не объясняют выбор одного из четырёх фрагментов; это видно на setup screen, но не в Rules.
2. Фраза «Усиление сработает» не объясняет требуемое умножение коэффициента и дополнительные очки при активации booster.
3. Правила не объясняют получение, тип/редкость и дальнейшую роль дополнительной награды.

При этом текст корректно отражает фактические cashout/crash-сценарии: ставка списывается, cashout доступен после первого уровня, шар продолжает полёт после cashout, а ставка теряется без cashout при crash. Условие «если вы ещё не забрали выигрыш» также соответствует запрету активации будущего booster после cashout.

## GREEN / RED

Requirement: PDF, стр. 3-6 и сценарий 1 на стр. 15: GREEN и RED должны быть переключаемыми, различимыми, с 9 и 12 уровнями соответственно. Отдельный экран выбора темы не обязателен.

- GREEN/RED DISTINGUISHABLE: `PASS` — две интерактивные карточки с разными подписями, цветами, selection state и темами оформления.
- 9/12 LEVELS: `PASS` — `Gameplay.tsx:9-10` берёт `catalog.levels[theme]`, а setup/flight отображают соответствующее количество уровней.

STATUS: `PASS`. Отсутствие отдельного стартового theme screen не является gap.

## RESULT UI

Requirement: PDF, стр. 10, result screen должен визуально показывать обязательные поля для win/loss и кнопку повторной игры; на мобильном ничего существенного не должно скрываться.

| Сценарий | Результат | Проверенные поля |
|---|---|---|
| WIN RESULT VISUAL | PASS | Сумма выигрыша, cashout multiplier, потенциальный максимум, points, reward, crash context и `Играть снова` выводятся в `Panels.tsx:11`. |
| LOSS RESULT VISUAL | PASS | Потеря ставки, crash multiplier, points, reward и `Играть снова` выводятся там же; mobile CSS переводит result details в две колонки без скрытия этих полей. |

STATUS: `PASS`. Финальный acceptance record также фиксирует browser smoke и responsive coverage как PASS; это использовано только как подтверждение визуальной части, не как новый backend/E2E аудит.

## GLOBAL HISTORY VISUAL SEMANTICS

Requirement: PDF, стр. 6 и 15, история всех завершённых игр обязательна и должна включать достигнутые коэффициенты; personal history не заменяет global history.

| Проверка | Результат | Основание |
|---|---|---|
| GLOBAL HISTORY UI | PASS | `Panels.tsx:15,18` вызывает `getGlobalHistory`, явно подписывает экран «История всех игроков» / «Общая история завершённых полётов» и показывает `Cashout` или `Crash` multiplier. |
| PERSONAL HISTORY UI | PASS | Отдельная вкладка «Мои игры» вызывает `getPersonalHistory` и подписана «Только ваши завершённые полёты». |

STATUS: `PASS`. Различие режимов понятно по tab state, заголовку и подзаголовку; результаты и коэффициенты читаемы, mobile CSS оставляет multiplier/result columns.

## FINDINGS

### REQUIRED GAPS: 3

1. **Animated onboarding arrow отсутствует.**
   - Requirement: PDF стр. 7 — анимированная стрелка рядом с «Забрать», указывающая на кнопку.
   - Actual: только текстовый `cashout-onboarding`; отдельной стрелки/animation нет.
   - Severity/class: `REQUIRED GAP`.
   - Recommended minimal fix: добавить отдельный декоративный arrow element/pseudo-element с анимацией, привязанный к cashout block; сохранить текущие 4 секунды и first-run guard.
2. **Multiplier visual states не соответствуют четырём состояниям.**
   - Requirement: PDF стр. 7 — чёрный → жёлтый → жёлтый+glow → жёлтый+glow+увеличение.
   - Actual: один постоянный `var(--accent)` и один размер шрифта.
   - Severity/class: `REQUIRED GAP`.
   - Recommended minimal fix: вычислять presentation class по `currentLevel` и добавить CSS color/glow/font-size states без изменения серверной математики.
3. **Reward не имеет объяснённой/видимой роли в прогрессе.**
   - Requirement: PDF стр. 10 — команда определяет earning/use mechanics и объясняет её в Rules.
   - Actual: reward показывается в Result, но Rules дают только общую фразу про сервер; пользовательского consumer/inventory/progress use нет.
   - Severity/class: `REQUIRED GAP`.
   - Recommended minimal fix: выбрать минимальную механику (например, коллекционные фрагменты), показать её смысл/накопление в UI и описать получение/использование в Rules.

### MINOR LITERAL MISMATCHES: 1

1. Onboarding text работает функционально, но вместо требуемого `Нажми 'Забрать' до того, как шар лопнет` показывает `Забрать выигрыш можно после первого уровня`.

### DOCUMENTATION GAPS: 2

1. Root `README.md` не содержит явных prerequisites и пошаговой подготовки env; запуск описан частично, хотя расширенная инструкция есть в `docs/demo-final/README.md`.
2. Rules не перечисляют четыре stake/booster варианта и не раскрывают multiplier/points effect booster; reward documentation gap включён в REQUIRED GAP №3.

### OPTIONAL MISSING: 0

Отсутствие отдельного theme-selection screen, птиц/облаков стартового экрана, upsell и полноценной admin UI в этот delta не записывалось: PDF относит их к дополнительным возможностям либо допускает конфигурационный способ.

## EXPLICITLY NOT RE-AUDITED

AUTH, ECONOMY, GAME ENGINE, WEBSOCKET, REPLAY, FAIRNESS, TOURNAMENT BACKEND, DATABASE, IDEMPOTENCY — `ALREADY COVERED BY FINAL ACCEPTANCE` согласно `docs/demo-final/ACCEPTANCE.md` и ограничениям этой задачи.

## FINAL VERDICT

- MANDATORY GAMEPLAY STILL READY: `YES` — обязательный игровой цикл и визуальный result/history/theme flows не сломаны.
- REQUIRED UI/TEXT GAPS: `3`
- DOCUMENTATION GAPS: `2`
- OPTIONAL GAPS: `0`
- NEEDS CODE CHANGES BEFORE JURY: `YES` — для буквального соответствия нужны arrow, multiplier states и минимальная reward-use presentation.
- NEEDS ONLY MINOR POLISH: `NO` — помимо одного minor text mismatch есть обязательные визуальные/продуктовые дельты.
- PRODUCTION CODE MODIFIED: `NO`
