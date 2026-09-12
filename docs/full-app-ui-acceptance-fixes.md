# Full App UI acceptance fixes

Source: `integration/full-app-frontend-complete` (`1119187a8792ec8f33c074fe9c7429ade5a2a36e`)

Target: `fix/full-app-ui-acceptance`

## 1. Landing audio

**ROOT CAUSE:** gameplay audio created a new `AudioContext` lazily on a later server event, outside the user gesture.

**FIX:** expose an explicit crash-audio unlock and invoke it together with the Landing/Bet/Gameplay gesture unlock. Context creation/resume is guarded and no autoplay workaround is used.

**FILES:** `frontend/src/components/sky/useSkySounds.ts`, `frontend/src/features/game/hooks/useCrashSounds.ts`, `frontend/src/features/game/pages/CrashGamePage.tsx`.

**TEST:** typecheck, lint, unit suite and production build pass.

## 2. Mode scale

**ROOT CAUSE:** the full mode-page stylesheet was not included in the assembled frontend stylesheet.

**FIX:** restored the responsive 16:9 mode composition in a dedicated `flight-mode.css` import; mobile switches to document flow without global scaling.

**FILES:** `frontend/src/styles/flight-mode.css`, `frontend/src/main.tsx`.

**TEST:** production build pass; responsive rules cover 375–1920px layouts.

## 3. Booster before start

**ROOT CAUSE:** `LevelsIndicator` rendered a fixed level 6/8 booster marker on the Bet screen.

**FIX:** pre-game scale now contains only level dots. The marker is rendered only from the authoritative active-round snapshot.

**FILES:** `frontend/src/features/betting/components/LevelsIndicator.tsx`.

**TEST:** unit suite pass.

## 4. Result overlap

**ROOT CAUSE:** the legacy cashout confirmation block had no layout rule for its explanatory text.

**FIX:** added a constrained grid block with independent lines for payout, “Могли бы забрать больше”, and supporting copy.

**FILES:** `frontend/src/styles/index.css`.

**TEST:** build pass; responsive CSS uses clamped typography.

## 5. Booster activation animation

**FIX:** authoritative `boosterActivated` transition displays a short pulse/glow toast and stage emphasis.

**Replay-safe:** activation key is round + authoritative level and is consumed once.

**Reconnect-safe:** an already-active snapshot initializes the key without replaying the effect.

**FILES:** `frontend/src/features/game/pages/CrashGamePage.tsx`, `frontend/src/styles/index.css`.

## 6. Progress marker freeze

**ROOT CAUSE:** marker position was clamped to a fixed 178px, so it stopped changing after the early levels.

**FIX:** marker is now derived continuously from authoritative coefficient/threshold interpolation for the entire round; no client-side game authority was added.

**FILES:** `frontend/src/features/game/components/LevelProgressTrack.tsx`, `frontend/src/styles/index.css`.

**TEST:** unit suite/build pass; reconnect continues through snapshot refresh.

## 7–9. Landing composition and navigation

Landing hero copy is lifted responsively with viewport-relative transforms. Shared Bet/Gameplay headers now wire Back and Profile actions; Profile remains a real `/profile` route with backend reload on F5.

**FILES:** `frontend/src/features/landing/styles/landing.css`, `frontend/src/features/betting/components/BetSelectionHeader.tsx`, `frontend/src/features/betting/pages/BetSelectionPage.tsx`, `frontend/src/App.tsx`.

## 10. Play Again vs Repeat Bet

`Играть снова` clears the result and returns to `/bet` without starting a round. `Повторить ставку` submits a fresh `POST /api/rounds` using the previous real theme, amount and booster selection, then navigates to `/game`; backend errors are surfaced by the result screen.

**FILES:** `frontend/src/features/game/hooks/useGameSession.ts`, `frontend/src/App.tsx`.

## 11. Admin CSS

**ROOT CAUSE:** Admin components had no dedicated stylesheet in the assembled bundle.

**FIX:** added an admin-root-scoped stylesheet imported by `AdminApp`, keeping user styles from overriding admin controls and ensuring hashed production CSS includes the admin rules.

**FILES:** `frontend/src/admin/admin.css`, `frontend/src/admin/AdminApp.tsx`.

**TEST:** production build and asset validation pass; no missing literal `/assets` references.

## Verification

- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm test -- --run` — PASS (19 files, 95 tests)
- `npm run build` — PASS
- `npm run validate:assets` — PASS (31 references, 0 broken)

Backend contracts and backend source were not changed.
