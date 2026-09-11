package ru.airballoon.integration;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.Principal;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import ru.hackathon.airballoon.user.DemoBootstrap;
import ru.hackathon.airballoon.user.UserService;
import ru.hackathon.airballoon.user.UserState;

@RestController
@Profile("demo")
@RequestMapping("/api/auth")
public class DemoAuthController {
    static final String SESSION_USER = "airBalloonUserId";
    private static final Map<String, String> PASSWORDS = Map.of(
            "anna", "balloon1", "maks", "balloon2", "liza", "balloon3");
    private final UserService users;

    public DemoAuthController(UserService users) { this.users = users; }

    @PostMapping("/demo-login")
    public UserState login(@Valid @RequestBody Login request, HttpSession session) {
        String expected = PASSWORDS.get(request.username().trim());
        if (expected == null || !MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                request.password().getBytes(StandardCharsets.UTF_8)))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid demo credentials");
        UUID id = DemoBootstrap.id(request.username().trim());
        session.setAttribute(SESSION_USER, id);
        return users.getState(id);
    }

    @GetMapping("/me")
    public UserState me(Principal principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required");
        return users.getState(UUID.fromString(principal.getName()));
    }

    @DeleteMapping("/session")
    public void logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
    }

    public record Login(@NotBlank String username, @NotBlank String password) { }
}
