package ru.hackathon.airballoon.history;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import ru.hackathon.airballoon.common.BusinessException;
import ru.hackathon.airballoon.game.RoundRepository;
import ru.hackathon.airballoon.profile.PuzzleRewardService;

@Service
public class HistoryService {
    public record Entry(UUID roundId,UUID userId,String username,String theme,long betAmount,int boosterTier,int boosterMultiplier,
                        BigDecimal cashoutMultiplier,BigDecimal crashMultiplier,long winAmount,long roundScore,
                        String result,Instant finishedAt) {}
    public record Page(List<Entry> items,int page,int size,long total) {}
    public record PersonalEntry(UUID roundId,String theme,long betAmount,int boosterMultiplier,
                                BigDecimal cashoutMultiplier,BigDecimal crashMultiplier,long winAmount,long score,
                                String result,PuzzleRewardService.RewardView reward,Instant completedAt) {}
    public record PersonalPage(List<PersonalEntry> items,int page,int size,long total,Instant serverTime) {}
    public record Result(UUID roundId,String result,long betAmount,BigDecimal cashoutMultiplier,
                         BigDecimal crashMultiplier,long winAmount,long potentialWinAmount,long score,long configVersion,
                         PuzzleRewardService.RewardView reward,
                         Instant completedAt,Instant serverTime) {}
    private final JdbcTemplate jdbc;
    private final RoundRepository rounds;
    private final PuzzleRewardService puzzleRewards;
    private final Clock clock;
    public HistoryService(JdbcTemplate jdbc,RoundRepository rounds,PuzzleRewardService puzzleRewards,Clock clock) {
        this.jdbc=jdbc;this.rounds=rounds;this.puzzleRewards=puzzleRewards;this.clock=clock;
    }
    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public Page getHistory(int page,int size) {
        validatePage(page,size);
        var entries=jdbc.query("""
            SELECT r.*,u.username,
            (cfg.config_json->'boosterValues'->>(r.booster_tier-1))::integer AS booster_value,
            COALESCE((SELECT SUM(points) FROM score_events s WHERE s.round_id=r.id),0) AS round_score
            FROM game_rounds r JOIN users u ON u.id=r.user_id
            JOIN game_config_versions cfg ON cfg.version=r.config_version
            WHERE r.finished_at IS NOT NULL ORDER BY r.finished_at DESC,r.id LIMIT ? OFFSET ?
            """,(rs,n)->new Entry(rs.getObject("id",UUID.class),rs.getObject("user_id",UUID.class),
                rs.getString("username"),rs.getString("theme"),
                rs.getLong("bet_amount"),rs.getInt("booster_tier"),rs.getInt("booster_value"),rs.getBigDecimal("cashout_multiplier"),
                rs.getBigDecimal("crash_multiplier"),rs.getLong("win_amount"),rs.getLong("round_score"),
                rs.getTimestamp("cashout_at")!=null?"WIN":"LOSS",rs.getTimestamp("finished_at").toInstant()),size,(long)page*size);
        return new Page(entries,page,size,jdbc.queryForObject("SELECT count(*) FROM game_rounds WHERE finished_at IS NOT NULL",Long.class));
    }

    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public PersonalPage getPersonalHistory(UUID userId,int page,int size) {
        validatePage(page,size);
        var entries=jdbc.query("""
            SELECT r.*,
            (cfg.config_json->'boosterValues'->>(r.booster_tier-1))::integer AS booster_value,
            COALESCE((SELECT SUM(points) FROM score_events s WHERE s.round_id=r.id),0) AS round_score,
            pg.reward_type,pg.fragment_delta,pg.collected_fragments_after,pg.total_fragments,
            pg.puzzle_completed,pg.clothing_unlocked,pg.created_at AS reward_created_at,
            pd.code AS puzzle_code,pd.name AS puzzle_name,ci.code AS clothing_code,ci.display_name AS clothing_name
            FROM game_rounds r JOIN game_config_versions cfg ON cfg.version=r.config_version
            LEFT JOIN puzzle_reward_grants pg ON pg.round_id=r.id
            LEFT JOIN puzzle_definitions pd ON pd.id=pg.puzzle_id
            LEFT JOIN clothing_items ci ON ci.id=pd.reward_clothing_id
            WHERE r.user_id=? AND r.finished_at IS NOT NULL
            ORDER BY r.finished_at DESC,r.id LIMIT ? OFFSET ?
            """,(rs,n)->new PersonalEntry(rs.getObject("id",UUID.class),rs.getString("theme"),
                rs.getLong("bet_amount"),rs.getInt("booster_value"),rs.getBigDecimal("cashout_multiplier"),
                rs.getBigDecimal("crash_multiplier"),rs.getLong("win_amount"),rs.getLong("round_score"),
                rs.getTimestamp("cashout_at")!=null?"WIN":"LOSS",
                rs.getString("reward_type")==null?null:rewardView(rs),
                rs.getTimestamp("finished_at").toInstant()),userId,size,(long)page*size);
        long total=jdbc.queryForObject("SELECT count(*) FROM game_rounds WHERE user_id=? AND finished_at IS NOT NULL",Long.class,userId);
        return new PersonalPage(entries,page,size,total,clock.instant());
    }

    public Result getResult(UUID id) {
        var r=rounds.findById(id).orElseThrow(()->BusinessException.missing("ROUND_NOT_FOUND"));
        return result(r);
    }

    public Result getResult(UUID userId,UUID id) {
        var r=rounds.findById(id).orElseThrow(()->BusinessException.missing("ROUND_NOT_FOUND"));
        if (!r.userId().equals(userId)) throw BusinessException.forbidden("NOT_OWNER","Round belongs to another user");
        return result(r);
    }

    private Result result(ru.hackathon.airballoon.game.GameRound r) {
        if (r.finishedAt()==null) throw BusinessException.conflict("ROUND_NOT_FINISHED","Раунд ещё не завершён");
        long potentialWinAmount=BigDecimal.valueOf(r.betAmount()).multiply(r.crashMultiplier())
            .setScale(0,java.math.RoundingMode.DOWN).longValueExact();
        return new Result(r.id(),r.cashoutAt()!=null?"WIN":"LOSS",r.betAmount(),r.cashoutMultiplier(),
            r.crashMultiplier(),r.winAmount(),potentialWinAmount,r.roundScore(),r.configVersion(),
            puzzleRewards.findByRound(r.id()).orElse(null),r.finishedAt(),clock.instant());
    }

    private static PuzzleRewardService.RewardView rewardView(java.sql.ResultSet rs) throws java.sql.SQLException {
        var clothing = rs.getBoolean("clothing_unlocked")
                ? new PuzzleRewardService.ClothingReward(rs.getString("clothing_code"), rs.getString("clothing_name")) : null;
        return new PuzzleRewardService.RewardView(rs.getString("reward_type"),rs.getString("puzzle_code"),
                rs.getString("puzzle_name"),rs.getInt("fragment_delta"),rs.getInt("collected_fragments_after"),
                rs.getInt("total_fragments"),rs.getBoolean("puzzle_completed"),clothing,
                rs.getTimestamp("reward_created_at").toInstant());
    }

    private static void validatePage(int page,int size) {
        if (page<0 || page>1000000 || size<1 || size>100)
            throw BusinessException.invalid("INVALID_PAGINATION","page: 0–1000000, size: 1–100");
    }
}
