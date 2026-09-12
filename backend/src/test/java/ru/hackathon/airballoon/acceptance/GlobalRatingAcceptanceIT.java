package ru.hackathon.airballoon.acceptance;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import ru.hackathon.airballoon.rating.api.GlobalRatingResponse;
import ru.hackathon.airballoon.support.TournamentIntegrationSupport;
import ru.hackathon.airballoon.tournament.api.LeaderboardEntry;
import ru.hackathon.airballoon.tournament.port.PlayerScore;
import ru.hackathon.airballoon.tournament.port.ScoreChanged;
import static org.assertj.core.api.Assertions.assertThat;

class GlobalRatingAcceptanceIT extends TournamentIntegrationSupport {
    private final UUID a = UUID.fromString("00000000-0000-0000-0000-00000000000a");
    private final UUID b = UUID.fromString("00000000-0000-0000-0000-00000000000b");
    private final UUID c = UUID.fromString("00000000-0000-0000-0000-00000000000c");
    private final UUID d = UUID.fromString("00000000-0000-0000-0000-00000000000d");
    private final UUID e = UUID.fromString("00000000-0000-0000-0000-00000000000e");

    @BeforeEach void users() {
        jdbc.execute("TRUNCATE TABLE users CASCADE");
        insert(a, "A", 1000, 1, 1);
        insert(b, "B", 5000, 1, 2);
        insert(c, "C", 2500, 1, 3);
        insert(d, "D", 5000, 1, 4);
        insert(e, "E", 0, 0, 5);
    }

    @Test void globalContainsAllUsersWhileTournamentContainsOnlyExplicitParticipants() {
        UUID tournament = tournament();
        join(tournament, a, "A", 1000, 1);
        join(tournament, c, "C", 2500, 1);
        join(tournament, e, "E", 0, 0);
        // This acceptance assertion verifies participant membership/order; keep the
        // production default masking policy out of the expected display-name values.
        properties.setMaskOtherPlayerNames(false);

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Test-Principal", a.toString());
        var global = http.exchange("/api/rating?page=0&size=3", HttpMethod.GET,
                new HttpEntity<>(headers), GlobalRatingResponse.class);

        assertThat(global.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(global.getBody().entries()).extracting(GlobalRatingResponse.Entry::displayName)
                .containsExactly("B", "D", "C");
        assertThat(global.getBody().currentPlayer())
                .isEqualTo(new GlobalRatingResponse.Entry(4, "A", 1000, true));
        assertThat(global.getBody().totalParticipants()).isEqualTo(5);
        assertThat(global.getBody().revision()).isEqualTo(4);

        var tournamentBoard = service.leaderboard(tournament, a, 0, 50);
        assertThat(tournamentBoard.participants()).extracting(LeaderboardEntry::username)
                .containsExactly("C", "A", "E");
        assertThat(tournamentBoard.totalParticipants()).isEqualTo(3);

        updateAndPublish(b, "B", 7000, 2);
        updateAndPublish(c, "C", 6000, 2);
        var updatedGlobal = http.exchange("/api/rating?page=0&size=5", HttpMethod.GET,
                new HttpEntity<>(headers), GlobalRatingResponse.class).getBody();
        assertThat(updatedGlobal.entries()).extracting(GlobalRatingResponse.Entry::displayName)
                .containsExactly("B", "C", "D", "A", "E");
        assertThat(updatedGlobal.revision()).isEqualTo(6);
        assertThat(service.leaderboard(tournament, a, 0, 50).participants())
                .extracting(LeaderboardEntry::username).containsExactly("C", "A", "E");
    }

    @Test void globalRatingRequiresAuthenticatedServerIdentityAndDoesNotExposeIds() {
        assertThat(http.getForEntity("/api/rating", String.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        HttpHeaders headers = new HttpHeaders(); headers.set("X-Test-Principal", a.toString());
        String body = http.exchange("/api/rating?userId=" + b, HttpMethod.GET,
                new HttpEntity<>(headers), String.class).getBody();
        assertThat(body).doesNotContain(a.toString(), "userId", "bonusBalance", "email");
        var response = http.exchange("/api/rating?userId=" + b, HttpMethod.GET,
                new HttpEntity<>(headers), GlobalRatingResponse.class).getBody();
        assertThat(response.currentPlayer().displayName()).isEqualTo("A");
    }

    private void join(UUID tournament, UUID user, String name, long score, long version) {
        scores.put(new PlayerScore(user, name, score, version, clock.instant()));
        service.join(tournament, user);
    }

    private void updateAndPublish(UUID user, String name, long score, long version) {
        Instant changedAt = clock.instant();
        jdbc.update("UPDATE users SET game_score=?,game_score_version=?,updated_at=? WHERE id=?",
                score, version, Timestamp.from(changedAt), user);
        events.publishEvent(new ScoreChanged(new PlayerScore(user, name, score, version, changedAt)));
    }

    private void insert(UUID id, String name, long score, long version, long second) {
        jdbc.update("""
                INSERT INTO users(id,username,display_name,bonus_balance,game_score,game_score_version,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?)
                """, id, name.toLowerCase(), name, 5000, score, version,
                Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")),
                Timestamp.from(Instant.parse("2026-01-01T00:00:00Z").plusSeconds(second)));
    }
}
