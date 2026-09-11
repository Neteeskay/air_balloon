package ru.hackathon.airballoon.score;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.common.BusinessException;
import ru.hackathon.airballoon.config.GameConfigProvider;
import ru.hackathon.airballoon.game.*;
import ru.hackathon.airballoon.tournament.port.PlayerScore;
import ru.hackathon.airballoon.tournament.port.ScoreChanged;

@Service
public class PostgresScoreService implements ScoreService {
    private final JdbcTemplate jdbc;
    private final RoundRepository rounds;
    private final GameConfigProvider configs;
    private final ApplicationEventPublisher events;
    private final Clock clock;
    public PostgresScoreService(JdbcTemplate jdbc, RoundRepository rounds, GameConfigProvider configs,
                                ApplicationEventPublisher events, Clock clock) {
        this.jdbc=jdbc; this.rounds=rounds; this.configs=configs; this.events=events; this.clock=clock;
    }
    @Transactional
    public ScoreChange awardLevelPoints(UUID userId,UUID roundId,int level,long points) { return award(userId,roundId,"LEVEL",level,points); }
    @Transactional
    public ScoreChange awardBoosterPoints(UUID userId,UUID roundId,int tier,long points) { return award(userId,roundId,"BOOSTER",tier,points); }
    @Transactional
    public ScoreChange awardCashoutPoints(UUID userId,UUID roundId,long points) { return award(userId,roundId,"CASHOUT",0,points); }
    private ScoreChange award(UUID userId,UUID roundId,String type,int key,long points) {
        GameRound r=rounds.lockById(roundId);
        if (!r.userId().equals(userId)) throw BusinessException.conflict("ROUND_USER_MISMATCH","Раунд принадлежит другому пользователю");
        var previous=jdbc.query("SELECT * FROM score_events WHERE round_id=? AND type=? AND event_key=?", (rs,n)->
            new ScoreChange(rs.getObject("id",UUID.class),rs.getLong("points"),true),roundId,type,key);
        if (!previous.isEmpty()) {
            if (previous.getFirst().points()!=points) throw BusinessException.conflict("IDEMPOTENCY_CONFLICT","Повтор события с другим количеством очков");
            return previous.getFirst();
        }
        var c=configs.getVersion(r.configVersion()).config();
        boolean valid = switch(type) {
            case "LEVEL" -> key>=1 && key <= (r.theme()==GameRound.Theme.GREEN?c.greenLevelCount():c.redLevelCount()) && points==c.pointsPerLevel();
            case "BOOSTER" -> key==r.boosterTier() && key>1 && r.boosterActivated() && points==c.boosterPoints(key);
            case "CASHOUT" -> r.cashoutAt()!=null && points==c.pointsCashoutBonus();
            default -> false;
        };
        if (!valid || r.status()==GameRound.Status.CREATED || points<0)
            throw BusinessException.invalid("INVALID_SCORE_EVENT","Событие или очки не соответствуют сохранённому раунду и его конфигурации");
        if (jdbc.queryForObject("SELECT count(*) FROM economy_transactions WHERE round_id=? AND type='BET_DEBIT'",Long.class,roundId)==0)
            throw BusinessException.conflict("BET_NOT_DEBITED","Ставка ещё не списана");
        long before=jdbc.queryForObject("SELECT game_score FROM users WHERE id=? FOR UPDATE",Long.class,userId);
        long after;
        try { after=Math.addExact(before,points); }
        catch (ArithmeticException e) { throw BusinessException.conflict("SCORE_LIMIT","Превышен предел очков"); }
        UUID id=UUID.randomUUID();
        Instant changedAt=clock.instant();
        jdbc.update("INSERT INTO score_events(id,user_id,round_id,type,event_key,points) VALUES (?,?,?,?,?,?)",id,userId,roundId,type,key,points);
        jdbc.update("""
                UPDATE users SET game_score=?,game_score_version=game_score_version+1,updated_at=?
                WHERE id=?
                """,after,Timestamp.from(changedAt),userId);
        PlayerScore snapshot=jdbc.queryForObject("""
                SELECT id,display_name,game_score,game_score_version FROM users WHERE id=?
                """,(rs,n)->new PlayerScore(rs.getObject("id",UUID.class),rs.getString("display_name"),
                rs.getLong("game_score"),rs.getLong("game_score_version"),
                changedAt),userId);
        events.publishEvent(new ScoreChanged(snapshot));
        return new ScoreChange(id,points,false);
    }
}
