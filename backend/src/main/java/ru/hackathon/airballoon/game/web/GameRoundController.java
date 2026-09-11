package ru.hackathon.airballoon.game.web;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import ru.hackathon.airballoon.game.dto.CashoutResponse;
import ru.hackathon.airballoon.game.dto.GameRoundResponse;
import ru.hackathon.airballoon.game.dto.GameRoundStartRequest;
import ru.hackathon.airballoon.game.dto.LevelCrossResponse;
import ru.hackathon.airballoon.game.dto.RoundStateResponse;
import ru.hackathon.airballoon.game.service.GameRoundService;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/game/rounds")
public class GameRoundController {
    private final GameRoundService service;

    public GameRoundController(GameRoundService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<GameRoundResponse> start(
            @Valid @RequestBody GameRoundStartRequest request,
            Authentication authentication) {
        GameRoundResponse response = service.start(authentication.getName(), request);
        return ResponseEntity.created(URI.create("/api/game/rounds/" + response.id())).body(response);
    }

    @GetMapping("/{id}")
    public GameRoundResponse get(@PathVariable UUID id, Authentication authentication) {
        return service.get(authentication.getName(), id);
    }

    @GetMapping("/{id}/state")
    public RoundStateResponse state(@PathVariable UUID id, Authentication authentication) {
        return service.state(authentication.getName(), id);
    }

    @PostMapping("/{id}/levels/{level}")
    public LevelCrossResponse crossLevel(
            @PathVariable UUID id,
            @PathVariable int level,
            Authentication authentication) {
        return service.crossLevel(authentication.getName(), id, level);
    }

    @PostMapping("/{id}/cashout")
    public CashoutResponse cashout(@PathVariable UUID id, Authentication authentication) {
        return service.cashout(authentication.getName(), id);
    }
}
