package ru.airballoon.game.domain;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.Collections;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static ru.airballoon.game.TestSupport.config;
import static ru.airballoon.game.TestSupport.dec;
import static ru.airballoon.game.TestSupport.START;

class CrashPointGeneratorTest {
    private final CrashPointGenerator generator = new CrashPointGenerator();

    private GameConfig model(String alpha, String min, String max) {
        GameConfig base = config("8.42", 3);
        return new GameConfig(dec(min), dec(max), dec(alpha), base.growthPerSecond(),
                base.minBet(), base.maxBet(), base.boosterPointsPerMultiplier(),
                null, null, null, 0, null,
                new GameConfig.ThemeConfig(base.green().thresholds(), base.green().points(),
                        Collections.nCopies(Theme.GREEN.levels(), BigDecimal.ONE)),
                new GameConfig.ThemeConfig(base.red().thresholds(), base.red().points(),
                        Collections.nCopies(Theme.RED.levels(), BigDecimal.ONE)));
    }

    @Test
    void exactPiecewiseFormulaAndBoundariesUseFloorFourPrecision() {
        GameConfig c = model("0.03", "1", "100");
        assertThat(generator.generate(c, dec("0"))).isEqualByComparingTo("1.0000");
        assertThat(generator.generate(c, dec("0.029999999"))).isEqualByComparingTo("1.0000");
        assertThat(generator.generate(c, dec("0.03"))).isEqualByComparingTo("1.0000");
        assertThat(generator.generate(c, dec("0.030000001"))).isEqualByComparingTo("1.0000");
        assertThat(generator.generate(c, dec("0.04"))).isEqualByComparingTo("1.0104");
        assertThat(generator.generate(c, dec("0.5"))).isEqualByComparingTo("1.9400");
        assertThat(generator.generate(c, dec("0.9999"))).isEqualByComparingTo("100.0000");
    }

    @Test
    void alphaAndRangeEdgesRemainWellDefined() {
        assertThat(generator.generate(model("0", "1", "100"), dec("0")))
                .isEqualByComparingTo("1.0000");
        assertThat(generator.generate(model("0.9999", "1", "100"), dec("0.9999")))
                .isEqualByComparingTo("1.0000");
        assertThat(generator.generate(model("0.03", "1", "1"), dec("0.5")))
                .isEqualByComparingTo("1.0000");
        assertThat(generator.generate(model("0.03", "8.42", "8.42"), dec("0.5")))
                .isEqualByComparingTo("8.4200");
    }

    @Test
    void uniformInputIsHalfOpenAndSeedDerivationIsReproducible() {
        BigDecimal first = CrashPointGenerator.uniform(Theme.GREEN, 3, 42);
        assertThat(first).isEqualByComparingTo(CrashPointGenerator.uniform(Theme.GREEN, 3, 42));
        assertThat(first).isGreaterThanOrEqualTo(BigDecimal.ZERO).isLessThan(BigDecimal.ONE);
        GameConfig c = model("0.03", "1", "100");
        assertThat(generator.generate(c, Theme.GREEN, 3, 42))
                .isEqualByComparingTo(generator.generate(c, Theme.GREEN, 3, 42));
        assertThatThrownBy(() -> generator.generate(c, dec("-0.0001"))).isInstanceOf(GameException.class);
        assertThatThrownBy(() -> generator.generate(c, BigDecimal.ONE)).isInstanceOf(GameException.class);
    }

    @Test
    void legacyActiveRoundSnapshotRestoresWithoutRegeneratingCrash() throws Exception {
        GameConfig current = model("0.03", "8.42", "8.42");
        RoundEngine engine = new RoundEngine();
        GameRound started = engine.start(UUID.randomUUID(), UUID.randomUUID(), Theme.GREEN,
                dec("100"), 3, 42, current, START).round();
        ObjectMapper json = new ObjectMapper().findAndRegisterModules();
        ObjectNode snapshot = (ObjectNode) json.valueToTree(started);
        ObjectNode oldConfig = (ObjectNode) snapshot.path("config");
        oldConfig.remove("alpha");
        oldConfig.remove("crashMathModel");
        oldConfig.put("distributionParameter", 2.0);

        GameRound restored = json.treeToValue(snapshot, GameRound.class);
        assertThat(restored.config().crashMathModel()).isEqualTo(GameConfig.CrashMathModel.LEGACY_POWER_SNAPSHOT);
        assertThat(restored.crashMultiplier()).isEqualByComparingTo(started.crashMultiplier());
        assertThat(restored.fairnessCommitment()).isEqualTo(started.fairnessCommitment());
        GameRound finished = engine.advance(restored, START.plus(Duration.ofMinutes(10))).round();
        assertThat(finished.crashMultiplier()).isEqualByComparingTo(started.crashMultiplier());
        assertThat(RoundFairness.verify(finished)).isTrue();
        assertThatThrownBy(() -> generator.generate(restored.config(), Theme.GREEN, 3, 42))
                .isInstanceOf(GameException.class);
    }

    @Test
    void deterministicDistributionMatchesSurvivalImmediateCrashAndFixedTargetEv() {
        GameConfig c = model("0.03", "1", "100");
        int samples = 200_000;
        int minimum = 0, atLeast2 = 0, atLeast5 = 0, atLeast10 = 0;
        for (int seed = 0; seed < samples; seed++) {
            BigDecimal x = generator.generate(c, Theme.GREEN, 3, seed);
            if (x.compareTo(dec("1")) == 0) minimum++;
            if (x.compareTo(dec("2")) >= 0) atLeast2++;
            if (x.compareTo(dec("5")) >= 0) atLeast5++;
            if (x.compareTo(dec("10")) >= 0) atLeast10++;
        }
        double pMinimum = minimum / (double) samples;
        double p2 = atLeast2 / (double) samples;
        double p5 = atLeast5 / (double) samples;
        double p10 = atLeast10 / (double) samples;
        assertThat(pMinimum).isCloseTo(0.03, within(0.002));
        assertThat(p2).isCloseTo(0.97 / 2, within(0.003));
        assertThat(p5).isCloseTo(0.97 / 5, within(0.003));
        assertThat(p10).isCloseTo(0.97 / 10, within(0.003));
        assertThat(2 * p2).isCloseTo(0.97, within(0.006));
        System.out.printf("CRASH_STATS samples=%d min=%.6f p2=%.6f p5=%.6f p10=%.6f evAt2=%.6f%n",
                samples, pMinimum, p2, p5, p10, 2 * p2);
    }

    private static org.assertj.core.data.Offset<Double> within(double value) {
        return org.assertj.core.data.Offset.offset(value);
    }
}
