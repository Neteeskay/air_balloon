package ru.airballoon.integration;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.stream.IntStream;
import org.springframework.context.annotation.Profile;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.airballoon.game.application.port.GameConfigProvider;
import ru.airballoon.game.domain.Theme;

/** Public pre-round allow-list. Hidden probabilities and future round data are intentionally absent. */
@RestController
@Profile("!test & !dev")
@RequestMapping("/api/game")
public class GameCatalogController {
    private final GameConfigProvider engineConfigs;
    private final ru.hackathon.airballoon.config.GameConfigProvider databaseConfigs;
    private final Clock clock;

    public GameCatalogController(GameConfigProvider engineConfigs,
                                 ru.hackathon.airballoon.config.GameConfigProvider databaseConfigs,
                                 Clock clock) {
        this.engineConfigs=engineConfigs;this.databaseConfigs=databaseConfigs;this.clock=clock;
    }

    @GetMapping("/catalog")
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public Catalog catalog() {
        var snapshot=databaseConfigs.getCurrentConfig();
        var stored=snapshot.config();
        var engine=engineConfigs.getCurrentConfig();
        var themes=List.of(
                new ThemeOption(Theme.GREEN,engine.green().thresholds().size(),engine.green().thresholds(),stored.active()),
                new ThemeOption(Theme.RED,engine.red().thresholds().size(),engine.red().thresholds(),stored.active()));
        var boosters=stored.boosterValues().stream()
                .map(value->new BoosterOption(value,BigDecimal.ZERO.setScale(engine.effectiveEconomyScale()),stored.active()))
                .toList();
        var amounts = engine.stakeOptions();
        var stakeOptions = IntStream.range(0, amounts.size())
                .mapToObj(i -> new StakeOption(amounts.get(i), i + 1, stored.active()))
                .toList();
        return new Catalog(snapshot.version(),stored.gameId(),stored.gameName(),stored.active(),themes,
                new StakeRules(engine.minBet(),engine.maxBet(),engine.effectiveEconomyScale()),stakeOptions,boosters,clock.instant());
    }

    public record Catalog(long configVersion,String gameId,String gameName,boolean active,
                          List<ThemeOption> themes,StakeRules stakes,List<StakeOption> stakeOptions,
                          List<BoosterOption> boosters,Instant serverTime) {}
    public record ThemeOption(Theme theme,int levels,List<BigDecimal> levelThresholds,boolean active) {}
    public record StakeRules(BigDecimal minimum,BigDecimal maximum,int decimalPlaces) {}
    public record StakeOption(BigDecimal amount,int boosterMultiplier,boolean active) {}
    public record BoosterOption(int multiplier,BigDecimal extraCost,boolean active) {}
}
