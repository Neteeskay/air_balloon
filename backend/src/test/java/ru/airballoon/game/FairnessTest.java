package ru.airballoon.game;

import org.junit.jupiter.api.Test;
import ru.airballoon.game.domain.*;
import ru.airballoon.game.infrastructure.web.*;
import com.fasterxml.jackson.databind.json.JsonMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static ru.airballoon.game.TestSupport.*;

class FairnessTest {
    private final RoundEngine engine = new RoundEngine();
    private final UUID id = UUID.fromString("00000000-0000-0000-0000-000000000123");
    private GameRound start() { return engine.start(id, UUID.randomUUID(), Theme.GREEN, dec("100"), 3, 42, config("8.42", 3), START).round(); }

    @Test void commitmentExistsInFirstEventBeforeAnyFlightProgress() {
        var t = engine.start(id, UUID.randomUUID(), Theme.GREEN, dec("100"), 3, 42, config("8.42", 3), START);
        assertThat(t.events()).hasSize(1);
        assertThat(RoundEventView.from(t.events().getFirst()).data().get("fairnessCommitment")).isEqualTo(t.round().fairnessCommitment());
        assertThat(t.round().currentLevel()).isZero();
        assertThat(RoundFairness.verify(t.round())).isTrue();
    }
    @Test void activeViewsHideSeedFutureCrashAndBooster() throws Exception {
        var r = start();
        var mapper = JsonMapper.builder().findAndAddModules().build();
        var json = mapper.valueToTree(RoundView.from(r));
        assertThat(json.path("boosterLevel").isNull()).isTrue();
        assertThat(json.path("crashMultiplier").isNull()).isTrue();
        assertThat(json.path("fairnessReveal").isNull()).isTrue();
        assertThat(json.has("seed")).isFalse();
        var proof = FairnessView.from(r);
        assertThat(proof.status()).isEqualTo("COMMITTED");
        assertThat(proof.serverSeed()).isNull(); assertThat(proof.canonicalInput()).isNull();
        assertThat(proof.boosterLevel()).isNull(); assertThat(proof.crashMultiplier()).isNull();
    }
    @Test void revealIsAvailableAtCrashAndFinishButNotCashout() {
        var running = engine.advance(start(), START.plusSeconds(3)).round();
        var cashout = engine.cashout(running, running.updatedAt()).round();
        assertThat(FairnessView.from(cashout).serverSeed()).isNull();
        var finished = engine.advance(cashout, START.plusSeconds(100));
        for (var e : finished.events()) {
            if (e.type() == GameEvent.Type.CRASH || e.type() == GameEvent.Type.ROUND_FINISHED) {
                var p = FairnessView.from(e.snapshot());
                assertThat(p.status()).isEqualTo("REVEALED"); assertThat(p.serverSeed()).isEqualTo("42");
                assertThat(p.verified()).isTrue();
            }
        }
    }
    @Test void independentSha256MatchesOriginalCommitment() throws Exception {
        String canonical = "air-balloon-fairness:v1\nroundId=00000000-0000-0000-0000-000000000123\n"
                + "serverSeed=42\ncrashMultiplier=8.42\nboosterLevel=3\n";
        String hash = "sha256:" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8)));
        assertThat(start().fairnessCommitment()).isEqualTo(hash);
        assertThat(hash).isEqualTo("sha256:fb553c3b8fce90e8b7b024d5917254fb402b22b343ebf2cf96209cb8f6008456");
    }
    @Test void tamperDemoOriginalVerifiedChangedResultNotVerified() {
        var r = start();
        assertThat(RoundFairness.verify(r)).as("original: VERIFIED").isTrue();
        assertThat(RoundFairness.verify(r.fairnessCommitment(), id, 42, dec("9.42"), 3)).as("tampered: NOT VERIFIED").isFalse();
    }
    @Test void tamperedBoosterIsRejected() { assertThat(RoundFairness.verify(start().fairnessCommitment(), id, 42, dec("8.42"), 4)).isFalse(); }
    @Test void tamperedSeedIsRejected() { assertThat(RoundFairness.verify(start().fairnessCommitment(), id, 43, dec("8.42"), 3)).isFalse(); }
    @Test void differentRoundCannotReuseProof() { assertThat(RoundFairness.verify(start().fairnessCommitment(), UUID.randomUUID(), 42, dec("8.42"), 3)).isFalse(); }
    @Test void sameSeedAndDataGiveSameCommitment() { assertThat(start().fairnessCommitment()).isEqualTo(start().fairnessCommitment()); }
    @Test void canonicalSerializationIgnoresScaleLocaleAndExponentNotation() {
        Locale old = Locale.getDefault();
        try {
            Locale.setDefault(Locale.forLanguageTag("ru-RU"));
            assertThat(RoundFairness.canonical(id, Long.MIN_VALUE, dec("8.4200"), null))
                    .isEqualTo(RoundFairness.canonical(id, Long.MIN_VALUE, dec("8.42"), null))
                    .contains("serverSeed=-9223372036854775808\n", "boosterLevel=null\n");
            assertThat(RoundFairness.canonical(id, 0, dec("1E+3"), 12)).contains("crashMultiplier=1000\n");
        } finally { Locale.setDefault(old); }
    }
    @Test void boosterBecomesVisibleOnlyAfterActivation() {
        assertThat(RoundView.from(start()).boosterLevel()).isNull();
        assertThat(RoundView.from(engine.advance(start(), START.plusSeconds(10)).round()).boosterLevel()).isEqualTo(3);
    }
    @Test void x1ProofUsesNullBooster() {
        var r = engine.start(id, UUID.randomUUID(), Theme.RED, dec("100"), 1, Long.MAX_VALUE, config("8.42", 3), START).round();
        assertThat(RoundFairness.verify(r)).isTrue();
        assertThat(RoundFairness.canonical(r.id(), r.seed(), r.crashMultiplier(), r.boosterLevel())).endsWith("boosterLevel=null\n");
    }
}
