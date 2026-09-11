# Backend

Java 21 + Spring Boot 3.

Основные пакеты:

- `game` — GameEngine, crash-модель, рост коэффициента, уровни, бустеры, очки
- `bet` — ставка, cashout, расчёт выигрыша
- `user` — демо-пользователь и баланс
- `history` — завершённые раунды
- `admin` — изменение игровых параметров
- `websocket` — realtime-события
- `config` — конфигурация приложения и игровой модели
- `common` — общие DTO, ошибки, утилиты

Критическое правило: клиент не определяет crash, booster level, payout или points.

## Реализовано Backend №3

Tournament + leaderboard + общий read-only STOMP transport. Game Engine и data/economy модули пока отсутствуют; готовность всей игровой системы не заявляется. Аудит: [backend3-audit.md](../docs/backend3-audit.md).

### Запуск

Нужны JDK 21 и PostgreSQL 17. Maven скачает Wrapper.

Из корня репозитория:

```powershell
docker compose up -d postgres
cd backend
.\mvnw.cmd spring-boot:run '-Dspring-boot.run.profiles=demo'
```

Linux/macOS: `sh mvnw spring-boot:run -Dspring-boot.run.profiles=demo`.

`GET http://localhost:8080/api/tournaments/active` возвращает demo турнир с 24 участниками; leaderboard — `/api/tournaments/{id}/leaderboard`. Demo simulation по умолчанию выключена. Для включения: `TOURNAMENT_DEMO_TOURNAMENT_SIMULATION_ENABLED=true` в environment перед запуском. Profile `prod` исключает demo beans.

Настройки БД: DATABASE_URL (JDBC URL), POSTGRES_USER, POSTGRES_PASSWORD; порт: BACKEND_PORT. `.env` для Compose не импортируется Maven автоматически: при смене значений передайте их и в environment backend. REST/WebSocket предполагают один origin (например, общий reverse proxy).

### Проверки

```powershell
.\mvnw.cmd test
.\mvnw.cmd verify
.\mvnw.cmd verify -Pacceptance
```

`verify` запускает unit + все IT на Testcontainers PostgreSQL (Docker обязателен по умолчанию). Для отдельной уже запущенной тестовой БД можно задать `TEST_DATABASE_URL`, `TEST_DATABASE_USER`, `TEST_DATABASE_PASSWORD`. H2 не используется. Suite очищает tournament-таблицы: используйте отдельную тестовую БД.

`verify -Pacceptance` — строгая приёмка: отсутствие реальных Backend №1/№2 adapters даёт BLOCKED и ненулевой exit code. Обычный `verify` показывает эти же проверки как skipped с причиной BLOCKED, поэтому зелёная сборка не означает готовность игровой интеграции.

Из корня Windows также доступно `powershell -File scripts/test-backend.ps1 -Suite acceptance` (или unit/tournament/all). Runner печатает SCENARIO 1–5 PASS/FAIL/BLOCKED по новым JUnit XML.

См. [tournament.md](../docs/tournament.md), [acceptance-tests.md](../docs/acceptance-tests.md) и [финальный отчёт](../docs/backend3-result.md).
