# Frontend ↔ Backend Binding Audit

Дата аудита: 2026-09-11 (Europe/Moscow)

Audit-ветка: `audit/frontend-backend-binding`

Безопасная база audit-ветки: `feature/e2e-acceptance` @ `aa07c4698d8a290f947707145f0d9c3cd926e66d`

Этот документ — карта будущего подключения готового frontend к финальному Core. Он не меняет production-код, не предлагает вымышленных endpoint и не включает Tournament. Статусы относятся к перечисленным ниже SHA; `integration/backend-core` на `origin` во время аудита отсутствует.

## 1. Ветки и источник истины

| Ветка | SHA | Роль в аудите |
| --- | --- | --- |
| `feature/game-frontend` | `f34754e8c45ea2316833ae99057cba6958cf05f9` | Готовый UI, API interfaces, MOCK/REAL adapters, `GameSession` |
| `codex/game-resilience` | `2b538e3078bad80e91590dd6e214fdfc933cbfa7` | Актуальный Game Backend №1: HTTP, WS, fairness, replay/reconnect |
| `feature/backend-data-economy` | `6e88eeab1778d1f50eb39a552544ea1a1faea4b3` | Backend №2: PostgreSQL economy, users, history, result, config, rewards |
| `feat/demo-login` | `a5ce2ea73d0d7dd0adeee8f0e47d8e5c558d9c4e` | Клиентский demo login; server auth отсутствует |
| `feature/e2e-acceptance` | `aa07c4698d8a290f947707145f0d9c3cd926e66d` | Известные E2E blockers и black-box contract consumers |

При расхождении game-контрактов источником истины является `codex/game-resilience`, а не `codex/game-engine` и не ранние общие документы.

### Статусы

- `MATCH` — route, method и необходимые поля совпадают.
- `ADAPTER CHANGE` — backend endpoint готов, но REAL adapter/types/normalization требуют изменения.
- `CORE CHANGE REQUIRED` — существующие ветки нельзя безопасно связать только frontend-адаптером.
- `WAITING FOR FINAL CORE` — окончательный endpoint/auth/unit contract ещё не опубликован.
- `MISSING` — требуемого контракта в обследованных ветках нет.

Для детального payload-аудита ниже также используются `MINOR ADAPTER CHANGE` и `MAJOR MISMATCH`.

## 2. Итоговая цепочка

```text
React screens
  → Api interface (`frontend/src/api/types.ts`)
  → REAL adapter (`frontend/src/api/real.ts`)
  → same-origin /api and /ws proxy
  → authenticated canonical UUID Principal
  → Game HTTP + native game WebSocket
  → PostgreSQL economy/history/result/config adapters
```

Game HTTP route names и WS event envelope в основном уже совпадают с frontend-заготовкой. Реальное включение сейчас блокируют четыре границы:

1. отсутствуют login/logout/current-user server contracts;
2. demo/economy/game используют разные identity;
3. отсутствует безопасный публичный предраундовый catalog со списком ставок;
4. `BigDecimal` Game Engine и `long` Economy не имеют согласованной wire/storage unit policy.

## 3. Инвентаризация frontend

### API и переключатель данных

| Файл | Назначение |
| --- | --- |
| `frontend/src/api/types.ts` | UI-facing `Api`, `GameApi`, User/Wallet/Catalog/Round/Event/History/Result/Fairness DTO |
| `frontend/src/api/index.ts` | Единственная точка `VITE_API_MODE=mock|real`; создаёт `MockBackend` либо `createRealApi` |
| `frontend/src/api/mock.ts` | Локальный authoritative-looking simulator только для демо |
| `frontend/src/api/real.ts` | Централизованный `fetch`, game HTTP routes, native WS; auth/catalog намеренно заблокированы |
| `frontend/src/api/demoUsers.ts` | Только MOCK credentials и строковые локальные id (`anna`, `maks`, `liza`) |
| `frontend/src/game/session.ts` | Start/cashout, ordered event reducer, reconnect и snapshot recovery |

### Все действия UI, требующие backend в REAL mode

- boot: определить текущего пользователя;
- login и logout;
- получить canonical profile/identity;
- получить баланс и game score; обновлять после start, cashout, score event и finish;
- получить темы, thresholds, доступные ставки, boosters и points hints до старта;
- start round;
- подключить game WebSocket до start;
- применить live multiplier/level/booster/cashout/crash/finish events;
- cashout с UUID idempotency key;
- восстановить активный round по сохранённому roundId;
- получить replay и snapshot при reconnect/gap;
- получить финальный result/reward;
- получить global history;
- получить fairness commitment/reveal и выполнить независимую verification;
- повторно начать игру после FINISHED.

`dev.setPreset`, `dev.disconnect` и `dev.setBalance` существуют только в MOCK и не должны иметь production endpoints.

