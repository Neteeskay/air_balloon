package ru.hackathon.airballoon;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import ru.hackathon.airballoon.config.*;
import ru.hackathon.airballoon.common.BusinessException;
import static org.assertj.core.api.Assertions.*;

class ConfigValidatorTest {
    final ObjectMapper json=new ObjectMapper();
    GameConfig config(String field,Object value) throws Exception {
        var node=(ObjectNode)json.readTree(getClass().getResourceAsStream("/valid-config.json"));
        node.set(field,json.valueToTree(value));
        return json.treeToValue(node,GameConfig.class);
    }
    static Stream<Object[]> invalidValues() {
        return Stream.of(
            new Object[]{"minCrashMultiplier",0},
            new Object[]{"minCrashMultiplier",1.00001},new Object[]{"maxCrashMultiplier",1000001},
            new Object[]{"growthRate",0},new Object[]{"growthRate",10.0001},new Object[]{"growthRate",0.00011},
            new Object[]{"alpha",-0.001},new Object[]{"alpha",1},
            new Object[]{"pointsPerLevel",-1},new Object[]{"pointsPerLevel",1000001},
            new Object[]{"pointsCashoutBonus",-1},new Object[]{"pointsX2Bonus",-1},
            new Object[]{"pointsX3Bonus",-1},new Object[]{"pointsX4Bonus",-1},
            new Object[]{"greenLevelCount",8},new Object[]{"redLevelCount",10},
            new Object[]{"greenBoosterWeights",java.util.List.of(10000)},
            new Object[]{"redBoosterWeights",java.util.Collections.nCopies(12,0)},
            new Object[]{"greenBoosterWeights",java.util.List.of(-1,1251,1250,1250,1250,1250,1250,1250,1250)},
            new Object[]{"boosterValues",java.util.List.of(1,2,3,0)},new Object[]{"boosterValues",java.util.List.of(1,3,5,8)},
            new Object[]{"updateIntervalMs",1001},new Object[]{"gameName",""},
            new Object[]{"gameType","OTHER"},new Object[]{"fixedSeedEnabled",true});
    }
    @ParameterizedTest @MethodSource("invalidValues")
    void rejectsInvalidParameter(String field,Object value) throws Exception {
        var c=config(field,value);
        assertThatThrownBy(()->new ConfigValidator(false).validate(c)).isInstanceOf(BusinessException.class);
    }
    @Test void validConfigAccepted() throws Exception {
        new ConfigValidator(false).validate(config("pointsPerLevel",500));
        new ConfigValidator(false).validate(config("boosterValues",java.util.List.of(1,2,3,4)));
        new ConfigValidator(false).validate(config("minCrashMultiplier",1));
        new ConfigValidator(false).validate(config("alpha",0));
        new ConfigValidator(false).validate(config("alpha",0.9999));
        new ConfigValidator(false).validate(config("growthRate",0.0001));
    }
    @Test void snapshotListsAreImmutable() throws Exception {
        var c=config("pointsPerLevel",500);
        assertThatThrownBy(()->c.greenBoosterWeights().set(0,10000)).isInstanceOf(UnsupportedOperationException.class);
    }
    @Test void fixedSeedAllowedOnlyInDemo() throws Exception {
        var node=(ObjectNode)json.valueToTree(config("fixedSeed",42L));node.put("fixedSeedEnabled",true);
        var c=json.treeToValue(node,GameConfig.class);
        new ConfigValidator(true).validate(c);
        assertThatThrownBy(()->new ConfigValidator(false).validate(c)).isInstanceOf(BusinessException.class);
    }
}
