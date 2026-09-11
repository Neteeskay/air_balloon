package ru.airballoon.integration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.airballoon.game.application.port.BalanceService;
import ru.airballoon.game.application.port.RoundRepository;
import ru.airballoon.game.domain.GameRound;
import ru.airballoon.game.domain.RoundCheckpoint;
import ru.airballoon.game.domain.RoundStatus;

/** Preserves the engine snapshot while writing the normalized Backend #2 round/economy model. */
@Component
@Profile("!test & !dev")
public class DataRoundRepositoryAdapter implements RoundRepository {
    private final ru.hackathon.airballoon.game.RoundRepository rounds;
    private final ru.hackathon.airballoon.economy.RoundTransactions transactions;
    private final DataGameConfigAdapter configs;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public DataRoundRepositoryAdapter(ru.hackathon.airballoon.game.RoundRepository rounds,
                                      ru.hackathon.airballoon.economy.RoundTransactions transactions,
                                      DataGameConfigAdapter configs, JdbcTemplate jdbc, ObjectMapper json) {
        this.rounds = rounds;
        this.transactions = transactions;
        this.configs = configs;
        this.jdbc = jdbc;
        this.json = json;
    }

    @Override
    @Transactional
    public GameRound createAndDebit(GameRound round, BalanceService ignored) {
        return createAndDebit(round, ignored, null);
    }

    @Override
    @Transactional
    public GameRound createAndDebit(GameRound round, BalanceService ignored, RoundCheckpoint checkpoint) {
        long version = configs.currentVersion();
        var created = toData(round, version, -1, ru.hackathon.airballoon.game.GameRound.Status.CREATED);
        var debited = transactions.createAndDebit(created);
        rounds.save(toData(round, version, debited.version(), ru.hackathon.airballoon.game.GameRound.Status.RUNNING));
        writeSnapshot(round);
        if (checkpoint != null) writeCheckpoint(checkpoint);
        return round;
    }

    @Override
    @Transactional
    public GameRound save(GameRound round) {
        var current = rounds.findById(round.id()).orElseThrow();
        rounds.save(toData(round, current.configVersion(), current.version(), mapStatus(round.status())));
        writeSnapshot(round);
        return round;
    }

    @Override
    public Optional<GameRound> findById(UUID id) {
        return jdbc.query("SELECT snapshot_json::text FROM core_round_snapshots WHERE round_id=?",
                (rs, row) -> read(rs.getString(1)), id).stream().findFirst();
    }

    private ru.hackathon.airballoon.game.GameRound toData(
            GameRound r, long configVersion, long version,
            ru.hackathon.airballoon.game.GameRound.Status status) {
        return new ru.hackathon.airballoon.game.GameRound(
                r.id(), r.userId(), ru.hackathon.airballoon.game.GameRound.Theme.valueOf(r.theme().name()),
                DataBalanceAdapter.units(r.betAmount()), r.boosterMultiplier(), r.boosterLevel(),
                r.boosterActivated(), r.crashMultiplier(), r.cashoutMultiplier(),
                DataBalanceAdapter.units(r.winAmount()), r.roundScore(), status,
                Long.toString(r.seed()), r.fairnessCommitment(), configVersion, version,
                r.startedAt(), status == ru.hackathon.airballoon.game.GameRound.Status.CREATED ? null : r.startedAt(),
                r.cashoutAt(), r.crashedAt(), r.finishedAt());
    }

    private static ru.hackathon.airballoon.game.GameRound.Status mapStatus(RoundStatus status) {
        return ru.hackathon.airballoon.game.GameRound.Status.valueOf(status.name());
    }

    private void writeSnapshot(GameRound round) {
        try {
            jdbc.update("""
                    INSERT INTO core_round_snapshots(round_id,snapshot_json,updated_at)
                    VALUES (?,?::jsonb,now())
                    ON CONFLICT (round_id) DO UPDATE SET snapshot_json=excluded.snapshot_json,updated_at=now()
                    """, round.id(), json.writeValueAsString(round));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize round snapshot", e);
        }
    }

    private void writeCheckpoint(RoundCheckpoint checkpoint) {
        try {
            jdbc.update("""
                    INSERT INTO core_round_checkpoints(round_id,checkpoint_json,updated_at,expires_at)
                    VALUES (?,?::jsonb,now(),NULL)
                    ON CONFLICT (round_id) DO UPDATE
                    SET checkpoint_json=excluded.checkpoint_json,updated_at=now(),expires_at=NULL
                    """, checkpoint.round().id(), json.writeValueAsString(checkpoint));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize initial round checkpoint", e);
        }
    }

    private GameRound read(String value) {
        try { return json.readValue(value, GameRound.class); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Cannot read round snapshot", e); }
    }
}
