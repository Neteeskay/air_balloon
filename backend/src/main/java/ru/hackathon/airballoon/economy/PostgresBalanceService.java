package ru.hackathon.airballoon.economy;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.common.BusinessException;
import ru.hackathon.airballoon.game.*;
import ru.hackathon.airballoon.user.UserService;

@Service
public class PostgresBalanceService implements BalanceService {
    private final JdbcTemplate jdbc;
    private final RoundRepository rounds;
    private final UserService users;
    public PostgresBalanceService(JdbcTemplate jdbc, RoundRepository rounds, UserService users) {
        this.jdbc=jdbc; this.rounds=rounds; this.users=users;
    }
    public long getBalance(UUID userId) { return users.getState(userId).bonusBalance(); }
    @Transactional
    public void lockUser(UUID userId) {
        if (jdbc.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE", UUID.class, userId).isEmpty())
            throw BusinessException.missing("USER_NOT_FOUND");
    }
    @Transactional
    public BalanceChange debitBet(UUID userId, UUID roundId, long amount) { return change(userId,roundId,amount,true); }
    @Transactional
    public BalanceChange creditWin(UUID userId, UUID roundId, long amount) { return change(userId,roundId,amount,false); }
    @Transactional
    public BalanceChange creditOutfitReward(UUID userId, UUID outfitRewardId, long amount) {
        if (amount <= 0) throw BusinessException.invalid("INVALID_AMOUNT", "Недопустимая сумма");
        Long configuredAmount = jdbc.query("""
                SELECT reward_amount FROM outfit_reward_definitions WHERE id=? AND active
                """, (rs, n) -> rs.getLong(1), outfitRewardId).stream().findFirst()
                .orElseThrow(() -> BusinessException.missing("OUTFIT_REWARD_NOT_FOUND"));
        if (configuredAmount != amount)
            throw BusinessException.conflict("OUTFIT_REWARD_AMOUNT_MISMATCH", "Сумма награды не соответствует настройке комплекта");

        Long before = jdbc.query("SELECT bonus_balance FROM users WHERE id=? FOR UPDATE",
                (rs, n) -> rs.getLong(1), userId).stream().findFirst()
                .orElseThrow(() -> BusinessException.missing("USER_NOT_FOUND"));
        var previous = jdbc.query("""
                SELECT id,amount,balance_before,balance_after FROM economy_transactions
                WHERE user_id=? AND outfit_reward_id=? AND type='OUTFIT_REWARD'
                """, (rs, n) -> new BalanceChange(rs.getObject("id", UUID.class), rs.getLong("amount"),
                rs.getLong("balance_before"), rs.getLong("balance_after"), true), userId, outfitRewardId);
        if (!previous.isEmpty()) {
            if (previous.getFirst().amount() != amount)
                throw BusinessException.conflict("IDEMPOTENCY_CONFLICT", "Повтор операции с другой суммой");
            return previous.getFirst();
        }

        long after;
        try { after = Math.addExact(before, amount); }
        catch (ArithmeticException e) { throw BusinessException.conflict("BALANCE_LIMIT", "Превышен предел баланса"); }
        UUID transactionId = UUID.randomUUID();
        jdbc.update("UPDATE users SET bonus_balance=?,updated_at=now() WHERE id=?", after, userId);
        jdbc.update("""
                INSERT INTO economy_transactions(id,user_id,round_id,type,amount,balance_before,balance_after,outfit_reward_id)
                VALUES (?,?,NULL,'OUTFIT_REWARD',?,?,?,?)
                """, transactionId, userId, amount, before, after, outfitRewardId);
        return new BalanceChange(transactionId, amount, before, after, false);
    }
    private BalanceChange change(UUID userId,UUID roundId,long amount,boolean debit) {
        if (amount<0 || (debit && amount==0)) throw BusinessException.invalid("INVALID_AMOUNT","Недопустимая сумма");
        GameRound r=rounds.lockById(roundId);
        if (!r.userId().equals(userId)) throw BusinessException.conflict("ROUND_USER_MISMATCH","Раунд принадлежит другому пользователю");
        String type=debit?"BET_DEBIT":"WIN_CREDIT";
        var previous=jdbc.query("SELECT * FROM economy_transactions WHERE round_id=? AND type=?", (rs,n)->
            new BalanceChange(rs.getObject("id",UUID.class),rs.getLong("amount"),rs.getLong("balance_before"),rs.getLong("balance_after"),true),roundId,type);
        if (!previous.isEmpty()) {
            if (previous.getFirst().amount()!=amount) throw BusinessException.conflict("IDEMPOTENCY_CONFLICT","Повтор операции с другой суммой");
            return previous.getFirst();
        }
        if (debit && (r.betAmount()!=amount || r.status()!=GameRound.Status.CREATED))
            throw BusinessException.conflict("INVALID_BET","Сумма должна совпадать со ставкой нового раунда");
        if (!debit && (r.cashoutAt()==null || r.winAmount()!=amount))
            throw BusinessException.conflict("INVALID_WIN","Начисление требует сохранённого cashout с той же суммой");
        if (!debit && jdbc.queryForObject("SELECT count(*) FROM economy_transactions WHERE round_id=? AND type='BET_DEBIT'",Long.class,roundId)==0)
            throw BusinessException.conflict("BET_NOT_DEBITED","Ставка ещё не списана");
        Long before=jdbc.query("SELECT bonus_balance FROM users WHERE id=? FOR UPDATE", (rs,n)->rs.getLong(1),userId)
            .stream().findFirst().orElseThrow(()->BusinessException.missing("USER_NOT_FOUND"));
        if (debit && before<amount) throw BusinessException.conflict("INSUFFICIENT_BALANCE","Недостаточно бонусов");
        long after;
        try { after=debit?Math.subtractExact(before,amount):Math.addExact(before,amount); }
        catch (ArithmeticException e) { throw BusinessException.conflict("BALANCE_LIMIT","Превышен предел баланса"); }
        UUID tx=UUID.randomUUID();
        jdbc.update("UPDATE users SET bonus_balance=?,updated_at=now() WHERE id=?",after,userId);
        jdbc.update("""
            INSERT INTO economy_transactions(id,user_id,round_id,type,amount,balance_before,balance_after)
            VALUES (?,?,?,?,?,?,?)
            """,tx,userId,roundId,type,amount,before,after);
        return new BalanceChange(tx,amount,before,after,false);
    }
}
