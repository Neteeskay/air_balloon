package ru.hackathon.airballoon.common.openapi;

import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@RestController
public class OpenApiController {
    @GetMapping(value = "/openapi/admin-api.yaml", produces = "application/yaml")
    public ResponseEntity<String> openApi() throws IOException {
        ClassPathResource resource = new ClassPathResource("openapi/admin-api.yaml");
        String body = StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/yaml")).body(body);
    }
}
