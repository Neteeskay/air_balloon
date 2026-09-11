package ru.hackathon.airballoon.config;

public interface GameConfigProvider {
    ConfigSnapshot getCurrentConfig();
    ConfigSnapshot getVersion(long version);
}
