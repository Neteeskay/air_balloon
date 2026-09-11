package ru.hackathon.airballoon.game;

import java.sql.*;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.*;
import ru.hackathon.airballoon.common.BusinessException;
import ru.hackathon.airballoon.config.GameConfigProvider;

@Repository
public class PostgresRoundRepository implements RoundRepository {
    private final JdbcTemplate jdbc;
    private final GameConfigProvider configs;
    private static final String SELECT = """
        SELECT r.*, COALESCE((SELECT SUM(points) FROM score_events s WHERE s.round_id=r.id),0) AS round_score
        FROM game_rounds r WHERE r.id=?
        """;
    public PostgresRoundRepository(JdbcTemplate jdbc, GameConfigProvider configs) { this.jdbc=jdbc; this.configs=configs; }
    public Optional<GameRound> findById(UUID id) { return jdbc.query(SELECT, this::map, id).stream().findFirst(); }
    @Transactional(propagation = Propagation.MANDATORY)
    public GameRound lockById(UUID id) {
        return jdbc.query(SELECT + " FOR UPDATE OF r", this::map, id).stream().findFirst()
            .orElseThrow(() -> BusinessException.missing("ROUND_NOT_FOUND"));
    }
    @Transactional
    public GameRound save(GameRound r) {
        if (r.id()==null || r.userId()==null || r.theme()==null || r.status()==null || r.createdAt()==null
            || r.betAmount() <= 0 || r.betAmount() > 1000000000L || r.crashMultiplier()==null
            || r.crashMultiplier().scale()>8 || (r.cashoutMultiplier()!=null && r.cashoutMultiplier().scale()>8)) {
            throw BusinessException.invalid("INVALID_ROUND", "Проверьте обязательные поля, ставку и точность коэффициентов");
        }
        if (r.version() == -1) {
            var config = configs.getVersion(r.configVersion()).config();
            if (!config.active()) throw BusinessException.conflict("GAME_INACTIVE", "Игра отключена");
            if (r.status()!=GameRound.Status.CREATED || r.cashoutAt()!=null || r.finishedAt()!=null
                || r.boosterActivated() || r.startedAt()!=null || r.crashedAt()!=null
                || r.crashMultiplier().compareTo(config.minCrashMultiplier())<0
                || r.crashMultiplier().compareTo(config.maxCrashMultiplier())>0) {
                throw BusinessException.invalid("INVALID_ROUND", "Новый раунд должен быть CREATED с параметрами своей конфигурации");
            }
            jdbc.update("""
                INSERT INTO game_rounds(id,user_id,theme,bet_amount,booster_tier,booster_level,
                booster_activated,crash_multiplier,cashout_multiplier,win_amount,status,seed,fairness_hash,
                config_version,created_at,started_at,cashout_at,crashed_at,finished_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, r.id(),r.userId(),r.theme().name(),r.betAmount(),r.boosterTier(),r.boosterLevel(),
                r.boosterActivated(),r.crashMultiplier(),r.cashoutMultiplier(),r.winAmount(),r.status().name(),r.seed(),
                r.fairnessHash(),r.configVersion(),ts(r.createdAt()),ts(r.startedAt()),ts(r.cashoutAt()),ts(r.crashedAt()),ts(r.finishedAt()));
        } else {
            GameRound old = lockById(r.id());
            if (old.version()!=r.version()) throw BusinessException.conflict("ROUND_VERSION_CONFLICT", "Раунд уже изменён; перечитайте состояние");
            if (!old.userId().equals(r.userId()) || old.theme()!=r.theme() || old.betAmount()!=r.betAmount()
                || old.boosterTier()!=r.boosterTier() || !Objects.equals(old.boosterLevel(),r.boosterLevel())
                || old.crashMultiplier().compareTo(r.crashMultiplier())!=0 || old.configVersion()!=r.configVersion()
                || !Objects.equals(old.seed(),r.seed()) || !Objects.equals(old.fairnessHash(),r.fairnessHash())
                || !old.createdAt().equals(r.createdAt())
                || (old.boosterActivated() && !r.boosterActivated())
                || (old.cashoutAt()!=null && (!old.cashoutAt().equals(r.cashoutAt()) || old.winAmount()!=r.winAmount()
                    || r.cashoutMultiplier()==null || old.cashoutMultiplier().compareTo(r.cashoutMultiplier())!=0))
                || (old.startedAt()!=null && !old.startedAt().equals(r.startedAt()))
                || (old.crashedAt()!=null && !old.crashedAt().equals(r.crashedAt()))
                || (old.finishedAt()!=null) || old.status().ordinal()>r.status().ordinal()) {
                throw BusinessException.conflict("IMMUTABLE_ROUND_DATA", "Нельзя менять начальные параметры, итог или откатывать сохранённые события");
            }
            jdbc.update("""
                UPDATE game_rounds SET booster_activated=?, cashout_multiplier=?, win_amount=?, status=?,
                started_at=?,cashout_at=?,crashed_at=?,finished_at=?,version=version+1 WHERE id=? AND version=?
                """,r.boosterActivated(),r.cashoutMultiplier(),r.winAmount(),r.status().name(),ts(r.startedAt()),
                ts(r.cashoutAt()),ts(r.crashedAt()),ts(r.finishedAt()),r.id(),r.version());
        }
        return findById(r.id()).orElseThrow();
    }
    private Timestamp ts(Instant value) { return value==null ? null : Timestamp.from(value); }
    private Instant time(ResultSet rs,String key) throws SQLException { var t=rs.getTimestamp(key); return t==null?null:t.toInstant(); }
    private GameRound map(ResultSet rs,int row) throws SQLException {
        return new GameRound(rs.getObject("id",UUID.class),rs.getObject("user_id",UUID.class),GameRound.Theme.valueOf(rs.getString("theme")),
            rs.getLong("bet_amount"),rs.getInt("booster_tier"),rs.getObject("booster_level",Integer.class),
            rs.getBoolean("booster_activated"),rs.getBigDecimal("crash_multiplier"),rs.getBigDecimal("cashout_multiplier"),
            rs.getLong("win_amount"),rs.getLong("round_score"),GameRound.Status.valueOf(rs.getString("status")),
            rs.getString("seed"),rs.getString("fairness_hash"),rs.getLong("config_version"),rs.getLong("version"),
            time(rs,"created_at"),time(rs,"started_at"),time(rs,"cashout_at"),time(rs,"crashed_at"),time(rs,"finished_at"));
    }
}