## 4. Обязательная feature-карта

| Feature | Frontend method | Backend contract | Status | Required change |
| --- | --- | --- | --- | --- |
| Login | `api.auth.login(login,password)` | `WAITING FOR FINAL CORE` | `WAITING FOR FINAL CORE` | Реализовать вызов опубликованного auth endpoint; не отправлять локальные mock identities как principal |
| Logout | `api.auth.logout()` | `WAITING FOR FINAL CORE` | `WAITING FOR FINAL CORE` | Завершать реальную session/token по контракту Core |
| Current user | `api.auth.currentUser()` | `WAITING FOR FINAL CORE` | `WAITING FOR FINAL CORE` | Вернуть canonical UUID и профиль из серверной session |
| Balance | `api.economy.getBalance(id)` | `GET /api/users/{id}/state` | `CORE CHANGE REQUIRED` | Связать path id с authenticated principal; нормализовать `UserState` в `Wallet`; согласовать money units |
| Game config | концептуально `api.catalog.get()` | Публичного player config endpoint нет; admin-only `GET /api/admin/config` не подходит UI | `MISSING` | `WAITING FOR FINAL CORE`; не передавать `X-Admin-Token` браузеру |
| Available stakes | концептуально `api.catalog.get()` | Endpoint/list отсутствует; Backend №1 имеет только min/max, Backend №2 не хранит stake list | `MISSING` | Core должен опубликовать фактический player catalog либо окончательное правило; endpoint не угадывать |
| Start round | `api.game.startRound(input)` | `POST /api/rounds`, 201 | `ADAPTER CHANGE` | Route/payload совпадают; исправить exact decimal boundary и подключить auth |
| Cashout | `api.game.cashout(id,key)` | `POST /api/rounds/{roundId}/cashout`, пустое body, optional UUID `Idempotency-Key`, 200 | `MATCH` | Не вычислять payout; сохранить один key на попытку и использовать server RoundView |
| Snapshot | `api.game.getSnapshot(id)` | `GET /api/rounds/{roundId}`, 200 | `MATCH` | Нормализовать decimal DTO; считать snapshot authoritative |
| Replay | `api.game.getReplay(id,after)` | `GET /api/rounds/{roundId}/events?afterSequence=N`, 200 | `ADAPTER CHANGE` | Transport совпадает; `GameSession` сейчас игнорирует `events` и `snapshotRequired` |
| Game WS | `api.game.connect(event,connection)` | native WS `/ws/rounds`; first frame `CONNECTION_READY` | `ADAPTER CHANGE` | Event schema совпадает; добавить production `/ws` proxy и финальный cookie/handshake auth |
| Result | `api.game.getResult(id)` | `GET /api/rounds/{id}/result`, 200 после finish | `ADAPTER CHANGE` | Route/fields совпадают; нормализовать money/long и дополнительные reward поля |
| Global history | `api.history.getHistory(page)` | `GET /api/history?page=&size=` | `ADAPTER CHANGE` | Экран действительно global; нормализовать amounts; оставить отдельно от personal history |
| Personal history | frontend method/экран отсутствует | Endpoint отсутствует | `MISSING` | `WAITING FOR FINAL CORE`; не подменять global history фильтрацией в браузере |
| Fairness commitment | `Round.fairnessCommitment` + `getFairness` | start/`ROUND_STARTED` + fairness endpoint | `MATCH` | Сохранять первоначальный commitment по roundId |
| Fairness reveal | `api.game.getFairness(id)` | `GET /api/rounds/{id}/fairness`; reveal после CRASH/FINISHED | `MATCH` | Дополнить frontend type полями `algorithm`, `format`, exact `serverSeed` |
| Fairness verification | method отсутствует | Server отдаёт proof и `verified`, независимый Node verifier есть только вне frontend | `MISSING` | Добавить browser-side SHA-256 verifier; не доверять server `verified` как доказательству |
| Reconnect | `GameSession.recover()` + auto-reconnect в `real.ts` | socket → buffer → replay/snapshot → sequence resume | `ADAPTER CHANGE` | Базовая стратегия безопасна, но replay result/eventId validation нужно реально использовать |

## 5. Детальный HTTP mapping

