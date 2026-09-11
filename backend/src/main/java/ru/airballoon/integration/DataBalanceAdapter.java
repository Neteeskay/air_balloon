package ru.airballoon.integration;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import ru.airballoon.game.application.port.BalanceService;

@Component
@Profile("!test & !dev")
public class DataBalanceAdapter implements BalanceService {
    private final ru.hackathon.airballoon.economy.BalanceService balances;

    public DataBalanceAdapter(ru.hackathon.airballoon.economy.BalanceService balances) {
        this.balances = balances;
    }

    @Override public void debitBet(UUID userId, UUID roundId, BigDecimal amount) {
        balances.debitBet(userId, roundId, units(amount));
    }

    @Override public void creditWin(UUID userId, UUID roundId, BigDecimal amount) {
        balances.creditWin(userId, roundId, units(amount));
    }

    static long units(BigDecimal value) {
        return value.setScale(0, RoundingMode.UNNECESSARY).longValueExact();
    }
}
