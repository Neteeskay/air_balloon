package ru.airballoon.game;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import ru.airballoon.game.domain.*;
import ru.airballoon.game.infrastructure.web.RoundView;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static ru.airballoon.game.TestSupport.*;
import static ru.airballoon.game.domain.GameEvent.Type.*;

class GameEngineTest {
    @ParameterizedTest @ValueSource(ints = {2, 4})
    void otherBoosterMultipliersAreAppliedOnce(int booster) {
        var f = new Fixture(); var r = f.at(f.start(booster), 16000);
        assertThat(r.flightMultiplier()).isEqualByComparingTo("4.9530");
        assertThat(r.currentMultiplier()).isEqualByComparingTo(r.flightMultiplier().multiply(java.math.BigDecimal.valueOf(booster)));
        assertThat(f.count(BOOSTER_ACTIVATED)).isEqualTo(1);
    }

    @Test void cashoutTimestampIsCurrentEvenWhenRoundedMultiplierHasNotChanged() {
        var base = config("8.42", 3);
        var slow = new GameConfig(base.minCrashMultiplier(), base.maxCrashMultiplier(), 0.03, dec("0.0001"),
                base.minBet(), base.maxBet(), 150, base.green(), base.red());
        var f = new Fixture(slow); var r = f.at(f.start(1), 2000000);
        f.clock.atMillis(2000010);
        var cashout = f.service.cashout(f.user, r.id());
        assertThat(cashout.cashoutMultiplier()).isEqualByComparingTo("1.2214");
        assertThat(cashout.cashoutAt()).isEqualTo(START.plusMillis(2000010));
    }

    @Test void cashoutBeforeCrashCreditsExactlyOnce() {
        var f = new Fixture(); var r = f.start(1); f.clock.atMillis(3000);
        var result = f.service.cashout(f.user, r.id());
        assertThat(result.status()).isEqualTo(RoundStatus.CASHED_OUT);
        assertThat(result.cashoutMultiplier()).isEqualByComparingTo("1.3498");
        assertThat(result.winAmount()).isEqualByComparingTo("134.98");
        assertThat(f.balance.balance(f.user)).isEqualByComparingTo("1034.98");
        assertThat(f.balance.creditCount(f.user)).isEqualTo(1);
        assertThat(f.count(CASHOUT_SUCCESS)).isEqualTo(1);
    }

    @Test void cashoutAfterCrashIsRejectedEvenWithoutAnyTicks() {
        var f = new Fixture(); var r = f.start(1); f.clock.atMillis(80000);
        error(() -> f.service.cashout(f.user, r.id()), GameError.ROUND_ALREADY_CRASHED);
        assertThat(f.balance.creditCount(f.user)).isZero();
        assertThat(f.count(CRASH)).isEqualTo(1);
        assertThat(f.count(ROUND_FINISHED)).isEqualTo(1);
    }

    @Test void cashoutBeforeFirstLevelIsRejected() {
        var f = new Fixture(); var r = f.start(1); f.clock.atMillis(1000);
        error(() -> f.service.cashout(f.user, r.id()), GameError.CASHOUT_NOT_AVAILABLE_YET);
        assertThat(f.balance.creditCount(f.user)).isZero();
    }

    @Test void firstLevelBoundaryUnlocksCashout() {
        var f = new Fixture(); var r = f.start(1); f.clock.atMillis(2000);
        assertThat(f.service.cashout(f.user, r.id()).cashoutMultiplier()).isEqualByComparingTo("1.2214");
    }

    @Test void duplicateCashoutAndHttpRetriesCannotCreditAgain() {
        var f = new Fixture(); var r = f.start(1); f.clock.atMillis(3000);
        f.service.cashout(f.user, r.id());
        for (int i = 0; i < 5; i++) error(() -> f.service.cashout(f.user, r.id()), GameError.ALREADY_CASHED_OUT);
        assertThat(f.balance.creditCount(f.user)).isEqualTo(1);
        assertThat(f.count(CASHOUT_SUCCESS)).isEqualTo(1);
    }

