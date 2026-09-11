package ru.airballoon.game;

import org.junit.jupiter.api.Test;
import ru.airballoon.game.domain.*;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static ru.airballoon.game.TestSupport.*;
import static ru.airballoon.game.GameEngineTest.error;

class RandomAndConfigTest {
    private final GameConfig base = config("30", 3);

    private GameConfig randomConfig() {
        var green = new GameConfig.ThemeConfig(base.green().thresholds(), base.green().points(), Collections.nCopies(9, BigDecimal.ONE));
        var red = new GameConfig.ThemeConfig(base.red().thresholds(), base.red().points(), Collections.nCopies(12, BigDecimal.ONE));
        return new GameConfig(dec("1.01"), dec("30"), 2, base.growthPerSecond(), base.minBet(), base.maxBet(), 150, green, red);
    }

    @Test void sameSeedReproducesCrashAndBoosterForEveryThemeAndBooster() {
        var config = randomConfig(); var crash = new CrashPointGenerator(); var booster = new BoosterGenerator();
        for (Theme theme : Theme.values()) for (int b = 1; b <= 4; b++) for (long seed = -50; seed < 50; seed++) {
            assertThat(crash.generate(config, theme, b, seed)).isEqualTo(crash.generate(config, theme, b, seed));
            assertThat(booster.generate(config, theme, b, seed)).isEqualTo(booster.generate(config, theme, b, seed));
        }
    }

    @Test void differentSeedsGenerallyProduceDifferentResultsInsideBounds() {
        var config = randomConfig(); var crash = new CrashPointGenerator(); var booster = new BoosterGenerator();
        Set<BigDecimal> crashes = new HashSet<>(); Set<Integer> positions = new HashSet<>();
        for (long seed = 0; seed < 1000; seed++) {
            var point = crash.generate(config, Theme.GREEN, 3, seed);
            assertThat(point).isBetween(config.minCrashMultiplier(), config.maxCrashMultiplier());
            crashes.add(point); positions.add(booster.generate(config, Theme.GREEN, 3, seed));
        }
        assertThat(crashes.size()).isGreaterThan(900);
        assertThat(positions).containsExactlyInAnyOrder(1, 2, 3, 4, 5, 6, 7, 8, 9);
    }

    @Test void fixedCrashRangeIsExact() {
        for (long seed : new long[]{0, -1, Long.MIN_VALUE, Long.MAX_VALUE})
            assertThat(new CrashPointGenerator().generate(config("8.42", 3), Theme.RED, 4, seed)).isEqualByComparingTo("8.42");
    }

    @Test void weightsAreNormalizedAndZeroWeightIsNeverSelected() {
        var weights = Collections.nCopies(9, dec("5"));
        var green = new GameConfig.ThemeConfig(base.green().thresholds(), base.green().points(), weights);
        var weighted = new GameConfig(base.minCrashMultiplier(), base.maxCrashMultiplier(), 2, base.growthPerSecond(),
                base.minBet(), base.maxBet(), 150, green, base.red());
        for (long seed = 0; seed < 100; seed++) {
            assertThat(new BoosterGenerator().generate(weighted, Theme.GREEN, 3, seed))
                    .isEqualTo(new BoosterGenerator().generate(randomConfig(), Theme.GREEN, 3, seed));
            assertThat(new BoosterGenerator().generate(base, Theme.GREEN, 3, seed)).isEqualTo(3);
        }
    }

    @Test void rejectsInvalidDistributionAndCrashBounds() {
        for (double p : new double[]{0, -1, Double.NaN, Double.POSITIVE_INFINITY, 101})
            error(() -> new GameConfig(dec("1"), dec("30"), p, dec("0.1"), dec("1"), dec("1000"), 150, base.green(), base.red()), GameError.INVALID_GAME_CONFIG);
        error(() -> new GameConfig(dec("5"), dec("4"), 2, dec("0.1"), dec("1"), dec("1000"), 150, base.green(), base.red()), GameError.INVALID_GAME_CONFIG);
        error(() -> new GameConfig(null, dec("4"), 2, dec("0.1"), dec("1"), dec("1000"), 150, base.green(), base.red()), GameError.INVALID_GAME_CONFIG);
        error(() -> new GameConfig(dec("0.99"), dec("4"), 2, dec("0.1"), dec("1"), dec("1000"), 150, base.green(), base.red()), GameError.INVALID_GAME_CONFIG);
    }

    @Test void rejectsInvalidThemeWeightsThresholdsAndLengths() {
        var g = base.green();
        error(() -> new GameConfig.ThemeConfig(g.thresholds(), g.points(), Collections.nCopies(9, BigDecimal.ZERO)), GameError.INVALID_GAME_CONFIG);
        var negative = new ArrayList<>(g.boosterWeights()); negative.set(0, dec("-1"));
        error(() -> new GameConfig.ThemeConfig(g.thresholds(), g.points(), negative), GameError.INVALID_GAME_CONFIG);
        error(() -> new GameConfig.ThemeConfig(g.thresholds(), List.of(100L), g.boosterWeights()), GameError.INVALID_GAME_CONFIG);
        var thresholds = new ArrayList<>(g.thresholds()); thresholds.set(1, thresholds.get(0));
        error(() -> new GameConfig.ThemeConfig(thresholds, g.points(), g.boosterWeights()), GameError.INVALID_GAME_CONFIG);
        error(() -> new GameConfig.ThemeConfig(null, g.points(), g.boosterWeights()), GameError.INVALID_GAME_CONFIG);
        error(() -> new GameConfig(dec("1"), dec("30"), 2, dec("0.1"), dec("1"), dec("1000"), 150, base.red(), base.green()), GameError.INVALID_GAME_CONFIG);
    }

    @Test void rejectsInvalidGrowthMoneyAndPoints() {
        error(() -> new GameConfig(dec("1"), dec("30"), 2, dec("0"), dec("1"), dec("1000"), 150, base.green(), base.red()), GameError.INVALID_GAME_CONFIG);
        error(() -> new GameConfig(dec("1"), dec("30"), 2, dec("0.1"), dec("1.001"), dec("1000"), 150, base.green(), base.red()), GameError.INVALID_GAME_CONFIG);
        error(() -> new GameConfig(dec("1"), dec("30"), 2, dec("0.1"), dec("1"), dec("1000"), -1, base.green(), base.red()), GameError.INVALID_GAME_CONFIG);
    }

    @Test void configurationDefensivelyCopiesLists() {
        var thresholds = new ArrayList<>(base.green().thresholds());
        var config = new GameConfig.ThemeConfig(thresholds, base.green().points(), base.green().boosterWeights());
        thresholds.set(0, dec("999"));
        assertThat(config.thresholds().getFirst()).isEqualByComparingTo("1.2");
        assertThatThrownBy(() -> config.thresholds().add(dec("1000"))).isInstanceOf(UnsupportedOperationException.class);
    }
}
