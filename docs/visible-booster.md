# Visible booster position

## Audit before change

Base `feature/crash-math-model` at `33df8e6b6d033ed50e0b26d2fae12cda518d9187`
already selected `boosterLevel` in `RoundEngine.start`, persisted it in the
immutable `GameRound`, and included it in the SHA-256 commitment. The leak
boundary was the public mapper: `RoundView.from` returned the level only after
activation/crash. The frontend and `MockBackend` repeated that stale contract
with a hidden marker and a level assigned only on activation/finish.

## Contract after change

- x2/x3/x4: the authoritative `boosterLevel` is returned by start, active
  snapshot, `ROUND_STARTED.data.round`, REST replay and the authenticated
  WebSocket event. The UI renders one marker immediately and keeps it visible
  after cashout; `BOOSTER_ACTIVATED` only changes the marker state, multiplier
  and points.
- x1: no booster position and no marker.
- `serverSeed`, `crashMultiplier`, fairness reveal and canonical proof remain
  hidden until the existing crash/finish reveal path.
- The position is never computed by React. The mock only mirrors the same
  preselected demo value for local UI tests.

## Security and persistence

Round ownership checks are unchanged for start, snapshot, replay, fairness and
cashout. The server still creates the seed, crash point and booster position,
and the commitment remains immutable. Reconnect/recovery reads the persisted
round/checkpoint, so the marker survives refresh, replay and process recovery.

## Verification matrix

Backend tests cover immediate REST visibility, replay and real WebSocket start
events, x1 absence, ownership, hidden crash/seed, persistence and unchanged
activation/cashout math. Frontend tests cover x1 and every x2/x3/x4 marker and
the local mock start snapshot.
