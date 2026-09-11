# Frontend hardening result

Date: 2026-09-11

Source: `feature/game-frontend` at `f34754e8c45ea2316833ae99057cba6958cf05f9`

Target: `fix/frontend-hardening`

No backend source or backend branch was modified. Work was performed in an isolated Git worktree so the checkout on `integration/backend-core` remained untouched.

## Issues found and fixed

### 1. Transient catalog failure left the setup screen in an endless loader

- severity: HIGH
- problem: the shared retry action refreshed the wallet and active round but never requested the catalog again. A one-off catalog failure therefore could not recover without a full reload.
- fix: retry now clears transport errors and reloads both setup resources; a regression test fails the first catalog request and verifies successful recovery.

### 2. Result and fairness failures kept showing loading copy

- severity: MEDIUM
- problem: rejected result/proof requests left “Загружаем…” visible indefinitely and fairness had no retry action.
- fix: explicit loading, error and retry transitions were added. Failed result data is labelled “Недоступно” until retry succeeds.

### 3. MOCK history leaked completed rounds between demo profiles

- severity: MEDIUM
- problem: history returned every locally stored round, despite the active authenticated demo profile.
- fix: `MockBackend` now scopes history to the signed-in profile. Browser acceptance verified that a fresh second profile receives the empty state.

### 4. MOCK tick persisted and scanned finished rounds while idle

- severity: MEDIUM
- problem: the 100 ms timer remained active after a round finished and repeatedly serialized the complete local database, so cost grew with history.
- fix: finished rounds are skipped, persistence happens only after state changes, and the timer stops when no active round remains. A new start restarts it.

### 5. Closing a modal with Escape did not reliably restore focus

- severity: MEDIUM
- problem: focus could fall back to the document body after the dialog unmounted.
- fix: the opener is captured and focused during dialog cleanup; browser acceptance verified focus returns to the “Правила” button. Dialog overflow is explicitly constrained vertically on mobile.

### 6. Standalone typecheck/lint gates were absent

- severity: MEDIUM
- problem: the repository had no `typecheck` or `lint` scripts. The installed jsdom release also declared a newer Node.js engine than the project runtime.
- fix: added strict TypeScript and ESLint gates with React Hooks rules, and selected a compatible jsdom release. No checks were disabled to obtain a pass.

### 7. Component module caused repeated Fast Refresh invalidation

- severity: LOW
- problem: formatting helpers were exported from the component-only panels module, so Vite invalidated the module instead of applying a clean component refresh during development.
- fix: moved numeric formatting helpers to a framework-neutral game utility module.

## Automated verification

```text
INSTALL: PASS (`npm ci`, 0 vulnerabilities)
TYPECHECK: PASS (`npm run typecheck`)
LINT: PASS (`npm run lint -- --max-warnings 0` via configured script)
TESTS: PASS (5 files, 18 tests)
BUILD: PASS (`npm run build`, Vite production bundle)
```

Regression coverage includes:

- GREEN renders 9 levels; RED renders 12 levels;
- cashout disabled before Level 1 and enabled after Level 1;
- boosters ×2, ×3 and ×4 update activation state, multiplier and points;
- a booster cannot activate after an earlier cashout;
- stake debit, payout credit, cashout idempotency and fixed cashout multiplier;
- WIN and LOSE results;
- Play Again preserves RED selection while clearing old result/cashout state;
- reconnect restores one authoritative snapshot, retains cashout and resumes sequence progress;
- delayed setup data retains the loading state; transient catalog/result failures leave it and recover through retry;
- history is scoped to the active profile.

## Manual browser acceptance

The MOCK app was exercised in a real in-app Chromium browser against the local Vite server. Seven completed rounds were retained together without layout or interaction degradation. Browser warning/error console: empty.

```text
LOGIN: PASS
GREEN WIN: PASS
GREEN LOSE: PASS
RED WIN: PASS
RED LOSE: PASS
BOOSTER ×2: PASS (active, multiplier and score updated)
BOOSTER ×3: PASS (active, multiplier and score updated)
BOOSTER ×4: PASS (active; separate early-cashout round stayed inactive)
CASHOUT: PASS (disabled before Level 1, enabled after, one-shot fixed payout)
PLAY AGAIN: PASS (theme retained; previous result/cashout state cleared)
RECONNECT: PASS (disconnect UI, snapshot/replay recovery, monotonic multiplier, fixed cashout retained)
HISTORY: PASS (WIN/LOSE, stake, multiplier, amount, time, multiple rows and empty state)
INSUFFICIENT BALANCE: PASS (stake/start disabled at 50; restored at 5 000)
MODAL/KEYBOARD: PASS (native buttons, disabled attributes, close focus and Escape restore)
```

## Responsive status

```text
DESKTOP 1440×900: PASS
TABLET 768×1024: PASS
MOBILE 375×812: PASS
```

At each viewport, `scrollWidth` remained within the layout viewport. On mobile the 328 px game card, level rail and 290 px cashout button stayed inside the 375 px viewport. The modal stayed inside the viewport and supports vertical scrolling; the history card remained usable without horizontal overflow.

## Loading and error states

- app boot, setup resources, history, result and fairness expose distinct loading states;
- empty history was verified in the browser with a second demo profile;
- transient catalog and result failures are covered by retry regression tests;
- reconnect and insufficient balance were verified manually;
- async effects use live guards and transport subscriptions/timers are cleaned up on unmount.

## REAL backend blockers

These items require the future `integration/backend-core` binding and were deliberately not implemented here:

1. Agreed server login/current-session contract; local demo passwords must never become REAL credentials.
2. Pre-round stake/theme/catalog endpoint and exact DTO mapping.
3. Final identity mapping for balance/history plus exact event/DTO field-name verification.
4. Production Nginx, CORS, credential and WebSocket-origin configuration during integration.
5. Canonical fairness reveal input and independent browser-side cryptographic verification.
6. End-to-end REAL scheduler/reconnect acceptance with the completed Core backend.

## Final verdict

```text
FRONTEND BUILD READY: YES
MOCK FLOW STABLE: YES
MOBILE READY: YES
READY FOR REAL BACKEND BINDING: YES
BACKEND MODIFIED: NO
```
