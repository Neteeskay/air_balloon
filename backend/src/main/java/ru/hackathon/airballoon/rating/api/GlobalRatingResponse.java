package ru.hackathon.airballoon.rating.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/** Public global rating contract. Internal user ids, balances and session data are intentionally absent. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record GlobalRatingResponse(
        List<Entry> entries,
        Entry currentPlayer,
        long totalParticipants,
        int page,
        int size,
        long revision) {
    public record Entry(long rank, String displayName, long score, boolean currentPlayer) {}
}
