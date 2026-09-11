package ru.hackathon.airballoon.tournament.port;

import java.security.Principal;
import java.util.Optional;
import java.util.UUID;

/** Auth integration seam. Never derive production identity from a request body/query/header. */
@FunctionalInterface
public interface CurrentPlayerResolver {
    Optional<UUID> resolve(Principal principal);
}
