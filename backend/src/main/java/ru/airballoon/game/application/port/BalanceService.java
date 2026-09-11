package ru.airballoon.game.application.port;

import java.math.BigDecimal;
import java.util.UUID;

public interface BalanceService {
    /** Atomic debit; MUST be idempotent by (roundId, debit). Amount uses decimal currency units. */
    void debitBet(UUID userId, UUID roundId, BigDecimal amount);
    /** Atomic credit; MUST be idempotent by (roundId, credit), including ambiguous network retries. */
    void creditWin(UUID userId, UUID roundId, BigDecimal amount);
}
