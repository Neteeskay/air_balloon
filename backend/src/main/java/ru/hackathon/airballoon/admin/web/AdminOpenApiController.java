package ru.hackathon.airballoon.admin.web;

import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Serves the admin API OpenAPI contract from classpath:/openapi/admin-api.yaml. */
@RestController
public class AdminOpenApiController {
    @GetMapping(value = "/openapi/admin-api.yaml", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> adminApi() throws Exception {
        var resource = new ClassPathResource("openapi/admin-api.yaml");
        String content = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/yaml")).body(content);
    }
}