package ru.hackathon.airballoon.rating.service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.rating.api.GlobalRatingException;
import ru.hackathon.airballoon.rating.api.GlobalRatingResponse;
import ru.hackathon.airballoon.rating.persistence.GlobalRatingRepository;
import ru.hackathon.airballoon.rating.persistence.GlobalRatingRepository.Row;

@Service
public class GlobalRatingService {
    private final GlobalRatingRepository repository;

    public GlobalRatingService(GlobalRatingRepository repository) { this.repository = repository; }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public GlobalRatingResponse rating(UUID currentUser, int page, int size) {
        if (page < 0 || size < 1 || size > 100)
            throw new GlobalRatingException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION", "page >= 0; size between 1 and 100");
        long offset = (long) page * size;
        List<GlobalRatingResponse.Entry> entries = new ArrayList<>();
        List<Row> pageRows = repository.page(offset, size);
        for (int i = 0; i < pageRows.size(); i++) {
            Row row = pageRows.get(i);
            boolean current = row.userId().equals(currentUser);
            entries.add(new GlobalRatingResponse.Entry(offset + i + 1, row.displayName(), row.score(), current));
        }
        GlobalRatingResponse.Entry current = repository.find(currentUser)
                .map(row -> new GlobalRatingResponse.Entry(repository.rank(row), row.displayName(), row.score(), true))
                .orElseThrow(() -> new GlobalRatingException(HttpStatus.NOT_FOUND, "PLAYER_NOT_FOUND", "Player not found"));
        var stats = repository.stats();
        return new GlobalRatingResponse(List.copyOf(entries), current, stats.totalParticipants(), page, size, stats.revision());
    }
}
