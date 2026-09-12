package ru.hackathon.airballoon.support;

import java.util.Map;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

/** Defaults to real Testcontainers PG17; external PG is an explicit option for hosts without Docker. */
public abstract class PostgresSupport {
    private static PostgreSQLContainer<?> postgres;
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        connectionProperties().forEach((key, value) -> registry.add(key, () -> value));
    }

    public static synchronized Map<String, Object> connectionProperties() {
        String url = System.getenv("TEST_DATABASE_URL");
        if (url != null && !url.isBlank()) {
            return Map.of("spring.datasource.url", url,
                    "spring.datasource.username", System.getenv().getOrDefault("TEST_DATABASE_USER", "postgres"),
                    "spring.datasource.password", System.getenv().getOrDefault("TEST_DATABASE_PASSWORD", ""));
        } else {
            if (postgres == null) {
                postgres = new PostgreSQLContainer<>("postgres:17-alpine");
                postgres.start(); // No silent skip: integration suite needs a real database.
            }
            return Map.of("spring.datasource.url", postgres.getJdbcUrl(), "spring.datasource.username", postgres.getUsername(),
                    "spring.datasource.password", postgres.getPassword());
        }
    }
}
