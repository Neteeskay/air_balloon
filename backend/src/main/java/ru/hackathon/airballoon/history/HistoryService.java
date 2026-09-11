package ru.hackathon.airballoon.history;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import ru.hackathon.airballoon.common.BusinessException;
import ru.hackathon.airballoon.game.RoundRepository;
import ru.hackathon.airballoon.reward.*;

@Service
public class HistoryService {
    public record Entry(UUID roundId,String username,String theme,long betAmount,int boosterTier,int boosterMultiplier,
                        BigDecimal cashoutMultiplier,BigDecimal crashMultiplier,long winAmount,long roundScore,
                        String result,Instant finishedAt) {}
    public record Page(List<Entry> items,int page,int size,long total) {}
    public record Result(UUID roundId,String result,long betAmount,BigDecimal cashoutMultiplier,
                         BigDecimal crashMultiplier,long winAmount,long score,long configVersion,Reward reward) {}
    private final JdbcTemplate jdbc;
    private final RoundRepository rounds;
    private final RewardService rewards;
    public HistoryService(JdbcTemplate jdbc,RoundRepository rounds,RewardService rewards) { this.jdbc=jdbc;this.rounds=rounds;this.rewards=rewards; }
    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public Page getHistory(int page,int size) {
        if (page<0 || page>1000000 || size<1 || size>100) throw BusinessException.invalid("INVALID_PAGINATION","page: 0–1000000, size: 1–100");
        var entries=jdbc.query("""
            SELECT r.*,u.username,
            (cfg.config_json->'boosterValues'->>(r.booster_tier-1))::integer AS booster_value,
            COALESCE((SELECT SUM(points) FROM score_events s WHERE s.round_id=r.id),0) AS round_score
            FROM game_rounds r JOIN users u ON u.id=r.user_id
            JOIN game_config_versions cfg ON cfg.version=r.config_version
            WHERE r.finished_at IS NOT NULL ORDER BY r.finished_at DESC,r.id LIMIT ? OFFSET ?
            """,(rs,n)->new Entry(rs.getObject("id",UUID.class),rs.getString("username"),rs.getString("theme"),
                rs.getLong("bet_amount"),rs.getInt("booster_tier"),rs.getInt("booster_value"),rs.getBigDecimal("cashout_multiplier"),
                rs.getBigDecimal("crash_multiplier"),rs.getLong("win_amount"),rs.getLong("round_score"),
                rs.getTimestamp("cashout_at")!=null?"WIN":"LOSS",rs.getTimestamp("finished_at").toInstant()),size,(long)page*size);
        return new Page(entries,page,size,jdbc.queryForObject("SELECT count(*) FROM game_rounds WHERE finished_at IS NOT NULL",Long.class));
    }
    public Result getResult(UUID id) {
        var r=rounds.findById(id).orElseThrow(()->BusinessException.missing("ROUND_NOT_FOUND"));
        if (r.finishedAt()==null) throw BusinessException.conflict("ROUND_NOT_FINISHED","Раунд ещё не завершён");
        return new Result(r.id(),r.cashoutAt()!=null?"WIN":"LOSS",r.betAmount(),r.cashoutMultiplier(),
            r.crashMultiplier(),r.winAmount(),r.roundScore(),r.configVersion(),rewards.findByRound(id)
                .orElseThrow(()->BusinessException.conflict("REWARD_NOT_READY","Раунд завершён без награды: используйте finishAndReward")));
    }
}
