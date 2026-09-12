package ru.airballoon.game.infrastructure.config;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CorsPropertiesTest {
    @ParameterizedTest
    @ValueSource(ints = {5173, 5174, 3000})
    void derivesBothLocalDevelopmentOriginsFromFrontendPort(int port) {
        CorsProperties properties = new CorsProperties("http", "localhost", port, "");

        assertThat(properties.allowedOriginList()).containsExactly(
                "http://localhost:" + port,
                "http://127.0.0.1:" + port);
    }

    @Test
    void explicitListIsAuthoritativeTrimmedAndDeduplicated() {
        CorsProperties properties = new CorsProperties("http", "localhost", 5174,
                " http://localhost:3000, ,http://127.0.0.1:3000,http://localhost:3000 ");

        assertThat(properties.allowedOriginList()).containsExactly(
                "http://localhost:3000", "http://127.0.0.1:3000");
        assertThat(properties.allowedOriginList()).doesNotContain("http://localhost:5174");
    }

    @Test
    void unknownOriginIsNotAdded() {
        CorsProperties properties = new CorsProperties("http", "localhost", 5174, "");

        assertThat(properties.allowedOriginList()).doesNotContain("http://localhost:9999");
    }

    @Test
    void rejectsWildcardBecauseCredentialsAreEnabled() {
        assertThatThrownBy(() -> new CorsProperties("http", "localhost", 5174, "*"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Wildcard");
    }
}
