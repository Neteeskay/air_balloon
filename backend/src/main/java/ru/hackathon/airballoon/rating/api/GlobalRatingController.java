package ru.hackathon.airballoon.rating.api;

import java.security.Principal;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpStatus;
import ru.hackathon.airballoon.rating.service.GlobalRatingService;
import ru.hackathon.airballoon.tournament.port.CurrentPlayerResolver;

@RestController
@RequestMapping("/api/rating")
public class GlobalRatingController {
    private final GlobalRatingService service;
    private final CurrentPlayerResolver identity;

    public GlobalRatingController(GlobalRatingService service, CurrentPlayerResolver identity) {
        this.service = service;
        this.identity = identity;
    }

    @GetMapping
    public GlobalRatingResponse rating(@RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "50") int size,
                                       Principal principal) {
        UUID currentUser = identity.resolve(principal).orElseThrow(() -> new GlobalRatingException(
                HttpStatus.UNAUTHORIZED, "AUTH_REQUIRED", "A valid authenticated session is required"));
        return service.rating(currentUser, page, size);
    }
}