    @Test void crashWithoutCashoutLosesBetAndFinishes() {
        var f = new Fixture(); var r = f.at(f.start(1), 100000);
        assertThat(r.status()).isEqualTo(RoundStatus.FINISHED);
        assertThat(r.winAmount()).isEqualByComparingTo("0.00");
        assertThat(r.cashoutAt()).isNull();
        assertThat(r.crashedAt()).isEqualTo(START.plusMillis(21307));
        assertThat(f.balance.balance(f.user)).isEqualByComparingTo("900.00");
        assertThat(f.count(CRASH)).isEqualTo(1);
        assertThat(f.rewards).hasSize(1);
    }

    @Test void successfulCashoutKeepsFlyingUntilRealCrash() {
        var f = new Fixture(); var r = f.start(1); f.clock.atMillis(3000);
        var cashout = f.service.cashout(f.user, r.id());
        var flying = f.at(r, 4000);
        assertThat(flying.status()).isEqualTo(RoundStatus.CASHED_OUT);
        assertThat(flying.currentMultiplier()).isGreaterThan(cashout.currentMultiplier());
        assertThat(flying.finishedAt()).isNull();
        var finished = f.at(r, 100000);
        assertThat(finished.winAmount()).isEqualTo(cashout.winAmount());
        assertThat(finished.cashoutMultiplier()).isEqualTo(cashout.cashoutMultiplier());
        assertThat(finished.finishedAt()).isEqualTo(finished.crashedAt());
    }

    @Test void boosterTriplesTwoIntoSixAndAwardsExtraPoints() {
        var f = new Fixture(); var r = f.at(f.start(3), 16000);
        var event = f.events.stream().filter(e -> e.type() == BOOSTER_ACTIVATED).findFirst().orElseThrow();
        assertThat((java.math.BigDecimal) event.data().get("beforeMultiplier")).isEqualByComparingTo("2.00");
        assertThat((java.math.BigDecimal) event.data().get("afterMultiplier")).isEqualByComparingTo("6.00");
        assertThat(event.data().get("points")).isEqualTo(300L);
        assertThat(r.currentMultiplier()).isEqualByComparingTo("14.8590");
        assertThat(r.boosterActivated()).isTrue();
        assertThat(r.currentLevel()).isEqualTo(5);
    }

    @Test void cashoutUsesBoosterAndCurrentCommandTimeBetweenTicks() {
        var f = new Fixture(); var r = f.start(3); f.clock.atMillis(16023);
        var cashout = f.service.cashout(f.user, r.id());
        assertThat(cashout.boosterActivated()).isTrue();
        assertThat(cashout.cashoutMultiplier()).isEqualByComparingTo("14.8932");
        assertThat(cashout.winAmount()).isEqualByComparingTo("1489.32");
        assertThat(cashout.cashoutAt()).isEqualTo(START.plusMillis(16023));
    }

    @Test void previewAndCashoutShareTheExactKnownPayoutVector() {
        var f = new Fixture();
        var started = f.service.start(f.user, Theme.GREEN, dec("1.01"), 1);
        var represented = f.at(started, 3456);
        var preview = RoundView.from(represented).cashoutPreviewAmount();
        var cashout = f.service.cashout(f.user, represented.id());

        assertThat(represented.currentMultiplier()).isEqualByComparingTo("1.4128");
        assertThat(preview).isEqualByComparingTo("1.42");
        assertThat(cashout.winAmount()).isEqualByComparingTo(preview);
    }

    @Test void previewExcludesFutureBoosterAndIncludesItImmediatelyAfterActivation() {
        var f = new Fixture(); var started = f.start(3);
        var before = f.at(started, 3000);
        var after = f.at(started, 16000);

        assertThat(before.boosterActivated()).isFalse();
        assertThat(RoundView.from(before).cashoutPreviewAmount()).isEqualByComparingTo("134.98");
        assertThat(after.boosterActivated()).isTrue();
        assertThat(RoundView.from(after).cashoutPreviewAmount()).isEqualByComparingTo("1485.90");
    }

