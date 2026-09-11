package ru.hackathon.airballoon.support;

import java.time.*;
import java.util.concurrent.atomic.AtomicReference;

public final class MutableClock extends Clock {
    public static final Instant INITIAL = Instant.parse("2026-09-11T12:00:00Z");
    private final AtomicReference<Instant> current = new AtomicReference<>(INITIAL);
    @Override public ZoneId getZone() { return ZoneOffset.UTC; }
    @Override public Clock withZone(ZoneId zone) {
        if (zone.equals(ZoneOffset.UTC)) return this;
        throw new UnsupportedOperationException("Tests use UTC");
    }
    @Override public Instant instant() { return current.get(); }
    public void set(Instant instant) { current.set(instant); }
}
