# FULL APP CORE BINDING RESULT

### BACKEND BASE

`integration/backend-final-binding` (`794d788`)

### FRONTEND SOURCE

`feature/bet-selection-page-pre-game` (`23a3ac6d7fe48b1271e5c1768d8db56a76c41d67`)

### TARGET

`integration/full-app`

### INTEGRATION STRATEGY

The target branch was recreated from the authoritative backend branch. The new
user-facing component tree (sky, bet selection, flight and responsive styles)
was transferred without replacing `frontend/src/admin`. A typed REST adapter
uses session cookies (`credentials: include`), canonical catalog `stakeOptions`,
active-round recovery, result/profile/wardrobe/equipment endpoints and unified
HTTP error handling. Gameplay now consumes the round snapshot and native JSON
WebSocket events; crash, multiplier, payout, score, balance and rewards are
server-owned. The legacy mock backend remains available only as an explicit
`VITE_API_MODE=mock` test/dev override; shipped default is `real`.

### ADMIN PRESERVED

`#/admin` routing, Admin login, Overview, Config, Versions, Audit, API client
and admin styles are preserved from the backend base.

### AUTH / CATALOG / GAMEPLAY

- Real login/restore/logout: **YES** (`/api/auth/demo-login`, `/api/auth/me`,
  `DELETE /api/auth/session`); no player token in localStorage.
- Catalog and paired stakes: **YES**, sourced from `stakeOptions[]`; no static
  stake authority in the production path.
- Start/cashout/result: **YES**, with idempotency keys and duplicate-click guard.
- Active-round recovery: **YES** through `/api/current-user/active-round`.
- Native WebSocket `/ws/rounds`, sequence-aware snapshot refresh and reconnect:
  **YES**. The visual RAF/timers are not outcome authority.
- Canonical balance/result/profile data: **YES**. Equipment is exposed through
  the typed `PUT /api/current-user/avatar/equipment` client.

### STILL MOCK / NOT YET BOUND

The decorative tournament/rating modal content from the visual source remains
demo-only in this first core pass. Fortune Wheel is not connected to economy.

### VERIFICATION

- Frontend typecheck/build: **PASS** (`npm run build`).
- Frontend tests: **PASS** (64 tests).
- Backend `./mvnw.cmd -B verify`: **PASS** (338 unit + 86 integration/acceptance,
  424 total; PostgreSQL 17 Testcontainers; Flyway validated/applied through
  V307).

### FINAL VERDICT

NEW USER FRONTEND PRESERVED: **PASS**  
ADMIN PRESERVED: **PASS**  
CORE MOCK AUTHORITY REMOVED FROM PRODUCTION: **PASS**  
REAL CORE TRANSPORT AND GAMEPLAY BOUND: **PASS**  
READY FOR MANUAL FULL-APP TEST: **YES**
