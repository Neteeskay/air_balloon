package ru.hackathon.airballoon.economy;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.common.BusinessException;
import ru.hackathon.airballoon.config.GameConfigProvider;
import ru.hackathon.airballoon.game.*;
import ru.hackathon.airballoon.reward.RewardService;
import ru.hackathon.airballoon.score.ScoreService;

/** Short atomic persistence boundaries. Engine supplies decisions; this class runs no game loop. */
@Service
public class RoundTransactions {
    private final RoundRepository rounds;
    private final BalanceService balances;
    private final ScoreService scores;
    private final RewardService rewards;
    private final GameConfigProvider configs;
    public RoundTransactions(RoundRepository rounds,BalanceService balances,ScoreService scores,RewardService rewards,GameConfigProvider configs) {
        this.rounds=rounds; this.balances=balances; this.scores=scores; this.rewards=rewards; this.configs=configs;
    }
    @Transactional
    public GameRound createAndDebit(GameRound created) {
        balances.lockUser(created.userId());
        GameRound saved=rounds.save(created);
        balances.debitBet(saved.userId(),saved.id(),saved.betAmount());
        return saved;
    }
    @Transactional
    public GameRound saveCashoutAndCredit(GameRound decided) {
        if (decided.cashoutAt()==null) throw BusinessException.invalid("INVALID_WIN","Нет события cashout");
        GameRound saved=rounds.save(decided);
        balances.creditWin(saved.userId(),saved.id(),saved.winAmount());
        scores.awardCashoutPoints(saved.userId(),saved.id(),configs.getVersion(saved.configVersion()).config().pointsCashoutBonus());
        return rounds.findById(saved.id()).orElseThrow();
    }
    @Transactional
    public GameRound finishAndReward(GameRound finished) {
        if (finished.status()!=GameRound.Status.FINISHED)
            throw BusinessException.invalid("INVALID_ROUND","Ожидается FINISHED");
        GameRound saved=rounds.save(finished);
        // Replay validates receipt if cashout had already been credited.
        if (saved.cashoutAt()!=null) balances.creditWin(saved.userId(),saved.id(),saved.winAmount());
        rewards.generateReward(saved);
        return rounds.findById(saved.id()).orElseThrow();
    }
}
