# Frontend reward → profile flow

## Current mock flow

The integrated frontend is intentionally mock-only. A completed round follows one deterministic chain:

```text
Round (WIN or LOSS)
  → one puzzle fragment
  → puzzle progress
  → puzzle completion
  → clothing unlock
  → profile wardrobe
  → equip
  → chinchilla render changes
```

The demo puzzle is **«Небесное путешествие»**. A newly authenticated demo user starts at **5 / 6** fragments, so the next completed round demonstrates completion without debug controls. Its reward is **«Облачный шарфик»**.

Puzzle fragments are independent of score, bonus balance and lottery tickets. A WIN still adds the existing lottery ticket; both WIN and LOSS award the puzzle fragment. Neither a fragment nor a clothing unlock spends bonuses.

## State boundary

`frontend/src/mocks/mockGame.ts` is the mock adapter/store boundary. UI components receive state and callbacks; they do not read or write browser storage directly.

The mock user contains:

- `puzzles`: normalized puzzle progress records;
- `unlockedClothingIds`: inventory IDs, without per-item booleans;
- `equippedClothing`: the equipped head and neck item IDs;
- `petName`: the current chinchilla name.

The whole application state is persisted with the existing `air-balloon:full-mock:v1` key in `sessionStorage`. Refreshing the page in the same browser session keeps puzzle progress, inventory and the equipped outfit. A new browser session starts from the deterministic demo state.

Round completion is idempotent for the active `roundId`. Completing a puzzle adds its reward ID to a set-like inventory once. The store rejects attempts to equip an ID that is not unlocked or does not belong to the expected outfit category.

## Routes and navigation

The profile route is `/profile`. Authenticated profile entry points are available from Mode, Bet/Tournament/Rating, mock Gameplay and Result. Closing Profile returns to the screen that opened it. Result also exposes a direct CTA when a clothing reward is unlocked.

## Rules copy

The in-game rules explain that every completed flight awards a puzzle fragment, a complete puzzle unlocks clothing, and unlocked clothing is equipped in Profile.

## Future backend binding

Real backend binding will move puzzle progress, inventory and equipped clothing to server-authoritative persistence. The future adapter should hydrate the same UI-facing model and replace the mock mutation functions. Components should remain unaware of transport, API endpoints or WebSocket events.

No real profile, inventory, reward, game or economy API is connected in this integration.

## Integration audit

- **Profile components:** `AvatarProfile`, `PetPreview`, `ItemArt` from `feature/avatar-customization` commit `1b0e93079bf5b1ecda0070a2445ddc953f7c35aa`.
- **Wardrobe:** two head items and two neck/clothing items; locked state is driven by `unlockedClothingIds`.
- **Avatar state:** adapted from component-owned `localStorage` to the shared mock user store.
- **Clothing data:** catalog IDs `aviator`, `sunhat`, `bow`, `cloud-scarf`; the latter is the puzzle reward.
- **Route:** source branch used an overlay inside a different `GameHome`; integration uses the existing coordinator and `/profile`.
- **CSS conflicts:** source selectors are `av-` scoped; only global dialog backdrop/body overflow behavior was retained. No generic `button`, `img`, `.container` or `.header` rules were introduced.
- **Package conflicts:** none. The profile uses React only and requires no dependency changes. The full-mock package versions and Playwright setup remain authoritative.
- **Assets:** eleven source avatar PNGs are served from `/assets/avatar/`; four pre-composed transparent chinchilla renders cover every supported outfit combination.
