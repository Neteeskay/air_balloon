package ru.hackathon.airballoon.profile;

import java.security.Principal;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.airballoon.game.infrastructure.web.CurrentUser;

@RestController
@RequestMapping("/api/current-user")
public class ProfileController {
    public record EquipmentRequest(String headId, String neckId) {}

    private final ProfileService profiles;

    public ProfileController(ProfileService profiles) { this.profiles = profiles; }

    @GetMapping("/profile")
    public ProfileService.Profile profile(Principal principal) {
        return profiles.get(CurrentUser.id(principal));
    }

    @GetMapping("/wardrobe")
    public List<ProfileService.WardrobeItem> wardrobe(Principal principal) {
        return profiles.wardrobe(CurrentUser.id(principal));
    }

    @PutMapping("/avatar/equipment")
    public ProfileService.Avatar equipment(Principal principal, @RequestBody EquipmentRequest request) {
        if (request == null)
            throw ru.hackathon.airballoon.common.BusinessException.invalid("INVALID_REQUEST", "Требуется состояние экипировки");
        return profiles.equip(CurrentUser.id(principal), request.headId(), request.neckId());
    }
}