    @Test void laterServerReceiptCanPayMoreButNeverLessThanLastMonotonicPreview() {
        var f = new Fixture(); var started = f.start(1);
        var represented = f.at(started, 3000);
        var lastPreview = RoundView.from(represented).cashoutPreviewAmount();
        f.clock.atMillis(3123);
        var cashout = f.service.cashout(f.user, represented.id());

        assertThat(lastPreview).isEqualByComparingTo("134.98");
        assertThat(cashout.winAmount()).isEqualByComparingTo("136.65");
        assertThat(cashout.winAmount()).isGreaterThanOrEqualTo(lastPreview);
    }

    @Test void canonicalCalculatorHandlesConfiguredScaleAndPayoutExtremes() {
        var f = new Fixture(); var round = f.start(1);
        assertThat(PayoutCalculator.calculate(round, dec("1.0000"))).isEqualByComparingTo("100.00");
        assertThat(PayoutCalculator.calculate(round, dec("30.0000"))).isEqualByComparingTo("3000.00");
    }

    @Test void cashoutDisablesFutureBoosterAndScoreAwards() {
        var f = new Fixture(); var r = f.start(3); f.clock.atMillis(3000);
        var cashout = f.service.cashout(f.user, r.id()); var later = f.at(r, 20000);
        assertThat(later.boosterActivated()).isFalse();
        assertThat(later.currentMultiplier()).isEqualByComparingTo("7.3890");
        assertThat(later.roundScore()).isEqualTo(cashout.roundScore());
        assertThat(f.count(BOOSTER_ACTIVATED)).isZero();
        assertThat(f.events.stream().filter(e -> e.type() == LEVEL_REACHED && e.timestamp().isAfter(cashout.cashoutAt())))
                .allSatisfy(e -> assertThat(e.data().get("pointsToAward")).isEqualTo(0L));
    }

    @Test void boosterActivatesOnceAcrossRepeatedTicks() {
        var f = new Fixture(); var r = f.start(3);
        for (long t : new long[]{10000, 10000, 10100, 11000, 18000, 100000, 400000}) f.at(r, t);
        assertThat(f.count(BOOSTER_ACTIVATED)).isEqualTo(1);
        assertThat(f.count(CRASH)).isEqualTo(1);
        assertThat(f.count(ROUND_FINISHED)).isEqualTo(1);
    }

    @Test void x1HasNoBoosterPositionOrActivation() {
        var f = new Fixture(); var r = f.at(f.start(1), 100000);
        assertThat(r.boosterLevel()).isNull(); assertThat(r.boosterActivated()).isFalse();
        assertThat(f.count(BOOSTER_ACTIVATED)).isZero();
    }

    @Test void levelsEmitOnlyOnce() {
        var f = new Fixture(); var r = f.start(1);
        for (int i = 0; i < 5; i++) f.at(r, 10000);
        assertThat(f.events.stream().filter(e -> e.type() == LEVEL_REACHED).map(e -> e.data().get("level")))
                .containsExactly(1, 2, 3);
    }

    @ParameterizedTest @EnumSource(Theme.class)
    void allThemeLevelsAreReachedExactlyOnce(Theme theme) {
        var f = new Fixture(config("30", 3));
        var r = f.service.start(f.user, theme, dec("100"), 1);
        var finalRound = f.at(r, 400000);
        assertThat(finalRound.currentLevel()).isEqualTo(theme.levels());
        assertThat(f.count(LEVEL_REACHED)).isEqualTo(theme.levels());
        assertThat(finalRound.roundScore()).isEqualTo(theme.levels() * 100L);
    }

    @Test void crashWinsTieWithLevelAndBooster() {
        var f = new Fixture(config("2.00", 3)); var r = f.at(f.start(3), 100000);
        assertThat(r.status()).isEqualTo(RoundStatus.FINISHED);
        assertThat(r.currentLevel()).isEqualTo(2);
        assertThat(f.count(BOOSTER_ACTIVATED)).isZero();
        error(() -> f.service.cashout(f.user, r.id()), GameError.ROUND_ALREADY_CRASHED);
    }

    @Test void boosterDoesNotCauseImmediateCrash() {
        var f = new Fixture(config("2.00", 1)); var r = f.at(f.start(4), 2000);
        assertThat(r.flightMultiplier()).isEqualByComparingTo("1.2214");
        assertThat(r.currentMultiplier()).isEqualByComparingTo("4.8856");
        assertThat(r.status()).isEqualTo(RoundStatus.RUNNING);
        assertThat(r.boosterActivated()).isTrue();
        assertThat(f.count(CRASH)).isZero();
    }

