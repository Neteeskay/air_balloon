package ru.hackathon.airballoon.common.web;

import org.slf4j.MDC;

public final class TraceId {
    public static final String MDC_KEY = "traceId";
    public static final String REQUEST_ATTRIBUTE = "airballoon.traceId";

    private TraceId() {}

    public static String current() {
        String value = MDC.get(MDC_KEY);
        return value == null || value.isBlank() ? "n/a" : value;
    }
}
