package ru.hackathon.airballoon.security;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.http.*;
import ru.hackathon.airballoon.support.*;
import ru.hackathon.airballoon.tournament.api.LeaderboardResponse;
import ru.hackathon.airballoon.tournament.port.PlayerScore;
import static org.assertj.core.api.Assertions.*;

class TournamentSecurityIT extends TournamentIntegrationSupport {
    @Autowired ApplicationContext context;

    @Test void anonymousCannotJoinAndForgedIdentityDoesNotUnmaskAnotherPlayer() {
        UUID id = tournament(), user = UUID.randomUUID(); score(user, "Alexander", 700, 1);
        assertThat(http.postForEntity("/api/tournaments/" + id + "/participants/me", Map.of("userId", user), String.class)
                .getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        HttpHeaders headers = new HttpHeaders(); headers.set("X-User-Id", user.toString());
        var board = http.exchange("/api/tournaments/" + id + "/leaderboard?currentPlayerId=" + user,
                HttpMethod.GET, new HttpEntity<>(headers), LeaderboardResponse.class).getBody();
        assertThat(board.currentPlayer()).isNull();
        assertThat(board.top3().getFirst().username()).isEqualTo("***xander");
    }

    @Test void joinBodyCannotOverwriteScoreOrEnrollForeignUser() {
        UUID id = tournament(), owner = UUID.randomUUID(), foreign = UUID.randomUUID();
        scores.put(new PlayerScore(owner, "Owner", 700, 1, clock.instant()));
        HttpHeaders headers = new HttpHeaders(); headers.set("X-Test-Principal", owner.toString());
        var request = new HttpEntity<>(Map.of("userId", foreign, "score", 999999999, "winAmount", 999999999,
                "cashoutMultiplier", 999999, "crashMultiplier", 1000000), headers);
        assertThat(http.exchange("/api/tournaments/" + id + "/participants/me", HttpMethod.POST, request, String.class)
                .getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        var board = service.leaderboard(id, owner, 0, 50);
        assertThat(board.totalParticipants()).isEqualTo(1);
        assertThat(board.currentPlayer().score()).isEqualTo(700);
        assertThat(board.participants().getFirst().userId()).isEqualTo(owner);
    }

    @Test void clientCannotPublishFakeLeaderboardFramesToPublicTopic() throws Exception {
        UUID id = tournament(), owner = UUID.randomUUID(); score(owner, "Owner", 700, 1);
        String topic = "/topic/tournaments/" + id + "/leaderboard";
        try (var observer = new LiveSubscription(port, topic, context);
             var attacker = new LiveSubscription(port, topic, context)) {
            attacker.session.send(topic, Map.of("type", "LEADERBOARD_UPDATE", "score", 999999999));
            org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(10)).until(() -> !attacker.session.isConnected());
            score(owner, "Owner", 800, 2);
            var received = observer.next();
            assertThat(received.changedPlayer().score()).isEqualTo(800);
            assertThat(received.revision()).isEqualTo(2);
            assertThat(service.leaderboard(id, owner, 0, 50).currentPlayer().score()).isEqualTo(800);
        }
    }
}