| Frontend method | Screen/action | Expected data | Actual backend endpoint | HTTP | Request payload | Response payload | Auth required | Payload status | Required adapter change |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auth.login` | Login form / «Войти» | `User` + session/token context | `WAITING FOR FINAL CORE` | — | UI has `{login,password}` | — | n/a until Core | `WAITING FOR CORE` | Replace deliberate `waiting()` implementation only after contract is published |
| `auth.logout` | Profile / «Выйти» | Session invalidated | `WAITING FOR FINAL CORE` | — | — | — | yes | `WAITING FOR CORE` | Current REAL implementation is a no-op and must not remain so |
| `auth.currentUser` | App boot | `User|null` for authenticated session | `WAITING FOR FINAL CORE` | — | credentials/session | — | yes | `WAITING FOR CORE` | Current REAL implementation always returns `null` |
| optional demo profile discovery | Login suggestions | Server demo `UserState[]` | `/api/demo/users` (demo profile only) | GET | none | `userId,username,displayName,bonusBalance,gameScore,createdAt,updatedAt` | no auth today | `MINOR ADAPTER CHANGE` | Optional discovery only; it is not login and must not mint identity |
| `economy.getBalance(id)` | Profile panel / affordability | `Wallet {bonusBalance,gameScore}` | `/api/users/{id}/state` | GET | UUID path | full `UserState` | not enforced in Backend №2 | `MAJOR MISMATCH` | Canonical UUID/auth binding and numeric normalization; ignore/map profile extras intentionally |
| `catalog.get` / getGameConfig | Setup/rules | thresholds, boosters, points rules | `WAITING FOR FINAL CORE` | — | — | — | — | `MISSING` | Do not call `/api/admin/config` from player UI |
| `catalog.get` / getAvailableStakes | Stake buttons | enumerated valid stakes | `WAITING FOR FINAL CORE` | — | — | — | — | `MISSING` | No real stake array exists in either backend branch |
| `game.startRound` | «Начать полёт» | authoritative `RoundView` | `/api/rounds` | POST | `{theme,betAmount,boosterMultiplier}` | `RoundView`, status 201 | trusted UUID Principal | `MINOR ADAPTER CHANGE` | Fields match; send exact decimal representation after Core money policy is fixed; never auto-retry |
| `game.cashout` | «Забрать» | fixed multiplier/win/status | `/api/rounds/{roundId}/cashout` | POST | empty body; header `Idempotency-Key: UUID` | `RoundView` | owner Principal | `MATCH` | Keep body absent. On ambiguous error recover snapshot; same key may be retried, new key must not be created |
| `game.getSnapshot` | reload/reconnect/gap/manual retry | cumulative authoritative state | `/api/rounds/{roundId}` | GET | UUID path | `RoundView` | owner Principal | `MINOR ADAPTER CHANGE` | Decimal normalization; use `sequence` as reducer cursor and `serverTime` as server observation time |
| `game.getReplay` | reconnect/gap | ordered tail + retention flags | `/api/rounds/{roundId}/events?afterSequence=N` | GET | non-negative integer cursor | `ReplayView` | owner Principal | `MATCH` transport / `MAJOR MISMATCH` consumption | Consume ordered `events`; branch on `snapshotRequired`; validate round/event identity |
| `game.getResult` | final result screen | outcome, stake, payout, score, reward | `/api/rounds/{id}/result` | GET | UUID path | `roundId,result,betAmount,cashoutMultiplier,crashMultiplier,winAmount,score,configVersion,reward` | Backend №2 currently does not enforce owner | `MINOR ADAPTER CHANGE` | Core must scope read; adapter normalizes amounts and maps reward extras |
| `history.getHistory` | «История полётов» (all profiles) | paged global entries | `/api/history?page=P&size=10` | GET | `page`, `size` | `Page<Entry>` | Backend №2 currently public | `MINOR ADAPTER CHANGE` | Field names used by UI match; preserve `boosterTier` as optional extra and normalize long/decimal values |
| personal history method absent | Future profile history | only authenticated user's rounds | `WAITING FOR FINAL CORE` | — | — | — | yes | `MISSING` | Add a distinct adapter method only after Core publishes a scoped route |
| `game.getFairness` | Fairness dialog | commitment or reveal proof | `/api/rounds/{roundId}/fairness` | GET | UUID path | `FairnessView` | owner Principal | `MINOR ADAPTER CHANGE` | Extend TS DTO; preserve `serverSeed` as string and original commitment separately |
| `verifyFairness` absent | Fairness dialog verification status | independent boolean + validation reason | no separate server endpoint is needed for client verification | local Web Crypto | `FairnessView` + original commitment | client result | no | `MISSING` | Implement canonical v1 hashing locally; do not determine game outcome locally |

### `RoundView` field audit

Backend №1 `RoundView` and frontend `Round` agree on the following semantic fields:

`id`, `roundId`, `theme`, `betAmount`, `boosterMultiplier`, optional `boosterLevel`, `boosterActivated`, `currentMultiplier`, `currentLevel`, `totalLevels`, `levelThresholds`, `cashoutAvailable`, optional `cashoutMultiplier`, `winAmount`, `roundScore`, `status`, optional `outcome`, optional `crashMultiplier`, `startedAt`, optional `finishedAt`, `timestamp`, `sequence`, `serverTime`, `cashoutPerformed`, `fairnessCommitment`, optional `fairnessReveal`.

Backend additionally returns optional `cashoutAt` and `crashedAt`; frontend may preserve or deliberately ignore them. Null fields are omitted by Backend №1. JSON UUID/Instant values arrive as strings and match frontend representation. Numeric semantics are not yet safe; see Money Format.

### Other payload mismatches

- Backend №2 history adds `boosterTier`; frontend only needs the resolved `boosterMultiplier`. This is compatible and useful to retain in the raw DTO.
- Backend №2 result reward contains `id`, `roundId`, `userId`, `createdAt` in addition to `type`, `rarity`. Frontend currently ignores the extra fields.
- Frontend `Fairness` omits real `algorithm` and `format`; both are required for versioned independent verification.
- `serverSeed` is correctly a decimal string in the real fairness contract. It must never pass through `Number`.
- `userId` is intentionally absent from Game start/cashout payloads. Ownership comes only from the trusted Principal.

## 6. Money format and conversion boundary

### Actual formats at the audited SHAs

| Layer | Actual type | Meaning |
| --- | --- | --- |
| Game HTTP request/response | Java `BigDecimal`, serialized as JSON number by current contract | `betAmount` scale ≤2; multipliers scale ≤4; `winAmount` scale 2 |
| Game calculation | `BigDecimal` | `winAmount = floor(betAmount × cashoutMultiplier, 2)`; only server calculates it |
| Economy API/DB | Java/SQL `long` / `BIGINT`, JSON integer | `bonusBalance`, `betAmount`, `winAmount`; demo balance is returned as `5000` |
| Score API/DB | `long` / `BIGINT`, JSON integer | `gameScore`, `roundScore`, points deltas |
| Current frontend | TypeScript `number` everywhere | `Number(...)`, `toFixed`, locale formatting |

This is a real Core mismatch, not merely a TypeScript annotation issue. Backend №1 says decimal currency units and documents minor-unit conversion with `movePointRight(2).longValueExact()`. Backend №2's public demo semantics currently treats stored `5000` as the displayed 5,000 bonuses and its `GameRound` accepts integer bet/win amounts. Final Core must publish one rule before adapters are bound:

- either all economy amounts are integer bonus units and Game Engine rejects/finalizes fractional payout according to an explicit rule;
- or Economy `BIGINT` values are minor units and every API/UI boundary converts scale 2 consistently (then existing demo seed value must be interpreted/configured consistently);
- or persistence/wire types change in final Core. This audit does not choose or implement that production decision.

### Required frontend boundary after Core decides

1. Keep wire amounts as canonical decimal strings or scaled `bigint` values in `real.ts`; do not immediately coerce with `Number`.
2. Separate raw backend DTO from UI DTO. Normalize in the REAL adapter once, with an explicit scale/unit.
3. Use a decimal library or small scaled-integer value object for comparisons and formatting.
4. Convert to JS `number` only for non-authoritative animation/layout where precision cannot change a bet, payout, balance, score, or verification input.
5. Render `winAmount`, `cashoutMultiplier`, balance and result received from the server. The browser must never calculate an authoritative payout.
6. If Core retains JSON numeric tokens for `BigDecimal`/`long`, safe parsing is only guaranteed inside JS safe integer limits. Prefer decimal strings on the final wire for values that may exceed those limits.

This boundary prevents `0.1 + 0.2` errors and prevents large `long` values from silently exceeding `Number.MAX_SAFE_INTEGER`.

## 7. Authentication and canonical user identity

### Current situation

| Source | Identity |
| --- | --- |
| `feat/demo-login` and frontend MOCK | localStorage value `anna`, `maks` or `liza`; passwords checked entirely in browser |
| Backend №2 demo users | stable UUIDs: anna `90132a44-8931-3c85-873b-efaa829567e6`, maks `5c8b44c2-11a6-34ac-9d70-1ebd499faf9c`, liza `608adbff-35ad-3bc0-9305-58fb05f26446` |
| Backend №2 user-state/history/result | accepts path/round UUID but currently has no player authentication/authorization layer |
| Backend №1 demo profile | forces the single Principal `00000000-0000-0000-0000-000000000001` for every request and WS handshake |
| Backend №1 production contract | requires trusted `Principal.getName()` containing the user's UUID; arbitrary `X-User-Id` is rejected as an identity mechanism |

The single Backend №1 demo Principal does not equal any Backend №2 demo-user UUID. Therefore a direct merge would debit/read one identity while the game owns another, or fail lookup entirely. A hardcoded demo UUID, localStorage id or `X-User-Id` must not be used to bridge this.

### Required final flow

```text
Frontend login(login, password)
  ↓
