# FRONTEND ↔ FINAL CORE BINDING AUDIT

Дата повторного аудита: 2026-09-11 (Europe/Moscow)

Ветка аудита: `audit/frontend-final-core-binding`

Audit only: production-код не менялся, merge и REAL integration не выполнялись. Tournament не включён в Core blockers.

## SOURCES

```text
Backend:
integration/backend-core
fd0846e92cc8c83330c07beba682dfec60c4542f

Frontend:
fix/frontend-hardening
f131634c9fd1f2f55ed527b5b7bc1604a2278f92
```

Старый audit прочитан из `origin/audit/frontend-backend-binding:docs/frontend-backend-binding-audit.md`. Старые feature-ветки использовались только как история; все выводы ниже повторно проверены по двум закреплённым SHA.

Кроме статического чтения контроллеров, DTO, фильтров, Nginx и тестов, Final Core был собран и запущен в отдельном Compose project. Через frontend Nginx фактически подтверждены successful login, cookie, `/me`, logout и cross-user read. Временные контейнеры и volume после smoke-check удалены.

## EXECUTIVE RESULT

Final Core закрыл главные архитектурные разрывы старого аудита: появился demo login с HTTP session, один UUID Principal теперь используется Game и Economy, game amounts приводятся к целым bonus units, PostgreSQL хранит rounds/replay/checkpoints, а Nginx проксирует `/api` и `/ws`.

Немедленный REAL binding всё ещё нельзя считать полным и production-safe по пяти причинам:

1. отсутствует player-facing catalog/available-stakes contract;
2. отсутствует personal history contract, хотя текущий frontend подписывает единственный history screen как «Ваши завершённые игры»;
3. anonymous/invalid auth фактически возвращает 503 вместо заявленного 401;
4. legacy user-state и result reads не проверяют Principal/owner (проверено: session Anna читает balance Maks с HTTP 200);
5. cashout score bonus записывается в cumulative score ledger, но отсутствует в `RoundView.roundScore` и `Result.score`, тогда как global history уже включает его.

Frontend integration остаётся локализованной в существующем adapter/session слое: UI игры переписывать не нужно. Основная frontend-работа — auth/profile mapping, lossless integer/decimal boundary, replay consumption, typed errors, history semantics, fairness verifier и Docker REAL build configuration.

## OLD BLOCKERS

| Старый вывод | Статус против Final Core | Фактическое состояние |
| --- | --- | --- |
| Login/current user отсутствуют | **RESOLVED BY FINAL CORE** | Есть `POST /api/auth/demo-login`, `GET /api/auth/me`, `DELETE /api/auth/session`, `JSESSIONID` и UUID Principal. Новый defect: auth failures становятся 503, см. Errors. |
| Game/Economy identity не связана | **RESOLVED BY FINAL CORE** | Session UUID передаётся в `GameService`; start создаёт/debit-ит round того же user. `CoreIdentityIntegrationTest` это проверяет. |
| Money types не согласованы | **CHANGED** | Core выбрал целые bonus units: `economyScale=0`, PostgreSQL `BIGINT`, `RoundingMode.UNNECESSARY`; win округляется вниз до целого. Frontend всё ещё использует `number`, поэтому нужен adapter/type change. |
| Balance не principal-scoped | **CHANGED** | Безопасный current balance уже есть внутри principal-scoped `GET /api/auth/me`. Но `GET /api/users/{id}/state` остаётся публичным и позволяет читать другого user; frontend не должен использовать его в REAL mode. Core должен закрыть/ограничить legacy route до production exposure. |
| Personal history отсутствует | **STILL OPEN** | Final Core предоставляет только global `GET /api/history`; фильтра по Principal/user нет. |
| Production WebSocket proxy отсутствует | **RESOLVED BY FINAL CORE** | Core `frontend/nginx.conf` проксирует `/ws/` с HTTP/1.1, Upgrade и Connection, cookies идут стандартным proxy forwarding. |
| Fairness mapping отсутствует | **CHANGED** | Commitment/reveal DTO и modal уже совместимы по смыслу; frontend не хранит `algorithm/format` и не выполняет independent verification. |
| Replay consumption incomplete | **STILL OPEN** | Hardened `GameSession.recover()` вызывает replay, но игнорирует `events` и `snapshotRequired`, затем всегда загружает snapshot. Это безопасный, но неполный fallback. |
| Game catalog отсутствует | **STILL OPEN** | Public player catalog и список ставок отсутствуют. Admin config не является browser contract и требует secret admin token. |
| Durable active-round/replay storage не интегрирован | **RESOLVED BY FINAL CORE** | Production profile использует PostgreSQL snapshot/checkpoint/event adapters и startup recovery. |
| Nginx reconnect path не доказан | **RESOLVED BY FINAL CORE** | `/ws/rounds` route и Upgrade proxy существуют; cookie попадает в handshake. Browser Origin должен совпасть с `game.allowed-origins`. |
| Auth errors имеют ожидаемые статусы | **NEW ISSUE** | Live smoke: anonymous `/api/auth/me`, invalid password и `/me` после logout вернули `503 INTEGRATION_UNAVAILABLE`, не 401. Catch-all `ApiExceptionHandler` перехватывает `ResponseStatusException`. |
| Current history UI однозначно global/personal | **NEW ISSUE** | Adapter вызывает global history, строки показывают `@username`, но subtitle говорит «Ваши завершённые игры». Нужно выбрать и явно назвать screen; personal contract сейчас отсутствует. |
| Per-round points согласованы между live/result/history | **NEW ISSUE** | `CASHOUT_SUCCESS` вызывает `awardCashoutPoints` в score ledger, но engine roundScore не меняется. `Result.score` читает сохранённый roundScore, а history суммирует score_events; значения расходятся на cashout bonus. |

## CONTRACT MATRIX

