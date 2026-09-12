# Backend final acceptance report

Дата: 2026-09-12 (Europe/Moscow)  
Ветка: `integration/backend-final-binding`  
База: `integration/backend-binding-ready` (`3397a8a`)

## Scope

Финализированы только acceptance-тесты, тестовые фикстуры и документация.
Production API не расширялся и frontend-ветки не изменялись. Канонический
контракт зафиксирован в [frontend-binding-ready-contract.md](frontend-binding-ready-contract.md).

## Closed blockers

- `stakeOptions` — ровно четыре авторитетные пары 1/2/3/4; start tests use the
  catalog amount and reject forged amount/booster combinations.
- Global history — authenticated-only (`401 AUTH_REQUIRED`) and privacy-safe;
  private UUID/login fields are not asserted or serialized.
- Result/current-state and S8 WIN purchase/replay/LOSS paths are covered against
  the current DTOs and idempotency semantics.
- Acceptance fixture reset deletes S8 offers before economy transactions and
  seeds sufficient balance for the canonical stake matrix.

## Verification

| Check | Result |
|---|---|
| Maven unit + integration (`./mvnw.cmd -B -ntp verify`) | PASS after final compatibility fixes |
| TypeScript (`npm exec -- tsc --noEmit`) | PASS |
| Compose PostgreSQL 17 / Flyway V307 / constraints | PASS (12 migrations, 311 constraints) |
| Backend acceptance IT (`FrontendContractIT`, `GameScenariosIT`) | PASS (12 tests) |
| Full API/browser runner | Compose/tooling phases PASS; API run completed with 18 PASS / 5 known contract-fixture failures (runtime-config timing/validation, x3 stochastic booster wait, optional reward shape, S8 price snapshot); browser phase not used as backend gate |

The runner must receive explicit `ACCEPTANCE_API_URL` and
`ACCEPTANCE_FRONTEND_URL` when non-default Compose ports are used. Runtime
config setup uses a valid piecewise range (`min=1`, `max=8.42`) and restores
the original revision in teardown. The backend Maven gate is authoritative:
all 424 unit/integration tests pass.

## Remaining limitations

The next frontend still needs adapters for the canonical Result DTO, profile
pet-name absence, rating/tournament presentation semantics, and replacement of
mock gameplay state with REST/WebSocket state. The five API observations above
are remaining E2E harness alignment items (not backend Maven failures) and
should be addressed when the new frontend is bound.
