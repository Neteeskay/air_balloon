package ru.airballoon.game.infrastructure.memory;

import ru.airballoon.game.application.port.GameConfigProvider;
import ru.airballoon.game.domain.GameConfig;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;

public final class InMemoryGameConfigProvider implements GameConfigProvider {
    private final AtomicReference<GameConfig> config;
    public InMemoryGameConfigProvider(GameConfig initial) { config = new AtomicReference<>(Objects.requireNonNull(initial)); }
    public GameConfig getCurrentConfig() { return config.get(); }
    public void replace(GameConfig next) { config.set(Objects.requireNonNull(next)); }
}
