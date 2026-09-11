package ru.airballoon.game.domain;

public enum Theme {
    GREEN(9), RED(12);

    private final int levels;
    Theme(int levels) { this.levels = levels; }
    public int levels() { return levels; }
}
