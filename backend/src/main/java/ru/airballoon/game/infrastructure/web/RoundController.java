package ru.airballoon.game.infrastructure.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import ru.airballoon.game.application.GameService;
import ru.airballoon.game.domain.*;
import java.math.BigDecimal;
import java.security.Principal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/rounds")
public class RoundController {
    private final GameService service;
    private final Clock clock;
    public RoundController(GameService service, Clock clock) { this.service = service; this.clock = clock; }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public RoundView start(Principal principal, @Valid @RequestBody StartRoundRequest request,
                           @RequestHeader(name = "Idempotency-Key", required = false) UUID key) {
        UUID userId = CurrentUser.id(principal);
        service.validateCatalogSelection(request.betAmount(), request.boosterMultiplier());
        return RoundView.from(service.start(userId, request.theme(),
                request.betAmount(), request.boosterMultiplier(), key), clock.instant());
    }

    @GetMapping("/{roundId}")
    public RoundView get(Principal principal, @PathVariable UUID roundId) {
        return RoundView.from(service.get(CurrentUser.id(principal), roundId), clock.instant());
    }

    @GetMapping("/{roundId}/fairness")
    public FairnessView fairness(Principal principal, @PathVariable UUID roundId) {
        return FairnessView.from(service.get(CurrentUser.id(principal), roundId));
    }

    @GetMapping("/{roundId}/events")
    public ReplayView replay(Principal principal, @PathVariable UUID roundId,
                             @RequestParam(defaultValue = "0") long afterSequence) {
        RoundEventPage page = service.replay(CurrentUser.id(principal), roundId, afterSequence);
        return new ReplayView(roundId, page.events().stream().map(RoundEventView::from).toList(),
                page.oldestAvailableSequence(), page.latestSequence(), page.snapshotRequired(), clock.instant());
    }

    @PostMapping("/{roundId}/cashout")
    public RoundView cashout(Principal principal, @PathVariable UUID roundId,
                             @RequestHeader(name = "Idempotency-Key", required = false) UUID key,
                             @RequestBody(required = false) String body) {
        if (body != null && !body.isBlank())
            throw new GameException(GameError.INVALID_REQUEST, "Cashout command must have an empty body");
        return RoundView.from(service.cashout(CurrentUser.id(principal), roundId, key), clock.instant());
    }

    public record StartRoundRequest(@NotNull Theme theme, @NotNull BigDecimal betAmount,
                                    @NotNull Integer boosterMultiplier) {}
    public record ReplayView(UUID roundId, List<RoundEventView> events, long oldestAvailableSequence,
                             long latestSequence, boolean snapshotRequired, Instant serverTime) {}
}
