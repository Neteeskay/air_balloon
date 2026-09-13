package ru.hackathon.airballoon.admin.config.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import ru.hackathon.airballoon.admin.config.dto.ConfigFilePayload;
import ru.hackathon.airballoon.common.error.ConfigValidationException;
import ru.hackathon.airballoon.common.error.FieldViolation;

/**
 * Serialises/deserialises a {@link ConfigFilePayload} to and from JSON and YAML files
 * used by the admin export/import endpoints.
 */
@Service
public class ConfigFileService {
    public enum Format { JSON, YAML }

    private static final String FIELD_NAME = "file";

    private final ObjectMapper json;
    private final ObjectMapper yaml;
    private final Validator validator;

    public ConfigFileService(ObjectMapper json, Validator validator) {
        this.json = json;
        this.yaml = new ObjectMapper(new YAMLFactory());
        this.yaml.findAndRegisterModules();
        this.validator = validator;
    }

    public Format parseFormat(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ConfigValidationException(List.of(
                    new FieldViolation("format", "Format parameter is required: 'json' or 'yaml'", raw)));
        }
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "json" -> Format.JSON;
            case "yaml", "yml" -> Format.YAML;
            default -> throw new ConfigValidationException(List.of(
                    new FieldViolation("format", "Unsupported format: '" + raw + "'. Use 'json' or 'yaml'", raw)));
        };
    }

    public String serialize(ConfigFilePayload payload, Format format) {
        try {
            return format == Format.JSON ? json.writeValueAsString(payload) : yaml.writeValueAsString(payload);
        } catch (Exception e) {
            throw new ConfigValidationException(List.of(
                    new FieldViolation(FIELD_NAME, "Could not serialise configuration: " + e.getMessage(), null)));
        }
    }

    public ConfigFilePayload deserialize(String content, Format format) {
        if (content == null || content.isBlank()) {
            throw new ConfigValidationException(List.of(
                    new FieldViolation(FIELD_NAME, "File is empty", null)));
        }
        ConfigFilePayload payload;
        try {
            ObjectMapper mapper = format == Format.JSON ? json : yaml;
            payload = mapper.readValue(content, ConfigFilePayload.class);
        } catch (Exception e) {
            throw new ConfigValidationException(List.of(
                    new FieldViolation(FIELD_NAME,
                            "Could not parse " + format.name().toLowerCase(Locale.ROOT)
                                    + " file: " + firstLine(e.getMessage()), null)));
        }
        var violations = validator.validate(payload);
        if (!violations.isEmpty()) {
            throw new ConfigValidationException(violations.stream()
                    .map(v -> new FieldViolation(v.getPropertyPath().toString(),
                            v.getMessage(), v.getInvalidValue()))
                    .toList());
        }
        return payload;
    }

    private static String firstLine(String message) {
        if (message == null || message.isBlank()) return "malformed file content";
        int newline = message.indexOf('\n');
        return newline < 0 ? message : message.substring(0, newline);
    }
}