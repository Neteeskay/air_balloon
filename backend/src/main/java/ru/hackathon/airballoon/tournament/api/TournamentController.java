package ru.hackathon.airballoon.tournament.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.security.Principal;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import ru.hackathon.airballoon.tournament.port.CurrentPlayerResolver;
import ru.hackathon.airballoon.tournament.service.TournamentService;

@RestController
@RequestMapping("/api/tournaments")
public class TournamentController {
    private final TournamentService service;
    private final CurrentPlayerResolver identity;
    public TournamentController(TournamentService service, CurrentPlayerResolver identity) {
        this.service = service;
        this.identity = identity;
    }

    @GetMapping("/active")
    public ActiveTournament active() {
        return service.active().map(t -> new ActiveTournament(true, t)).orElseGet(() -> new ActiveTournament(false, null));
    }

    @GetMapping("/{id}/leaderboard")
    public LeaderboardResponse leaderboard(@PathVariable UUID id, @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "50") int size, Principal principal) {
        return service.leaderboard(id, identity.resolve(principal).orElse(null), page, size);
    }

    @PostMapping("/{id}/participants/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void join(@PathVariable UUID id, Principal principal) {
        UUID userId = identity.resolve(principal).orElseThrow(() -> new TournamentException(
                HttpStatus.UNAUTHORIZED, "AUTH_REQUIRED", "A valid authenticated session is required"));
        service.join(id, userId);
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ActiveTournament(boolean active, TournamentView tournament) {}
}
