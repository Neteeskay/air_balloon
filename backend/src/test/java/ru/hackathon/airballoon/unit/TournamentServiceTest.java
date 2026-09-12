package ru.hackathon.airballoon.unit;

import java.time.Clock;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import ru.hackathon.airballoon.support.MutableClock;
import ru.hackathon.airballoon.tournament.api.*;
import ru.hackathon.airballoon.tournament.config.TournamentProperties;
import ru.hackathon.airballoon.tournament.domain.Tournament;
import ru.hackathon.airballoon.tournament.persistence.TournamentRepository;
import ru.hackathon.airballoon.tournament.port.*;
import ru.hackathon.airballoon.tournament.service.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class TournamentServiceTest {
    TournamentRepository repository = mock(TournamentRepository.class);
    ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    MutableClock clock = new MutableClock();
    TournamentService service;
    @BeforeEach @SuppressWarnings("unchecked") void setup() {
        service = new TournamentService(repository, new TournamentProperties(), clock, events, mock(ObjectProvider.class));
    }

    @Test void invalidPaginationDoesNotQueryDatabase() {
        assertThatThrownBy(() -> service.leaderboard(UUID.randomUUID(), null, -1, 50)).isInstanceOf(TournamentException.class);
        assertThatThrownBy(() -> service.leaderboard(UUID.randomUUID(), null, 0, 101)).isInstanceOf(TournamentException.class);
        verifyNoInteractions(repository);
    }
    @Test void missingTournamentReturnsTypedNotFound() {
        UUID id = UUID.randomUUID(); when(repository.find(id)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.leaderboard(id, null, 0, 50)).isInstanceOfSatisfying(TournamentException.class,
                ex -> assertThat(ex.code()).isEqualTo("TOURNAMENT_NOT_FOUND"));
    }
    @Test void expiryIsRecheckedAfterWaitingForLock() {
        UUID id = UUID.randomUUID(); var now = clock.instant();
        var tournament = new Tournament(id, "Race", "", now.minusSeconds(60), now.plusSeconds(1), now, now, 0);
        when(repository.activeIds(now)).thenReturn(List.of(id));
        when(repository.lock(id)).thenAnswer(invocation -> {
            clock.set(now.plusSeconds(1)); return Optional.of(tournament);
        });
        service.onScoreChanged(new PlayerScore(UUID.randomUUID(), "Alex", 1000, 1, now));
        verify(repository, never()).project(any(), any(), any());
        verifyNoInteractions(events);
    }
    @Test void scoreEventCannotCreateTournamentMembership() {
        UUID id = UUID.randomUUID(), user = UUID.randomUUID(); var now = clock.instant();
        var tournament = new Tournament(id, "Race", "", now.minusSeconds(60), now.plusSeconds(3600), now, now, 0);
        when(repository.activeIds(now)).thenReturn(List.of(id));
        when(repository.lock(id)).thenReturn(Optional.of(tournament));
        when(repository.participant(id, user)).thenReturn(Optional.empty());

        service.onScoreChanged(new PlayerScore(user, "A", 1000, 1, now));

        verify(repository, never()).project(any(), any(), any());
        verifyNoInteractions(events);
    }
    @Test void transportFailureDoesNotTurnCommittedScoreIntoBusinessFailure() {
        LeaderboardPublisher publisher = mock(LeaderboardPublisher.class);
        var update = new LeaderboardUpdate("LEADERBOARD_UPDATE", UUID.randomUUID(), 1, List.of(), null, 0, clock.instant());
        doThrow(new IllegalStateException("Disconnected")).when(publisher).publish(update);
        assertThatCode(() -> new TournamentEvents(service, publisher).committed(update)).doesNotThrowAnyException();
    }
}
