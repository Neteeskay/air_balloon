package ru.airballoon.integration;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Profile;

/** Loads Backend #2 only for the durable CORE runtime; game tests retain their isolated adapters. */
@Configuration(proxyBeanMethods = false)
@Profile("!test & !dev")
@ComponentScan(
        basePackages = "ru.hackathon.airballoon",
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = ru.hackathon.airballoon.AirBalloonApplication.class))
public class CorePersistenceConfiguration {
}
