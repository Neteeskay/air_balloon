package ru.hackathon.airballoon.profile;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.common.BusinessException;
import ru.hackathon.airballoon.game.GameRound;

/** Durable, server-only puzzle progression. There is deliberately no HTTP grant endpoint. */
@Service
public class PuzzleRewardService {
    public static final String REWARD_TYPE = "PUZZLE_FRAGMENT";

    public record ClothingReward(String id, String name) {}
    public record RewardView(String type, String puzzleId, String puzzleName, int fragmentGranted,
                             int fragments, int totalFragments, boolean puzzleCompleted,
                             ClothingReward unlockedClothing, Instant grantedAt) {}

    private final JdbcTemplate jdbc;
    private final boolean enabled;

    public PuzzleRewardService(JdbcTemplate jdbc,
                               @Value("${app.puzzle-rewards-enabled:true}") boolean enabled) {
        this.jdbc = jdbc;
        this.enabled = enabled;
    }

    /**
     * Serializes on the authoritative round row. Progress, completion, inventory and the grant
     * receipt commit atomically; a retry returns the immutable receipt.
     */
    @Transactional
    public Optional<RewardView> grantForWinningRound(GameRound supplied) {
        if (!enabled) return Optional.empty();
        var rounds = jdbc.query("""
                SELECT user_id,status,cashout_at,finished_at
                FROM game_rounds WHERE id=? FOR UPDATE
                """, (rs, row) -> new EligibleRound(
                rs.getObject("user_id", UUID.class), rs.getString("status"),
                instant(rs, "cashout_at"), instant(rs, "finished_at")), supplied.id());
        if (rounds.isEmpty()) throw BusinessException.missing("ROUND_NOT_FOUND");
        EligibleRound round = rounds.getFirst();
        if (!round.userId().equals(supplied.userId()))
            throw BusinessException.conflict("ROUND_USER_MISMATCH", "Раунд принадлежит другому пользователю");
        if (!"FINISHED".equals(round.status()))
            throw BusinessException.conflict("ROUND_NOT_FINISHED", "Награда доступна после завершения раунда");

        Optional<RewardView> replay = findByRound(supplied.id());
        if (replay.isPresent()) return replay;
        if (round.cashoutAt() == null) return Optional.empty(); // LOSS: explicitly no puzzle reward.

        var puzzles = jdbc.query("""
                SELECT p.id,p.total_fragments
                FROM puzzle_definitions p
                LEFT JOIN user_puzzle_progress up ON up.puzzle_id=p.id AND up.user_id=?
                WHERE p.active AND p.rewards_enabled_at<=?
                  AND COALESCE(up.completed,false)=false
                ORDER BY p.ordering,p.id LIMIT 1
                """, (rs, row) -> new PuzzleKey(rs.getObject("id", UUID.class),
                rs.getInt("total_fragments")), supplied.userId(), java.sql.Timestamp.from(round.finishedAt()));
        if (puzzles.isEmpty()) return Optional.empty();
        PuzzleKey puzzle = puzzles.getFirst();

        jdbc.update("""
                INSERT INTO user_puzzle_progress(user_id,puzzle_id,total_fragments)
                VALUES (?,?,?) ON CONFLICT (user_id,puzzle_id) DO NOTHING
                """, supplied.userId(), puzzle.id(), puzzle.totalFragments());
        Progress progress = jdbc.query("""
                SELECT collected_fragments,completed FROM user_puzzle_progress
                WHERE user_id=? AND puzzle_id=? FOR UPDATE
                """, (rs, row) -> new Progress(rs.getInt(1), rs.getBoolean(2)),
                supplied.userId(), puzzle.id()).stream().findFirst().orElseThrow();
        // Another winning round may have completed the only active puzzle while this call waited.
        if (progress.completed()) return Optional.empty();

        int next = Math.min(puzzle.totalFragments(), progress.collectedFragments() + 1);
        boolean completed = next == puzzle.totalFragments();
        jdbc.update("""
                UPDATE user_puzzle_progress
                SET collected_fragments=?,completed=?,completed_at=CASE WHEN ? THEN now() ELSE NULL END,updated_at=now()
                WHERE user_id=? AND puzzle_id=?
                """, next, completed, completed, supplied.userId(), puzzle.id());

        boolean clothingUnlocked = false;
        if (completed) {
            clothingUnlocked = jdbc.update("""
                    INSERT INTO user_clothing_items(user_id,clothing_id,source_type,source_id)
                    SELECT ?,reward_clothing_id,'PUZZLE',id FROM puzzle_definitions WHERE id=?
                    ON CONFLICT (user_id,clothing_id) DO NOTHING
                    """, supplied.userId(), puzzle.id()) == 1;
        }
        jdbc.update("""
                INSERT INTO puzzle_reward_grants(id,user_id,round_id,reward_type,puzzle_id,total_fragments,
                    fragment_delta,collected_fragments_after,puzzle_completed,clothing_unlocked)
                VALUES (?,?,?,?,?,?,1,?,?,?)
                """, UUID.randomUUID(), supplied.userId(), supplied.id(), REWARD_TYPE, puzzle.id(),
                puzzle.totalFragments(), next, completed, clothingUnlocked);
        return Optional.of(findByRound(supplied.id()).orElseThrow());
    }

    @Transactional(readOnly = true)
    public Optional<RewardView> findByRound(UUID roundId) {
        return jdbc.query("""
                SELECT g.reward_type,p.code AS puzzle_code,p.name,g.fragment_delta,
                       g.collected_fragments_after,g.total_fragments,g.puzzle_completed,
                       g.clothing_unlocked,c.code AS clothing_code,c.display_name AS clothing_name,g.created_at
                FROM puzzle_reward_grants g
                JOIN puzzle_definitions p ON p.id=g.puzzle_id
                JOIN clothing_items c ON c.id=p.reward_clothing_id
                WHERE g.round_id=?
                """, this::mapReward, roundId).stream().findFirst();
    }

    private RewardView mapReward(ResultSet rs, int row) throws SQLException {
        ClothingReward clothing = rs.getBoolean("clothing_unlocked")
                ? new ClothingReward(rs.getString("clothing_code"), rs.getString("clothing_name")) : null;
        return new RewardView(rs.getString("reward_type"), rs.getString("puzzle_code"),
                rs.getString("name"), rs.getInt("fragment_delta"),
                rs.getInt("collected_fragments_after"), rs.getInt("total_fragments"),
                rs.getBoolean("puzzle_completed"), clothing,
                rs.getTimestamp("created_at").toInstant());
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        var value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private record EligibleRound(UUID userId, String status, Instant cashoutAt, Instant finishedAt) {}
    private record PuzzleKey(UUID id, int totalFragments) {}
    private record Progress(int collectedFragments, boolean completed) {}
}
