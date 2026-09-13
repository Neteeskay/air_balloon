package ru.hackathon.airballoon.common.error;

/** 409 CONFIG_VERSION_CONFLICT — edits were made against a stale revision. */
public class VersionConflictException extends RuntimeException {
    private final long currentVersion;
    public VersionConflictException(long currentVersion) {
        super("Конфигурацию изменил другой администратор");
        this.currentVersion = currentVersion;
    }
    public long currentVersion() { return currentVersion; }
}