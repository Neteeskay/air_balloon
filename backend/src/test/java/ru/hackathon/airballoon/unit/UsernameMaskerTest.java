package ru.hackathon.airballoon.unit;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;
import ru.hackathon.airballoon.tournament.domain.UsernameMasker;
import static org.assertj.core.api.Assertions.assertThat;

class UsernameMaskerTest {
    @ParameterizedTest
    @CsvSource({"Alexander,***xander", "Maks,***s", "Al,***", "A,***", "Аня,***", "Алексей,***ксей", "🎈🚀☁Pilot,***Pilot"})
    void masksFirstThreeCodePoints(String original, String expected) {
        assertThat(UsernameMasker.mask(original)).isEqualTo(expected);
    }
    @Test void missingNameIsSafe() {
        assertThat(UsernameMasker.mask(null)).isEqualTo("***");
        assertThat(UsernameMasker.mask(" ")).isEqualTo("***");
    }
}