Core validates credentials and establishes session/token
  ↓
Central `request()` sends `credentials: include` (cookie flow)
  ↓
currentUser reads the authenticated canonical user
  ↓
User.id is the same canonical UUID exposed as Principal.getName()
  ↓
balance + game ownership + result + personal history use that identity
  ↓
WebSocket handshake resolves the same Principal
```

`currentUser` is `WAITING FOR FINAL CORE`. Its response must be sufficient to build frontend `User {id,name,login,initials,color}` or the adapter must derive presentation-only `initials/color`; identity itself must come from the server.

The existing central `request()` already sets `credentials: 'include'`. Native browser WebSocket cannot attach an arbitrary `Authorization` header. Consequently:

- same-origin HttpOnly cookie sessions fit both HTTP and WS with the fewest frontend changes;
- if Core chooses bearer auth, Core must publish a secure browser WS handshake mechanism. Do not invent a query-token contract in `real.ts`.

`GET /api/users/{id}/state`, result and any personal-history read must be authorized against the Principal in final Core. Merely hiding a foreign UUID in the UI is not access control.

## 8. Global and personal history

The existing frontend history screen explicitly says "завершённые игры всех профилей" and displays `@username`. Its correct source is Backend №2 global endpoint:

```http
GET /api/history?page=0&size=10
```

Backend №2 returns all finished rounds ordered by `finishedAt DESC, id`. This contract must not be presented as personal history.

Personal user history is a different future feature. No frontend method/screen and no principal-scoped backend endpoint exist at the audited SHAs, so its route is `WAITING FOR FINAL CORE`. Do not download global history and filter it in the browser: that leaks data and breaks pagination/authorization.

The E2E `CURRENT-IDENTITY`/`MULTI-USER` expectations must bind to the future personal-history source. They must not reinterpret the global feed as scoped data.

## 9. WebSocket protocol and event mapping

### Connection contract

- URL: `/ws/rounds`, native JSON WebSocket, no STOMP/topics.
- Scheme: `ws` for HTTP and `wss` for HTTPS.
- Handshake: trusted authenticated Principal; exact Origin must be in `game.allowed-origins`.
- First server frame: `{"type":"CONNECTION_READY"}`; it has no round envelope.
- Client sends no messages. A client game message closes the connection with policy violation 1008.
- Each authenticated connection receives only events for that Principal's rounds.
- Gameplay envelope: `type,roundId,sequence,eventId,timestamp,serverTime,data`.
- `eventId` is deterministically `${roundId}:${sequence}` and is stable across retry/replay/recovery.

### Frontend handler → backend event

| Backend frame/event | Real backend `data` | Existing frontend handling | Status / required change |
| --- | --- | --- | --- |
| `CONNECTION_READY` | none | Resolves initial connect; marks connected | `MATCH` |
| `ROUND_STARTED` | `round`, `fairnessCommitment` | Replaces state from `data.round` | `MATCH`; preserve initial commitment separately for verification |
| `MULTIPLIER_UPDATE` | `multiplier`, `level` | Updates current multiplier/level | `ADAPTER CHANGE`; exact decimal normalization before reducer |
| `LEVEL_REACHED` | `level`, `multiplier`, `points`, `pointsToAward` | Updates level/multiplier; adds `pointsToAward` | `MATCH`; long-safe points representation still needed |
| `BOOSTER_ACTIVATED` | `booster`, `level`, `beforeMultiplier`, `afterMultiplier`, `points`, `pointsToAward` | Sets activated/level/current multiplier and score | `MATCH`; do not infer future level |
| `CASHOUT_SUCCESS` | `multiplier`, `cashoutMultiplier`, `winAmount` | Fixes server values and `CASHED_OUT` state | `MATCH`; server response/event is authoritative |
| `CRASH` | `crashMultiplier`, `fairnessReveal` | Marks `CRASHED`, records crash multiplier | `ADAPTER CHANGE`; reducer currently ignores event reveal, later FINISHED snapshot supplies it |
| `ROUND_FINISHED` | `round`, `fairnessReveal` | Replaces state from `data.round` | `MATCH`; final round includes reveal |

Frontend `real.ts` rejects frames without `roundId`, safe-integer `sequence`, and string `eventId`, but `GameSession` does not verify the deterministic `eventId` value. Add validation/deduplication at the raw adapter or sequence guard boundary.

### Reconnect and gap algorithm

Required algorithm:

```text
receive sequence N
  ↓
