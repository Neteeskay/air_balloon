package ru.hackathon.airballoon.profile;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.economy.BalanceChange;
import ru.hackathon.airballoon.economy.BalanceService;

/** Matches normalized equipment against data-driven definitions and persists one-time grants. */
@Service
public class OutfitRewardService {
    public static final String LEDGER_TYPE = "OUTFIT_REWARD";

    public record RewardGrant(String code, String title, long rewardAmount, Instant claimedAt) {}
    public record OutfitStatus(String code, String title, long rewardAmount,
                               boolean completed, boolean claimed, Instant claimedAt) {}
    public record GrantResult(List<RewardGrant> rewards, long balanceAfter) {}

    private final JdbcTemplate jdbc;
    private final BalanceService balances;

    public OutfitRewardService(JdbcTemplate jdbc, BalanceService balances) {
        this.jdbc = jdbc;
        this.balances = balances;
    }

    /** Runs inside the equipment transaction and serializes all reward decisions for the user. */
    @Transactional(propagation = Propagation.MANDATORY)
    public GrantResult grantMatching(UUID userId) {
        balances.lockUser(userId);
        List<Definition> matches = matchingDefinitions(userId);
        List<RewardGrant> granted = new ArrayList<>();
        long balanceAfter = balances.getBalance(userId);
        for (Definition definition : matches) {
            if (claimExists(userId, definition.id())) continue;
            BalanceChange credit = balances.creditOutfitReward(
                    userId, definition.id(), definition.rewardAmount());
            UUID claimId = UUID.randomUUID();
            int inserted = jdbc.update("""
                    INSERT INTO user_outfit_reward_claims(
                        id,user_id,outfit_reward_id,claimed_at,ledger_entry_id)
                    VALUES (?,?,?,now(),?)
                    ON CONFLICT (user_id,outfit_reward_id) DO NOTHING
                    """, claimId, userId, definition.id(), credit.transactionId());
            if (inserted != 1) {
                // A new credit and a lost claim must never commit as separate facts.
                throw new IllegalStateException("Concurrent outfit claim conflict");
            }
            Instant claimedAt = jdbc.queryForObject(
                    "SELECT claimed_at FROM user_outfit_reward_claims WHERE id=?",
                    (rs, row) -> rs.getTimestamp(1).toInstant(), claimId);
            granted.add(new RewardGrant(definition.code(), definition.title(),
                    definition.rewardAmount(), claimedAt));
            balanceAfter = credit.balanceAfter();
        }
        if (granted.isEmpty()) balanceAfter = balances.getBalance(userId);
        return new GrantResult(List.copyOf(granted), balanceAfter);
    }

    @Transactional(readOnly = true)
    public List<OutfitStatus> statuses(UUID userId) {
        balances.getBalance(userId); // validates that only a real current user is queried
        return jdbc.query("""
                SELECT d.code,d.title,d.reward_amount,c.claimed_at,
                       NOT EXISTS (
                           SELECT 1
                           FROM outfit_reward_requirements r
                           LEFT JOIN user_avatar_equipped_items e
                             ON e.user_id=? AND e.slot=r.slot AND e.clothing_id=r.clothing_id
                           WHERE r.outfit_reward_id=d.id AND e.clothing_id IS NULL
                       ) AS completed
                FROM outfit_reward_definitions d
                LEFT JOIN user_outfit_reward_claims c
                  ON c.outfit_reward_id=d.id AND c.user_id=?
                WHERE (d.active OR c.user_id IS NOT NULL)
                  AND EXISTS (SELECT 1 FROM outfit_reward_requirements r0 WHERE r0.outfit_reward_id=d.id)
                ORDER BY d.ordering,d.id
                """,
                this::mapStatus, userId, userId);
    }

    private List<Definition> matchingDefinitions(UUID userId) {
        return jdbc.query("""
                SELECT d.id,d.code,d.title,d.reward_amount
                FROM outfit_reward_definitions d
                WHERE d.active
                  AND EXISTS (
                      SELECT 1 FROM outfit_reward_requirements r0
                      WHERE r0.outfit_reward_id=d.id
                  )
                  AND NOT EXISTS (
                      SELECT 1
                      FROM outfit_reward_requirements r
                      LEFT JOIN user_avatar_equipped_items e
                        ON e.user_id=? AND e.slot=r.slot AND e.clothing_id=r.clothing_id
                      WHERE r.outfit_reward_id=d.id AND e.clothing_id IS NULL
                  )
                ORDER BY d.ordering,d.id
                """, (rs, row) -> new Definition(rs.getObject("id", UUID.class), rs.getString("code"),
                rs.getString("title"), rs.getLong("reward_amount")), userId);
    }

    private boolean claimExists(UUID userId, UUID definitionId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS(SELECT 1 FROM user_outfit_reward_claims
                              WHERE user_id=? AND outfit_reward_id=?)
                """, Boolean.class, userId, definitionId));
    }

    private OutfitStatus mapStatus(ResultSet rs, int row) throws SQLException {
        var claimedAt = rs.getTimestamp("claimed_at");
        return new OutfitStatus(rs.getString("code"), rs.getString("title"),
                rs.getLong("reward_amount"), rs.getBoolean("completed"), claimedAt != null,
                claimedAt == null ? null : claimedAt.toInstant());
    }

    private record Definition(UUID id, String code, String title, long rewardAmount) {}
}