| Boundary | Status | Summary |
| --- | --- | --- |
| AUTH | **CORE CHANGE** | Endpoints/session готовы, frontend adapter отсутствует; Core должен вернуть реальные 401 для invalid/expired session. |
| CURRENT USER | **CORE CHANGE** | `/me` и UUID готовы; нужен UserState→User/Wallet mapper и исправление anonymous status. |
| BALANCE | **ADAPTER CHANGE** | Читать current balance из `/api/auth/me`, убрать path identity из frontend interface; legacy cross-user endpoint требует hardening до production. |
| CATALOG | **MISSING** | **CORE CONTRACT MISSING**: player config и enumerated stakes не опубликованы. |
| START ROUND | **ADAPTER CHANGE** | URL/method/field names совпадают; нужны integer request boundary, Round DTO mapper и typed errors. |
| CASHOUT | **ADAPTER CHANGE** | HTTP contract совпадает; нужны lossless result mapping и code-aware ambiguous-response recovery. |
| SNAPSHOT | **ADAPTER CHANGE** | DTO shape совпадает; нужны raw→UI normalization и exact numeric representation. |
| REPLAY | **FRONTEND CHANGE** | Route/DTO готовы; `events` и `snapshotRequired` не используются. |
| GAME WS | **CORE CHANGE** | Route/envelope/events готовы, но CASHOUT_SUCCESS/round snapshot не несут authoritative cashout score bonus; также нужны frontend mapping/validation и Origin alignment. |
| RESULT | **CORE CHANGE** | DTO почти совпадает, но endpoint не owner-scoped и `score` расходится с history/cumulative ledger после cashout. |
| GLOBAL HISTORY | **ADAPTER CHANGE** | Endpoint готов; нужно lossless mapping и честная global label. |
| PERSONAL HISTORY | **MISSING** | **CORE CONTRACT MISSING** и отдельный frontend method отсутствуют. |
| FAIRNESS | **FRONTEND CHANGE** | Core proof готов; frontend type/verifier неполны. |
| RECONNECT | **FRONTEND CHANGE** | Buffer/snapshot skeleton готов; replay branch, eventId validation и auth-expiry handling нужны. |

```text
AUTH: CORE CHANGE
CURRENT USER: CORE CHANGE
BALANCE: ADAPTER CHANGE
CATALOG: MISSING
START ROUND: ADAPTER CHANGE
CASHOUT: ADAPTER CHANGE
SNAPSHOT: ADAPTER CHANGE
REPLAY: FRONTEND CHANGE
GAME WS: CORE CHANGE
RESULT: CORE CHANGE
GLOBAL HISTORY: ADAPTER CHANGE
PERSONAL HISTORY: MISSING
FAIRNESS: FRONTEND CHANGE
RECONNECT: FRONTEND CHANGE
```

## AUTH AND CURRENT USER

### Actual Final Core contract

| Action | Contract | Response/session |
| --- | --- | --- |
| Login | `POST /api/auth/demo-login`, JSON `{"username":"anna","password":"balloon1"}` | `200 UserState`; creates servlet HTTP session |
| Current user | `GET /api/auth/me` | `200 UserState` for session Principal |
| Logout | `DELETE /api/auth/session` | `200` with empty body; invalidates session |
| Session transport | Cookie | live response: `JSESSIONID=...; Path=/; HttpOnly` |

`UserState`:

```text
userId: UUID
username: string
displayName: string
bonusBalance: long / JSON integer
gameScore: long / JSON integer
createdAt: ISO-8601
updatedAt: ISO-8601
```

Demo auth exists only under Spring profile `demo`. Valid credentials are currently the same names/passwords shown by MOCK, but in REAL mode they are server credentials, not client-side identity. The browser must never send `anna`, `maks` or `liza` as Principal/userId.

### Session behavior

- Hardened `request()` already uses `credentials: 'include'`: **MATCH**.
- Same-origin WebSocket automatically sends `JSESSIONID`: **MATCH**.
- Session survives SPA navigation and browser refresh while the backend process retains the servlet session.
- Cookie is a browser-session cookie (no Max-Age in the live response).
- Servlet session storage is in-process; it does **not** survive backend/container restart. Durable balance/history/round data survives, but the user must login again after a restart unless Spring Session is added later.
- Core Nginx forwards request Cookie and response Set-Cookie by default; no manual cookie header is needed.

### Frontend adapter comparison

Current `frontend/src/api/real.ts` deliberately has:

```text
demos: []
currentUser: () => null
login: waiting
logout: no-op
```

Required mapping in that file:

```text
login(login, password)
→ POST /api/auth/demo-login { username: login, password }
→ map UserState.userId to User.id

currentUser()
→ GET /api/auth/me
→ 401 means null on initial boot
→ other errors remain visible/retryable

logout()
→ DELETE /api/auth/session
→ accept an empty 200 response (do not call response.json())
```

`UserState → User`:

```text
id       ← userId (canonical UUID)
login    ← username
name     ← displayName
initials ← presentation-only derivation from displayName
color    ← presentation-only stable palette/hash; never identity
```

Status: **CORE CHANGE REQUIRED** for correct 401 behavior, then **ADAPTER CHANGE**.

### Exact mock-identity replacement point

The replacement belongs in `frontend/src/api/real.ts`, not in screen components. `auth.login()` and `auth.currentUser()` must return the mapped canonical UUID as `User.id`. Existing `GameHome` then naturally uses it in:

```text
air-balloon-active-real-${user.id}
```

and scopes local active-round recovery per authenticated UUID. `frontend/src/api/demoUsers.ts` remains MOCK-only; `auth.demos: []` in REAL mode already prevents those local records from being offered as authority.

For stronger type safety, change `economy.getBalance(id)` to `economy.getBalance()` and have it read `/api/auth/me`. This removes the last opportunity for a screen to supply an arbitrary identity.

## BALANCE / ECONOMY / MONEY

### Actual Core behavior

