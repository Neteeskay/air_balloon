# Backend

Java 21 + Spring Boot 3.5.16 + Spring JDBC + PostgreSQL 17 + Flyway.

Реализован Backend №2: пользователи, баланс, журнал транзакций, очки,
сохранение раундов, история, награды и версионируемая конфигурация.
Game Engine / WebSocket относятся к Backend №1.

## Запуск

Критическое правило: клиент не определяет crash, booster level, payout или points.

## Реализованный Game Engine

Java 21, Spring Boot 3.5.16, Maven Wrapper 3.9.11. Исходный пакет:
`ru.airballoon.game`, слои `domain`, `application`, `infrastructure`.
Перечисленные выше user/history/admin — зоны дальнейшей работы Backend/Data.

```powershell
# Из backend/, при установленном JDK 21+
.\mvnw.cmd -B verify
.\mvnw.cmd spring-boot:run '-Dspring-boot.run.profiles=demo'
```

Для Linux/macOS: `sh mvnw -B verify` и
`sh mvnw spring-boot:run -Dspring-boot.run.profiles=demo`.
`demo` воспроизводит x3 на 2.00→6.00, crash=8.42; `dev` использует случайный seed.
В этих профилях есть тестовый пользователь с балансом 1000 и in-memory адаптеры.
Без dev/demo/test необходимо подключить реальные реализации портов и Principal.

REST: `POST /api/rounds`, `GET /api/rounds/{id}`, `POST /api/rounds/{id}/cashout`.
Native JSON WebSocket: `/ws/rounds`, автоматически только события текущего пользователя.

- [API contract](../docs/API_CONTRACT.md)
- [Математика, lifecycle, конфигурация, DI и ограничения](../docs/game-engine.md)
- [Полный отчёт о реализации](../docs/game-engine-result.md)
- [Smoke test реального scheduler + WebSocket](../scripts/game-engine-smoke.ps1)
- [Commit/reveal и независимая проверка proof](../docs/fairness.md)
- [Snapshot, reconnect, replay, checkpoints и cleanup](../docs/reconnect-recovery.md)

Дополнительные REST endpoints: `GET /api/rounds/{id}/fairness`,
`GET /api/rounds/{id}/events?afterSequence=0`. Cashout принимает необязательный
`Idempotency-Key: UUID`. Все integration/reliability tests входят в `mvnw verify`.
Локальная fairness-демонстрация из корня: `node scripts/verify-fairness.mjs --demo`.

## Data / Economy / PostgreSQL

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
