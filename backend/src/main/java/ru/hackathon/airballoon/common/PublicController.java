package ru.hackathon.airballoon.common;

import java.util.UUID;
import org.springframework.web.bind.annotation.*;
import ru.hackathon.airballoon.history.HistoryService;
import ru.hackathon.airballoon.user.*;

@RestController
@RequestMapping("/api")
public class PublicController {
    private final HistoryService history;
    private final UserService users;
    public PublicController(HistoryService history,UserService users) { this.history=history;this.users=users; }
    @GetMapping("/users/{id}/state") public UserState state(@PathVariable UUID id) { return users.getState(id); }
    @GetMapping("/history") public HistoryService.Page history(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return history.getHistory(page,size);
    }
    @GetMapping("/rounds/{id}/result") public HistoryService.Result result(@PathVariable UUID id) { return history.getResult(id); }
}