- Economy balance, stake, payout and score persistence use `long/BIGINT`.
- Production `DataGameConfigAdapter` sets `economyScale=0`.
- Fractional stake is rejected as `400 INVALID_BET`.
- `DataBalanceAdapter` uses `setScale(0, RoundingMode.UNNECESSARY).longValueExact()`.
- Payout is calculated only by `RoundEngine`, rounded down to zero decimal places, then credited idempotently once.
- Start creates the round and debit atomically; insufficient balance produces `409 INSUFFICIENT_BALANCE` without debit.
- Same cashout key cannot credit twice.
- Cashout score bonus is persisted idempotently in `score_events`/`users.game_score`, but the engine's per-round score is not updated; this mismatch is detailed under Result.

### Required frontend representation

Authoritative bonus amounts should be stored in frontend DTO/domain state as **string integer**, with `BigInt` used for comparison and formatting. Do not store them as JS `number`.

Recommended boundary:

```text
type IntegerAmount = string   // canonical /^0|[1-9][0-9]*$/
wire JSON numeric token
→ lossless JSON parser
→ canonical decimal integer string
→ BigInt only for affordability/comparison/formatting
```

Why string rather than plain integer `number`: Core fields are Java `long`; a future balance can exceed `Number.MAX_SAFE_INTEGER`. Native `JSON.parse` loses precision before a mapper sees the value, so `real.ts` needs a lossless JSON parser (and corresponding package/lock change) or Core must deliberately serialize long values as strings. No floating-point operation may decide affordability, payout, balance or score.

Multipliers are server `BigDecimal` (up to four decimals) and should likewise cross the REAL adapter as canonical decimal strings or a decimal value object. Conversion to `number` is acceptable only for non-authoritative animation/position after the exact value has been retained.

Frontend must display `winAmount`, `cashoutMultiplier`, `crashMultiplier`, `roundScore` and final reward from server Round/result/event data. It must not calculate authoritative payout. A client-side multiplication may appear only in tests/diagnostics and may not drive UI or balance.

### Balance endpoint choice

Use principal-scoped `GET /api/auth/me` for initial and refreshed Wallet:

```text
Wallet.bonusBalance ← UserState.bonusBalance
Wallet.gameScore    ← UserState.gameScore
```

Do not call `GET /api/users/{id}/state` from REAL browser code. Live proof showed Anna's session can read Maks's state with 200. Core should restrict or remove this legacy player route before production exposure even if the frontend no longer calls it.

Ledger mutations are internal only; there is no public debit/payout endpoint, and frontend does not need one.

## STAKE / PLAYER CATALOG

Status: **CORE CONTRACT MISSING**.

Final Core has versioned admin config at `GET /api/admin/config`, protected by `X-Admin-Token`. It must not be called from the browser and the token must never enter the bundle. Core also has engine min/max bet defaults, but no public player endpoint and no enumerated valid stake list.

Minimum player-facing read contract needed (route name is intentionally not invented here):

```text
configVersion
active
currencyUnit = BONUS
amountScale = 0
stakes: integer[]              // exact selectable values
boosters: [1,2,3,4]
themes.GREEN.levelThresholds   // exactly 9
themes.RED.levelThresholds     // exactly 12
pointsPerLevel
cashoutPoints
boosterPoints: {2,3,4}
minBet / maxBet                // validation metadata, not a substitute for stakes
serverTime
```

Balance restriction is computed only for presentation by comparing each catalog stake to the latest current-user balance using `BigInt`; start remains server-authoritative and still handles 409 races.

Until this contract exists, REAL Setup must remain blocked with a clear «Конфигурация игры недоступна» state. Do not copy MOCK stakes or call Admin API.

## GAME HTTP CONTRACTS

### START ROUND

| Item | Frontend hardened | Final Core | Status/change |
| --- | --- | --- | --- |
| URL/method | `POST /api/rounds` | `POST /api/rounds`, 201 | **MATCH** |
| Auth | `credentials: include` | UUID Principal from session | **MATCH** after login adapter |
| Request | `theme, betAmount, boosterMultiplier` | same names; strict JSON | **ADAPTER CHANGE**: integer amount serialization |
| Theme | `GREEN/RED` | `GREEN/RED` | **MATCH** |
| Booster | selected 1/2/3/4 | exactly 1/2/3/4 | **MATCH** |
| Round id | expects `id` and `roundId` | both fields, same UUID | **MATCH** |
| Commitment | `fairnessCommitment` | present at start | **MATCH** |
| Initial snapshot | `Round` | full `RoundView`, status RUNNING, sequence 1 | **ADAPTER CHANGE**: raw DTO normalization |

Start is not idempotent and must never be automatically retried. The current `GameSession.start()` already respects this. On an ambiguous network failure, recover a known returned round only if a roundId was received; otherwise refresh current balance/current active-round contract if Core adds one, or ask the user to retry explicitly after reconciliation.

### CASHOUT

Actual contract:

```text
POST /api/rounds/{roundId}/cashout
body: empty (even {} is rejected)
Idempotency-Key: UUID (optional in Core, required by frontend policy)
200 RoundView
```

The frontend route, empty body and UUID header already match. `GameSession` creates one `crypto.randomUUID()` per round and reuses it: **MATCH**.

Semantics to preserve:

- first success fixes multiplier and integer `winAmount` on the server;
- the flight continues until crash/FINISHED;
- same successful key returns the original cashout snapshot, even after crash, with fresh `serverTime`;
- different key or no key after success returns `409 ALREADY_CASHED_OUT` or `ROUND_ALREADY_CRASHED`;
- invalid UUID header returns `400 INVALID_REQUEST`;
- on `503 INTEGRATION_UNAVAILABLE`, the command may have committed; load snapshot first, then retry only with the same key if still appropriate;
- UI must use returned/snapshot server values and never recompute payout.

