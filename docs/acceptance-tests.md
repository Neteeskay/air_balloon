# Automated E2E / acceptance tests

This suite is a black-box consumer of the application. It does not import or alter
Game Engine, Economy, Login, Tournament or frontend business code. Missing final
integration is reported as `BLOCKED`, never converted to PASS with mocks.

## What exists

- `e2e/specs/api/`: real HTTP, native WebSocket, reconnect/replay, exact economy,
  fairness, concurrency and multi-user checks.
- `e2e/specs/browser/`: Playwright browser scenarios 1–5 through Page Objects.
- `e2e/specs/persistence/`: checkpoint before and verification after a real backend
  container restart.
- `e2e/specs/harness/`: offline self-checks for the acceptance tools only. A PASS
  here is not application acceptance evidence.
- `scripts/acceptance.ps1`: strict one-command runner.

The concrete routes are not invented. They come from the published branches:

```text
POST /api/rounds
GET  /api/rounds/{roundId}
POST /api/rounds/{roundId}/cashout
GET  /api/rounds/{roundId}/events?afterSequence=N
GET  /api/rounds/{roundId}/fairness
GET  /api/demo/users
GET  /api/users/{id}/state
GET  /api/history?page=0&size=100
GET  /api/rounds/{id}/result
GET/PUT /api/admin/config
WS   /ws/rounds
```

If Core intentionally changes a route during integration, update the central
`e2e/helpers/api-client.ts` adapter and the API contract documentation together.

## Prerequisites

- PowerShell 7 or Windows PowerShell 5.1.
- Node.js 18+ and npm.
- For full acceptance: Docker Engine with Compose, and a final Compose file with
  healthy `postgres`, `backend` and `frontend` services.
- Network access on first install for npm and Playwright Chromium.

The full suite uses real PostgreSQL. SQLite, an in-memory DB and HTTP mocks do not
count as final evidence.

## Running

Offline harness self-check (safe before Core/frontend merge):

```powershell
.\scripts\acceptance.ps1 -Mode self-check
```

Against an already-running application, without controlling restart:

```powershell
.\scripts\acceptance.ps1 -Mode live
```

Full Docker/PostgreSQL/browser/restart acceptance:

```powershell
.\scripts\acceptance.ps1 -Mode full
```

Fresh-DB migration proof uses a dedicated Compose project. It removes volumes only
inside the exact `air-balloon-acceptance` project before starting:

```powershell
.\scripts\acceptance.ps1 -Mode full -FreshDatabase
```

Use alternate host ports if another stack already occupies 5432/8080/5173. The
runner leaves its stack running for inspection. Stop it later without deleting data:

```powershell
docker compose -p air-balloon-acceptance stop
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `ACCEPTANCE_API_URL` | `http://127.0.0.1:8080` | Real backend base URL |
| `ACCEPTANCE_FRONTEND_URL` | `http://127.0.0.1:5173` | Real browser target |
| `ACCEPTANCE_WS_URL` | API URL converted to `ws` + `/ws/rounds` | Native game socket |
| `ACCEPTANCE_WS_ORIGIN` | unset | Explicit allowed WebSocket Origin when required |
| `ACCEPTANCE_USERNAME` / `ACCEPTANCE_PASSWORD` | `anna` / `balloon1` | Browser/API demo user |
| `ACCEPTANCE_SECOND_USERNAME` | `maks` | Isolation user B |
| `ACCEPTANCE_AUTH_HEADERS` | `{}` | JSON object of real auth headers for user A |
| `ACCEPTANCE_SECOND_AUTH_HEADERS` | `{}` | Distinct JSON auth headers for user B |
| `ACCEPTANCE_ADMIN_TOKEN` | `local-demo-admin` | Versioned config acceptance |
| `ACCEPTANCE_STAKE` | `100` | Valid stake, passed as a decimal string |
| `ACCEPTANCE_UNAFFORDABLE_STAKE` | derived | Known valid stake exceeding balance |
| `ACCEPTANCE_RELIABILITY_STAKE` | `1` | Stake for 100 parallel starts |
| `ACCEPTANCE_EVENT_TIMEOUT_MS` | `120000` | Real round/event deadline |
| `ACCEPTANCE_ACTIVE_ROUND_RECOVERY` | unset | Set `1` only if final Core promises process-restart recovery |

Auth headers are JSON, for example:

```powershell
$env:ACCEPTANCE_AUTH_HEADERS = '{"Authorization":"Bearer <user-a-token>"}'
$env:ACCEPTANCE_SECOND_AUTH_HEADERS = '{"Authorization":"Bearer <user-b-token>"}'
```

Do not put tokens in committed files or reports. Metadata records URLs, not headers,
passwords or secrets.

## Browser selector contract

Page Objects prefer roles and accessible names for login, themes, stake, booster,
rules, history, start, cashout and Play Again. Dynamic values need stable semantic
hooks because text changes every tick:

```text
data-testid="multiplier"
data-testid="current-level"
data-testid="booster-state"
data-testid="round-points"
data-testid="round-result"
data-level on each rendered level (or an accessible list named Levels/Уровни)
```

These hooks describe what the pending frontend must expose for automation; this
branch does not modify frontend production code to add them.

## Reports and strict result

All output is under the gitignored `artifacts/acceptance/` directory:

- `acceptance-summary.json` and `playwright-report.json`: machine-readable results;
- `acceptance-summary.md`, `runner-summary.md`: human-readable results;
- `playwright-html/`: interactive report;
- `test-results/`: traces and screenshots only for failures;
- `compose.log`: relevant backend/frontend/PostgreSQL logs on a failed full run;
- `restart-checkpoint.json`: non-secret persistence correlation data.

Status rules:

- `PASS`: a real assertion completed against the requested layer.
- `FAIL`: functionality exists but violates the contract.
- `BLOCKED`: a REQUIRED dependency/contract is absent; exit is non-zero.
- `NOT RUN`: only conditional or FUTURE checks. Tournament remains NOT RUN until
  Backend №3 is deliberately integrated.

Exit code is `0` only when every phase selected by the runner passes. Any test
failure or REQUIRED blocker is non-zero. `-Mode live` deliberately records restart
persistence as NOT RUN; only `-Mode full` can be final evidence.

## Mock UI versus real acceptance

This branch intentionally contains no mock-backed UI PASS path. `specs/harness`
checks only the test utilities (decimal math, fairness hashing and sequence guard).
Every test under `specs/browser` opens the configured real frontend, which must in
turn use the real Core and PostgreSQL. Browser failures retain a screenshot/trace.
Therefore a client-only demo screen or mock backend cannot make the final verdict
green.

## Repeatability and data

Round IDs, fairness commitments and idempotency keys are unique per run. Assertions
correlate history/result by round ID and do not require an empty database. Demo
balances are consumed, so repeated reliability runs need enough balance or a fresh
dedicated acceptance DB. `-FreshDatabase` is the supported deterministic reset.

No cleanup API is invented. When final Core publishes a test-user provisioning or
safe cleanup contract, add it to the central API helper rather than writing directly
to production tables.

## Known integration blockers

At preparation time `integration/backend-core` and `feature/game-frontend` are not
published. Backend №2 exposes global history and no authentication; Backend №1
uses a demo principal and in-memory adapters. Consequently identity, scoped history,
real PostgreSQL game persistence, final Docker health and browser game flows cannot
currently PASS together. This is expected and must remain visible as `BLOCKED` until
Core/frontend integration resolves it.
