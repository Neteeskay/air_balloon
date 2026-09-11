package ru.hackathon.airballoon.user;

import java.util.UUID;
import org.springframework.boot.*;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("demo")
public class DemoBootstrap implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    public DemoBootstrap(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    @Override @Transactional
    public void run(ApplicationArguments args) {
        String[] usernames={"anna","maks","liza"};
        String[] names={"Анна Ветрова","Максим Орлов","Лиза Соколова"};
        for (int i=0;i<3;i++) jdbc.update("""
            INSERT INTO users(id,username,display_name,bonus_balance) VALUES (?,?,?,5000)
            ON CONFLICT (username) DO NOTHING
            """, id(usernames[i]),usernames[i],names[i]);
    }
    public static UUID id(String username) {
        return UUID.nameUUIDFromBytes(("air-balloon:demo:"+username).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