Status: HTTP **MATCH**, REAL DTO/error adapter **ADAPTER CHANGE**.

### SNAPSHOT

`GET /api/rounds/{roundId}`, owner-only, returns authoritative `RoundView` after advancing the round to server time.

| Semantic field | Core field | Hardened frontend | Status |
| --- | --- | --- | --- |
| Identity | `id`, `roundId` | both required | MATCH |
| Lifecycle | `status` | RUNNING/CASHED_OUT/CRASHED/FINISHED | MATCH |
| Theme/stake | `theme`, `betAmount` | same | ADAPTER CHANGE for amount |
| Multiplier/level | `currentMultiplier`, `currentLevel`, `totalLevels`, `levelThresholds` | same | ADAPTER CHANGE for decimals |
| Booster | `boosterMultiplier`, optional `boosterLevel`, `boosterActivated` | same | MATCH |
| Cashout | `cashoutAvailable`, `cashoutPerformed`, optional `cashoutMultiplier`, `cashoutAt`, `winAmount` | all except `cashoutAt` retained | Compatible; optionally retain time |
| Result | optional `outcome`, `crashMultiplier`, `finishedAt` | same meanings | MATCH (`outcome=CASHED_OUT|LOSS`) |
| Ordering | `sequence` | same | MATCH |
| Time | `timestamp`, `serverTime`, `startedAt`, optional crash/cashout/finish times | core subset represented | Compatible |
| Fairness | `fairnessCommitment`, optional `fairnessReveal` | same concept | FRONTEND type extension needed |

`timestamp` is state/event logical time; `serverTime` is observation/response time. Local `Date.now()` cannot decide crash or cashout availability.

### REPLAY

Actual route and DTO already match the TypeScript names:

```text
GET /api/rounds/{roundId}/events?afterSequence=N
→ roundId
→ events[]
→ oldestAvailableSequence
→ latestSequence
→ snapshotRequired
→ serverTime
```

Current hardened behavior:

```text
GET replay (response ignored)
→ GET snapshot unconditionally
→ install snapshot
→ drain buffered WS events
```

It is correctness-safe because snapshot is authoritative, but it does not consume the advertised replay contract and cannot distinguish a complete tail from retention loss.

Required future algorithm in `frontend/src/game/session.ts`:

```text
gap detected / socket reconnected
↓
open WS, wait CONNECTION_READY, buffer incoming events
↓
GET replay(after=current sequence)
↓
if snapshotRequired == false and events form a contiguous tail:
    validate roundId, sequence and eventId
    apply events strictly in sequence
else:
    GET snapshot
    replace cumulative UI state and cursor
↓
sort/drain WS buffer
drop wrong-round and sequence <= cursor
if another gap appears: repeat replay/snapshot recovery
↓
resume live WS
```

For initial restoration with no trusted in-memory snapshot/cursor, open/buffer WS and load snapshot first. `eventId` must equal `${roundId}:${sequence}`. Never advance the cursor across a gap and never synthesize missed business effects.

### RESULT

Actual endpoint:

```text
GET /api/rounds/{roundId}/result
```

Actual result fields:

```text
roundId
result: WIN | LOSS
betAmount: integer
cashoutMultiplier: decimal, optional
crashMultiplier: decimal
winAmount: integer
score: integer
configVersion
reward: { id, roundId, userId, type, rarity, createdAt }
```

Frontend `Result` omits `configVersion` and most reward metadata; that is compatible if raw DTO is validated and intentionally mapped. `ResultScreen` currently renders stake/payout/crash/points/booster from final `Round` and uses result only for reward. Final Round is authoritative, but the integration should validate matching `roundId` and prefer the completed Result DTO for result-specific fields, while retaining Round booster state.

Security defect: `PublicController.result()` accepts only path UUID and does not compare the saved round owner with Principal. Core must make this endpoint owner-scoped before production binding.

Score consistency defect:

```text
CASHOUT_SUCCESS
→ PostgresRoundEventStore.awardCashoutPoints(...)
→ score_events + users.game_score include pointsCashoutBonus

but

RoundEngine/GameRound.roundScore does not add that bonus
→ RoundView.roundScore excludes it
→ persisted game_rounds.round_score excludes it
→ Result.score excludes it

while

global HistoryService.Entry.roundScore = SUM(score_events)
→ includes it
```

Core must publish one coherent per-round score. Preferred minimal fix: make the cashout transition carry authoritative `pointsToAward`, update the cumulative `roundScore` exactly once in the engine snapshot, and keep score-ledger insertion idempotent from the same event. At minimum, RoundView, Result and History must agree after cashout. Frontend must never infer/add the configured bonus on its own.

Status: payload **ADAPTER CHANGE**; authorization and score coherence **CORE CHANGE REQUIRED**.

## GAME WEBSOCKET

### Route, auth and envelope

```text
Browser route: /ws/rounds
Protocol: native JSON WebSocket (not STOMP)
Auth: JSESSIONID → servlet Principal → UUID
Direction: server events only; client text closes with policy violation 1008
```

First frame is service-only:

```json
{"type":"CONNECTION_READY"}
```

All round events have:

```text
type
roundId
sequence
eventId = roundId + ":" + sequence
timestamp
serverTime
data
```

No `userId`, seed, config or internal snapshot is exposed in the envelope.

### Event mapping

