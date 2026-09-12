package ru.hackathon.airballoon.admin.domain;

/** Audit event types exposed by the admin API. */
public enum AuditAction {
    CONFIG_CREATED,
    CONFIG_VALIDATED,
    CONFIG_ACTIVATED,
    CONFIG_ROLLBACK,
    ADMIN_LOGIN,
    ADMIN_LOGOUT
}