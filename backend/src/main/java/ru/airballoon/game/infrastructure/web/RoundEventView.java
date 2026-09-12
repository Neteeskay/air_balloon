package ru.airballoon.game.infrastructure.web;

import ru.airballoon.game.domain.GameEvent;
import ru.airballoon.game.domain.PayoutCalculator;
import ru.airballoon.game.domain.RoundStatus;
import java.time.Instant;
import java.util.*;

/** Shared REST replay / realtime allow-list. Never serialize internal event snapshots. */
public record RoundEventView(GameEvent.Type type, UUID roundId, long sequence, Instant timestamp,
                             Map<String, Object> data, String eventId, Instant serverTime) {
    public static RoundEventView from(GameEvent event) {
        Map<String, Object> data = new HashMap<>(event.data());
        if (event.snapshot().status() == RoundStatus.RUNNING)
            data.put("cashoutPreviewAmount", PayoutCalculator.calculate(event.snapshot()));
        if (event.type() == GameEvent.Type.ROUND_STARTED)
            data.put("fairnessCommitment", event.snapshot().fairnessCommitment());
        if (event.type() == GameEvent.Type.ROUND_STARTED || event.type() == GameEvent.Type.ROUND_FINISHED)
            data.put("round", RoundView.from(event.snapshot(), event.serverTime()));
        if (event.type() == GameEvent.Type.CRASH || event.type() == GameEvent.Type.ROUND_FINISHED)
            data.put("fairnessReveal", FairnessView.from(event.snapshot()));
        return new RoundEventView(event.type(), event.roundId(), event.sequence(), event.timestamp(),
                Map.copyOf(data), event.eventId(), event.serverTime());
    }
}
