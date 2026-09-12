package ru.hackathon.airballoon.admin.config.dto;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Dynamic map of per-level booster probabilities keyed as "line1LootProb..lineNLootProb".
 * @JsonAnyGetter/@JsonAnySetter flattens/serialises the levels into the parent JSON object.
 */
public class ThemeProbabilitiesDto {
    private final Map<String, Double> values = new LinkedHashMap<>();

    @JsonAnySetter
    public void put(String key, Double value) { values.put(key, value); }

    @JsonAnyGetter
    public Map<String, Double> values() { return values; }

    public Double get(String key) { return values.get(key); }
    public int size() { return values.size(); }

    /** Create from a pre-built map. */
    public static ThemeProbabilitiesDto of(Map<String, Double> values) {
        ThemeProbabilitiesDto dto = new ThemeProbabilitiesDto();
        dto.values.putAll(values);
        return dto;
    }
}