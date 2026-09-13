package ru.hackathon.airballoon.admin.config.service;

import java.util.List;
import org.springframework.stereotype.Service;
import ru.hackathon.airballoon.admin.config.dto.ConfigMetadataResponse;
import ru.hackathon.airballoon.admin.config.dto.ParameterMetadata;

/** Static machine-readable metadata the UI uses to render the configuration form. */
@Service
public class ConfigMetadataService {
    public ConfigMetadataResponse metadata() {
        return new ConfigMetadataResponse(
                "key" ,
                "weighted-per-level-sum-100",
                ConfigAdminValidator.GREEN_LEVEL_COUNT,
                ConfigAdminValidator.RED_LEVEL_COUNT,
                List.of(
                        param("gameId", "Game ID", "Identifier of the game the config is applied to", "string", null,
                                null, null, "air-balloon", true, false, "general", "game", null,
                                "Identifies the target game; must match the live game id"),
                        param("gameName", "Game name", "Display name of the game", "string", null,
                                null, null, null, true, false, "general", "game", null,
                                "Shown in admin UI only"),
                        param("isActive", "Game active", "Whether new rounds are allowed", "boolean", null,
                                null, null, Boolean.TRUE, true, true, "general", "toggle",
                                List.of("true", "false"),
                                "Turning the game off rejects new round starts (GAME_INACTIVE)"),
                        param("crash.alpha", "Alpha", "House edge / skew parameter of the crash curve", "number", null,
                                0.0, 1.0, 0.85, true, true, "crash", "probability", null,
                                "Higher alpha pushes multipliers toward the minimum and raises the house advantage"),
                        param("crash.minCrashMultiplier", "Min crash multiplier", "Guaranteed minimum multiplier", "number", "x",
                                0.1, 1.0, 1.0, true, true, "crash", "multiplier", null,
                                "Engine crash formula requires a value <= 1 (fixed range min==max)"),
                        param("crash.maxMultiplier", "Max multiplier", "Hard cap on the crash multiplier", "number", "x",
                                1.0, 100_000.0, 100.0, true, true, "crash", "multiplier", null,
                                "Trades above this value are capped"),
                        param("crash.multiplierGrowthRate", "Multiplier growth rate", "Exponential flight growth constant per second", "number", "1/s",
                                0.0, 10.0, 0.15, true, true, "crash", "rate", null,
                                "Higher values preserve the crash distribution but reach high multipliers sooner"),
                        param("crash.fps", "FPS", "Engine simulation frames per second", "integer", "fps",
                                1.0, 10_000.0, 60.0, true, true, "crash", "engine", null,
                                "Simulation frame rate; delta must equal 1/fps"),
                        param("crash.delta", "Delta", "Seconds per frame (1/fps)", "number", "s",
                                0.0001, 1.0, 0.0166666667, true, true, "crash", "engine", null,
                                "Time step per frame; must match 1/fps"),
                        tierParam("1"), tierParam("2"), tierParam("3"), tierParam("4"),
                        themeProbParam("green", "Green", 9), themeProbParam("red", "Red", 12),
                        param("points.pointsPerLine", "Points per line", "Points awarded per cleared line", "integer", "pts",
                                0, 1_000_000, 10, true, true, "points", "value", null,
                                "Base reward for a single cleared line"),
                        param("points.pointsCashoutBonus", "Cashout bonus", "Bonus points on cash out", "integer", "pts",
                                0, 1_000_000, 25, true, true, "points", "value", null,
                                "Reward given when the player cashes out his winnings"),
                        param("points.pointsXNBonus", "Multiplier bonus", "Bonus points when a multiplier booster is active", "integer", "pts",
                                0, 1_000_000, 50, true, true, "points", "value", null,
                                "Applied for x2/x3/x4 multiplier boosters")
                ));
    }

    private static ParameterMetadata tierParam(String n) {
        return param("boosters.multiplierTier" + n + "Value", "Booster tier " + n + " multiplier",
                "Multiplier value of booster tier " + n, "number", "x",
                0.1, null, n, true, false, "boosters", "multiplier",
                List.of("1.0", "2.0", "3.0", "4.0"),
                "Fixed engine booster tier; this field is read-only");
    }

    private static ParameterMetadata themeProbParam(String theme, String label, int count) {
        return param("boosters." + theme + ".lineNLootProb", theme + " line loot probability (1.." + count + ")", null, "percent",
                "%", 0.0, 100.0, null, true, true, "boosters", "probability", null,
                "Relative loot probability of the level; all levels of the theme sum to 100%");
    }

    private static ParameterMetadata param(String name, String display, String description, String type, String unit,
                                           Object min, Object max, Object def, boolean required, boolean mutable,
                                           String group, String semantic, List<String> allowed, String effect) {
        return new ParameterMetadata(name, display, description, type, unit, min, max, def, required, mutable,
                group, semantic, allowed, effect);
    }
}