receive N+2 → do not apply delta
  ↓
mark recovering and buffer live frames
  ↓
request replay after N
  ↓
if replay is complete: apply N+1, N+2... in order
if snapshotRequired or replay invalid: GET authoritative snapshot
  ↓
reset cursor to snapshot.sequence
  ↓
discard buffered sequence <= cursor and wrong-round frames
  ↓
apply the remaining contiguous events; another gap repeats recovery
```

Existing frontend correctness characteristics:

- opens/subscribes before start;
- auto-reconnects with exponential delay capped at 8 seconds;
- disables cashout unless `connection === connected`;
- detects non-contiguous sequence and enters recovery;
- buffers live events while HTTP recovery is in progress;
- always installs an authoritative snapshot and drops stale sequence values.

Existing gap: `GameSession.recover()` calls `getReplay()` but discards its entire response, including `events` and `snapshotRequired`, then always fetches a snapshot. This conservative flow can restore correctness while snapshot is available, but it is not a full replay implementation and fails recovery unnecessarily if replay itself is unavailable. Status: `ADAPTER CHANGE REQUIRED` for transport normalization and `FRONTEND LOGIC CHANGE REQUIRED` to consume/validate replay semantics. Keep snapshot fallback even after replay is implemented.

## 10. Cashout authoritative flow

```text
Cashout button enabled only after server state says `cashoutAvailable`
  ↓
