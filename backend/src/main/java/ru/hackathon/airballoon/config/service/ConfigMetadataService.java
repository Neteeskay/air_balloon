package ru.hackathon.airballoon.config.service;

import org.springframework.stereotype.Service;
import ru.hackathon.airballoon.config.dto.ConfigMetadataResponse;
import ru.hackathon.airballoon.config.dto.ParameterMetadata;

import java.util.ArrayList;
import java.util.List;

@Service
public class ConfigMetadataService {
    public ConfigMetadataResponse metadata() {
        List<ParameterMetadata> p = new ArrayList<>();
        p.add(meta("gameId", "Game ID", "Stable identifier of the game", "STRING", null, null, null,
                "air-balloon", true, false, "GENERAL", "IDENTIFIER", null,
                "Immutable key used by configuration history and game rounds"));
        p.add(meta("gameName", "Game name", "Display name returned to clients", "STRING", null, null, null,
                "Воздушный Шар", true, true, "GENERAL", null, null, "Changes product-facing game name"));
        p.add(meta("gameType", "Game type", "Mathematical/gameplay engine type", "ENUM", null, null, null,
                "CRASH", true, false, "GENERAL", null, List.of("CRASH"), "Selects the authoritative server engine"));
        p.add(meta("isActive", "Game active", "Whether new rounds may be created", "BOOLEAN", null, null, null,
                true, true, true, "GENERAL", null, null, "Disables/enables creation of new rounds"));

        p.add(meta("crash.alpha", "Crash alpha", "Shape/rate parameter of the server crash distribution", "DECIMAL", null,
                0.000001, 1000, 0.85, true, true, "CRASH", "MODEL_PARAMETER", null,
                "Higher values concentrate crash points closer to the minimum"));
        p.add(meta("crash.minCrashMultiplier", "Minimum crash multiplier", "Lower bound for the generated crash point", "DECIMAL", "x",
                0.000001, 100000, 1.50, true, true, "CRASH", "MODEL_PARAMETER", null,
                "Defines the earliest possible crash"));
        p.add(meta("crash.maxMultiplier", "Maximum multiplier", "Hard upper bound for multiplier/crash point", "DECIMAL", "x",
                1.000001, 1_000_000, 100.0, true, true, "CRASH", "MODEL_PARAMETER", null,
                "Caps crash point and server multiplier"));
        p.add(meta("crash.multiplierGrowthRate", "Multiplier growth rate", "Exponential multiplier growth rate per second", "DECIMAL", "1/s",
                0.000001, 1000, 0.15, true, true, "CRASH", "MODEL_PARAMETER", null,
                "Controls how quickly the displayed multiplier grows"));
        p.add(meta("crash.fps", "Server tick reference FPS", "Reference sampling frequency used by clients/engine", "DECIMAL", "fps",
                0.000001, 1000, 60.0, true, true, "CRASH", "MODEL_PARAMETER", null,
                "Controls reference update cadence; the server remains authoritative"));
        p.add(meta("crash.delta", "Reference delta", "Reference timestep associated with multiplier updates", "DECIMAL", "s",
                0.000000001, 100, 1.0 / 60.0, true, true, "CRASH", "MODEL_PARAMETER", null,
                "Defines the documented timestep for growth calculations"));

        for (int tier = 1; tier <= 4; tier++) {
            p.add(meta("boosters.multiplierTier" + tier + "Value", "Booster tier " + tier,
                    "Multiplier applied if the round reaches the server-selected booster level before cashout",
                    "DECIMAL", "x", 0.000001, 1000, (double) tier, true, true, "BOOSTERS", "MULTIPLIER", null,
                    "Multiplies the current coefficient at booster activation"));
        }
        for (int level = 1; level <= 9; level++) {
            p.add(probability("boosters.green.line" + level + "LootProb", "GREEN", level));
        }
        for (int level = 1; level <= 12; level++) {
            p.add(probability("boosters.red.line" + level + "LootProb", "RED", level));
        }

        p.add(meta("points.pointsPerLine", "Points per line", "Points awarded when a level is crossed", "INTEGER", "points",
                0, 1_000_000, 10, true, true, "POINTS", "REWARD", null,
                "Directly changes points awarded for every newly crossed level"));
        p.add(meta("points.pointsCashoutBonus", "Cashout points bonus", "Additional points awarded on successful cashout", "INTEGER", "points",
                0, 1_000_000, 25, true, true, "POINTS", "REWARD", null,
                "Changes successful-cashout point reward"));
        p.add(meta("points.pointsXNBonus", "Booster points bonus", "Additional points awarded when a booster activates", "INTEGER", "points",
                0, 1_000_000, 50, true, true, "POINTS", "REWARD", null,
                "Changes the point reward for booster activation"));

        return new ConfigMetadataResponse(
                "gameId is immutable after game creation",
                "Each theme contains a normalized percentage distribution: all level probabilities are in [0,100] and sum to 100",
                9, 12, List.copyOf(p));
    }

    private static ParameterMetadata probability(String name, String theme, int level) {
        return meta(name, theme + " level " + level + " booster probability",
                "Probability weight as normalized percent for server-side booster position selection",
                "DECIMAL", "%", 0.0, 100.0, null, true, true, "BOOSTERS", "PROBABILITY", null,
                "Changes how often the booster is placed on this level; all " + theme + " values must sum to 100");
    }

    private static ParameterMetadata meta(
            String technicalName, String displayName, String description, String dataType, String unit,
            Number min, Number max, Object defaultValue, boolean required, boolean mutable, String group,
            String semanticType, List<String> allowedValues, String effect) {
        return new ParameterMetadata(technicalName, displayName, description, dataType, unit, min, max,
                defaultValue, required, mutable, group, semanticType, allowedValues, effect);
    }
}
