package ru.hackathon.airballoon.score;

import java.util.UUID;
public interface ScoreService {
    ScoreChange awardLevelPoints(UUID userId, UUID roundId, int level, long points);
    ScoreChange awardBoosterPoints(UUID userId, UUID roundId, int boosterTier, long points);
    ScoreChange awardCashoutPoints(UUID userId, UUID roundId, long points);
}
