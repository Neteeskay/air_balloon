package ru.airballoon.acceptance;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import ru.hackathon.airballoon.support.MutableClock;

/** Test harness wiring only; every business operation remains a real Core/PostgreSQL operation. */
@TestConfiguration(proxyBeanMethods = false)
@Import(CoreBackendAcceptanceDriver.class)
public class CoreBackendAcceptanceConfiguration {
    @Bean @Primary MutableClock acceptanceClock() { return new MutableClock(); }

    @Bean
    WebServerFactoryCustomizer<TomcatServletWebServerFactory> acceptanceNio2Connector() {
        return factory -> factory.setProtocol("org.apache.coyote.http11.Http11Nio2Protocol");
    }
}
