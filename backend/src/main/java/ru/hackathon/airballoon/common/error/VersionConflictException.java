package ru.hackathon.airballoon.common.error;

public class VersionConflictException extends RuntimeException {
    private final long currentVersion;

    public VersionConflictException(long currentVersion) {
        super("Configuration was modified by another administrator");
        this.currentVersion = currentVersion;
    }

    public long getCurrentVersion() {
        return currentVersion;
    }
}
