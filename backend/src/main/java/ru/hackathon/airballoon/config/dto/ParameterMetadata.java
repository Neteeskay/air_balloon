package ru.hackathon.airballoon.config.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ParameterMetadata(
        String technicalName,
        String displayName,
        String description,
        String dataType,
        String unit,
        Number min,
        Number max,
        Object defaultValue,
        boolean required,
        boolean mutable,
        String group,
        String semanticType,
        List<String> allowedValues,
        String effectOnGame) {
}
