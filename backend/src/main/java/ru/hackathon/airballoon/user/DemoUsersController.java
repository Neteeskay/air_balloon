package ru.hackathon.airballoon.user;

import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("demo")
@RequestMapping("/api/demo/users")
public class DemoUsersController {
    private final UserService users;
    public DemoUsersController(UserService users) { this.users=users; }
    @GetMapping public List<UserState> list() {
        return List.of("anna","maks","liza").stream().map(name->users.getState(DemoBootstrap.id(name))).toList();
    }
}
