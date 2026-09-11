package ru.airballoon.game.infrastructure.web;

import ru.airballoon.game.domain.GameError;
import ru.airballoon.game.domain.GameException;
import java.security.Principal;
import java.util.UUID;

public final class CurrentUser {
    private CurrentUser() {}

    public static UUID id(Principal principal) {
        try {
            if (principal != null) return UUID.fromString(principal.getName());
        } catch (IllegalArgumentException ignored) { /* Uniform authentication error. */ }
        throw new GameException(GameError.UNAUTHENTICATED, "A trusted UUID principal is required");
    }
}
