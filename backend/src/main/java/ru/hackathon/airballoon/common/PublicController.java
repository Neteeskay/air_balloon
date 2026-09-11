package ru.hackathon.airballoon.common;

import java.security.Principal;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;
import ru.airballoon.game.infrastructure.web.CurrentUser;
import ru.hackathon.airballoon.history.HistoryService;
import ru.hackathon.airballoon.user.*;

@RestController
@RequestMapping("/api")
public class PublicController {
    private final HistoryService history;
    private final UserService users;
    private final Clock clock;
    public PublicController(HistoryService history,UserService users,Clock clock) { this.history=history;this.users=users;this.clock=clock; }

    @GetMapping({"/current-user","/current-user/state"})
    public UserState currentUser(Principal principal) { return users.getState(CurrentUser.id(principal)); }

    @GetMapping("/current-user/balance")
    public BalanceView balance(Principal principal) {
        UserState state=users.getState(CurrentUser.id(principal));
        return new BalanceView(state.bonusBalance(),clock.instant());
    }

    /** Compatibility route: the path id is an assertion, never an identity selector. */
    @GetMapping("/users/{id}/state") public UserState state(Principal principal,@PathVariable UUID id) {
        UUID current=CurrentUser.id(principal);
        if (!current.equals(id)) throw BusinessException.forbidden("NOT_OWNER","Cannot read another user's state");
        return users.getState(current);
    }
    @GetMapping("/history") public HistoryService.Page history(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return history.getHistory(page,size);
    }
    @GetMapping("/current-user/history") public HistoryService.PersonalPage personalHistory(
            Principal principal,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return history.getPersonalHistory(CurrentUser.id(principal),page,size);
    }
    @GetMapping("/rounds/{id}/result") public HistoryService.Result result(Principal principal,@PathVariable UUID id) {
        return history.getResult(CurrentUser.id(principal),id);
    }

    public record BalanceView(long bonusBalance,Instant serverTime) {}
}
