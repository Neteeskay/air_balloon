package ru.hackathon.airballoon;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import ru.airballoon.game.infrastructure.config.CorsProperties;

@SpringBootApplication
@EnableConfigurationProperties(CorsProperties.class)
public class AirBalloonApplication {
    public static void main(String[] args) {
        SpringApplication.run(AirBalloonApplication.class, args);
    }
}
