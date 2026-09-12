package ru.hackathon.airballoon.admin.config.domain;

public enum GameTheme {
    GREEN(9), RED(12);

    private final int levelCount;
    GameTheme(int levelCount) { this.levelCount = levelCount; }
    public int levelCount() { return levelCount; }
}