    @Test void crashUsesBaseFlightAfterBoosterAndCashoutUsesEffectiveMultiplier() {
        var f = new Fixture(config("2.00", 1)); var started = f.start(4);
        var boosted = f.at(started, 3000);
        assertThat(boosted.flightMultiplier()).isEqualByComparingTo("1.3498");
        assertThat(boosted.currentMultiplier()).isEqualByComparingTo("5.3992");
        var cashout = f.service.cashout(f.user, started.id());
        assertThat(cashout.cashoutMultiplier()).isEqualByComparingTo("5.3992");
        assertThat(cashout.winAmount()).isEqualByComparingTo("539.92");

        var lossFixture = new Fixture(config("2.00", 1));
        var loss = lossFixture.at(lossFixture.start(4), 100000);
        assertThat(loss.status()).isEqualTo(RoundStatus.FINISHED);
        assertThat(loss.flightMultiplier()).isEqualByComparingTo("2.0000");
        assertThat(loss.currentMultiplier()).isEqualByComparingTo("8.0000");
        assertThat(lossFixture.events.stream().map(GameEvent::type))
                .containsSubsequence(BOOSTER_ACTIVATED, CRASH, ROUND_FINISHED);
    }

    @Test void crashBeforeBoosterThresholdDoesNotActivateBooster() {
        var f = new Fixture(config("1.15", 1)); var r = f.at(f.start(4), 100000);
        assertThat(r.status()).isEqualTo(RoundStatus.FINISHED);
        assertThat(r.flightMultiplier()).isEqualByComparingTo("1.1500");
        assertThat(r.boosterActivated()).isFalse();
        assertThat(f.count(BOOSTER_ACTIVATED)).isZero();
    }

    @Test void tickCadenceDoesNotChangeMathScoresOrBoundaryTimes() {
        var fine = new Fixture(); var coarse = new Fixture(); var a = fine.start(3); var b = coarse.start(3);
        for (int t = 100; t <= 20000; t += 100) fine.at(a, t);
        var result = coarse.at(b, 20000);
        var expected = fine.service.get(fine.user, a.id());
        assertThat(result.currentMultiplier()).isEqualTo(expected.currentMultiplier());
        assertThat(result.crashedAt()).isEqualTo(expected.crashedAt());
        assertThat(result.roundScore()).isEqualTo(expected.roundScore());
        assertThat(coarse.events.stream().filter(e -> e.type() != MULTIPLIER_UPDATE)
                .map(e -> List.of(e.type(), e.timestamp(), e.data())))
                .containsExactlyElementsOf(fine.events.stream().filter(e -> e.type() != MULTIPLIER_UPDATE)
                        .map(e -> List.of(e.type(), e.timestamp(), e.data())).toList());
    }

    @Test void sameTickOrdersEveryCrossedBoundaryAndEmitsNothingAboveCrash() {
        var base = config("2.35", 4);
        var thresholds = java.util.stream.Stream.of("1.2", "1.5", "2.0", "2.2", "2.4", "3", "4", "5", "6")
                .map(TestSupport::dec).toList();
        var weights = java.util.stream.IntStream.range(0, thresholds.size())
                .mapToObj(i -> i == 3 ? dec("1") : dec("0")).toList();
        var green = new GameConfig.ThemeConfig(thresholds,
                java.util.Collections.nCopies(thresholds.size(), 100L), weights);
        var tuned = new GameConfig(base.minCrashMultiplier(), base.maxCrashMultiplier(), base.alpha(),
                base.growthPerSecond(), base.minBet(), base.maxBet(), base.boosterPointsPerMultiplier(),
                base.boosterPointsX2(), base.boosterPointsX3(), base.boosterPointsX4(), base.cashoutPoints(),
                base.economyScale(), green, base.red(), base.crashMathModel());
        var f = new Fixture(tuned);

        var finished = f.at(f.start(4), 10_000);
        var ordered = f.events.stream().filter(e -> e.type() != ROUND_STARTED).map(GameEvent::type).toList();

        assertThat(ordered).containsExactly(LEVEL_REACHED, LEVEL_REACHED, LEVEL_REACHED,
                LEVEL_REACHED, BOOSTER_ACTIVATED, CRASH, ROUND_FINISHED);
        assertThat(finished.currentLevel()).isEqualTo(4);
        assertThat(finished.flightMultiplier()).isEqualByComparingTo("2.35");
        assertThat(finished.boosterActivated()).isTrue();
        assertThat(f.events.stream().filter(e -> e.type() == LEVEL_REACHED)
                .map(e -> e.data().get("flightMultiplier"))).doesNotContain(dec("2.4"));
    }

