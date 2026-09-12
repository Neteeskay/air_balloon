package ru.hackathon.airballoon.unit;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import ru.hackathon.airballoon.rating.persistence.GlobalRatingRepository;
import ru.hackathon.airballoon.rating.service.GlobalRatingService;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class GlobalRatingServiceTest {
    private final GlobalRatingRepository repository = mock(GlobalRatingRepository.class);
    private GlobalRatingService service;

    @BeforeEach void setUp() { service = new GlobalRatingService(repository); }

    @Test void currentPlayerIsReturnedWhenOutsideRequestedPageAndZeroScoreIsKept() {
        UUID first = UUID.randomUUID();
        UUID current = UUID.randomUUID();
        var top = new GlobalRatingRepository.Row(first, "B", 5000, 1, Instant.parse("2026-01-01T00:00:00Z"));
        var me = new GlobalRatingRepository.Row(current, "E", 0, 0, Instant.parse("2026-01-01T00:00:05Z"));
        when(repository.page(0, 1)).thenReturn(List.of(top));
        when(repository.find(current)).thenReturn(Optional.of(me));
        when(repository.rank(me)).thenReturn(5L);
        when(repository.stats()).thenReturn(new GlobalRatingRepository.Stats(5, 4));

        var response = service.rating(current, 0, 1);

        assertThat(response.entries()).extracting("rank").containsExactly(1L);
        assertThat(response.entries().getFirst().currentPlayer()).isFalse();
        assertThat(response.currentPlayer()).extracting("rank", "score", "currentPlayer")
                .containsExactly(5L, 0L, true);
        assertThat(response.totalParticipants()).isEqualTo(5);
    }

    @Test void invalidPaginationDoesNotQueryDatabase() {
        UUID user = UUID.randomUUID();
        assertThatThrownBy(() -> service.rating(user, -1, 50)).hasMessageContaining("page >= 0");
        assertThatThrownBy(() -> service.rating(user, 0, 101)).hasMessageContaining("size between 1 and 100");
        verifyNoInteractions(repository);
    }
}
