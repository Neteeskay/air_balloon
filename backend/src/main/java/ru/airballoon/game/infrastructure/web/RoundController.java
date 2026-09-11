package ru.airballoon.game.infrastructure.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import ru.airballoon.game.application.GameService;
import ru.airballoon.game.domain.*;
import java.math.BigDecimal;
import java.security.Principal;
import java.util.UUID;

@RestController
@RequestMapping("/api/rounds")
public class RoundController {
    private final GameService service;
    public RoundController(GameService service) { this.service = service; }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public RoundView start(Principal principal, @Valid @RequestBody StartRoundRequest request) {
        return RoundView.from(service.start(CurrentUser.id(principal), request.theme(),
                request.betAmount(), request.boosterMultiplier()));
    }

    @GetMapping("/{roundId}")
    public RoundView get(Principal principal, @PathVariable UUID roundId) {
        return RoundView.from(service.get(CurrentUser.id(principal), roundId));
    }

    @PostMapping("/{roundId}/cashout")
    public RoundView cashout(Principal principal, @PathVariable UUID roundId,
                             @RequestBody(required = false) String body) {
        if (body != null && !body.isBlank())
            throw new GameException(GameError.INVALID_REQUEST, "Cashout command must have an empty body");
        return RoundView.from(service.cashout(CurrentUser.id(principal), roundId));
    }

    public record StartRoundRequest(@NotNull Theme theme, @NotNull BigDecimal betAmount,
                                    @NotNull Integer boosterMultiplier) {}
}
