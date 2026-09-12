package ru.hackathon.airballoon.history;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import ru.hackathon.airballoon.game.GameRound;
import ru.hackathon.airballoon.game.RoundRepository;
import ru.hackathon.airballoon.profile.PuzzleRewardService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class HistoryServiceTest {
    @Test void resultDtoContainsStableBackendCharacter() {
        UUID roundId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Instant completedAt = Instant.parse("2026-09-11T00:00:10Z");
        GameRound round = new GameRound(roundId, userId, GameRound.Theme.RED, 100,
                1, null, false, new BigDecimal("6.00"), new BigDecimal("5.90"),
                590, 350, GameRound.Status.FINISHED, "seed", "hash", 1, 1,
                completedAt.minusSeconds(10), completedAt.minusSeconds(10),
                completedAt.minusSeconds(1), completedAt, completedAt);
        RoundRepository rounds = mock(RoundRepository.class);
        PuzzleRewardService rewards = mock(PuzzleRewardService.class);
        when(rounds.findById(roundId)).thenReturn(Optional.of(round));
        when(rewards.findByRound(roundId)).thenReturn(Optional.empty());
        HistoryService service = new HistoryService(mock(JdbcTemplate.class), rounds, rewards,
                Clock.fixed(completedAt.plusSeconds(1), ZoneOffset.UTC), new PlayerCharacterClassifier());

        HistoryService.Result first = service.getResult(userId, roundId);
        HistoryService.Result repeated = service.getResult(userId, roundId);

        assertThat(first.playerCharacter()).isEqualTo(repeated.playerCharacter());
        assertThat(first.playerCharacter().code()).isEqualTo(PlayerCharacterClassifier.Code.CLOSE_CALL);
        var json = new ObjectMapper().findAndRegisterModules().valueToTree(first);
        assertThat(json.path("playerCharacter").path("code").asText()).isEqualTo("CLOSE_CALL");
        assertThat(json.path("playerCharacter").path("title").asText()).isEqualTo("На волоске");
    }
}
