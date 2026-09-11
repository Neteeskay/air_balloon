package ru.airballoon.game.application.port;

import ru.airballoon.game.domain.GameRound;
import ru.airballoon.game.domain.RoundCheckpoint;
import java.util.Optional;
import java.util.UUID;

public interface RoundRepository {
    /** Optional retention hook; durable adapters may use their own history policy. */
    default void cleanup(java.time.Instant now) {}
    /** Upsert an immutable snapshot; repeated saves of the same sequence must be safe. */
    GameRound save(GameRound round);
    /** Atomically establishes the durable round and its one-time bet debit when supported. */
    default GameRound createAndDebit(GameRound round, BalanceService balances) {
        balances.debitBet(round.userId(), round.id(), round.betAmount().setScale(2));
        return save(round);
    }
    /** Durable adapters can include the initial recovery record in the same transaction. */
    default GameRound createAndDebit(GameRound round, BalanceService balances, RoundCheckpoint checkpoint) {
        return createAndDebit(round, balances);
    }
    Optional<GameRound> findById(UUID id);
}
