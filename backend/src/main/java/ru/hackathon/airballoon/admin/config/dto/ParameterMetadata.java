package ru.hackathon.airballoon.admin.config.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ParameterMetadata(
    String technicalName,
    String displayName,
    String description,
    String dataType,
    String unit,
    Object min,
    Object max,
    Object defaultValue,
    boolean required,
    boolean mutable,
    String group,
    String semanticType,
    List<String> allowedValues,
    String effectOnGame
) {}