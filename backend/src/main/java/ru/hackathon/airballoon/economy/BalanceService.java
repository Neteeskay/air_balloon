package ru.hackathon.airballoon.economy;

import java.util.UUID;
public interface BalanceService {
    /** Establishes the transaction lock order before a new round takes an FK lock. */
    void lockUser(UUID userId);
    BalanceChange debitBet(UUID userId, UUID roundId, long amount);
    BalanceChange creditWin(UUID userId, UUID roundId, long amount);
    /** Credits a registered outfit definition exactly once for this user. */
    BalanceChange creditOutfitReward(UUID userId, UUID outfitRewardId, long amount);
    long getBalance(UUID userId);
}