POST /api/rounds/{roundId}/cashout with empty body and stable UUID key
  ↓
Server catches up to current server time, validates ownership/level/crash
  ↓
Server fixes `cashoutMultiplier` and `winAmount`, persists/credits idempotently
  ↓
RoundView / CASHOUT_SUCCESS updates UI
  ↓
UI displays fixed values while flight continues to CRASH/FINISHED
```

The current frontend follows this authority boundary: components do not calculate payout. `MockBackend` does calculate a demo value internally, but it is isolated from REAL mode. On an ambiguous cashout error, the frontend recovers the snapshot and displays the server state. It must retain the same idempotency key for a retry of that logical command.

## 11. Booster secrecy

Backend №1 exposes no future `boosterLevel` at start. It appears only after actual activation or after CRASH/FINISHED reveal. The frontend type makes it optional, the current UI labels an unactivated booster as "скрыт", and MOCK start also omits it. This is `MATCH`.

REAL adapter/reducer must never synthesize the future position from config, weights, mock preset, seed, or client timing. Cashout does not reveal it because the flight continues.

## 12. Fairness

### Commitment

At start, preserve `RoundView.fairnessCommitment` keyed by `roundId`. `ROUND_STARTED.data.fairnessCommitment` must match it. Do not replace this saved value with a later response's hash.

### Reveal

Before crash, fairness returns `roundId,status=COMMITTED,commitment,algorithm=SHA-256,format=air-balloon-fairness:v1`. It omits `serverSeed`, crash result, canonical input and future booster.

After CRASH/FINISHED it additionally returns exact string `serverSeed`, `crashMultiplier`, optional/null `boosterLevel`, `verified`, and `canonicalInput`.

### Independent verification

The current UI only requests/displays proof and explicitly says independent verification is pending. The future browser verifier must recreate UTF-8 canonical input with LF after every line:

```text
air-balloon-fairness:v1
roundId=<canonical lowercase UUID>
serverSeed=<signed 64-bit decimal string>
crashMultiplier=<plain decimal without exponent/trailing zeroes>
boosterLevel=<integer or null>
```

Then compare `sha256:` + lowercase SHA-256 hex with the commitment saved at start. The server's `verified=true` and returned `canonicalInput` are diagnostics, not independent proof. Client verification does not calculate or override the authoritative outcome.

## 13. Environment and REAL/MOCK switch

Existing names are sufficient; do not introduce new env names unless final Core truly requires a separate public WS origin.

| Existing variable | Future REAL value |
| --- | --- |
| `VITE_API_MODE` | `real` |
| `VITE_API_BASE_URL` | preferably empty for same-origin Nginx proxy; otherwise browser-reachable HTTP(S) origin such as `http://127.0.0.1:8080` |

The WebSocket URL is derived from `VITE_API_BASE_URL` (or `location.href`) and the fixed `/ws/rounds` path. There is no existing `VITE_WS_URL`.

Switch path:

```text
VITE_API_MODE=mock
  → complete auth/catalog/money mappings in `real.ts`
  → configure same-origin /api and /ws proxy
  → pass Docker build args
  → VITE_API_MODE=real
```

Important: Vite variables are build-time values. `frontend/Dockerfile` defines build args, but the audited frontend `docker-compose.yml` does not pass them. Merely setting a runtime container environment variable will not change the already-built JS bundle.

## 14. CORS, cookies and Origin

Preferred topology is same-origin browser traffic through frontend Nginx. It avoids exposing Docker hostnames and minimizes CORS/cookie/WS differences.

If using direct cross-origin browser calls:

- `fetch` already uses `credentials: include`;
- server CORS must allow the exact frontend scheme/host/port and credentials for all auth/user/economy/history/result/game routes, not only `/api/rounds/**`;
- cookies need suitable `Secure`, `HttpOnly`, `SameSite`, domain/path and HTTPS policy;
- WS allowed Origin must exactly contain the browser origin;
- default Backend №1 allows `http://localhost:5173`, not `http://127.0.0.1:5173`, while project docs commonly use 127.0.0.1;
- Backend №2 currently defines no matching global CORS layer.

