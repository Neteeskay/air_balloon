package ru.hackathon.airballoon.unit;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import ru.hackathon.airballoon.tournament.domain.Tournament;
import ru.hackathon.airballoon.tournament.domain.TournamentStatus;
import ru.hackathon.airballoon.tournament.port.PlayerScore;
import static org.assertj.core.api.Assertions.*;

class TournamentDomainTest {
    private final Instant start = Instant.parse("2026-09-11T00:00:00Z");
    private final Tournament tournament = new Tournament(UUID.randomUUID(), "Race", "", start,
            start.plusSeconds(60), start, start, 0);

    @Test void dateBoundariesAreHalfOpen() {
        assertThat(tournament.statusAt(start.minusNanos(1))).isEqualTo(TournamentStatus.PLANNED);
        assertThat(tournament.statusAt(start)).isEqualTo(TournamentStatus.ACTIVE);
        assertThat(tournament.statusAt(start.plusSeconds(60).minusNanos(1))).isEqualTo(TournamentStatus.ACTIVE);
        assertThat(tournament.statusAt(start.plusSeconds(60))).isEqualTo(TournamentStatus.FINISHED);
    }
    @Test void countdownRoundsUpAndNeverBecomesNegative() {
        assertThat(tournament.secondsRemaining(start)).isEqualTo(60);
        assertThat(tournament.secondsRemaining(start.plusMillis(59500))).isEqualTo(1);
        assertThat(tournament.secondsRemaining(start.plusSeconds(60))).isZero();
        assertThat(tournament.secondsRemaining(start.plusSeconds(100))).isZero();
    }
    @Test void invalidDatesAndNameAreRejected() {
        assertThatThrownBy(() -> new Tournament(UUID.randomUUID(), "Race", "", start, start, start, start, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Tournament(UUID.randomUUID(), " ", "", start, start.plusSeconds(1), start, start, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }
    @Test void invalidAuthoritativeScoresAreRejected() {
        assertThatThrownBy(() -> new PlayerScore(UUID.randomUUID(), "Alex", -1, 0, start))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new PlayerScore(UUID.randomUUID(), "Alex", 1, -1, start))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
