package ru.hackathon.airballoon.history;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.hackathon.airballoon.game.GameRound;

import static org.assertj.core.api.Assertions.assertThat;

class PlayerCharacterClassifierTest {
    private final PlayerCharacterClassifier classifier = new PlayerCharacterClassifier();

    @Test void cautious() {
        assertCode(round("1.40", "4.00", false), PlayerCharacterClassifier.Code.CAUTIOUS);
    }

    @Test void coldBlooded() {
        assertCode(round("5.00", "8.00", false), PlayerCharacterClassifier.Code.COLD_BLOODED);
    }

    @Test void closeCall() {
        assertCode(round("5.90", "6.00", false), PlayerCharacterClassifier.Code.CLOSE_CALL);
    }

    @Test void boosterHunter() {
        assertCode(round("2.50", "4.00", true), PlayerCharacterClassifier.Code.BOOSTER_HUNTER);
    }

    @Test void greedy() {
        assertCode(round(null, "2.01", false), PlayerCharacterClassifier.Code.GREEDY);
    }

    @Test void fallbackAdventurer() {
        assertCode(round(null, "1.80", false), PlayerCharacterClassifier.Code.ADVENTURER);
    }

    @Test void boosterHunterWinsOverlapWithCloseCallAndColdBlooded() {
        assertCode(round("5.90", "6.00", true), PlayerCharacterClassifier.Code.BOOSTER_HUNTER);
    }

    private void assertCode(GameRound round, PlayerCharacterClassifier.Code expected) {
        assertThat(classifier.classify(round).code()).isEqualTo(expected);
    }

    private static GameRound round(String cashout, String crash, boolean boosterActivated) {
        Instant now = Instant.parse("2026-09-11T00:00:00Z");
        BigDecimal cashoutMultiplier = cashout == null ? null : decimal(cashout);
        return new GameRound(UUID.randomUUID(), UUID.randomUUID(), GameRound.Theme.GREEN, 100,
                boosterActivated ? 2 : 1, boosterActivated ? 2 : null, boosterActivated,
                decimal(crash), cashoutMultiplier, cashoutMultiplier == null ? 0 : 100, 0,
                GameRound.Status.FINISHED, "seed", "hash", 1, 1,
                now, now, cashoutMultiplier == null ? null : now, now, now);
    }

    private static BigDecimal decimal(String value) { return new BigDecimal(value); }
}
