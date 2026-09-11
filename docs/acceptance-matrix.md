# Air Balloon acceptance traceability matrix

Матрица подготовлена по документации `main` и опубликованным контрактам веток
`origin/codex/game-resilience` (`2b538e3`) и
`origin/feature/backend-data-economy` (`6e88eea`). В `main` описаны только
обязательные сценарии 1–5. В этой матрице сценарии 6–8 — обозначения для явно
поставленных acceptance-расширений: reconnect/replay, fairness и restart persistence.

Статусы относятся к состоянию ветки на 2026-09-11. `READY (design)` означает,
что executable test готов, но не объявляет production PASS. `WAITING` и `BLOCKED`
всегда дают ненулевой код в полном прогоне REQUIRED-набора.

## REQUIRED

| ID | Requirement | Priority | Test | Backend functionality | Frontend functionality | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1-LOGIN | Demo login and current identity | REQUIRED | `S1-BROWSER`, `MULTI-USER` | Demo users and authenticated principal must identify the same user | Semantic login form and logged-in identity | WAITING FOR CORE/FRONTEND | Login is client-only in `feat/demo-login`; Core auth contract is not published |
| S1-BALANCE | Balance is visible and authoritative | REQUIRED | `S1-API`, `S1-BROWSER` | `GET /api/users/{id}/state` | Visible balance | READY (design) | Real data endpoint from Backend №2; end-to-end identity remains blocked |
| S1-THEME-GREEN | GREEN has exactly 9 levels | REQUIRED | `S1-API`, `S1-BROWSER`, `RELIABILITY` | `RoundView.totalLevels` and `levelThresholds` | Real DOM level collection | READY (design) | API asserts 9 and array length; DOM asserts rendered count |
| S1-THEME-RED | RED has exactly 12 levels | REQUIRED | `S1-API`, `S1-BROWSER`, `RELIABILITY` | `RoundView.totalLevels` and `levelThresholds` | Real DOM level collection | READY (design) | API asserts 12 and array length; DOM asserts rendered count |
| S1-OPTIONS | Stakes, booster ×2, rules and history are available | REQUIRED | `S1-BROWSER` | Validated start request; history endpoint | Semantic buttons/regions | WAITING FOR FRONTEND | Page Object uses roles/names; current game UI is not published |
| S1-INSUFFICIENT | Unaffordable valid stake is blocked | REQUIRED | `S1-API` | 409 `INSUFFICIENT_BALANCE`, no debit | Disabled unavailable stake | PARTIAL | API case ready; Core must expose valid stake range or set `ACCEPTANCE_UNAFFORDABLE_STAKE` |
| S1-START-DEBIT | Start creates round and debits stake exactly once | REQUIRED | `S1-API` | `POST /api/rounds` + persistent economy | Start control and updated balance | READY (design) | Exact integer/decimal comparison, no floating point |
| S2-CASHOUT-RULE | Cashout disabled before Level 1 and enabled after | REQUIRED | `S2-API`, `S2-BROWSER` | 409 before Level 1; snapshot flag after | Disabled/enabled accessible button | READY (design) | Separate early and successful command assertions |
| S2-PAYOUT | Payout equals stake × fixed multiplier | REQUIRED | `S2-API` | BigDecimal cashout and credit | Result displays server values | READY (design) | BigInt decimal helper reproduces scale-2 `RoundingMode.DOWN` |
| S2-ONCE | Duplicate cashout cannot pay twice | REQUIRED | `S2-API`, `DOUBLE-PAYOUT`, `WS-RECONNECT-CASHOUT` | Idempotency-Key and ledger idempotency | Single accepted action | READY (design) | 100 simultaneous same-key retries plus reconnect retry |
| S2-CONTINUE | Flight continues after cashout; fixed payout does not change | REQUIRED | `S2-API`, `S2-BROWSER` | `CASHED_OUT` → crash → `FINISHED` | Live multiplier and upsell | READY (design) | Final multiplier must exceed fixed cashout multiplier |
| S2-RESULT-HISTORY | WIN result and history contain completed round | REQUIRED | `S2-API`, `S2-BROWSER` | Result/history persistence | Result and history | READY (design) | Round ID and exact payout correlated across APIs |
| S3-LOSS | Crash without cashout loses stake and gives no payout | REQUIRED | `S3-API`, `S3-BROWSER` | `LOSS`, winAmount=0, no balance credit | Lose result | READY (design) | Exact pre/post balance assertion and history correlation |
| S4-ACTIVATE | Server assigns and activates ×2 booster before cashout | REQUIRED | `S4-API`, `S4-BROWSER` | `BOOSTER_ACTIVATED`, server level | Booster state | READY (design) | Exact before × 2 = after and positive points |
| S4-AFTER-CASHOUT | Booster reached after cashout does not activate | REQUIRED | `S4-API` | No activation/points after cashout | No false activation | READY (design) | Event list, final snapshot and frozen score asserted |
| S4-X3-X4 | Validate ×3/×4 because the published engine supports them | REQUIRED | `S4-API` parameterized x3/x4 cases | Booster values 3/4 | Controls ×3/×4 | READY (backend design) | Exact multiplication and extra points are asserted separately for x3 and x4 |
| S5-RESULT | Final screen has outcome, coefficient, points and booster result | REQUIRED | `S5-API`, `S5-BROWSER` | Final snapshot and persisted result/reward | Result dialog | READY (design) | Server result fields plus browser assertions |
| S5-REPLAY | Play Again retains selected GREEN/RED theme | REQUIRED | `S5-BROWSER` | New round accepts theme | Play Again and accessible selected state | WAITING FOR FRONTEND | Semantic Page Object ready |
| CONFIG | Parameters change without source edits; active snapshot is immutable | REQUIRED (project docs) | `CONFIG` | Versioned `/api/admin/config` | Not required | READY (design) | Updates `pointsPerLevel`, compares old/new rounds, restores config |
| WS-CONTRACT | Native socket connect/events contain sequence, eventId and serverTime | REQUIRED | `WS-RECONNECT`, `SEQUENCE` | `/ws/rounds` and replay | Client realtime reducer | READY (backend design) | Real socket helper; no STOMP assumptions |
| S6-RECONNECT | Disconnect/reconnect restores multiplier, level, booster, cashout and sequence | REQUIRED | `WS-RECONNECT` | Snapshot + replay | Reconnect reducer | READY (backend design), WAITING FOR FRONTEND reducer | Real disconnect and new socket, not mocked |
| S6-GAP | Gap/out-of-order 10,12,11 is not applied blindly | REQUIRED | `SEQUENCE`, `HARNESS-SEQUENCE` | Replay/snapshot contract | Gap-aware reducer | PARTIAL | Real replay recovery tested; frontend reducer awaits UI integration |
| S6-AFTER-CASHOUT | Reconnect after cashout keeps fixed payout and no second credit | REQUIRED | `WS-RECONNECT-CASHOUT` | Snapshot/idempotency | Restored cashed-out UI | READY (backend design) | Retry and final snapshot assertions |
| S7-COMMIT | Commitment exists at start; seed/result hidden before crash | REQUIRED | `FAIRNESS` | Commit endpoint/event allow-list | Client stores original commitment | READY (design) | Checks REST and ROUND_STARTED, rejects leaks |
| S7-VERIFY | Original VERIFIED; crash/booster/seed/roundId tampering NOT VERIFIED | REQUIRED | `FAIRNESS`, `HARNESS-FAIRNESS` | Reveal endpoint | Optional proof UI | READY (design) | Independent Node crypto verifier ignores server `verified` claim |
| S8-RESTART | User, balance, history and result survive backend restart | REQUIRED | `PERSISTENCE-PREPARE`, `PERSISTENCE-VERIFY` | Durable Core/PostgreSQL adapters | Login/read after restart | READY (design), WAITING FOR CORE | Runner performs actual container restart between tests |
| S8-ACTIVE | Active round recovery after process restart | CONDITIONAL REQUIRED | Persistence tests with `ACCEPTANCE_ACTIVE_ROUND_RECOVERY=1` | Durable active checkpoint/recovery | Restored flight | NOT RUN | Enable only when final Core declares process-restart recovery |
| DB-FRESH | Fresh PostgreSQL migrations succeed | REQUIRED | `scripts/acceptance.ps1 -FreshDatabase` | Flyway + PostgreSQL 17 | N/A | READY (runner) | Dedicated Compose project; no SQLite/mocks |
| DB-REPEAT | Repeated startup and constraints | REQUIRED | `scripts/acceptance.ps1` | Healthy repeated Compose startup; schema constraints | N/A | READY (runner) | Real `psql` checks |
| RELIABILITY | 100 parallel rounds and generated fairness proofs | REQUIRED | `RELIABILITY` | Concurrent starts, 100 reveals and commitments | N/A | READY (design) | 100 unique IDs/commitments; every revealed seed is exact string and independently verifies |
| MULTI-USER | A/B balance and history never mix | REQUIRED | `MULTI-USER` | Authenticated principal and scoped history | Two logins | BLOCKED | Backend №2 currently publishes global history; Core identity contract absent |
| CURRENT-ID | Login user A = economy user A = history user A | REQUIRED | `CURRENT-IDENTITY` | Principal-bound start/state/history | Logged-in user A | BLOCKED | No final authenticated current-user contract is published |

