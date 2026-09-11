package ru.hackathon.airballoon.game.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.hackathon.airballoon.game.entity.GameRoundEntity;

import java.util.Optional;
import java.util.UUID;

public interface GameRoundRepository extends JpaRepository<GameRoundEntity, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from GameRoundEntity r join fetch r.configurationVersion join fetch r.player where r.id = :id")
    Optional<GameRoundEntity> findByIdForUpdate(@Param("id") UUID id);

    @Query("select r from GameRoundEntity r join fetch r.configurationVersion join fetch r.player where r.id = :id")
    Optional<GameRoundEntity> findDetailedById(@Param("id") UUID id);
}
