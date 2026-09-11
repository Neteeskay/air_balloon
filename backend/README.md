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
