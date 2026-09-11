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
