package ru.airballoon.game.application.port;

import ru.airballoon.game.domain.GameConfig;

public interface GameConfigProvider {
    GameConfig getCurrentConfig();
}
