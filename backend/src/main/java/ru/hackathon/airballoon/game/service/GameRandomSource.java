package ru.hackathon.airballoon.game.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.OptionalLong;
import java.util.Random;

@Component
public class GameRandomSource {
    private final Random random;
    private final boolean deterministic;

    public GameRandomSource(@Value("${app.game.fixed-seed:}") String configuredSeed) {
        OptionalLong seed = parseSeed(configuredSeed);
        if (seed.isPresent()) {
            this.random = new Random(seed.getAsLong());
            this.deterministic = true;
        } else {
            this.random = new SecureRandom();
            this.deterministic = false;
        }
    }

    public synchronized double nextDouble() {
        return random.nextDouble();
    }

    public boolean isDeterministic() {
        return deterministic;
    }

    private static OptionalLong parseSeed(String value) {
        if (value == null || value.isBlank()) return OptionalLong.empty();
        try {
            return OptionalLong.of(Long.parseLong(value.trim()));
        } catch (NumberFormatException e) {
            throw new IllegalStateException("app.game.fixed-seed must be a signed 64-bit integer");
        }
    }
}
