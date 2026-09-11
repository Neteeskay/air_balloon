FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:resolve
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S balloon && adduser -S balloon -G balloon
COPY --from=build /app/target/air-balloon.jar app.jar
USER balloon
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
