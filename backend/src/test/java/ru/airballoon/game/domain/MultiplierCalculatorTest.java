package ru.airballoon.game.domain;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.airballoon.game.TestSupport.START;
import static ru.airballoon.game.TestSupport.config;

class MultiplierCalculatorTest {
    private final MultiplierCalculator calculator = new MultiplierCalculator();
    private final GameConfig config = config("100", 3, "0.20");

    @Test void startsAtOneAndAcceleratesSmoothly() {
        BigDecimal atZero = calculator.at(START, START, config);
        BigDecimal atOne = calculator.at(START, START.plusSeconds(1), config);
        BigDecimal atTwo = calculator.at(START, START.plusSeconds(2), config);
        BigDecimal atTen = calculator.at(START, START.plusSeconds(10), config);
        BigDecimal atEleven = calculator.at(START, START.plusSeconds(11), config);

        assertThat(atZero).isEqualByComparingTo("1.0000");
        assertThat(atTwo).isGreaterThan(atOne);
        assertThat(atEleven.subtract(atTen)).isGreaterThan(atOne.subtract(atZero));
    }

    @ParameterizedTest(name = "X{0} is first reached at {1} ms")
    @CsvSource({
            "1.2,912", "1.5,2028", "2,3466", "3,5494", "5,8048",
            "10,11513", "20,14979", "50,19561", "100,23026"
    })
    void analyticalCrossingMatchesTheAuthoritativeMillisecondCurve(String multiplier, long expectedMillis) {
        BigDecimal boundary = new BigDecimal(multiplier);
        Instant crossing = calculator.crossing(START, boundary, config);

        assertThat(Duration.between(START, crossing).toMillis()).isEqualTo(expectedMillis);
        assertThat(calculator.at(START, crossing, config)).isGreaterThanOrEqualTo(boundary);
        assertThat(calculator.at(START, crossing.minusMillis(1), config)).isLessThan(boundary);
    }

    @Test void highMultipliersAreFasterWhileEarlyPacingRemainsHumanScale() {
        assertThat(secondsTo("1.2")).isGreaterThan(0.9);
        assertThat(secondsTo("1.5")).isGreaterThan(2.0);
        assertThat(secondsTo("2")).isGreaterThan(3.4);

        assertThat(secondsTo("10")).isLessThan(oldLinearSecondsTo("10"));
        assertThat(secondsTo("20")).isLessThan(oldLinearSecondsTo("20"));
        assertThat(secondsTo("50")).isLessThan(oldLinearSecondsTo("50"));
        assertThat(secondsTo("100")).isLessThan(oldLinearSecondsTo("100"));
    }

    @Test void elapsedTimeNotTickCountDeterminesTheResult() {
        BigDecimal afterHundredSmallTicks = BigDecimal.ONE;
        for (int millis = 100; millis <= 10_000; millis += 100) {
            afterHundredSmallTicks = calculator.at(START, START.plusMillis(millis), config);
        }
        BigDecimal afterTenLargeTicks = BigDecimal.ONE;
        for (int millis = 1_000; millis <= 10_000; millis += 1_000) {
            afterTenLargeTicks = calculator.at(START, START.plusMillis(millis), config);
        }
        assertThat(afterHundredSmallTicks).isEqualByComparingTo(afterTenLargeTicks);
    }

    private double secondsTo(String multiplier) {
        return Duration.between(START, calculator.crossing(START, new BigDecimal(multiplier), config)).toMillis() / 1000.0;
    }

    private double oldLinearSecondsTo(String multiplier) {
        return new BigDecimal(multiplier).subtract(BigDecimal.ONE)
                .divide(config.growthPerSecond()).doubleValue();
    }
}
