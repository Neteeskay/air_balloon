# Full project acceptance + Frontend ↔ Backend binding audit

Дата аудита: 2026-09-12 (Europe/Moscow)

## Source and delta

Проверена ветка `integration/backend-admin-improvements`, HEAD
`b280c39aa129cae37b9339f249ced3519d5bf6c8`. Рабочее дерево tracked-файлов
чистое; заранее существующий untracked `docs/backend3-final-core-audit.md`
не изменялся. Base: `integration/backend-admin-base`
(`e4aba7464280ea72211520c70b3a9fd8daab636e`).

Commits после base:

| Commit | Содержание |
|---|---|
| `2e73f77` | Admin config editor, crash-model chart, simulation, `isActive` toggle |
| `01fb3b9` | Russian labels, tooltips, compact admin layout |
| `b280c39` | House-edge wording, stakes KPI, all model parameters by chart |

Delta base..HEAD: 17 файлов, +1163/-137 строк. Backend delta — metadata
`isActive` в `ConfigMetadataService`; admin delta — editor/chart/help/labels,
KPI/filter и UI-flow; frontend delta — новые admin-компоненты, math и
component tests; migrations/infra — без изменений.

## Phase 1 — acceptance

### Database and PostgreSQL

Фактический Flyway-набор: ровно 12 миграций в порядке `V1,V2,V3,V4,V300,
V301,V302,V303,V304,V305,V306,V307`. `V306` один, `V307` последний, V308+
отсутствуют; duplicate-version/checksum conflict не обнаружен.

Fresh PostgreSQL 17.11 Testcontainers и отдельный Docker Compose проект
прошли: 12 успешных migrations, 311 constraints, application boot,
повторный startup. Existing-V307 путь фактически проверен boot-ом на уже
последней версии: database up-to-date, новые migration не требуются.
Migration acceptance сохранила user/balance/score/version/tickets, round,
score event, S8 offer, puzzle progress, clothing/equipment и tournament
membership.

### Backend regression

`mvn -B clean verify -Pacceptance` завершился `BUILD SUCCESS`:

| Набор | Tests | Skipped | Failed | Errors |
|---|---:|---:|---:|---:|
| Surefire unit | 338 | 0 | 0 | 0 |
| Failsafe integration/acceptance | 85 | 0 | 0 | 0 |
| **Итого** | **423** | **0** | **0** | **0** |

Покрыты reliability/concurrency/security/migration/recovery suites; baseline
423 зелёных теста сохранён.

### Full stack browser/API acceptance

Запускался `scripts/acceptance.ps1 -Mode full -FreshDatabase
-SkipBrowserInstall` на выделенных портах (55432/58080/55173), не затрагивая
чужие Compose-проекты и production DB. Tooling, dependencies, typecheck,
harness, fresh DB, Docker start/repeated startup, PostgreSQL, migrations и
constraints — PASS.

`real-api-browser-acceptance`: **21 PASS, 19 FAIL, 3 NOT RUN**, runner exit 1.
Сводные причины из `artifacts/acceptance/acceptance-summary.md`:

- API fairness/S4/WS reconnect получили `undefined` в ожидании booster/event
  полей; S2 ожидал отсутствующий decimal field.
- S5 validation принял `alpha=1` (suite ожидал 400).
- S8 offer отвечал 503 в сценариях WIN/LOSS.
- Browser reconnect/reload, responsive, S1/S2/S4, S8 и tournament не нашли
  ожидаемые текущие элементы/состояния; matrix во всех Chromium/Firefox/WebKit
  не нашёл кнопку sound. Это реальные acceptance failures текущего старого UI/
  contract harness, а не основание объявлять backend unit regression зелёным.

### Core game and math

Backend integration tests и API scenarios подтверждают GREEN (9 levels), RED
(12 levels), start/flight/crash/result/history, commit/reveal, hidden seed,
tamper rejection, immutable round config snapshot, server-authoritative crash
и `PayoutCalculator`. Cashout idempotency и 100 concurrent attempts дают один
settlement. Отдельные full E2E S2/S4 failures перечислены выше (DTO/harness
несовпадение), поэтому browser acceptance целиком не PASS.

### Boosters and Scenario 8

Core tests покрывают x1–x4 assignment/activation, no activation after cashout,
replay/reconnect/restart and points. S8 service has WIN offer, LOSS no offer,
owner check, idempotent purchase, snapshotted price/config, restart persistence
and concurrent purchase protection. Full E2E S8 returned 503 and is recorded as
FAIL; no silent fix was made.

