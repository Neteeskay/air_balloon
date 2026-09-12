package ru.hackathon.airballoon.common.web;

import org.slf4j.MDC;

/** Access to the current request trace id (also exposed as X-Trace-Id response header). */
public final class TraceId {
    public static final String MDC_KEY = "traceId";
    public static final String REQUEST_ATTRIBUTE = "airballoon.traceId";
    private TraceId() {}

    public static String current() {
        String traceId = MDC.get(MDC_KEY);
        return traceId == null ? "n/a" : traceId;
    }
}