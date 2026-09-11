package ru.airballoon.game.domain;

public final class GameException extends RuntimeException {
    private final GameError code;

    public GameException(GameError code, String message) {
        super(message);
        this.code = code;
    }

    public GameError code() { return code; }

    public GameException(GameError code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }
}
