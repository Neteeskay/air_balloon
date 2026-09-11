package ru.hackathon.airballoon.reward;

import java.security.SecureRandom;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.common.BusinessException;
import ru.hackathon.airballoon.game.*;

@Service
public class PostgresRewardService implements RewardService {
    private final JdbcTemplate jdbc;
    private final RoundRepository rounds;
    private final SecureRandom random=new SecureRandom();
    public PostgresRewardService(JdbcTemplate jdbc,RoundRepository rounds) { this.jdbc=jdbc; this.rounds=rounds; }
    public Optional<Reward> findByRound(UUID roundId) {
        return jdbc.query("SELECT * FROM round_rewards WHERE round_id=?", (rs,n)->new Reward(
            rs.getObject("id",UUID.class),rs.getObject("round_id",UUID.class),rs.getObject("user_id",UUID.class),
            rs.getString("type"),rs.getString("rarity"),rs.getTimestamp("created_at").toInstant()),roundId).stream().findFirst();
    }
    @Transactional
    public Reward generateReward(GameRound supplied) {
        GameRound r=rounds.lockById(supplied.id()); // Never trust a stale snapshot for ownership/status.
        if (!r.userId().equals(supplied.userId())) throw BusinessException.conflict("ROUND_USER_MISMATCH","Раунд принадлежит другому пользователю");
        var existing=findByRound(r.id());
        if (existing.isPresent()) return existing.get();
        if (r.status()!=GameRound.Status.FINISHED) throw BusinessException.conflict("ROUND_NOT_FINISHED","Награда доступна после завершения раунда");
        if (jdbc.queryForObject("SELECT count(*) FROM economy_transactions WHERE round_id=? AND type='BET_DEBIT'",Long.class,r.id())==0)
            throw BusinessException.conflict("BET_NOT_DEBITED","Ставка ещё не списана");
        int roll=random.nextInt(100);
        String rarity=roll<70?"COMMON":roll<90?"RARE":roll<98?"EPIC":"LEGENDARY";
        String type=switch(rarity) { case "COMMON" -> random.nextBoolean()?"CLOUD":"FEATHER"; case "RARE" -> "STAR"; case "EPIC" -> "MOON"; default -> "MOUNTAIN"; };
        jdbc.update("INSERT INTO round_rewards(id,round_id,user_id,type,rarity) VALUES (?,?,?,?,?)",UUID.randomUUID(),r.id(),r.userId(),type,rarity);
        return findByRound(r.id()).orElseThrow();
    }
}
