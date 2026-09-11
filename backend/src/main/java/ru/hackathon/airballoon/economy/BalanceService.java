package ru.hackathon.airballoon.economy;

import java.util.UUID;
public interface BalanceService {
    BalanceChange debitBet(UUID userId, UUID roundId, long amount);
    BalanceChange creditWin(UUID userId, UUID roundId, long amount);
    long getBalance(UUID userId);
}
