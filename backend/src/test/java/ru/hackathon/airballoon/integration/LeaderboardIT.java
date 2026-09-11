package ru.hackathon.airballoon.integration;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.http.*;
import org.springframework.transaction.support.TransactionTemplate;
import ru.hackathon.airballoon.support.TournamentIntegrationSupport;
import ru.hackathon.airballoon.tournament.api.*;
import ru.hackathon.airballoon.tournament.domain.TournamentStatus;
import ru.hackathon.airballoon.tournament.port.*;
import static org.assertj.core.api.Assertions.*;

class LeaderboardIT extends TournamentIntegrationSupport {
    @Test void noActiveTournamentIsANormalHttpResponse() {
        var response = http.getForEntity("/api/tournaments/active", TournamentController.ActiveTournament.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().active()).isFalse();
        assertThat(response.getBody().tournament()).isNull();
    }

    @Test void rankingTopThreePaginationAndCurrentPlayerWorkOverHttp() {
        UUID tournament = tournament();
        UUID a = UUID.randomUUID(), b = UUID.randomUUID(), c = UUID.randomUUID(), me = UUID.randomUUID();
        score(a, "Alexander", 1000, 1); score(b, "Sofia", 900, 1);
        score(c, "CloudRunner", 800, 1); score(me, "CurrentUser", 700, 1);
        HttpHeaders headers = new HttpHeaders(); headers.set("X-Test-Principal", me.toString());
        var response = http.exchange("/api/tournaments/" + tournament + "/leaderboard?page=0&size=2",
                HttpMethod.GET, new HttpEntity<>(headers), LeaderboardResponse.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        var board = response.getBody();
        assertThat(board.top3()).extracting(LeaderboardEntry::userId).containsExactly(a, b, c);
        assertThat(board.participants()).extracting(LeaderboardEntry::position).containsExactly(1L, 2L);
        assertThat(board.currentPlayer()).isEqualTo(new LeaderboardEntry(4, me, "CurrentUser", 700));
        assertThat(board.top3().getFirst().username()).isEqualTo("***xander");
        assertThat(board.totalParticipants()).isEqualTo(4);
        assertThat(service.leaderboard(tournament, me, 1, 2).participants())
                .extracting(LeaderboardEntry::position).containsExactly(3L, 4L);
        assertThat(service.leaderboard(tournament, me, Integer.MAX_VALUE, 100).participants()).isEmpty();
        assertThat(service.leaderboard(tournament, me, Integer.MAX_VALUE, 100).currentPlayer().position()).isEqualTo(4);
        score(me, "CurrentUser", 1200, 2);
        var updated = service.leaderboard(tournament, me, 0, 2);
        assertThat(updated.currentPlayer().position()).isEqualTo(1);
        assertThat(updated.currentPlayer().score()).isEqualTo(1200);
    }

    @Test void emptyAndSmallLeaderboardsAndUnjoinedViewerAreSupported() {
        UUID id = tournament();
        assertThat(service.leaderboard(id, UUID.randomUUID(), 0, 50).top3()).isEmpty();
        UUID user = UUID.randomUUID(); score(user, "Alex", 10, 1);
        var response = service.leaderboard(id, UUID.randomUUID(), 0, 50);
        assertThat(response.top3()).hasSize(1);
        assertThat(response.currentPlayer()).isNull();
    }

    @Test void tieOrderingIsDeterministicIncludingUuidAndEarlierUpdate() {
        UUID id = tournament();
        UUID low = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID high = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");
        score(high, "High", 50, 1); score(low, "Low", 50, 1);
        assertThat(service.leaderboard(id, null, 0, 50).participants()).extracting(LeaderboardEntry::userId).containsExactly(low, high);
        clock.set(clock.instant().plusSeconds(1)); score(low, "Low", 50, 2);
        assertThat(service.leaderboard(id, low, 0, 50).currentPlayer().position()).isEqualTo(2);
        assertThat(service.leaderboard(id, null, 0, 50).participants()).extracting(LeaderboardEntry::userId).containsExactly(high, low);
    }

    @Test void maskingCanBeDisabled() {
        UUID id = tournament(); score(UUID.randomUUID(), "Alexander", 1000, 1);
        properties.setMaskOtherPlayerNames(false);
        assertThat(service.leaderboard(id, null, 0, 50).top3().getFirst().username()).isEqualTo("Alexander");
    }

    @Test void staleAndDuplicateEventsDoNotChangeRevisionButNewerCorrectionsCanDecreaseScore() {
        UUID id = tournament(), user = UUID.randomUUID();
        score(user, "Alex", 100, 5);
        long revision = service.leaderboard(id, user, 0, 50).tournament().revision();
        score(user, "Alex", 9000, 5); score(user, "Alex", 9999, 4);
        assertThat(service.leaderboard(id, user, 0, 50).tournament().revision()).isEqualTo(revision);
        assertThat(service.leaderboard(id, user, 0, 50).currentPlayer().score()).isEqualTo(100);
        score(user, "Alex", 75, 6);
        assertThat(service.leaderboard(id, user, 0, 50).currentPlayer().score()).isEqualTo(75);
    }

    @Test void producerRollbackRollsBackProjectionAndRevision() {
        UUID id = tournament(), user = UUID.randomUUID();
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            events.publishEvent(new ScoreChanged(new PlayerScore(user, "Rollback", 500, 1, clock.instant())));
            assertThat(service.leaderboard(id, user, 0, 50).totalParticipants()).isEqualTo(1);
            status.setRollbackOnly();
        });
        assertThat(service.leaderboard(id, user, 0, 50).totalParticipants()).isZero();
        assertThat(service.leaderboard(id, user, 0, 50).tournament().revision()).isZero();
    }

    @Test void controllableClockTransitionsAndFreezesResultsAtExactDeadline() {
        UUID id = UUID.randomUUID(), user = UUID.randomUUID();
        var start = clock.instant().plusSeconds(5); var end = start.plusSeconds(10);
        service.create(id, "Scheduled", "", start, end);
        assertThat(service.leaderboard(id, null, 0, 50).tournament().status()).isEqualTo(TournamentStatus.PLANNED);
        score(user, "Alex", 50, 1);
        assertThat(service.leaderboard(id, user, 0, 50).totalParticipants()).isZero();
        clock.set(start); score(user, "Alex", 100, 2);
        assertThat(service.active().orElseThrow().id()).isEqualTo(id);
        assertThat(service.leaderboard(id, user, 0, 50).tournament().secondsRemaining()).isEqualTo(10);
        clock.set(end); score(user, "Alex", 200, 3);
        var finalBoard = service.leaderboard(id, user, 0, 50);
        assertThat(finalBoard.tournament().status()).isEqualTo(TournamentStatus.FINISHED);
        assertThat(finalBoard.currentPlayer().score()).isEqualTo(100);
        assertThat(finalBoard.tournament().secondsRemaining()).isZero();
        assertThat(service.active()).isEmpty();
        assertThatThrownBy(() -> service.join(id, user)).isInstanceOf(TournamentException.class);
    }

    @Test void preTournamentAndFutureEventsAreNotAccepted() {
        UUID id = tournament(), user = UUID.randomUUID();
        events.publishEvent(new ScoreChanged(new PlayerScore(user, "Old", 100, 1, clock.instant().minusSeconds(120))));
        assertThat(service.leaderboard(id, null, 0, 50).totalParticipants()).isZero();
        assertThatThrownBy(() -> events.publishEvent(new ScoreChanged(new PlayerScore(user, "Future", 100, 2,
                clock.instant().plusSeconds(1))))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test void httpJoinUsesTheSharedScoreSourceAndIsIdempotent() {
        UUID id = tournament(), user = UUID.randomUUID();
        scores.put(new PlayerScore(user, "CurrentUser", 700, 4, clock.instant().minusSeconds(500)));
        HttpHeaders headers = new HttpHeaders(); headers.set("X-Test-Principal", user.toString());
        for (int i = 0; i < 2; i++) {
            var response = http.exchange("/api/tournaments/" + id + "/participants/me", HttpMethod.POST,
                    new HttpEntity<>(headers), String.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        }
        var board = service.leaderboard(id, user, 0, 50);
        assertThat(board.totalParticipants()).isEqualTo(1);
        assertThat(board.currentPlayer().score()).isEqualTo(700);
        assertThat(board.tournament().revision()).isEqualTo(1);
    }

    @Test void malformedIdsAndPaginationReturnBusinessErrors() {
        UUID id = tournament();
        for (String query : List.of("page=-1", "size=0", "size=101", "page=oops")) {
            assertThat(http.getForEntity("/api/tournaments/" + id + "/leaderboard?" + query, String.class).getStatusCode())
                    .isEqualTo(HttpStatus.BAD_REQUEST);
        }
        assertThat(http.getForEntity("/api/tournaments/not-a-uuid/leaderboard", String.class).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(http.getForEntity("/api/tournaments/" + UUID.randomUUID() + "/leaderboard", String.class).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
