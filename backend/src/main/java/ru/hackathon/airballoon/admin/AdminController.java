package ru.hackathon.airballoon.admin;

import org.springframework.web.bind.annotation.*;
import ru.hackathon.airballoon.config.*;

@RestController
@RequestMapping("/api/admin/config")
public class AdminController {
    public record Update(long expectedVersion,GameConfig config) {}
    private final PostgresGameConfigProvider configs;
    public AdminController(PostgresGameConfigProvider configs) { this.configs=configs; }
    @GetMapping public ConfigSnapshot get() { return configs.getCurrentConfig(); }
    @PutMapping public ConfigSnapshot put(@RequestBody Update update) { return configs.update(update.expectedVersion(),update.config()); }
}
