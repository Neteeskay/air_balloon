package ru.airballoon.game.application.port;

import ru.airballoon.game.domain.GameRound;

public interface RewardService {
    /** Idempotent by roundId. Backend #2 owns reward selection and persistence. */
    void onRoundFinished(GameRound round);
}
