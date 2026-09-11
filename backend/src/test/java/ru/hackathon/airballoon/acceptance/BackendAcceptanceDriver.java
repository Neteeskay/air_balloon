package ru.hackathon.airballoon.acceptance;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import ru.hackathon.airballoon.tournament.api.LeaderboardResponse;

/**
 * TEST-ONLY integration seam pending Backend #1/#2. Implement start/cashout/config/history using
 * real HTTP against the RANDOM_PORT server. Fixtures, deterministic stepping and inspection may
 * call the real engine/repositories. Never satisfy this contract with a replacement game/economy.
 * Seed profiles are requirements, not fabricated numeric seeds or a second crash algorithm.
 */
public interface BackendAcceptanceDriver {
    enum SeedProfile { LATE_CRASH_AFTER_LEVEL_3, X3_BOOSTER_AT_LEVEL_2_LATE_CRASH }
    enum Theme { GREEN, RED }
    record Response<T>(int status, String errorCode, T body) { public boolean successful() { return status >= 200 && status < 300; } }
    record Player(UUID id, BigDecimal balance, long gameScore) {}
    record Round(UUID id, UUID userId, String state, String result, Theme theme, int levels, int booster,
                 int level, boolean cashoutAvailable, BigDecimal multiplier, BigDecimal cashoutMultiplier,
                 BigDecimal winAmount, BigDecimal crashMultiplier, long levelPoints, long boosterPoints, long cashoutPoints,
                 boolean boosterActivated,
                 long pointsPerLevelSnapshot) {}
    record Event(String type, int level, long points, BigDecimal multiplierBefore, BigDecimal multiplierAfter) {}
    record Reward(UUID id, UUID roundId) {}
    record History(UUID roundId, UUID userId, String result, BigDecimal cashoutMultiplier, Instant finishedAt) {}
    record HistoryPage(List<History> items, long total) {}
    record Config(long pointsPerLevel) {}

    void resetFixtures();
    UUID createActiveTournament();
    Response<LeaderboardResponse> leaderboard(UUID tournamentId, UUID viewer, int page, int size);
    Player createPlayer(String name, BigDecimal balance, long gameScore);
    Player player(UUID userId);
    Response<Round> start(UUID userId, Theme theme, BigDecimal bet, int booster, SeedProfile seed, Map<String, Object> forgedFields);
    Response<Round> cashout(UUID actingUser, UUID roundId, Map<String, Object> forgedFields);
    Round round(UUID roundId);
    void reachLevel(UUID roundId, int level);
    void reachCrash(UUID roundId);
    List<Event> events(UUID roundId);
    long ledgerCount(UUID roundId, String type);
    Response<Config> getAdminConfig();
    Response<Config> setPointsPerLevel(long points);
    Response<HistoryPage> history(int page, int size);
    Reward reward(UUID roundId);
    Reward generateRewardAgain(UUID roundId);
    long rewardCount(UUID roundId);
    void redeliverLevelEvent(UUID roundId, int level);
    void redeliverBoosterEvent(UUID roundId);
    void restartApplicationPreservingDatabase();
}
