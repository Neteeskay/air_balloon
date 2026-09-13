# Backend outfit rewards

## Audit and source of truth

The implementation builds on the existing server-side profile and economy model:

- wardrobe: `clothing_items` plus per-user unlocks in `user_clothing_items`;
- equipment: `user_avatar_equipment`, updated by `PUT /api/current-user/avatar/equipment`;
- clothing unlock: durable puzzle completion in `PuzzleRewardService`;
- balance: `users.bonus_balance`, exposed through the existing user/balance APIs;
- ledger: `economy_transactions`;
- transactions: Spring JDBC services with PostgreSQL row locks and constraints.

There was no outfit reward definition, claim, matching, or grant flow before migration `V308`.

## Persistent model

`outfit_reward_definitions` stores the stable code, display title, reward amount, activation flag,
and ordering. `outfit_reward_requirements` stores one required clothing item per required slot. Its
foreign key to `clothing_items(id, slot)` prevents a definition from assigning an item to the
wrong slot.

`user_avatar_equipped_items` is the normalized equipment view used by matching. A database
trigger mirrors the existing HEAD and NECK columns into it, preserving the old API and storage
contract while allowing the matcher to handle any number of requirements without Java branches.
Future equipment slots can be added as rows once the clothing slot constraint and write API are
extended.

`user_outfit_reward_claims` is the durable receipt. PostgreSQL enforces uniqueness on
`(user_id, outfit_reward_id)`. Its composite foreign key guarantees that `ledger_entry_id`
references an economy entry for the same user and outfit.

The seeded production definition is:

| Code | Required items | Reward |
|---|---|---:|
| `SKY_TRAVELER` | `HEAD=SUNHAT`, `NECK=CLOUD_SCARF` | 500 bonus units |

Both item codes are defined by migration `V306`; `CLOUD_SCARF` remains locked until the existing
`SKY_JOURNEY` puzzle unlocks it.

## Matching and grant semantics

An active definition matches when every requirement row has the same `(slot, clothing_id)` in
the user's normalized equipment. Equipment in slots not mentioned by the definition is ignored.
Definitions with no requirements cannot match. The query returns all matching definitions, so a
single equipment update can grant multiple independent rewards.

`ProfileService.equip` and `OutfitRewardService` perform this sequence in one transaction:

1. lock the authenticated user's row with `FOR UPDATE` (the reward boundary reasserts the lock);
2. validate that every requested item is active, belongs to the requested slot, and is unlocked
   by that user;
3. persist the final equipment state (the database trigger updates normalized equipment);
4. find all matching active definitions without a claim;
5. credit each configured reward through `BalanceService` and its `OUTFIT_REWARD` ledger entry;
6. insert the corresponding claim linked to that ledger entry;
7. return the final equipment, all newly granted rewards, and authoritative final balance.

Removing and re-equipping an outfit, logging in again, or restarting the service cannot grant it
again because both the claim and ledger entry are persistent.

## Idempotency, concurrency, and rollback

The user-row lock serializes all equipment and balance changes for one user. Concurrent requests
therefore observe committed claim state in order. Database uniqueness on both the claim and the
outfit ledger entry remains the final idempotency guard:

- `UNIQUE (user_id, outfit_reward_id)` on claims;
- a partial unique index on ledger `(user_id, outfit_reward_id)` for `OUTFIT_REWARD`.

Balance update, ledger insert, and claim insert share the equipment transaction. If crediting,
claim insertion, or any later operation fails, PostgreSQL rolls the whole unit back. A claim
cannot reference a missing or unrelated ledger entry because of its composite foreign key.

## API

`PUT /api/current-user/avatar/equipment` keeps the existing request:

```json
{
  "headId": "SUNHAT",
  "neckId": "CLOUD_SCARF"
}
```

The existing response shape is extended additively:

```json
{
  "equipped": { "headId": "SUNHAT", "neckId": "CLOUD_SCARF" },
  "version": 2,
  "updatedAt": "2026-09-13T08:00:00Z",
  "newOutfitRewards": [
    {
      "code": "SKY_TRAVELER",
      "title": "Небесный путешественник",
      "rewardAmount": 500,
      "claimedAt": "2026-09-13T08:00:00Z"
    }
  ],
  "balanceAfter": 5500
}
```

On a repeated completion, `newOutfitRewards` is empty and `balanceAfter` remains authoritative.

`GET /api/current-user/outfit-rewards` returns the current user's visible definitions with
`completed`, `claimed`, and `claimedAt`. Inactive definitions remain visible only when the user
already has a historical claim.

## Ledger and security

The authoritative economy uses ledger reason `OUTFIT_REWARD`; the ledger row stores
`outfit_reward_id`, amount, and before/after balances. The reward amount is loaded from the active
definition and checked again by `PostgresBalanceService`; it is never accepted from the client.

Endpoints derive `user_id` exclusively from the authenticated principal. Equipment requests only
accept the existing `headId` and `neckId` fields. Global Jackson configuration rejects unknown
properties, so attempts to send `rewardAmount`, `claimed`, `outfitCode`, or `userId` fail before
equipment or balance is changed. The existing ownership foreign key and service validation reject
locked or foreign inventory.

## Verification

`OutfitRewardIntegrationTest` runs against PostgreSQL 17 through Testcontainers and covers
incomplete and complete matching, exact balance, persistent/repeated claims, service recreation,
concurrency, locked and foreign inventory, multiple definitions, unrelated slots, ledger reason,
history isolation, forged request fields, database constraints, injected economy failure, and
full transaction rollback. The migration upgrade test also verifies normalized equipment backfill
and absence of historical claim backfill.
