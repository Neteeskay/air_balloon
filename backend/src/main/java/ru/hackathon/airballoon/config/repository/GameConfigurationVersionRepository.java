package ru.hackathon.airballoon.config.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.hackathon.airballoon.config.domain.ConfigStatus;
import ru.hackathon.airballoon.config.entity.GameConfigurationVersionEntity;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GameConfigurationVersionRepository extends JpaRepository<GameConfigurationVersionEntity, UUID> {
    Optional<GameConfigurationVersionEntity> findFirstByGame_IdAndStatus(String gameId, ConfigStatus status);

    List<GameConfigurationVersionEntity> findAllByGame_IdOrderByRevisionDesc(String gameId);

    Optional<GameConfigurationVersionEntity> findByIdAndGame_Id(UUID id, String gameId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from GameConfigurationVersionEntity c where c.game.id = :gameId and c.status = :status")
    Optional<GameConfigurationVersionEntity> findByGameAndStatusForUpdate(
            @Param("gameId") String gameId, @Param("status") ConfigStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from GameConfigurationVersionEntity c where c.id = :id")
    Optional<GameConfigurationVersionEntity> findByIdForUpdate(@Param("id") UUID id);
}
