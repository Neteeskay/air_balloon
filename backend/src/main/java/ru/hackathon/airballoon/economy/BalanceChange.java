package ru.hackathon.airballoon.economy;

import java.util.UUID;
/** On a retry returns the original receipt, including its original resulting balance. */
public record BalanceChange(UUID transactionId, long amount, long balanceBefore, long balanceAfter, boolean replayed) {}