| Event | Core data | Hardened handling | Status |
| --- | --- | --- | --- |
| `CONNECTION_READY` | only `type` | clears handshake timer, marks connected | **MATCH** |
| `ROUND_STARTED` | `round`, `fairnessCommitment` | installs `data.round` | **ADAPTER CHANGE**: normalize nested raw Round before install |
| `MULTIPLIER_UPDATE` | `multiplier`, `level` | updates both | **ADAPTER CHANGE**: retain exact decimal, number only for animation |
| `LEVEL_REACHED` | `level`, `multiplier`, `points`, `pointsToAward` | updates level/multiplier/score/notice | **MATCH** semantics; exact integer mapping needed |
| `BOOSTER_ACTIVATED` | `booster`, `level`, `beforeMultiplier`, `afterMultiplier`, `points`, `pointsToAward` | updates booster, multiplier, score/notice | **MATCH** semantics; exact mapping needed |
| `CASHOUT_SUCCESS` | `multiplier`, `cashoutMultiplier`, `winAmount`; no score delta | fixes cashout values/status | **CORE CHANGE** for authoritative cashout points; integer/decimal mapping also needed |
| `CRASH` | `crashMultiplier`, `fairnessReveal` | records crash only; ignores embedded reveal | **ADAPTER CHANGE**: map reveal or deliberately rely on final snapshot/GET proof |
| `ROUND_FINISHED` | full final `round`, `fairnessReveal` | installs `data.round` | **ADAPTER CHANGE**: normalize/validate full nested DTO and reveal |

There is no missing event-type handler. The frontend work is validation/normalization and replay use, not new game-state rules. However, Core must make the existing cashout score bonus visible through authoritative round/event/result data; frontend must not add catalog `cashoutPoints` locally as if it were confirmed.

## FAIRNESS

Core exposes:

```text
commitment at start/ROUND_STARTED
GET /api/rounds/{roundId}/fairness
algorithm = SHA-256
format = air-balloon-fairness:v1
serverSeed = signed 64-bit decimal string after reveal
crashMultiplier
boosterLevel or null
verified
canonicalInput
```

`frontend/src/api/types.ts` must add `algorithm` and `format` and retain `serverSeed` strictly as string. `FairnessDialog` already preserves and displays the start commitment and correctly states that reveal occurs after crash.

Decision: **B — perform independent client verification**. Showing server `verified=true` alone is not an independent proof and contradicts the UI action «Проверить честность».

Minimal browser verifier:

1. validate `algorithm === 'SHA-256'` and `format === 'air-balloon-fairness:v1'`;
2. validate canonical lowercase UUID;
3. validate `serverSeed` as signed 64-bit decimal string and parse with `BigInt`, never Number;
4. normalize crash decimal to plain form with trailing zeros removed, maximum four fractional digits;
5. use `boosterLevel` integer or literal `null`;
6. construct UTF-8 input exactly:

```text
air-balloon-fairness:v1
roundId=<uuid>
serverSeed=<decimal>
crashMultiplier=<normalized decimal>
boosterLevel=<integer|null>
```

including the final newline;

7. compute SHA-256 with `crypto.subtle.digest` and lowercase hex;
8. require both `proof.commitment === originalCommitmentSavedAtStart` and computed `sha256:<hex> === originalCommitmentSavedAtStart`;
9. ignore server `verified` and `canonicalInput` as evidence (they may be shown only as diagnostics).

The verifier does not calculate or alter the authoritative outcome.

## HISTORY

### Global history

Existing contract:

```text
GET /api/history?page=0&size=10
→ { items, page, size, total }
```

It is explicitly global and contains all users. Entry fields are `roundId, username, theme, betAmount, boosterTier, boosterMultiplier, cashoutMultiplier, crashMultiplier, winAmount, roundScore, result, finishedAt`.

Mapping:

```text
frontend History component in Panels.tsx
→ may use GET /api/history only if the screen is labeled as global/all-player history
```

The presence of `@username` already supports a global feed. Change «Ваши завершённые игры» to an unambiguous global label. Preserve `boosterTier` only if useful; server `boosterMultiplier` is the displayed value.

Status: **ADAPTER CHANGE** for exact numeric types and UI wording.

### Personal history

No personal endpoint exists.

Current UI wording says «Ваши завершённые игры», and acceptance `CURRENT-IDENTITY`/`MULTI-USER` expects isolated histories. If that product behavior remains required, Core needs a distinct Principal-scoped paginated contract returning only current user's completed rounds. The route name is intentionally not invented in this audit.

Mapping after publication:

```text
personal History screen/mode in Panels.tsx
→ new api.history.getPersonalHistory(page)
→ server filters by session Principal, never by browser-supplied userId
```

Do not implement personal history by downloading global history and filtering in the browser: pagination totals/order would be wrong and other users' data would still be disclosed.

Status: **CORE CONTRACT MISSING** plus **FRONTEND CHANGE** if personal UI is retained.

## RECONNECT END TO END

Reusable from hardened frontend:

- one `GameSession` owns transport state;
- WebSocket opens before start;
- incoming events are buffered during synchronization;
- per-round sequence rejects stale/duplicate events;
- active roundId is stored per `api.mode + canonical user UUID`;
- cashout idempotency key is stable;
- UI already has connecting/disconnected/recovering states, retry action and snapshot-oriented copy;
- server remains authoritative and MOCK disconnect controls are isolated behind `api.dev`.

Required for REAL:

- consume replay events and `snapshotRequired` as specified above;
- validate exact `eventId`, envelope, nested DTO and roundId;
- retain exact numeric values through replay and snapshot;
- turn 401 during HTTP recovery into session-expired logout, not endless reconnect;
- preserve or safely recreate the cashout key for an ambiguous in-flight cashout during the same SPA lifetime;
- on 404 expired/unknown saved round, clear only that user's active-round localStorage key and return to Setup;
- on FINISHED, install final round immediately, then fetch Result/Fairness as independent reads.

Target flow:

```text
active round
↓
WS disconnect; Core round continues
↓
reconnect with same session cookie
↓
CONNECTION_READY; buffer events
↓
replay from trusted sequence
↓
snapshot only if required/gap/initial restore
↓
drain buffer and resume UI
```

## ERRORS AND HTTP STATUS MAPPING

Game API error body:

```text
{ code, message, timestamp, path }
```

Data/economy error body:

```text
{ code, message, timestamp }
```

