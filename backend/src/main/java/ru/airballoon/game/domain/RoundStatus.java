package ru.airballoon.game.domain;

public enum RoundStatus {
    CREATED, RUNNING, CASHED_OUT, CRASHED, FINISHED;

    public boolean flying() { return this == RUNNING || this == CASHED_OUT; }
}