## OPTIONAL

| ID | Requirement | Priority | Test | Backend functionality | Frontend functionality | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FAIL-WS | Controlled WebSocket disconnect | OPTIONAL reliability | `WS-RECONNECT` | Connection-independent scheduler | Reconnect handling | READY (backend design) | Socket is actually closed and recreated |
| FAIL-DUP | Duplicate/simultaneous command injection | OPTIONAL reliability | `DOUBLE-PAYOUT` | Idempotent command/economy | N/A | READY (design) | 100 concurrent requests |
| FAIL-DB | Delayed DB availability | OPTIONAL reliability | Future Compose profile | Retry/health behavior | Loading/error UI | NOT RUN | No final Core startup policy is published; must not be invented |
| ARTIFACTS | JSON/Markdown/HTML, traces, screenshots and logs | REQUIRED harness | Reporter + runner | HTTP/WS errors in report | Screenshot only on failure | READY | `artifacts/acceptance/` is gitignored |

## FUTURE TOURNAMENT

Tournament checks are intentionally excluded from REQUIRED Core acceptance and do
not import `feature/backend-tournament` production code.

| ID | Requirement | Priority | Test | Backend functionality | Frontend functionality | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-LEADERS | top-3 and currentPlayer | FUTURE | TODO after Backend №3 | Leaderboard API | Leaderboard panel | NOT RUN / WAITING FOR BACKEND №3 | Separate integration required |
| T-MASK | Username masking | FUTURE | TODO after Backend №3 | Masking policy | Masked display | NOT RUN / WAITING FOR BACKEND №3 | Separate integration required |
| T-TIMER | Tournament timer | FUTURE | TODO after Backend №3 | Server lifecycle/time | Countdown | NOT RUN / WAITING FOR BACKEND №3 | Separate integration required |
| T-WS | Leaderboard WebSocket updates | FUTURE | TODO after Backend №3 | Tournament realtime | Live table | NOT RUN / WAITING FOR BACKEND №3 | Not part of `/ws/rounds` tests |
| T-SCORE | Score idempotency | FUTURE | TODO after Backend №3 | Score event ledger | Stable rank | NOT RUN / WAITING FOR BACKEND №3 | Separate integration required |