The REAL adapter must throw a typed error carrying at least `status`, `code`, `message`, optional `path`, and distinguish timeout/network errors. The current `new Error(message)` discards status/code and is insufficient.

### Actual Core mapping

| HTTP | Actual game/data codes relevant to frontend | Frontend UX |
| --- | --- | --- |
| 400 | `INVALID_REQUEST`, `INVALID_THEME`, `INVALID_BOOSTER`, `INVALID_BET`, `INVALID_PAGINATION` | Inline validation/config-stale message; keep user input; do not retry automatically. |
| 401 | Intended `UNAUTHENTICATED`; WS handshake unauthenticated | Return to Login, clear in-memory user and active socket; preserve no cross-user state. |
| 403 | `FORBIDDEN_ROUND_ACCESS`; admin 403 | Stop round recovery, clear foreign/stale round key, show forbidden/session anomaly. |
| 404 | `ROUND_NOT_FOUND`, `USER_NOT_FOUND` | Saved round expired/not found: clear its local key and return to Setup; result/history detail: unavailable. |
| 409 | `INSUFFICIENT_BALANCE` | Refresh `/me`, show insufficient-balance Setup state; no automatic start retry. |
| 409 | `CASHOUT_NOT_AVAILABLE_YET` | Keep flight, disable until authoritative level/cashoutAvailable update. |
| 409 | `ALREADY_CASHED_OUT` | GET snapshot; show fixed payout if present; never issue a new payout calculation. |
| 409 | `ROUND_ALREADY_CRASHED`, `ROUND_NOT_RUNNING` | GET snapshot and transition to final/result UI. |
| 409 | `ROUND_NOT_FINISHED`, `REWARD_NOT_READY` | Result panel remains loading/retryable for a short bounded retry; Round FINISHED should normally precede request. |
| 503 | `INVALID_GAME_CONFIG` | Block new start/catalog, show configuration unavailable; retry config read later. |
| 503 | `INTEGRATION_UNAVAILABLE` | Retry GET/recovery; never auto-retry start; cashout reconciles via snapshot and the same key. |
| 405 | `INVALID_REQUEST` | Programming/configuration error; generic unavailable UI plus telemetry, not user retry loop. |

Core has no 422 responses in the audited implementation.

### Confirmed auth error defect

Live responses through Nginx at the audited SHA:

```text
anonymous GET /api/auth/me       → 503 INTEGRATION_UNAVAILABLE
invalid POST /api/auth/demo-login → 503 INTEGRATION_UNAVAILABLE
GET /api/auth/me after logout     → 503 INTEGRATION_UNAVAILABLE
```

Expected is 401. Minimal Core fix: let `ResponseStatusException` retain its status or express these cases through the Core `UNAUTHENTICATED` error mapping; add integration tests for anonymous `/me`, invalid credentials and `/me` after logout. Without this, frontend cannot reliably distinguish expired auth from backend outage.

Existing frontend UX that can be reused: login error, global resource error/retry box, insufficient balance text, reconnect banner/button, Result retry, History retry, Fairness retry and loading/empty states. The adapter must provide codes so screens select the right one.

## DOCKER / NGINX / REAL MODE

### Correct topology

```text
Browser
  → http://localhost:${FRONTEND_PORT:-5173}
  → same-origin /api/* and /ws/rounds

Frontend Nginx container
  → http://backend:8080/api/*
  → ws://backend:8080/ws/rounds

Backend container
  → jdbc:postgresql://postgres:5432/air_balloon
```

`backend` and `postgres` are Docker-internal DNS names. They must never be compiled into the browser bundle.

With the default Core config, use `http://localhost:5173`, not `http://127.0.0.1:5173`: `game.allowed-origins` contains `http://localhost:5173` but not the numeric-host variant. Although Compose binds the port to `127.0.0.1`, `localhost` reaches that binding and supplies the allowed Origin. A non-local deployment must configure the exact public scheme/host/port in `game.allowed-origins` and use HTTPS/WSS.

Core `frontend/nginx.conf` already has the correct `/api/` proxy and WebSocket Upgrade headers. Cookie and Set-Cookie forwarding are automatic. Retain this version when resolving the merge with hardened frontend, whose SHA has no production proxy locations.

### Build-time configuration

Existing frontend variables are sufficient:

| Existing value | REAL Compose value | Notes |
| --- | --- | --- |
| `VITE_API_MODE` | `real` | Build-time Vite value, not runtime container env |
| `VITE_API_BASE_URL` | empty string | Uses same browser origin for HTTP and derives WS URL |

There is no existing `VITE_WS_BASE_URL`, and none is needed for same-origin deployment.

Hardened `frontend/Dockerfile` already declares both build args. Final Core's current `docker-compose.yml` does not pass them, while the Core-side Dockerfile at its SHA builds with defaults from its own tree. During integration, keep the hardened Dockerfile args and add Compose `build.args` using these existing names. Merely adding `environment:` to the running Nginx container will not change an already-built Vite bundle.

Relevant existing backend/Compose values remain:

```text
FRONTEND_PORT=5173
BACKEND_PORT=8080          # host/debug only; not browser bundle origin
POSTGRES_PORT=5432
SPRING_PROFILES_ACTIVE=demo
DB_URL=jdbc:postgresql://postgres:5432/...
```

## REAL BINDING CHANGES: MOCK → REAL SWITCH

Minimal implementation sequence using the actual frontend structure:

