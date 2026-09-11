package ru.airballoon.integration;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import ru.airballoon.game.application.port.RewardService;
import ru.airballoon.game.domain.GameRound;

@Component
@Profile("!test & !dev")
public class DataRewardAdapter implements RewardService {
    private final ru.hackathon.airballoon.game.RoundRepository rounds;
    private final ru.hackathon.airballoon.reward.RewardService rewards;

    public DataRewardAdapter(ru.hackathon.airballoon.game.RoundRepository rounds,
                             ru.hackathon.airballoon.reward.RewardService rewards) {
        this.rounds = rounds;
        this.rewards = rewards;
    }

    @Override public void onRoundFinished(GameRound round) {
        rewards.generateReward(rounds.findById(round.id()).orElseThrow());
    }
}