### Puzzle/profile and generic model

WIN settlement grants one fragment, persists progress, completes puzzle and
unlocks clothing; wardrobe/equip/unequip, locked/wrong-slot/foreign ownership,
restart and concurrency are covered by backend tests.

Runtime puzzle code reads `puzzle_definitions.total_fragments`; reward and
progress queries are keyed by puzzle id and do not assume six. Literal `6`
appears only in seed/test data for `SKY_JOURNEY`. Therefore A=6, B=8, C=12 are
supported without core service changes; only data/migrations and valid reward
clothing rows are needed.

Outfit reward audit (current state):

| Capability | Exists |
|---|---|
| complete-outfit rule engine / set detection | NO |
| reward claim and one-time claim protection | NO |
| bonus settlement for outfit | NO |
| fortune-spin inventory / wheel backend | NO |

### Global rating, tournament, player character

`GET /api/rating` passes all-users, zero score, `game_score DESC,
updated_at ASC,id ASC` tie-break, pagination, current-player-outside-page and
revision tests; no internal IDs are in the rating DTO. Tournament membership is
participant-only; ScoreChanged does not create membership and global rating is a
separate aggregate. Player-character codes CAUTIOUS, COLD_BLOODED, CLOSE_CALL,
BOOSTER_HUNTER, GREEDY and ADVENTURER are deterministic with tested priority and
are included in Result DTO.

### Admin acceptance

Backend lifecycle tests pass for opaque Bearer auth, TTL, logout/revocation,
audit, current config, metadata, validate, draft, activate, versions, diff,
rollback and optimistic locking. Admin UI improvements are present and tested
by frontend tests (Vitest component/math); no dedicated Playwright admin page
spec was found.

The verified chain is draft → validate → live publish → old round keeps its
snapshot → new round reads new config → settlement uses round snapshot. Known
fields (min/max bet, update interval, fixed-seed and S8 settings) are preserved
by `LiveConfigPublisher`; EconomyIntegration explicitly asserts this.

`LiveConfigPublisher.buildMerged` keeps core `boosterValues [1,2,3,4]` and
fixed 9/12 levels. FPS, delta and booster tier controls are explicitly
read-only metadata and non-default values are rejected; no unsupported field
is silently reported as active.

### Security and restart

Player session identity is server-side session/principal; admin uses separate
opaque hashed Bearer tokens. Foreign round/equipment access, fake score,
fragment/unlock/cashout/S8 values and admin-token-vs-player-token paths are
covered by backend security tests. Restart persistence passes in backend and
full-stack startup checks for DB/config; browser persistence phase was not run
because real-api-browser-acceptance exited non-zero.

The P1 history issue is fixed: `GET /api/history` requires a player session and
the global DTO contains only round outcome data plus public `displayName`; raw
user UUIDs, email and session fields are omitted.

## Phase 2 — current old frontend binding

### Clients and transports

| Frontend module | Purpose | Transport |
|---|---|---|
| `frontend/src/api/real.ts` | auth, catalog, economy, rounds, result, history, rating, tournament, S8 | fetch REST, cookie credentials, idempotency headers |
| `frontend/src/game/session.ts` | ordered round state, replay, reconnect | native JSON WebSocket |
| `frontend/src/tournament/client.ts` | leaderboard updates | STOMP over WebSocket |
| `frontend/src/admin/client.ts` | admin auth/config/version/diff/audit | fetch REST + Bearer |
| `frontend/src/api/mock.ts` | local demo fallback | mock/localStorage (selected by `VITE_API_MODE`, default mock) |

No axios, SockJS or EventSource usage was found.

### Auth, mode and round flow

Player login POSTs `/api/auth/demo-login` with username/password; backend stores
the UUID in an HTTP session cookie. `/api/auth/me` restores it after F5 and
DELETE `/api/auth/session` logs out. The frontend stores only an active-round id
per user/mode in localStorage and recovers stream → snapshot → replay.
Admin login is an independent opaque Bearer token stored in
`air-balloon-admin-session`; 401 clears it.

Catalog is real (`GET /api/game/catalog`) but the UI derives four stake cards
from min/max bounds (10/25/50/100%), not from authoritative paired stake
options. Balance is `/api/current-user/balance` plus `/state`. Start is
`POST /api/rounds` (`theme`, `betAmount`, `boosterMultiplier`); snapshot is
`GET /api/rounds/{id}`.

