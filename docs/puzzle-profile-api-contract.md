# Puzzle rewards and avatar profile API

## Product rule

Puzzle progression is server-authoritative and independent from score, bonus balance, tournament
score, and Scenario 8 lottery tickets. Exactly one fragment is granted for a newly completed
authoritative **WIN** (a finished round with a successful cashout). A LOSS grants no fragment.

There is no public API for granting fragments, completing a puzzle, or unlocking clothing. Those
changes are produced only by round settlement. `app.puzzle-rewards-enabled` (environment variable
`PUZZLE_REWARDS_ENABLED`) can disable new grants without changing already persisted progress.

The first active puzzle is:

- `id`: `SKY_JOURNEY`
- name: `Небесное путешествие`
- total fragments: `6`
- reward clothing: `CLOUD_SCARF`

`CLOUD_SCARF` is a `NECK` item with asset key `avatar/cloud-scarf`. It is locked until puzzle
completion. No second puzzle is started after `SKY_JOURNEY` reaches 6/6.

## Authentication and ownership

All private endpoints derive the canonical user UUID from the existing authenticated `Principal`.
They do not accept a `userId`. A caller cannot read another user's progress or wardrobe and cannot
change another user's outfit.

## Round result

`GET /api/rounds/{roundId}/result`

The endpoint remains owner-only. A new winning round returns its immutable grant snapshot in
`reward`, so a later profile change cannot rewrite the historical result:

```json
{
  "roundId": "d5dc91ce-c32f-49f4-8c4d-479fb66d7bcc",
  "result": "WIN",
  "reward": {
    "type": "PUZZLE_FRAGMENT",
    "puzzleId": "SKY_JOURNEY",
    "puzzleName": "Небесное путешествие",
    "fragmentGranted": 1,
    "fragments": 6,
    "totalFragments": 6,
    "puzzleCompleted": true,
    "unlockedClothing": {
      "id": "CLOUD_SCARF",
      "name": "Облачный шарфик"
    },
    "grantedAt": "2026-09-12T12:00:00Z"
  }
}
```

For LOSS, completed puzzles with no next active puzzle, disabled rewards, and historical rounds
completed before V306, `reward` is absent (`null` at the domain boundary). Reads never generate or
change a reward.

The former random `CLOUD/FEATHER/STAR/MOON/MOUNTAIN` records remain in `round_rewards` only as an
internal compatibility receipt for the existing settlement/acceptance pipeline. They are no longer
returned as the player-facing result or personal-history reward.

## Current-user profile

`GET /api/current-user/profile`

This is the primary hydration endpoint. It returns basic user state plus all puzzle, wardrobe, and
equipped-avatar data in three bounded database queries (no per-item queries):

```json
{
  "user": {
    "userId": "3188b4d5-0c51-37dc-a28f-32fb6f49ac28",
    "username": "anna",
    "displayName": "Анна Ветрова",
    "bonusBalance": 5000,
    "gameScore": 0,
    "lotteryTicketCount": 0
  },
  "avatar": {
    "equipped": { "headId": "AVIATOR", "neckId": "BOW" },
    "version": 0,
    "updatedAt": "2026-09-12T12:00:00Z"
  },
  "puzzles": [
    {
      "id": "SKY_JOURNEY",
      "name": "Небесное путешествие",
      "totalFragments": 6,
      "collectedFragments": 0,
      "completed": false,
      "rewardClothingId": "CLOUD_SCARF",
      "active": true
    }
  ],
  "wardrobe": [
    {
      "id": "CLOUD_SCARF",
      "displayName": "Облачный шарфик",
      "slot": "NECK",
      "assetKey": "avatar/cloud-scarf",
      "active": true,
      "unlocked": false
    }
  ],
  "serverTime": "2026-09-12T12:00:00Z"
}
```

`GET /api/current-user/wardrobe` returns only the same wardrobe array for consumers that do not need
the whole profile.

## Equip and unequip

`PUT /api/current-user/avatar/equipment`

```json
{ "headId": "SUNHAT", "neckId": "CLOUD_SCARF" }
```

Both properties are required as the desired complete outfit state; either may be JSON `null` to
unequip that slot. The response is the persisted `avatar` object. Updates lock the canonical user
row, validate both items, and atomically replace one equipment row. Concurrent updates therefore
leave one valid last-committed state, never duplicate slot records.

Validation errors:

| HTTP | Code | Meaning |
|---:|---|---|
| 400 | `INVALID_CLOTHING_ID` | An ID is blank |
| 400 | `WRONG_CLOTHING_SLOT` | A known item was sent for the other slot |
| 404 | `CLOTHING_NOT_FOUND` | The catalog ID is unknown |
| 409 | `ITEM_LOCKED` | The current user does not own the item |
| 409 | `ITEM_INACTIVE` | The catalog item is inactive |

Database foreign keys additionally require every equipped item to exist in that same user's
inventory. `HEAD` and `NECK` slot validity is also enforced by a database trigger.

## Idempotency and transaction boundary

The database grant key is `(user_id, round_id, reward_type)` and `reward_type` is
`PUZZLE_FRAGMENT`. The grant service locks the authoritative finished round and user progress,
then commits progress, completion, inventory unlock, and the immutable grant receipt in one
transaction. Progress has a database check of `0 <= collected <= total`; inventory uniqueness is
`(user_id, clothing_id)`.

In the normalized data settlement path, finished-round persistence and reward generation share the
existing transaction. In the real-time core adapter they are performed through its durable pending
effect queue: the checkpoint is written before settlement effects, and the idempotent reward
transaction is replayed after a failure or restart. This preserves the stable economy boundary while
preventing a successfully finished WIN from losing or duplicating its fragment.

## Scenario 8 coexistence

A qualifying WIN can independently have both:

1. `reward.type = PUZZLE_FRAGMENT` on the result;
2. an available `GET /api/current-user/upsell/lottery-tickets/offer?roundId=...` response.

Buying the Scenario 8 offer changes bonus balance and lottery tickets only. It does not read or
write puzzle progress, inventory, or equipment.

## Frontend handoff from `integration/frontend-complete-mock`

Replace the mock store fields as follows:

| Current mock field/action | Real backend binding |
|---|---|
| `currentUser.puzzles` / `puzzleProgress` | `GET /api/current-user/profile` → `puzzles` |
| `unlockedClothingIds` | profile `wardrobe[].unlocked` (derive the ID set) |
| `equippedClothing` | profile `avatar.equipped` |
| `saveMockAvatar(... equipped ...)` | `PUT /api/current-user/avatar/equipment` |
| result `reward` | `GET /api/rounds/{roundId}/result` → `reward` |

The mock uses lowercase UI IDs (`sky-journey`, `cloud-scarf`, `aviator`, `sunhat`, `bow`); the real
contract uses stable catalog codes (`SKY_JOURNEY`, `CLOUD_SCARF`, `AVIATOR`, `SUNHAT`, `BOW`). The
future frontend adapter should map these codes or adopt them directly.

Important semantic mismatch: the current mock grants a fragment after both WIN and LOSS. The backend
product policy is **WIN only**. Update frontend rules copy and mock/result handling during real API
binding; this backend task intentionally does not modify the frontend.
