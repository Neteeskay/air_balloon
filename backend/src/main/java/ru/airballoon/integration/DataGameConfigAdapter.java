package ru.airballoon.integration;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import ru.airballoon.game.application.port.GameConfigProvider;
import ru.airballoon.game.domain.GameConfig;
import ru.airballoon.game.domain.GameError;
import ru.airballoon.game.domain.GameException;
import ru.airballoon.game.domain.LevelThresholds;
import ru.airballoon.game.infrastructure.config.GameProperties;

/** Makes the versioned PostgreSQL config authoritative for every shared engine setting. */
@Component
@Profile("!test & !dev")
public class DataGameConfigAdapter implements GameConfigProvider {
    private final ru.hackathon.airballoon.config.GameConfigProvider source;
    private final GameProperties deploymentDefaults;

    public DataGameConfigAdapter(ru.hackathon.airballoon.config.GameConfigProvider source,
                                 GameProperties deploymentDefaults) {
        this.source = source;
        this.deploymentDefaults = deploymentDefaults;
    }

    @Override
    public GameConfig getCurrentConfig() {
        return toEngine(source.getCurrentConfig().config());
    }

    GameConfig configVersion(long version) {
        return toEngine(source.getVersion(version).config());
    }

    long currentVersion() {
        return source.getCurrentConfig().version();
    }

    private GameConfig toEngine(ru.hackathon.airballoon.config.GameConfig data) {
        if (!data.active()) throw invalid("Game is disabled in the active database configuration");
        if (!data.boosterValues().equals(List.of(1, 2, 3, 4)))
            throw invalid("CORE currently requires boosterValues [1,2,3,4]");
        GameConfig base = deploymentDefaults.config();
        return new GameConfig(
                data.minCrashMultiplier(), data.maxCrashMultiplier(), data.alpha(),
                BigDecimal.valueOf(data.growthRate()).stripTrailingZeros(), data.minBet(), data.maxBet(),
                base.boosterPointsPerMultiplier(), data.pointsX2Bonus(), data.pointsX3Bonus(), data.pointsX4Bonus(),
                data.pointsCashoutBonus(), 0,
                theme(base.green(), data.maxCrashMultiplier(), data.greenBoosterWeights(), data.pointsPerLevel()),
                theme(base.red(), data.maxCrashMultiplier(), data.redBoosterWeights(), data.pointsPerLevel()));
    }

    private static GameConfig.ThemeConfig theme(GameConfig.ThemeConfig base, BigDecimal maxX,
                                                List<Integer> weights, long points) {
        // maxX <= 1 is a valid degenerate crash configuration in older fixtures;
        // retain deployment thresholds there because no strictly-above-1 catalog can exist.
        List<BigDecimal> thresholds = maxX.compareTo(BigDecimal.ONE) > 0
                ? LevelThresholds.forMax(maxX, weights.size()) : base.thresholds();
        return new GameConfig.ThemeConfig(thresholds, Collections.nCopies(weights.size(), points),
                weights.stream().map(BigDecimal::valueOf).toList());
    }

    private static GameException invalid(String message) {
        return new GameException(GameError.INVALID_GAME_CONFIG, message);
    }
}