### Realtime map

Game URL is `ws[s]://<host>/ws/rounds`; cookie-authenticated native JSON, no
topics/subscriptions. Server emits `CONNECTION_READY`, then
`ROUND_STARTED`, `MULTIPLIER_UPDATE`, `LEVEL_REACHED`, `BOOSTER_ACTIVATED`,
`CASHOUT_SUCCESS`, `CRASH`, `ROUND_FINISHED` with `RoundEventView` payload
(`type,roundId,sequence,timestamp,data,eventId,serverTime`). The frontend applies
only server state; sequence gaps call replay
`GET /api/rounds/{id}/events?afterSequence=...` and then snapshot. Reconnect is
exponential 1/2/4/8 seconds. Tournament uses `/ws` STOMP v12 with
`/topic/tournaments/{id}/leaderboard`, 10s heartbeats and REST refetch on a
higher revision.

### Gameplay, cashout, result and history

Multiplier, crash, booster activation and payout are never calculated by the
old real client. `cashoutPreviewAmount` comes from snapshot/WS; cashout is
`POST /api/rounds/{id}/cashout` with an idempotency UUID and UI busy guard.
Result is `GET /api/rounds/{id}/result` and includes
`roundId,result,betAmount,cashoutMultiplier,crashMultiplier,winAmount,
potentialWinAmount,score,configVersion,playerCharacter,reward,completedAt,
serverTime`; reward includes puzzle fragment/clothing fields. The current
frontend TypeScript result type is stale (generic `{type,rarity}` reward, no
playerCharacter), so extra backend fields are ignored — **binding gap P1**.

Global history is `GET /api/history?page&size`; personal history is
`GET /api/current-user/history`. Current UI consumes personal/history views but
has no non-test caller for `rating.get`; profile/wardrobe/equip clients and UI
are absent. S8 offer is GET `/api/current-user/upsell/lottery-tickets/offer`,
purchase POST with `{offerId}` and `Idempotency-Key`; close/decline is local
suppression (no server mutation).

## New frontend audit (`integration/frontend-final-mock`, `cee86fe`)

Relevant modules: `pages/LoginPage.tsx`, `pages/FlightModePage.tsx`,
`features/betting/pages/BetSelectionPage.tsx`, `features/crash/CrashGamePage.tsx`,
`features/crash/useCrashRound.ts`, `features/results/ResultScreen.tsx`,
`features/avatar/AvatarProfile.tsx`, rating/tournament hooks and
`mocks/mockGame.ts`. Auth, balance, rounds, crash point, multiplier, level,
booster, payout, puzzle progress, clothing unlock, history, rating, tournament
and avatar are all mock/sessionStorage state.

### Mock → real replacement map

| New module/flow | Current mock | Real backend source | Work/risk |
|---|---|---|---|
| Login/current user | `mockAuth`, sessionStorage | `/api/auth/demo-login`, `/me`, session cookie | replace auth and restore |
| Balance | `beginMockRound`/topUp | `/api/current-user/balance`, `/state` | server refresh after mutations |
| Mode/catalog | `betOptions.ts` | `/api/game/catalog` | add authoritative stake-option contract (GAP) |
| Start round | `beginMockRound` | `POST /api/rounds` | idempotency key, map DTO |
| Snapshot/flight | `createCrashRoundMock`, RAF timers | `GET /api/rounds/{id}` + WS events | delete client authority |
| Booster | local activation/score | snapshot + `BOOSTER_ACTIVATED` | render only server value |
| Cashout preview/cashout | local payout math | snapshot `cashoutPreviewAmount`, POST cashout | delete calculation; handle 409 |
| Crash/result | local random crash/finish | `CRASH`/`ROUND_FINISHED`, `/result` | map exact Result DTO |
| History | sample arrays | `/api/current-user/history`, `/api/history` | pagination and privacy |
| Puzzle/profile | local fragments/clothing | `/api/current-user/profile` | add adapters; no petName backend |
| Wardrobe/equip | `saveMockAvatar` | profile + `PUT /api/current-user/profile/equipment` | map slot/id and 400/404/409 |
| Global rating | mock participants | `GET /api/rating` | period/countdown fields absent |
| Tournament | mock leaderboard | `/api/tournaments/active`, leaderboard, join, STOMP | map real membership; no invites |
| Scenario 8 | absent | offer GET + purchase POST | add UI; decline is client-only |
| Player character | absent | Result `playerCharacter` | add result presentation |

