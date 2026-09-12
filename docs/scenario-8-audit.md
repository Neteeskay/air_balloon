# Scenario 8 implementation audit

- **CURRENT RESULT FLOW:** core `RoundController` persists server round/cashout; `GameService` finishes it; `HistoryService` serves `/api/rounds/{id}/result`; `ResultScreen` renders the result after the existing delay.
- **CURRENT BALANCE SERVICE:** `ru.hackathon.airballoon.economy.PostgresBalanceService`, exposed to the core engine through `DataBalanceAdapter` in the durable runtime.
- **CURRENT ECONOMY TRANSACTION:** `RoundTransactions` + `PostgresBalanceService` use Spring transactions, row locks and unique `(round_id,type)` receipts for bet debit and win credit.
- **CURRENT SESSION MODEL:** authenticated server session is a cookie-backed Principal; browser UI preferences use web storage. Scenario 8 uses per-user `sessionStorage` only for offer suppression.
- **CURRENT INVENTORY/TICKET MODEL:** no prior ticket inventory existed. V305 adds `users.lottery_ticket_count`; no draw, number generation or real-money lottery is introduced.
- **REUSABLE COMPONENTS:** existing versioned `GameConfig`, `UserState`, PostgreSQL ledger, `BusinessException` API errors, `Modal` focus restoration, `ResultScreen`, real API adapter and deterministic `MockBackend`.

Scenario 8 deliberately sits after the authoritative WIN result. It does not alter crash
math, round payout, booster RNG, score, tournament projections or reward generation.
