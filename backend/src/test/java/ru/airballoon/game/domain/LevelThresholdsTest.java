package ru.airballoon.game.domain;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class LevelThresholdsTest {
    @ParameterizedTest(name = "max X{0}")
    @CsvSource({"10", "20", "50", "100"})
    void distributesBothThemesAcrossTheConfiguredMaximum(String maxText) {
        BigDecimal max = new BigDecimal(maxText).setScale(4);
        assertThresholds(LevelThresholds.forMax(max, 9), max, 9);
        assertThresholds(LevelThresholds.forMax(max, 12), max, 12);
    }

    @ParameterizedTest(name = "max X{0} follows logarithmic formula")
    @CsvSource({"10", "20", "50", "100"})
    void followsLogarithmicFormulaWithExactFinalValue(String maxText) {
        BigDecimal max = new BigDecimal(maxText);
        List<BigDecimal> levels = LevelThresholds.forMax(max, 9);
        for (int i = 1; i <= 8; i++) {
            BigDecimal expected = BigDecimal.valueOf(StrictMath.pow(max.doubleValue(), (double) i / 9))
                    .setScale(LevelThresholds.SCALE, RoundingMode.HALF_UP);
            assertThat(levels.get(i - 1)).isEqualByComparingTo(expected);
        }
        assertThat(levels.getLast()).isEqualByComparingTo(max);
    }

    private static void assertThresholds(List<BigDecimal> values, BigDecimal max, int expectedSize) {
        assertThat(values).hasSize(expectedSize);
        assertThat(values.getLast()).isEqualByComparingTo(max);
        for (int i = 1; i < values.size(); i++) assertThat(values.get(i)).isGreaterThan(values.get(i - 1));
    }
}
