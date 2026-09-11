package ru.hackathon.airballoon.admin.domain;

public enum AuditAction {
    CONFIG_CREATED,
    CONFIG_VALIDATED,
    CONFIG_ACTIVATED,
    CONFIG_ROLLBACK,
    ADMIN_LOGIN,
    ADMIN_LOGOUT
}