Same-origin proxy still requires the backend to trust forwarded deployment headers as appropriate, but the browser sees one origin and sends the same session cookie to `/api` and `/ws`.

## 15. Docker topology and URLs

```text
Browser
  │ http://127.0.0.1:5173/       (browser-reachable host port)
  ▼
Frontend Nginx container
  │ /api/* and /ws/* → http://backend:8080 / ws://backend:8080
  ▼
Backend container
  │ jdbc:postgresql://postgres:5432/air_balloon
  ▼
PostgreSQL container
```

Rules:

- Browser JS must use empty `VITE_API_BASE_URL` for same-origin or a host-reachable URL. It must never use `http://backend:8080`; `backend` is a Docker DNS name unavailable to the browser.
- Nginx may use `backend:8080` because it runs inside the Compose network.
- Backend may use `postgres:5432`; browser/frontend must not.
- Backend №2 Nginx already proxies `/api/`, but not `/ws/`. Add a WebSocket location with HTTP/1.1 Upgrade/Connection forwarding during Core integration.
- Frontend branch Nginx proxies neither `/api` nor `/ws`; the Core/economy Nginx version must win in conflict resolution and be extended for WS.
- Dev Vite already proxies `/api` and `/ws` to `127.0.0.1:8080`.

## 16. Expected integration file changes

| File | Expected change | Complexity | Risk |
| --- | --- | --- | --- |
| `frontend/src/api/real.ts` | Implement final auth/current-user/logout/catalog; raw DTO normalization; WS auth/error validation | HIGH | Identity or money corruption; reconnect behavior |
| `frontend/src/api/types.ts` | Separate raw/UI money types; add fairness metadata, optional tier/profile contracts, personal history only if published | HIGH | Wide compile impact |
| `frontend/src/game/session.ts` | Consume replay result, validate eventId, preserve exact server values/commitment, reset cursor correctly | HIGH | Duplicate/missed events or stale cashout UI |
| `frontend/src/api/index.ts` | Usually no logic change; retain the single REAL/MOCK composition point | LOW | Accidentally shipping MOCK |
| `frontend/src/app/App.tsx` | Remove REAL waiting copy once auth is live; map server profile/logout failures | MEDIUM | False logged-in UI after invalid session |
| `frontend/src/app/GameHome.tsx` | Canonical identity, exact wallet/catalog values, active-round recovery ownership | MEDIUM | Cross-user local active-round key or unsafe comparisons |
| `frontend/src/app/Gameplay.tsx` | Decimal-safe formatting/comparison props; retain server authority and booster secrecy | MEDIUM | UI enabling cashout from imprecise/stale state |
| `frontend/src/app/Panels.tsx` | Decimal-safe result/history formatting; independent fairness verification; keep global/personal labels distinct | MEDIUM | Misreported payout/proof/history scope |
| `frontend/package.json` / lock | Add decimal helper library only if project chooses one | LOW | Dependency/lock conflict |
| `frontend/nginx.conf` | Merge `/api` proxy and add `/ws` Upgrade proxy | HIGH | Production HTTP/WS unavailable or auth cookie split |
| `frontend/Dockerfile` | Keep REAL build args and confirm production default/pipeline | LOW | Bundle built in MOCK mode |
| `frontend/vite.config.ts` | Retain existing `/api` + `/ws` dev proxies; align port only if Core changes it | LOW | Dev-only connectivity |
| `.env.example` | Document final values using existing names | LOW | Operator confusion |
| `docker-compose.yml` | Merge frontend/backend/PostgreSQL services, healthchecks, build args, ports/origins | HIGH | Browser vs Docker URL mix-up; startup/auth failures |
| frontend tests | Add REAL adapter DTO, auth, replay/gap, decimal and fairness verification tests | MEDIUM | Regressions hidden by MOCK tests |
| E2E central adapters/env | Align only if final Core deliberately changes published routes/auth headers | MEDIUM | Acceptance tests target obsolete contract |

Likely merge conflicts are concentrated in `docker-compose.yml`, `.env.example`, `frontend/nginx.conf`, `frontend/Dockerfile`, `frontend/vite.config.ts`, `frontend/README.md`, and `frontend/src/app/App.tsx` because the source feature branches independently changed them.

## 17. Integration blockers

