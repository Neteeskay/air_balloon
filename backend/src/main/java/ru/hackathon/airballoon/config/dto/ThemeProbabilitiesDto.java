package ru.hackathon.airballoon.config.dto;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;

import java.util.LinkedHashMap;
import java.util.Map;

public class ThemeProbabilitiesDto {
    private final Map<String, Double> values = new LinkedHashMap<>();

    public ThemeProbabilitiesDto() {
    }

    public ThemeProbabilitiesDto(Map<String, Double> values) {
        if (values != null) this.values.putAll(values);
    }

    @JsonAnySetter
    public void put(String name, Double value) {
        values.put(name, value);
    }

    @JsonAnyGetter
    public Map<String, Double> values() {
        return values;
    }

    public Double get(String name) {
        return values.get(name);
    }

    public Map<String, Double> asMap() {
        return java.util.Collections.unmodifiableMap(new LinkedHashMap<>(values));
    }
}
