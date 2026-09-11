package ru.airballoon.game.infrastructure.memory;

import ru.airballoon.game.application.port.BalanceService;
import ru.airballoon.game.domain.GameError;
import ru.airballoon.game.domain.GameException;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Development adapter only. No production wallet, registration, or persistence. */
public final class FakeBalanceService implements BalanceService {
    private final BigDecimal initialBalance;
    private final Map<UUID, Account> accounts = new ConcurrentHashMap<>();

    public FakeBalanceService(BigDecimal initialBalance) {
        this.initialBalance = initialBalance.setScale(2);
    }

    public void debitBet(UUID user, UUID round, BigDecimal amount) { apply(user, round, amount, false); }
    public void creditWin(UUID user, UUID round, BigDecimal amount) { apply(user, round, amount, true); }

    private void apply(UUID user, UUID round, BigDecimal amount, boolean credit) {
        if (amount == null || amount.signum() < 0 || amount.scale() > 2) throw new IllegalArgumentException("Invalid money amount");
        Account account = accounts.computeIfAbsent(user, ignored -> new Account(initialBalance));
        synchronized (account) {
            String key = round + (credit ? ":credit" : ":debit");
            BigDecimal previous = account.operations.get(key);
            if (previous != null) {
                if (previous.compareTo(amount) != 0) throw new IllegalStateException("Conflicting idempotency key");
                return;
            }
            if (!credit && account.balance.compareTo(amount) < 0)
                throw new GameException(GameError.INSUFFICIENT_BALANCE, "Insufficient demo balance");
            account.balance = credit ? account.balance.add(amount) : account.balance.subtract(amount);
            account.operations.put(key, amount);
        }
    }

    public BigDecimal balance(UUID user) {
        Account account = accounts.computeIfAbsent(user, ignored -> new Account(initialBalance));
        synchronized (account) { return account.balance; }
    }

    public long creditCount(UUID user) {
        Account account = accounts.computeIfAbsent(user, ignored -> new Account(initialBalance));
        synchronized (account) { return account.operations.keySet().stream().filter(k -> k.endsWith(":credit")).count(); }
    }

    private static final class Account {
        BigDecimal balance;
        final Map<String, BigDecimal> operations = new HashMap<>();
        Account(BigDecimal initial) { balance = initial; }
    }
}