### Client-side logic to delete/replace

1. `Math.random` crash-point generation and `createCrashRoundMock`.
2. RAF/setInterval multiplier, level and booster-activation calculations.
3. Local payout, score, balance, ticket, puzzle and clothing mutations in
   `finishMockRound`.
4. Mock top-up, sample history/rating/tournament data and mock auth state.
5. Any “active”/“crashed” decision based on elapsed client time; retain only
   animation and view state.

### Server authority and state ownership

Crash point, multiplier, booster, cashout amount, settlement, balance, score,
puzzle/inventory, rating, tournament and player character belong exclusively to
the backend. Frontend may retain selected mode/bet, modal/tab state, animation,
connection indicator and transient form state. On F5/network wake, reconnect
the game WS, GET snapshot, replay events after the last sequence, and render the
server result; if local round id is unavailable, an `active-round` discovery
endpoint is currently missing (API GAP).

## Contract gaps and UI gaps

Backend API gaps for the new screen set:

1. Catalog exposes bounds/booster values but no authoritative four paired stake
   options; new mock cards cannot be safely derived in general.
2. No persisted `petName` field/endpoint although the new profile mock edits it.
3. Global rating has lifetime score/revision, not the mock period end/countdown,
   rewards or 25-day semantics.
4. Result aggregate lacks theme, player display name, post-settlement balance and
   `canRepeatBet`; these require snapshot/profile/balance joins or DTO additions.
5. No server endpoint to discover the current active round after storage loss.

Frontend UI gaps despite backend support: Scenario 8 offer/purchase, rich
`playerCharacter`, puzzle reward details, full profile/wardrobe/equip, real
rating/tournament screens, and connection/error/fairness states. The new mock
also uses lowercase/hyphen clothing codes; an adapter is required for backend
`AVIATOR`, `SUNHAT`, `BOW`, `CLOUD_SCARF`.

## Recommended binding order

1. Replace auth and current-user restore; remove mock session authority.
2. Bind catalog/mode/bet and canonical balance.
3. Bind start request, snapshot and local active-round persistence.
4. Bind native WS events, sequence replay and reconnect recovery.
5. Bind server cashout preview/cashout and conflict/error handling.
6. Bind result/reward/playerCharacter and history.
7. Bind profile, puzzle, wardrobe, equip and restart refresh.
8. Bind rating and tournament REST/STOMP.
9. Add Scenario 8 UI and session-only close suppression; verify idempotency.
10. Remove all mock math/mutations, then run API + Chromium/Firefox/WebKit
    acceptance and persistence-verify.

## Final status

## Binding-ready follow-up (2026-09-12)

The P1 findings from this audit are now addressed on
`integration/backend-binding-ready`:

- `GET /api/history` requires an authenticated player (`401 AUTH_REQUIRED`)
  and its global DTO exposes only the public display name and round outcome
  fields; internal user UUIDs and usernames are no longer serialized.
- `GET /api/game/catalog` now includes exactly four authoritative paired
  `stakeOptions` (10%, 25%, 50%, 100% of configured maxBet with ×1..×4). The
  HTTP start path rejects forged stake/booster pairs with `INVALID_BET`.
- `GET /api/current-user/active-round` returns the owner’s active snapshot or
  `204`, enabling reconnect after local round-id loss.
- Result responses include canonical `balanceAfter` when the persistent
  economy adapter is active.
- Admin FPS, delta and booster-tier controls are explicitly read-only metadata;
  unsupported changes are rejected rather than silently ignored.

The authoritative handoff is [frontend-binding-ready-contract.md](frontend-binding-ready-contract.md).

- Integration/backend-admin-improvements healthy: **NO for full acceptance**
  (backend regression is green, but full API/browser acceptance is 21/19 with
  three not-run tests).
- Full backend regression: **PASS (423/423)**.
- Current old frontend actually connected to backend: **PARTIAL** (core game,
  auth, realtime, cashout, result, history, tournament and S8 clients exist;
  profile/rating/playerCharacter consumption is incomplete).
- New frontend ready to be rebound: **YES, with the listed adapter/API gaps**.
- Backend API sufficient for new frontend: **PARTIAL**.
- Safe to start real frontend binding: **YES**, beginning with auth/core game;
  do not claim full product fidelity until catalog/petName/result/rating gaps
  and the P1 findings are resolved.
