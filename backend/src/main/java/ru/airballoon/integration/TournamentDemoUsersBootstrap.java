package ru.airballoon.integration;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.user.DemoBootstrap;

/** Adds leaderboard-only demo identities without changing the three login-enabled demo profiles. */
@Component
@Profile("demo")
@Order(5)
public class TournamentDemoUsersBootstrap implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    public TournamentDemoUsersBootstrap(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (DemoBootstrap.DemoUser user : DemoBootstrap.USERS.subList(3, DemoBootstrap.USERS.size())) {
            jdbc.update("""
                    INSERT INTO users(id,username,display_name,bonus_balance) VALUES (?,?,?,5000)
                    ON CONFLICT (username) DO NOTHING
                    """, DemoBootstrap.id(user.username()), user.username(), user.displayName());
        }
    }
}
