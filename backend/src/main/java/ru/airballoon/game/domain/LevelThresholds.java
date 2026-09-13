package ru.airballoon.game.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/** Builds the authoritative level X values from the active crash ceiling. */
public final class LevelThresholds {
    public static final int SCALE = 4;
    private static final BigDecimal UNIT = BigDecimal.ONE.movePointLeft(SCALE);

    private LevelThresholds() {}

    /**
     * Splits the exponential flight axis into equal-time segments.  The final
     * value is assigned from maxX itself so serialized snapshots never expose
     * a floating-point artefact such as 99.9999 instead of the configured cap.
     */
    public static List<BigDecimal> forMax(BigDecimal maxX, int levelCount) {
        if (maxX == null || levelCount <= 0) throw new IllegalArgumentException("maxX and levelCount are required");
        if (maxX.compareTo(BigDecimal.ONE) <= 0) return List.of();

        BigDecimal canonicalMax = maxX.setScale(SCALE, RoundingMode.UNNECESSARY);
        List<BigDecimal> values = new ArrayList<>(levelCount);
        BigDecimal previous = BigDecimal.ONE.setScale(SCALE);
        for (int i = 1; i <= levelCount; i++) {
            BigDecimal value;
            if (i == levelCount) {
                value = canonicalMax;
            } else {
                double exponent = StrictMath.log(maxX.doubleValue()) * i / levelCount;
                value = BigDecimal.valueOf(StrictMath.exp(exponent)).setScale(SCALE, RoundingMode.HALF_UP);
                value = value.max(previous.add(UNIT));
                // Leave enough scale-4 values for the remaining levels.
                BigDecimal latestAllowed = canonicalMax.subtract(UNIT.multiply(BigDecimal.valueOf(levelCount - i)));
                value = value.min(latestAllowed);
            }
            if (value.compareTo(previous) <= 0 || value.compareTo(canonicalMax) >= 0 && i < levelCount) {
                throw new IllegalArgumentException("maxX is too small for strictly increasing canonical thresholds");
            }
            values.add(value);
            previous = value;
        }
        return List.copyOf(values);
    }
}
