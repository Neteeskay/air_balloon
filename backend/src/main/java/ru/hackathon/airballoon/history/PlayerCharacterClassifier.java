package ru.hackathon.airballoon.history;

import java.math.BigDecimal;
import org.springframework.stereotype.Component;
import ru.hackathon.airballoon.game.GameRound;

/** Deterministic post-round personalization. It never participates in game math. */
@Component
public final class PlayerCharacterClassifier {
    private static final BigDecimal CLOSE_CALL_DISTANCE = new BigDecimal("0.15");
    private static final BigDecimal COLD_BLOODED_MULTIPLIER = new BigDecimal("5.0");
    // GREEN and RED share these first three immutable engine thresholds.
    private static final BigDecimal LEVEL_ONE = new BigDecimal("1.20");
    private static final BigDecimal LEVEL_TWO = new BigDecimal("1.50");
    private static final BigDecimal LEVEL_THREE = new BigDecimal("2.00");

    public PlayerCharacter classify(GameRound round) {
        if (round.finishedAt() == null) {
            throw new IllegalArgumentException("Player character is available only after round completion");
        }

        BigDecimal cashout = round.cashoutMultiplier();
        if (cashout != null && round.boosterActivated()) return character(Code.BOOSTER_HUNTER);

        if (cashout != null && round.crashMultiplier() != null) {
            BigDecimal distance = round.crashMultiplier().subtract(cashout);
            if (distance.signum() >= 0 && distance.compareTo(CLOSE_CALL_DISTANCE) <= 0) {
                return character(Code.CLOSE_CALL);
            }
        }

        if (cashout != null && cashout.compareTo(COLD_BLOODED_MULTIPLIER) >= 0) {
            return character(Code.COLD_BLOODED);
        }

        if (cashout != null
                && cashout.compareTo(LEVEL_ONE) >= 0
                && cashout.compareTo(LEVEL_TWO) < 0) {
            return character(Code.CAUTIOUS);
        }

        // RoundEngine resolves a tie in favour of Crash, so a level is reached only above its threshold.
        if (cashout == null && round.crashMultiplier() != null
                && round.crashMultiplier().compareTo(LEVEL_THREE) > 0) {
            return character(Code.GREEDY);
        }

        return character(Code.ADVENTURER);
    }

    private static PlayerCharacter character(Code code) {
        return switch (code) {
            case CAUTIOUS -> new PlayerCharacter(code, "Осторожный",
                    "Не стал рисковать и забрал выигрыш заранее");
            case COLD_BLOODED -> new PlayerCharacter(code, "Хладнокровный",
                    "Уверенно забрал на высоком коэффициенте");
            case CLOSE_CALL -> new PlayerCharacter(code, "На волоске",
                    "Забрал выигрыш буквально перед Crash");
            case BOOSTER_HUNTER -> new PlayerCharacter(code, "Охотник за бустером",
                    "Дождался бустера и успешно забрал выигрыш");
            case GREEDY -> new PlayerCharacter(code, "Жадина",
                    "Рискнул подняться выше, но шар не выдержал");
            case ADVENTURER -> new PlayerCharacter(code, "Искатель высоты",
                    "Каждый полёт — новый шанс подняться выше");
        };
    }

    public enum Code { CAUTIOUS, COLD_BLOODED, CLOSE_CALL, BOOSTER_HUNTER, GREEDY, ADVENTURER }
    public record PlayerCharacter(Code code, String title, String description) {}
}
