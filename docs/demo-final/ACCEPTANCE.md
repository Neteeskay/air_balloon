# Final acceptance record

## Mandatory scenarios

| Scenario | Result |
| --- | --- |
| S1 — login, balance, selection, start | PASS |
| S2 — cashout, result, continued flight | PASS |
| S3 — crash without cashout / loss | PASS |
| S4 — booster activation and points | PASS |
| S5 — protected runtime config change and restore | PASS |

## Automated suites

- Backend: **381/381 PASS**
  - 301/301 unit/integration tests in an isolated Docker test run.
  - 79/80 integration tests passed in the full Docker acceptance process; the remaining migration-upgrade test requires Docker access for nested Testcontainers and passed 6/6 separately on the host against a new empty PostgreSQL instance. All 80 unique integration tests PASS.
- Frontend: **32/32 PASS**
- E2E: **38/38 PASS**
  - API: 20/20 PASS.
  - Browser: 17/17 PASS, including the cleanup fixture.
  - Browser engines: Chromium, Firefox, and WebKit all PASS.

## Frontend gates

- Typecheck: PASS
- Lint: PASS
- Production build: PASS

## Clean-room record

A fresh Compose project and fresh PostgreSQL volume were used. PostgreSQL, backend, and frontend containers reached healthy/running state. Backend startup logs report Flyway validation of eight migrations and successful application through `V303`; the backend then started normally. Backend actuator health reported `UP`.

## Real browser smoke

The real browser acceptance run covered login/profile/balance, GREEN and RED flows, paired stake and booster selection, start/levels/cashout/continued flight/crash/result, loss, booster rendering and points, onboarding/result return, history, tournament, reconnect, page reload, and the three-engine browser matrix. Result: PASS.

The browser acceptance cleanup restored the original runtime config after the S5 workflow.

## Defect count

- P0: 0
- P1: 0
- P2: 0
- P3: 0

No product changes, test skips, or test deletions were made for this release.
