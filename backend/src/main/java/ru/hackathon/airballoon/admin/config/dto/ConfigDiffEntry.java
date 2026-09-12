package ru.hackathon.airballoon.admin.config.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ConfigDiffEntry(String field, Object before, Object after) {}