    @Test void backwardClockCannotRewindMultiplier() {
        var f = new Fixture(); var r = f.start(1); var before = f.at(r, 10000); var after = f.at(r, 5000);
        assertThat(after).isEqualTo(before);
    }

    @Test void configChangeOnlyAffectsNewRounds() {
        var f = new Fixture(); var r = f.start(3); f.configs.replace(config("1.01", 1));
        assertThat(f.at(r, 10000).currentMultiplier()).isEqualByComparingTo("8.1546");
        assertThat(f.start(1).crashMultiplier()).isEqualByComparingTo("1.01");
    }

    @Test void moneyRoundsDownOnceToTwoDecimalPlaces() {
        var f = new Fixture(); var r = f.service.start(f.user, Theme.GREEN, dec("1.01"), 1);
        f.clock.atMillis(3456);
        assertThat(f.service.cashout(f.user, r.id()).winAmount()).isEqualByComparingTo("1.42");
    }

    @Test void ownershipAndMissingRoundAreBusinessErrors() {
        var f = new Fixture(); var r = f.start(1);
        error(() -> f.service.get(UUID.randomUUID(), r.id()), GameError.FORBIDDEN_ROUND_ACCESS);
        error(() -> f.service.cashout(UUID.randomUUID(), r.id()), GameError.FORBIDDEN_ROUND_ACCESS);
        error(() -> f.service.get(f.user, UUID.randomUUID()), GameError.ROUND_NOT_FOUND);
        error(() -> f.service.start(null, Theme.GREEN, dec("100"), 1), GameError.UNAUTHENTICATED);
    }

    @Test void invalidStartDoesNotDebit() {
        var f = new Fixture();
        error(() -> f.service.start(f.user, Theme.GREEN, dec("100"), 5), GameError.INVALID_BOOSTER);
        error(() -> f.service.start(f.user, null, dec("100"), 1), GameError.INVALID_THEME);
        error(() -> f.service.start(f.user, Theme.GREEN, dec("1.001"), 1), GameError.INVALID_BET);
        error(() -> f.service.start(f.user, Theme.GREEN, dec("0"), 1), GameError.INVALID_BET);
        assertThat(f.balance.balance(f.user)).isEqualByComparingTo("1000");
    }

    @Test void insufficientBalanceDoesNotCreateRound() {
        var f = new Fixture(); f.service.start(f.user, Theme.GREEN, dec("1000"), 1);
        error(() -> f.start(1), GameError.INSUFFICIENT_BALANCE);
        assertThat(f.count(ROUND_STARTED)).isEqualTo(1);
    }

    @Test void stateMachineRejectsImpossibleTransitions() {
        var states = new RoundStateMachine();
        for (RoundStatus from : RoundStatus.values()) {
            for (RoundStatus to : RoundStatus.values()) {
                boolean allowed = from == RoundStatus.CREATED && to == RoundStatus.RUNNING
                        || from == RoundStatus.RUNNING && (to == RoundStatus.CASHED_OUT || to == RoundStatus.CRASHED)
                        || from == RoundStatus.CASHED_OUT && to == RoundStatus.CRASHED
                        || from == RoundStatus.CRASHED && to == RoundStatus.FINISHED;
                if (allowed) assertThat(states.transition(from, to)).isEqualTo(to);
                else error(() -> states.transition(from, to), GameError.ROUND_NOT_RUNNING);
            }
        }
    }

    static void error(Runnable operation, GameError code) {
        assertThatThrownBy(operation::run).isInstanceOfSatisfying(GameException.class, e -> assertThat(e.code()).isEqualTo(code));
    }
}