1. Add raw Core DTOs, typed API errors, integer-string/decimal types and lossless parsing in `frontend/src/api/types.ts` / `real.ts`.
2. Implement demo session auth, `/me` current user, empty-body logout and `UserState→User/Wallet` mapping in `real.ts`.
3. Remove arbitrary userId from frontend balance reads; refresh Wallet from `/me`.
4. Bind the new player catalog contract; keep REAL Setup blocked until Core publishes it.
5. Map start/snapshot/cashout/result/history/fairness HTTP DTOs without floating-point authoritative calculations.
6. Normalize all WS nested event data before it reaches `GameSession`.
7. Complete sequence replay and snapshot fallback in `frontend/src/game/session.ts`.
8. Add independent browser fairness verification and bind its result to `FairnessDialog`.
9. Bind global history with global labeling; add personal history only after a scoped Core contract exists.
10. Resolve Nginx/Docker conflicts, pass `VITE_API_MODE=real` and empty `VITE_API_BASE_URL` as build args.
11. Add REAL adapter/auth/error/replay/fairness tests; retain all MOCK tests.
12. Run `feature/e2e-acceptance` after updating its auth/numeric assumptions to Final Core.

## EXPECTED FILES TO CHANGE / FRONTEND FILE CHANGE PLAN

### Required/expected production files

```text
file: frontend/src/api/real.ts
purpose: Single REAL transport/adapter boundary.
change: Implement auth/me/logout; accept empty responses; typed errors; lossless JSON; UserState/Wallet/Round/Event/History/Result/Fairness mappers; current-user balance; strict WS envelope validation.
risk: HIGH — identity, precision, auth expiry and realtime data all cross here.
```

```text
file: frontend/src/api/types.ts
purpose: UI-facing API and domain types.
change: Replace authoritative money/score number fields with canonical integer strings/value types; exact decimal type; add fairness algorithm/format and raw/result metadata; remove balance userId; add distinct personal history method only when Core publishes it.
risk: HIGH — wide compile-time impact, but it makes unsafe uses visible.
```

```text
file: frontend/src/game/session.ts
purpose: Ordered round state and recovery.
change: Apply replay events, branch on snapshotRequired, validate eventId/contiguity, drain WS buffer safely, handle 401/403/404 terminal recovery, preserve exact server values.
risk: HIGH — mistakes cause duplicate/missed events or stale cashout UI.
```

```text
file: frontend/src/app/App.tsx
purpose: Boot/login/logout shell.
change: Remove obsolete REAL-waits-for-Core copy; map login/current-user statuses; return to Login on session expiry; avoid leaving authenticated UI after failed logout.
risk: MEDIUM — session state and error UX.
```

```text
file: frontend/src/app/GameHome.tsx
purpose: Compose profile, wallet, catalog and GameSession.
change: Call no-arg current-user wallet refresh; use UUID-scoped round key; exact affordability; catalog unavailable state; session-expired callback; explicit global/personal history choice.
risk: MEDIUM — cross-user local state and stale balance/catalog behavior.
```

```text
file: frontend/src/app/Gameplay.tsx
purpose: Setup and live flight presentation.
change: Format/compare integer strings and exact decimals; retain server authority; otherwise preserve existing GREEN/RED, booster and cashout UI.
risk: MEDIUM — unsafe number coercion could enable an unaffordable stake or display a wrong fixed value.
```

```text
file: frontend/src/app/Panels.tsx
purpose: Result, history and fairness UI.
change: Render mapped server result; exact formatting; label global history honestly; add personal mode only with Core contract; run/show independent fairness verification.
risk: MEDIUM — misleading result/proof/history scope.
```

```text
file: frontend/src/game/format.ts
purpose: Display formatting.
change: Format integer strings/BigInt and canonical decimal strings without Number/toFixed on authoritative values.
risk: MEDIUM — visible precision and locale formatting.
```

```text
file: frontend/nginx.conf
purpose: Production same-origin routing.
change: Resolve merge by retaining Final Core `/api/` and `/ws/` proxy blocks plus hardened static asset/SPA behavior; optionally add forwarded scheme/host headers for deployment policy.
risk: HIGH — a wrong resolution breaks all production HTTP/WS and session sharing.
```

```text
file: frontend/Dockerfile
purpose: Build the Vite bundle.
change: Retain hardened VITE_API_MODE/VITE_API_BASE_URL ARG→ENV before build; no new env names.
risk: LOW — wrong default silently ships MOCK.
```

```text
file: docker-compose.yml
purpose: Full-app topology.
change: Keep Core backend/PostgreSQL/healthchecks/Nginx dependencies and pass existing Vite build args to frontend; never pass backend:8080 as public API base.
risk: HIGH — browser/Docker hostname and build-time/runtime confusion.
```

```text
file: .env.example
purpose: Operator-facing configuration.
change: Combine Core values with existing VITE_API_MODE=real and VITE_API_BASE_URL= examples; document localhost Origin requirement and build rebuild.
risk: LOW — configuration drift.
```

### Likely supporting files

| File | Purpose/change | Risk |
| --- | --- | --- |
| `frontend/package.json`, lock | Add one lossless JSON/decimal helper only if selected; native BigInt/Web Crypto need no dependency | LOW |
| `frontend/src/api/real.test.ts` (new) | Contract fixtures, 200-empty logout, typed errors, large integers, nested WS DTO | MEDIUM |
| `frontend/src/game/session.test.ts` | Replay tail, snapshotRequired, wrong eventId/round, duplicate/stale/gap, auth expiry | HIGH |
| `frontend/src/app/*.test.tsx` | REAL login/session expiry, catalog unavailable, global/personal labels, fairness status | MEDIUM |

### Files checked but not expected to need logic changes

- `frontend/src/api/index.ts`: existing `VITE_API_MODE=mock|real` composition point is correct.
- `frontend/src/api/demoUsers.ts`: keep unchanged and MOCK-only.
- `frontend/src/api/mock.ts`: keep as deterministic UI/test adapter; do not make it imitate session authority.
- `frontend/vite.config.ts`: existing `/api` HTTP and `/ws` WS dev proxies already target `127.0.0.1:8080` correctly.

## WHAT MUST NOT BE REWRITTEN

The following hardened frontend parts are already ready and should be reused:

