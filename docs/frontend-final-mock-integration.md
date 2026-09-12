# Complete mock frontend integration

## Audit

- Base: `fix/mode-page-polish` (`6b0d8f1dc17d2031a4ca6b2505ec0745b83852bd`).
- Requested game source: `feature/bet-selection-page-pre-game` (`0b7457412a8e2aacaafbe5a3c7532cdec5bce697`).
- The requested source contains the Bet/pre-game implementation and sky assets, but no full Gameplay implementation (`frontend/src/features/game/.gitkeep` only). The temporary bridge on the base explicitly confirmed this.
- The integration therefore uses a manual semantic integration: current base routing, Mode, Profile, Result and mock state remain authoritative; Bet assets and the gameplay contract are connected without cherry-picking old `App.tsx`, routes or Result styles.

## Gameplay integration

`MockGameplay` replaces `MockGameplayBridge`. A `MockRound` now stores its start time, deterministic demo crash window, crash multiplier, cashout multiplier and lifecycle status in the existing `air-balloon:full-mock:v1` session state. Refreshing `/game` restores that round. Green renders 9 levels; Red renders 12. Cashout is available after level one, booster markers are shown for ×2/×3/×4 and absent for ×1, and crash transitions to the current Result screen.

## Product semantics

WIN grants exactly one puzzle fragment and can complete 5/6 → 6/6, unlocking `CLOUD_SCARF`. LOSS grants zero fragments and leaves 5/6 unchanged. Wardrobe equipment continues to persist through the existing session state.

## Scenario 8

No Scenario 8 popup was present in the authoritative base; no new upsell implementation was added during this integration.

## Verification

- Unit tests: `npm test -- --run` — 22 passed.
- Typecheck: `npm run typecheck` — passed.
- Lint: `npm run lint` — passed.
- Production build: `npm run build` — passed; no source references `frontend/dist`.
- Playwright Chromium: 4 passed (GREEN WIN, RED LOSS, puzzle/wardrobe persistence, logout).
- Playwright WebKit: 4 passed.
- Firefox: environment blocked at browser launch (`spawn UNKNOWN` for the installed Playwright Firefox binary), not a product assertion failure.
- Responsive CUA spot checks: 375×812 and 1440×900 Gameplay; both reported `document`/`body` width equal to viewport with no horizontal overflow. Mobile Gameplay uses vertical scrolling so the cashout panel remains reachable.
- No runtime backend, REST, WebSocket or PostgreSQL binding was added.
