package ru.hackathon.airballoon.user;

import java.util.List;
import java.util.UUID;
import org.springframework.boot.*;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("demo")
@Order(0)
public class DemoBootstrap implements ApplicationRunner {
    public record DemoUser(String username, String displayName) { }
    public static final List<DemoUser> USERS = List.of(
            new DemoUser("anna", "Анна Ветрова"),
            new DemoUser("maks", "Максим Орлов"),
            new DemoUser("liza", "Лиза Соколова"),
            new DemoUser("alex", "Alex"),
            new DemoUser("sofia", "Sofia"),
            new DemoUser("lucky777", "Lucky777"),
            new DemoUser("skyman", "SkyMan"),
            new DemoUser("rocket", "Rocket"),
            new DemoUser("nika", "Nika"),
            new DemoUser("player17", "Player17"),
            new DemoUser("ballooner", "Ballooner"),
            new DemoUser("cloudrunner", "CloudRunner"),
            new DemoUser("airking", "AirKing"),
            new DemoUser("alexander", "Alexander"),
            new DemoUser("skyfox", "SkyFox"),
            new DemoUser("luna", "Luna"),
            new DemoUser("pilot", "Pilot"),
            new DemoUser("vega", "Vega"),
            new DemoUser("windy", "Windy"),
            new DemoUser("comet", "Comet"),
            new DemoUser("orbit", "Orbit"),
            new DemoUser("flame", "Flame"),
            new DemoUser("aurora", "Aurora"),
            new DemoUser("sirius", "Sirius"));
    private final JdbcTemplate jdbc;
    public DemoBootstrap(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    @Override @Transactional
    public void run(ApplicationArguments args) {
        for (DemoUser user : USERS.subList(0, 3)) jdbc.update("""
            INSERT INTO users(id,username,display_name,bonus_balance) VALUES (?,?,?,5000)
            ON CONFLICT (username) DO NOTHING
            """, id(user.username()),user.username(),user.displayName());
    }
    public static UUID id(String username) {
        return UUID.nameUUIDFromBytes(("air-balloon:demo:"+username).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
