package ru.hackathon.airballoon.tournament.port;

import ru.hackathon.airballoon.tournament.api.LeaderboardUpdate;

@FunctionalInterface
public interface LeaderboardPublisher {
    void publish(LeaderboardUpdate update);
}
