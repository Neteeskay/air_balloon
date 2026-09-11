package ru.hackathon.airballoon.reward;

import java.util.Optional;
import java.util.UUID;
import ru.hackathon.airballoon.game.GameRound;
public interface RewardService {
    Reward generateReward(GameRound round);
    Optional<Reward> findByRound(UUID roundId);
}
