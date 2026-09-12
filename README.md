# Воздушный Шар — хакатон 2026

Монорепозиторий рабочего MVP бонусной crash-игры «Воздушный Шар».

## Стек

- Frontend: React + TypeScript + Vite
- Backend: Java 21 + Spring Boot 3.5.16 + Spring JDBC
- Database: PostgreSQL 17 + Flyway
- Realtime: native WebSocket с replay/checkpoint recovery
- Infrastructure: Docker Compose + Nginx

## Структура

- `frontend/` — пользовательский интерфейс игры
- `backend/` — серверная логика, игровая математика, ставки, история, настройки
- `docs/` — архитектура, механика, обязательные сценарии, решения команды
- `infra/` — инфраструктурные конфиги
- `scripts/` — вспомогательные скрипты

## Приоритет MVP

Инструкции запуска backend, API, ограничения и интеграция:
[данные и экономика](docs/backend-data-economy.md), [REST API](docs/API_CONTRACT.md).

Локальный запуск всех сервисов: `docker compose up -d --build --wait`.
Порты и browser origin задаются в `.env` на основе `.env.example`:

```dotenv
FRONTEND_SCHEME=http
FRONTEND_HOST=localhost
FRONTEND_PORT=5174
BACKEND_PORT=8081
# Необязательный authoritative allow-list:
CORS_ALLOWED_ORIGINS=
```

После изменения только `.env` выполните `docker compose up -d --build --wait`.
Frontend будет доступен на `http://127.0.0.1:5174`, backend — на
`http://127.0.0.1:8081`. Backend автоматически разрешает frontend origins
`localhost` и `127.0.0.1` с заданным frontend-портом. Для нестандартных или
нескольких hosts задайте точный comma-separated `CORS_ALLOWED_ORIGINS`; этот
список имеет приоритет, wildcard не поддерживается из-за cookie credentials.

В Docker browser использует same-origin Nginx-маршруты `/api` и `/ws`. При
прямом запуске Vite задайте `VITE_API_BASE_URL` (например,
`http://localhost:8081`) согласно `BACKEND_PORT`.
Переменные портов и demo-токен admin приведены в `.env.example`.
Миграции и PostgreSQL запускаются автоматически.
В demo-профиле создаются anna, maks, liza с 5000 бонусами.
Frontend использует серверную demo-сессию (`anna/balloon1`, `maks/balloon2`,
`liza/balloon3`); тот же UUID применяется в Game Engine и PostgreSQL economy.

Тесты: `docker compose -f docker-compose.backend-test.yml -p balloon-economy-test run --rm backend-test`.

Сначала реализуются обязательные сценарии:

1. Выбор ставки и запуск игры
2. Успешный cashout
3. Проигрыш по crash
4. Активация бустера
5. Изменение параметров без правки исходного кода

Дополнительные функции — рейтинг, турнирная таблица, upsell, расширенная анимация — после стабильного MVP.

## Правило архитектуры

Вся игровая математика и случайные события должны считаться на backend. Frontend только отображает состояние и отправляет действия пользователя.
