package ru.hackathon.airballoon.config.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.hackathon.airballoon.config.entity.BoosterLevelProbabilityEntity;

public interface BoosterLevelProbabilityRepository extends JpaRepository<BoosterLevelProbabilityEntity, Long> {
}
