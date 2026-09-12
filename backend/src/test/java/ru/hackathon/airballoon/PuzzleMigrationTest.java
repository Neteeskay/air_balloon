package ru.hackathon.airballoon;

import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import ru.hackathon.airballoon.support.PostgresSupport;
import static org.assertj.core.api.Assertions.assertThat;

/** Proves a populated V305 database upgrades without backfilling historical round rewards. */
class PuzzleMigrationTest {
    @Test void populatedV305UpgradesToV306WithoutDataLossOrHistoricalRewardBackfill() throws Exception {
        var properties = PostgresSupport.connectionProperties();
        String baseUrl = (String) properties.get("spring.datasource.url");
        String user = (String) properties.get("spring.datasource.username");
        String password = (String) properties.get("spring.datasource.password");
        String database = "puzzle_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        String adminUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1) + "postgres";
        String testUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1) + database;
        UUID userId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        UUID offerId = UUID.randomUUID();

        try (var admin = DriverManager.getConnection(adminUrl, user, password);
             var statement = admin.createStatement()) {
            statement.execute("CREATE DATABASE " + database);
        }
        try {
            Flyway.configure().dataSource(testUrl, user, password).target("305").load().migrate();
            try (var connection = DriverManager.getConnection(testUrl, user, password);
                 var statement = connection.createStatement()) {
                statement.execute("""
                        INSERT INTO users(id,username,display_name,bonus_balance,game_score,lottery_ticket_count)
                        VALUES ('%s','upgrade-user','Upgrade User',4321,765,9)
                        """.formatted(userId));
                statement.execute("""
                        INSERT INTO game_rounds(id,user_id,theme,bet_amount,booster_tier,booster_level,
                            booster_activated,crash_multiplier,cashout_multiplier,win_amount,status,
                            config_version,version,created_at,started_at,cashout_at,crashed_at,finished_at)
                        VALUES ('%s','%s','GREEN',100,1,NULL,false,2.0,1.5,150,'FINISHED',
                            (SELECT version FROM game_config_active WHERE id=1),0,now()-interval '2 minutes',
                            now()-interval '110 seconds',now()-interval '100 seconds',now()-interval '90 seconds',now()-interval '80 seconds')
                        """.formatted(roundId, userId));
                statement.execute("""
                        INSERT INTO scenario8_offers(id,user_id,round_id,price,ticket_count,min_win_amount,expires_at)
                        VALUES ('%s','%s','%s',150,3,0,now()+interval '10 minutes')
                        """.formatted(offerId, userId, roundId));
            }

            var result = Flyway.configure().dataSource(testUrl, user, password).load().migrate();
            assertThat(result.targetSchemaVersion).isEqualTo("306");
            try (var connection = DriverManager.getConnection(testUrl, user, password);
                 var statement = connection.createStatement()) {
                try (var rs = statement.executeQuery("SELECT bonus_balance,game_score,lottery_ticket_count FROM users WHERE id='" + userId + "'")) {
                    assertThat(rs.next()).isTrue();
                    assertThat(rs.getLong(1)).isEqualTo(4321);
                    assertThat(rs.getLong(2)).isEqualTo(765);
                    assertThat(rs.getLong(3)).isEqualTo(9);
                }
                assertThat(count(statement, "SELECT count(*) FROM game_rounds WHERE id='" + roundId + "'")).isEqualTo(1);
                assertThat(count(statement, "SELECT count(*) FROM scenario8_offers WHERE id='" + offerId + "'")).isEqualTo(1);
                assertThat(count(statement, "SELECT count(*) FROM puzzle_reward_grants")).isZero();
                assertThat(count(statement, "SELECT count(*) FROM user_clothing_items WHERE user_id='" + userId + "' AND source_type='DEFAULT'"))
                        .isEqualTo(3);
            }
        } finally {
            try (var admin = DriverManager.getConnection(adminUrl, user, password);
                 var statement = admin.createStatement()) {
                statement.execute("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='" + database + "'");
                statement.execute("DROP DATABASE IF EXISTS " + database);
            }
        }
    }

    private static long count(java.sql.Statement statement, String sql) throws Exception {
        try (var rs = statement.executeQuery(sql)) { rs.next(); return rs.getLong(1); }
    }
}
