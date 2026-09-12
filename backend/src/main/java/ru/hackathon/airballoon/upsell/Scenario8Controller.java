package ru.hackathon.airballoon.upsell;

import java.security.Principal;
import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.airballoon.game.infrastructure.web.CurrentUser;

@RestController
@RequestMapping("/api/current-user/upsell/lottery-tickets")
public class Scenario8Controller {
    private final Scenario8OfferService offers;
    public Scenario8Controller(Scenario8OfferService offers) { this.offers = offers; }

    @GetMapping("/offer")
    public ResponseEntity<Scenario8OfferService.OfferView> offer(Principal principal, @RequestParam UUID roundId) {
        var offer = offers.offer(CurrentUser.id(principal), roundId);
        return offer == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(offer);
    }

    /** Client-supplied price/ticket/win claims are deliberately ignored. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PurchaseRequest(UUID offerId) {}

    @PostMapping("/purchase")
    public Scenario8OfferService.PurchaseResult purchase(Principal principal,
            @RequestHeader(name = "Idempotency-Key", required = false) String key, @RequestBody PurchaseRequest request) {
        if (request == null || request.offerId() == null)
            throw ru.hackathon.airballoon.common.BusinessException.invalid("INVALID_REQUEST", "Требуется offerId");
        return offers.purchase(CurrentUser.id(principal), request.offerId(), key);
    }
}
