# Backend №3: исходный аудит

Дата: 2026-09-11. Исходный commit: `9db3b3c` (`Initial project structure`), ветка `codex/3bec`.

До изменений прочитаны все отслеживаемые файлы backend и документы архитектуры, механики, API, MVP и работы команды. Рабочее дерево было чистым. `AGENTS.md` не найден.

| Область | Фактическое состояние |
|---|---|
| Java/Spring Boot | Объявлены Java 21 + Spring Boot 3; build-файла и Application нет |
| Пакеты | Пустые `admin`, `bet`, `common`, `config`, `game`, `history`, `user`, `websocket`, только `.gitkeep` |
| Backend №1 | GameEngine, GameRound, seed hook, multiplier, lifecycle отсутствуют |
| Backend №2 | UserService, ScoreService, BalanceService, RoundRepository, GameConfigProvider, RewardService отсутствуют |
| БД | Entities, repositories, migrations отсутствуют |
| API / shared contracts | `docs/API_CONTRACT.md`: REST, WebSocket, errors = TBD |
| Realtime / auth / errors | Реализаций нет |
| Tests / Testcontainers | Только пустая директория тестов |
| Docker | Compose содержит PostgreSQL 17 Alpine, backend container отсутствует |
| Среда проверки | Java 21 найдена в Android Studio; Maven загружен локально в игнорируемый `tmp`; Docker CLI отсутствует |

Решение: реализовать только tournament projection и минимальный запускаемый Spring Boot каркас. Не создавать движок, экономику, общую систему пользователей/очков или наград. Для Backend №2 предоставить `PlayerScoreSource`, `PlayerScore`, `ScoreChanged`; для Backend №1/№2 — test-only acceptance driver с явным BLOCKED при отсутствии адаптера. Production не подменяется fake.

Tournament использует Spring JDBC и отдельную схему `tournament`, миграцию V300, общий Spring STOMP transport. Новые интерфейсы являются точками подключения отсутствующих модулей, а не их альтернативными реализациями.
