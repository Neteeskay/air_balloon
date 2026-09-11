package ru.airballoon.game.infrastructure.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.mock.env.MockEnvironment;
import ru.airballoon.game.application.port.BalanceService;
import ru.airballoon.game.domain.GameException;
import ru.airballoon.game.infrastructure.memory.FakeBalanceService;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static ru.airballoon.game.TestSupport.*;

class EngineConfigurationTest {
    private GameProperties properties(GameProperties.RandomMode mode, Long seed) {
        return new GameProperties(config("8.42", 3), mode, seed, 100, false, UUID.randomUUID(), dec("1000"), List.of("http://localhost:5173"));
    }

    @Test void fixedSeedOnlyAllowedInExplicitDemoProfiles() {
        var wiring = new EngineConfiguration();
        for (String profile : List.of("dev", "demo", "test")) {
            var env = new MockEnvironment(); env.setActiveProfiles(profile);
            var source = wiring.seedSource(properties(GameProperties.RandomMode.FIXED_SEED, 123L), env);
            assertThat(source.nextSeed()).isEqualTo(123L); assertThat(source.nextSeed()).isEqualTo(123L);
        }
        for (String[] profiles : List.of(new String[]{}, new String[]{"prod"}, new String[]{"dev", "prod"})) {
            var env = new MockEnvironment(); env.setActiveProfiles(profiles);
            assertThatThrownBy(() -> wiring.seedSource(properties(GameProperties.RandomMode.FIXED_SEED, 123L), env))
                    .isInstanceOf(GameException.class).hasMessageContaining("test/dev/demo");
        }
    }

    @Test void fixedSeedMustBePresent() {
        var env = new MockEnvironment(); env.setActiveProfiles("test");
        assertThatThrownBy(() -> new EngineConfiguration().seedSource(properties(GameProperties.RandomMode.FIXED_SEED, null), env))
                .isInstanceOf(GameException.class).hasMessageContaining("game.fixed-seed");
    }

    @Test void normalModeGeneratesServerSeeds() {
        var source = new EngineConfiguration().seedSource(properties(GameProperties.RandomMode.NORMAL, 42L), new MockEnvironment());
        assertThat(java.util.stream.LongStream.generate(source::nextSeed).limit(50).distinct().count()).isEqualTo(50);
    }

    @Test void realBalanceBeanReplacesDemoAdapterWithoutEngineChanges() {
        BalanceService real = new FakeBalanceService(dec("5000"));
        new ApplicationContextRunner().withUserConfiguration(DemoAdaptersConfiguration.class)
                .withInitializer(ctx -> ctx.getEnvironment().setActiveProfiles("test"))
                .withBean(GameProperties.class, () -> properties(GameProperties.RandomMode.NORMAL, null))
                .withBean(BalanceService.class, () -> real)
                .run(context -> {
                    assertThat(context).hasNotFailed().hasSingleBean(BalanceService.class);
                    assertThat(context.getBean(BalanceService.class)).isSameAs(real);
                });
    }

    @Test void noDemoAdaptersAreInstalledInProduction() {
        new ApplicationContextRunner().withUserConfiguration(DemoAdaptersConfiguration.class)
                .withInitializer(ctx -> ctx.getEnvironment().setActiveProfiles("prod"))
                .run(context -> assertThat(context).hasNotFailed().doesNotHaveBean(BalanceService.class));
    }
}
