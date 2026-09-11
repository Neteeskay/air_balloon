package ru.hackathon.airballoon.acceptance;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.http.*;
import ru.hackathon.airballoon.support.*;
import ru.hackathon.airballoon.tournament.api.*;
import static org.assertj.core.api.Assertions.assertThat;

class TournamentAcceptanceIT extends TournamentIntegrationSupport {
    @Autowired ApplicationContext context;

    @Test void currentUserMovesFromFourthToFirstOverHttpAndLiveStomp() throws Exception {
        UUID id = tournament(), a = UUID.randomUUID(), b = UUID.randomUUID(), c = UUID.randomUUID(), me = UUID.randomUUID();
        score(a, "Alexander", 1000, 1); score(b, "Sofia", 900, 1);
        score(c, "CloudRunner", 800, 1); score(me, "CurrentUser", 700, 1);
        HttpHeaders headers = new HttpHeaders(); headers.set("X-Test-Principal", me.toString());
        String url = "/api/tournaments/" + id + "/leaderboard?size=3";
        var initial = http.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), LeaderboardResponse.class).getBody();
        assertThat(initial.top3()).extracting(LeaderboardEntry::userId).containsExactly(a, b, c);
        assertThat(initial.currentPlayer().position()).isEqualTo(4);
        try (var live = new LiveSubscription(port, "/topic/tournaments/" + id + "/leaderboard", context)) {
            score(me, "CurrentUser", 1200, 2); // Authoritative new total: Backend #3 does not calculate +500.
            var update = live.next();
            assertThat(update.tournamentId()).isEqualTo(id);
            assertThat(update.changedPlayer()).isEqualTo(new LeaderboardUpdate.Player(me, 1, 1200));
            var response = http.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), LeaderboardResponse.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody().currentPlayer()).isEqualTo(new LeaderboardEntry(1, me, "CurrentUser", 1200));
            assertThat(response.getBody().top3().getFirst().userId()).isEqualTo(me);
        }
    }
}