- GREEN/RED theme selection, 9/12-level rendering and level progress UI;
- balloon/sky animations and responsive layout;
- cashout enabled/disabled/fixed-payout UX;
- booster ×2/×3/×4 activation presentation and hidden-until-activation behavior;
- WIN/LOSE result layout, reward slot and Play Again flow;
- profile/sidebar, rules modal, loading/empty/error/retry states;
- connection/recovering banner and MOCK reconnect controls separation;
- `Api` + `MockBackend` + `createRealApi` architecture;
- `GameSession` ownership of transport state, buffer, sequence cursor and idempotency key;
- MOCK scenarios, presets and existing 18 tests.

Integration must replace transport/data mapping, not redesign screens or recreate game rules in React.

## CORE CHANGES REQUIRED

Minimal required Core work before declaring production REAL binding complete:

1. **Player catalog contract:** publish a non-admin read contract with exact enumerated integer stakes and the fields listed in Stake / Player Catalog.
2. **Auth status correctness:** anonymous `/me`, invalid credentials and expired session must return 401, not catch-all 503; cover with integration tests.
3. **Principal-scoped reads:** make player state/current balance impossible to read for an arbitrary UUID, or remove the legacy route from player exposure; owner-check `/api/rounds/{id}/result`.
4. **Personal history, if the current “Ваши” UX and multi-user acceptance remain required:** publish a Principal-scoped paginated contract. Keep global history separate.
5. **Per-round score coherence:** expose the persisted cashout bonus in authoritative cashout event/snapshot and make `RoundView.roundScore`, `Result.score`, global/personal history and cumulative `gameScore` reconcile.

Recommended but not a binding blocker for the local demo: durable/distributed session storage if login continuity across backend restart is a product requirement.

No other Core change is needed for start/cashout money semantics, snapshot/replay ordering, the set of game WebSocket event types, integer economy calculation, global history fields, reward payload or fairness proof.

## E2E EXPECTATION

`feature/e2e-acceptance` predates Final Core and needs adapter updates before its result is meaningful:

- authenticate Playwright API contexts by `POST /api/auth/demo-login` and preserve separate cookies for user A/B instead of assuming static auth headers;
- treat bonus amounts as scale 0 integer units, not hard-coded scale 2;
- obtain valid/unaffordable selectable stakes from the new player catalog;
- decide whether history assertions target global or personal endpoint; do not use global history for isolation tests.

After Core blockers and REAL binding are complete, the following should become executable:

| Acceptance group | Expected after integration/full-app |
| --- | --- |
| Scenario 1 API/browser | Login/current UUID/balance, catalog stakes, GREEN 9, RED 12, x2, rules/history and start; requires catalog and cookie harness updates. |
| Scenario 2 API/browser | Early cashout error, fixed successful payout, same-key idempotency, continued flight, result/history, one credit and consistent cashout score; requires the score coherence fix. |
| Scenario 3 API/browser | No-cashout LOSS, zero payout, stake debit, points/result/history. |
| Scenario 4 API/browser | x2/x3/x4 server-assigned booster activation, exact multiplier event and points; no post-cashout activation. |
| Scenario 5 API/browser | Final outcome/coefficients/points/booster/reward, Play Again and theme persistence. |
| WebSocket reconnect | Real disconnect/reconnect, same session cookie, snapshot/replay restore, fixed cashout remains fixed. |
| Sequence/replay | Ordered sequence/eventId/serverTime; replay tail applies; snapshotRequired fallback; injected gap recovery. |
| Fairness | Start commitment, no pre-crash leak, reveal, independent Web Crypto verification and tamper rejection. |
| Persistence | User/economy/history/result/reward and active checkpoint survive backend restart; auth session itself currently requires re-login. |
| Multi-user/current identity | Game ownership and balances can pass after cookie harness update; history isolation and safe result/state reads require the Core scoping changes above. |

The existing `S1-API` insufficient-balance test cannot be fully deterministic until catalog tells it a server-valid stake above current balance. `CURRENT-IDENTITY` and `MULTI-USER` must not pass by filtering global history client-side.

## FUTURE: TOURNAMENT BINDING AFTER `integration/backend-tournament`

Tournament is not connected and is not a Core blocker in this audit. A later dedicated binding should add separate frontend contracts/state for:

- paginated leaderboard;
- top-3 projection;
- authenticated `currentPlayer` rank/score;
- timer derived from server time and tournament boundaries;
- Tournament WebSocket/STOMP (or its final published transport), with its own reconnect/version cursor.

Do not mix Tournament events with native game `/ws/rounds` or reuse game replay semantics without checking the final tournament contract.

## ESTIMATED REAL BINDING COMPLEXITY

**HIGH** at the audited SHAs because player catalog/personal history/auth-status/read-scoping/score coherence need Core work and because exact numeric types touch the adapter, session and presentation boundary. After the five minimal Core decisions/fixes are published, the frontend-only implementation is **MEDIUM**: screens and game UX already exist.

## FINAL VERDICT

```text
AUTH READY: CHANGES REQUIRED
IDENTITY READY: CHANGES REQUIRED
ECONOMY READY: CHANGES REQUIRED
GAME HTTP READY: CHANGES REQUIRED
GAME WS READY: CHANGES REQUIRED
HISTORY READY: CHANGES REQUIRED
FAIRNESS READY: CHANGES REQUIRED
RECONNECT READY: CHANGES REQUIRED

CORE CHANGES REQUIRED BEFORE FRONTEND BINDING: YES

READY TO CREATE integration/full-app: NO
EXPECTED BINDING COMPLEXITY: HIGH

PRODUCTION CODE MODIFIED: NO
```

`READY TO CREATE integration/full-app: NO` означает «не начинать реализацию как заведомо завершаемую production binding». Технически ветку можно создать для параллельной подготовки adapter/tests, но её нельзя объявить готовой, пока Core не публикует catalog, не исправляет auth 401 и не закрывает требуемые principal-scoped reads/history.
