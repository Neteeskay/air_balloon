package ru.hackathon.airballoon;

import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import ru.hackathon.airballoon.support.PostgresSupport;

import static org.assertj.core.api.Assertions.assertThat;

/** Proves that V309 upgrades populated puzzle definitions and progress without editing old migrations. */
class PuzzleDefinitionMigrationTest {
    @Test void populatedV308DatabaseUpgradesToFinalPuzzleMapping() throws Exception {
        var properties = PostgresSupport.connectionProperties();
        String baseUrl = (String) properties.get("spring.datasource.url");
        String user = (String) properties.get("spring.datasource.username");
        String password = (String) properties.get("spring.datasource.password");
        String database = "puzzle_definition_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        String adminUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1) + "postgres";
        String testUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1) + database;
        UUID puzzleOneUser = UUID.randomUUID();
        UUID puzzleThreeUser = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();

        try (var admin = DriverManager.getConnection(adminUrl, user, password);
             var statement = admin.createStatement()) {
            statement.execute("CREATE DATABASE " + database);
        }
        try {
            Flyway.configure().dataSource(testUrl, user, password).target("308").load().migrate();
            try (var connection = DriverManager.getConnection(testUrl, user, password);
                 var statement = connection.createStatement()) {
                statement.execute("UPDATE puzzle_definitions SET code='PUZZLE_1' WHERE code='SKY_JOURNEY'");
                statement.execute("""
                        INSERT INTO clothing_items(id,code,display_name,slot,asset_key,active,default_unlocked,ordering)
                        VALUES
                          ('00000000-0000-0000-0000-000000000105','SPACE_HAT','Космическая шапка','HEAD','avatar/space-hat',true,false,50),
                          ('00000000-0000-0000-0000-000000000106','TRAVELER_COSTUME','Костюм путешественника','NECK','avatar/traveler-costume',true,false,60)
                        """);
                statement.execute("""
                        INSERT INTO puzzle_definitions(id,code,name,total_fragments,reward_clothing_id,active,ordering)
                        VALUES
                          ('00000000-0000-0000-0000-000000000202','PUZZLE_2','Космическая экспедиция',8,
                           '00000000-0000-0000-0000-000000000105',true,20),
                          ('00000000-0000-0000-0000-000000000203','PUZZLE_3','Вокруг света',12,
                           '00000000-0000-0000-0000-000000000106',true,30)
                        """);
                statement.execute("""
                        INSERT INTO users(id,username,display_name) VALUES
                          ('%s','puzzle-one-user','Puzzle One User'),
                          ('%s','puzzle-three-user','Puzzle Three User')
                        """.formatted(puzzleOneUser, puzzleThreeUser));
                statement.execute("""
                        INSERT INTO user_puzzle_progress(user_id,puzzle_id,total_fragments,collected_fragments,completed,completed_at)
                        VALUES
                          ('%s','00000000-0000-0000-0000-000000000201',6,6,true,now()),
                          ('%s','00000000-0000-0000-0000-000000000203',12,6,false,NULL)
                        """.formatted(puzzleOneUser, puzzleThreeUser));
                statement.execute("""
                        INSERT INTO user_clothing_items(user_id,clothing_id,source_type,source_id)
                        VALUES ('%s','00000000-0000-0000-0000-000000000104','PUZZLE',
                                '00000000-0000-0000-0000-000000000201')
                        """.formatted(puzzleOneUser));
                statement.execute("""
                        INSERT INTO game_rounds(id,user_id,theme,bet_amount,booster_tier,booster_level,
                            booster_activated,crash_multiplier,cashout_multiplier,win_amount,status,
                            config_version,version,created_at,started_at,cashout_at,crashed_at,finished_at)
                        VALUES ('%s','%s','GREEN',100,1,NULL,false,2.0,1.5,150,'FINISHED',
                            (SELECT version FROM game_config_active WHERE id=1),0,now()-interval '2 minutes',
                            now()-interval '110 seconds',now()-interval '100 seconds',now()-interval '90 seconds',now()-interval '80 seconds')
                        """.formatted(roundId, puzzleOneUser));
                statement.execute("""
                        INSERT INTO puzzle_reward_grants(id,user_id,round_id,reward_type,puzzle_id,total_fragments,
                            fragment_delta,collected_fragments_after,puzzle_completed,clothing_unlocked)
                        VALUES ('%s','%s','%s','PUZZLE_FRAGMENT','00000000-0000-0000-0000-000000000201',
                                6,1,6,true,true)
                        """.formatted(UUID.randomUUID(), puzzleOneUser, roundId));
            }

            Flyway flyway = Flyway.configure().dataSource(testUrl, user, password).load();
            var result = flyway.migrate();
            flyway.validate();
            assertThat(result.targetSchemaVersion).isEqualTo("309");

            try (var connection = DriverManager.getConnection(testUrl, user, password);
                 var statement = connection.createStatement()) {
                try (var rs = statement.executeQuery("""
                        SELECT p.code,p.name,p.total_fragments,c.code
                        FROM puzzle_definitions p JOIN clothing_items c ON c.id=p.reward_clothing_id
                        ORDER BY p.ordering
                        """)) {
                    assertThat(rs.next()).isTrue();
                    assertThat(new Object[]{rs.getString(1), rs.getString(2), rs.getInt(3), rs.getString(4)})
                            .containsExactly("PUZZLE_1", "Вокруг света", 12, "CLOUD_SCARF");
                    assertThat(rs.next()).isTrue();
                    assertThat(new Object[]{rs.getString(1), rs.getString(2), rs.getInt(3), rs.getString(4)})
                            .containsExactly("PUZZLE_2", "Космическая экспедиция", 8, "SPACE_HAT");
                    assertThat(rs.next()).isTrue();
                    assertThat(new Object[]{rs.getString(1), rs.getString(2), rs.getInt(3), rs.getString(4)})
                            .containsExactly("PUZZLE_3", "Небесное путешествие", 6, "TRAVELER_COSTUME");
                    assertThat(rs.next()).isFalse();
                }
                assertThat(count(statement, """
                        SELECT count(*) FROM user_puzzle_progress
                        WHERE user_id='%s' AND puzzle_id='00000000-0000-0000-0000-000000000201'
                          AND total_fragments=12 AND collected_fragments=6 AND NOT completed AND completed_at IS NULL
                        """.formatted(puzzleOneUser))).isEqualTo(1);
                assertThat(count(statement, """
                        SELECT count(*) FROM user_puzzle_progress
                        WHERE user_id='%s' AND puzzle_id='00000000-0000-0000-0000-000000000203'
                          AND total_fragments=6 AND collected_fragments=6 AND completed AND completed_at IS NOT NULL
                        """.formatted(puzzleThreeUser))).isEqualTo(1);
                assertThat(count(statement, """
                        SELECT count(*) FROM user_clothing_items
                        WHERE user_id='%s' AND clothing_id='00000000-0000-0000-0000-000000000106'
                        """.formatted(puzzleThreeUser))).isEqualTo(1);
                assertThat(count(statement, """
                        SELECT count(*) FROM puzzle_reward_grants
                        WHERE round_id='%s' AND total_fragments=6 AND collected_fragments_after=6 AND puzzle_completed
                        """.formatted(roundId))).isEqualTo(1);
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
        try (var rs = statement.executeQuery(sql)) {
            rs.next();
            return rs.getLong(1);
        }
    }
}