1. `integration/backend-core` is not published on origin at audit time.
2. No server login/logout/current-user contract exists.
3. Game demo Principal and Economy demo-user UUIDs differ; production auth adapter is absent.
4. Economy user state/result/global history endpoints are not principal-scoped in Backend №2.
5. No public player catalog or enumerated valid stakes contract exists. Admin config cannot be used by browser UI.
6. Decimal Game Engine amounts and integer Economy amounts lack one final unit/rounding/wire contract.
7. Durable Game resilience ports/checkpoints/outbox must be connected by final Core; current resilience replay/checkpoints are memory-backed.
8. Production Nginx lacks `/ws` proxy; frontend Nginx also lacks `/api` proxy.
9. Direct cross-origin configuration is incomplete and default Origin values differ between `localhost` and `127.0.0.1`.
10. Frontend has no independent fairness verifier and does not consume replay payload semantics.
11. Personal history endpoint/method is absent and must remain separate from global history.

Tournament is intentionally excluded. A future Tournament screen/API/WS requires a separate post-Core audit and integration.

## 18. Exact future integration order

1. Create `integration/full-app` from the final `integration/backend-core` SHA and record that SHA.
2. Merge `feature/game-frontend` @ `f34754e8c45ea2316833ae99057cba6958cf05f9`.
3. Resolve frontend/infrastructure conflicts only; keep Core backend contracts and no Tournament code.
4. Confirm final money units/serialization and canonical UUID identity before writing adapters.
5. Configure auth: login, logout, current-user, HTTP credentials and WS handshake must resolve the same Principal.
6. Bind economy: map authenticated `UserState` to profile/wallet; prove start debit and cashout credit are exact and idempotent.
7. Bind player config/catalog. Do not expose admin token; if no public catalog was added, keep REAL start blocked rather than using mock stakes.
8. Bind game HTTP using existing routes; preserve empty cashout body, stable UUID idempotency key and no automatic start retry.
9. Bind game WebSocket `/ws/rounds`; verify `CONNECTION_READY`, private event delivery, full envelope and all seven gameplay event types.
10. Complete sequence/replay reducer and snapshot fallback; test duplicate, stale, wrong-round, gap and expired replay cases.
11. Bind global history to the current all-profiles screen. Bind personal history only to a separately published scoped contract/UI.
12. Bind result/reward and verify the fixed cashout values remain unchanged through final crash.
13. Bind fairness commitment/reveal; add independent browser SHA-256 verification using exact strings.
14. Merge/configure Docker topology: frontend Nginx same-origin `/api` and `/ws`, backend, PostgreSQL, healthchecks and browser-safe URLs.
15. Pass `VITE_API_MODE=real` and `VITE_API_BASE_URL=` as frontend build args; verify the produced UI says `REAL API` and contains no MOCK dev controls.
16. Run `npm ci`, frontend unit tests and production build.
17. Run `scripts/acceptance.ps1 -Mode self-check`, then live/full `feature/e2e-acceptance` against real Core/PostgreSQL/browser. Treat required `BLOCKED` as non-pass.
18. Run fresh-database migrations and restart persistence acceptance with the final Compose project; enable active-round restart test only if Core promises it.

## 19. Final contract status

```text
AUTH:             WAITING FOR FINAL CORE
CURRENT USER:     WAITING FOR FINAL CORE
BALANCE:          CORE CHANGE REQUIRED
GAME CONFIG:      MISSING
START ROUND:      ADAPTER CHANGE
CASHOUT:          MATCH (route/payload/authority; auth and money policy remain Core-wide blockers)
SNAPSHOT:         MATCH (decimal normalization required)
REPLAY:           ADAPTER CHANGE
WEBSOCKET:        ADAPTER CHANGE
RESULT:           ADAPTER CHANGE
GLOBAL HISTORY:   ADAPTER CHANGE
PERSONAL HISTORY: MISSING
FAIRNESS:         ADAPTER CHANGE (commit/reveal match; independent verifier missing)
RECONNECT:        ADAPTER CHANGE
```

Estimated integration complexity: **HIGH** until auth/identity/money contracts are fixed in Core; then **MEDIUM** frontend work because most game routes and event fields already align.

```text
FRONTEND API LAYER READY FOR BINDING: NO (shape prepared; auth/catalog/exact-money/replay verification incomplete)
GAME HTTP CONTRACT COMPATIBLE: YES, CHANGES REQUIRED AT ADAPTER MONEY/AUTH BOUNDARY
GAME WS CONTRACT COMPATIBLE: YES, CHANGES REQUIRED FOR AUTH/PROXY/REPLAY VALIDATION
ECONOMY CONTRACT COMPATIBLE: CHANGES REQUIRED
AUTH CONTRACT COMPATIBLE: CHANGES REQUIRED / WAITING FOR FINAL CORE
HISTORY CONTRACT COMPATIBLE: GLOBAL YES WITH ADAPTER CHANGES; PERSONAL NO CONTRACT

READY TO START REAL BINDING WHEN CORE FINISHES: YES, IF CORE RESOLVES THE LISTED AUTH/IDENTITY/MONEY/CATALOG BLOCKERS
PRODUCTION CODE MODIFIED: NO
```
