# Backend

Java 21 + Spring Boot 3.5.16 + Spring JDBC + PostgreSQL 17 + Flyway.

Реализован Backend №2: пользователи, баланс, журнал транзакций, очки,
сохранение раундов, история, награды и версионируемая конфигурация.
Game Engine / WebSocket относятся к Backend №1.

## Запуск

Из корня:

~~~bash
docker compose up -d --build --wait
~~~

API: http://127.0.0.1:8080; health: /actuator/health.
GET /api/demo/users возвращает anna, maks и liza, изначально по 5000 бонусов.
Демо-данные создаются только при SPRING_PROFILES_ACTIVE=demo.
Повторный запуск сохраняет потраченный баланс и накопленные очки.

С Maven 3.9 и Java 21, при отдельно запущенном PostgreSQL:

~~~bash
mvn spring-boot:run -Dspring-boot.run.profiles=demo
~~~

DB_URL по умолчанию jdbc:postgresql://localhost:5432/air_balloon.
Переменные и demo-токен Admin API: [.env.example](../.env.example).

## Тесты на настоящем PostgreSQL

Из корня:

~~~bash
docker compose -f docker-compose.backend-test.yml -p balloon-economy-test run --rm backend-test
~~~

Тестовая БД изолирована от рабочей и не публикует порт. Тесты очищают только
БД с именем balloon_test. Отчёты: target/surefire-reports.

## Контракты

GameConfigProvider, BalanceService, RoundRepository, ScoreService,
RewardService; короткие атомарные сценарии — RoundTransactions.

[Подробная документация](../docs/backend-data-economy.md):
схема БД, гарантии, конфигурация, порядок вызовов и ограничения.
[REST-контракт](../docs/API_CONTRACT.md).
