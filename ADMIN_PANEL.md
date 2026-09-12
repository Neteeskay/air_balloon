# Админ-панель «Воздушный Шар» — документация изменений

> Интегрированная база: `integration/backend-admin-base`
> Источник Admin-реализации: `integration/admin-panel` (`b8b76333c7131c42d270a39455bd90f6153aa696`)

---

## Обзор

Реализована полноценная админ-панель для управления конфигурацией игры «Воздушный Шар» — backend API (Spring Boot / JDBC / Flyway) и frontend SPA (React 19 / TypeScript / Vite / Tailwind-free CSS). Панель позволяет администратору авторизовываться, просматривать текущую конфигурацию, редактировать параметры, управлять черновиками и версиями, активировать изменения и просматривать аудит-журнал.

---

## Структура изменений

### Backend (Java / Spring Boot)

#### Новый пакет `ru.hackathon.airballoon.admin` (~49 файлов)

| Подпакет | Назначение | Ключевые классы |
|----------|-----------|-----------------|
| `domain` | Доменные типы | `AdminRole` (роль), `AuditAction` (тип события) |
| `entity` | Сущности / record'ы | `AdminUserEntity`, `AdminPrincipal`, `AdminSessionEntity`, `IssuedToken` |
| `repository` | JDBC-доступ к данным | `AdminUserRepository`, `AdminSessionRepository`, `AuditLogRepository` |
| `service` | Бизнес-логика | `AdminAuthService` (логин/выход), `AdminTokenService` (токены, TTL), `AuditService` (аудит) |
| `security` | Защита эндпоинтов | `AdminBearerTokenFilter` (SHA-256 хеш токена, 401/403), `AdminSecurityConfiguration` (BCrypt) |
| `bootstrap` | Инициализация | `AdminDemoDataInitializer` (создание `admin/admin` в demo-профиле) |
| `web` | REST-контроллеры | `AdminAuthController`, `AuditController`, `AdminOpenApiController` |

#### Подпакет `ru.hackathon.airballoon.admin.config` — управление конфигурацией

| Подпакет | Назначение | Ключевые классы |
|----------|-----------|-----------------|
| `domain` | Статусы/типы | `ConfigStatus` (DRAFT/ACTIVE/ARCHIVED), `GameTheme` (GREEN 9 / RED 12), `GameType` (CRASH) |
| `entity` | Строки БД | `AdminConfigRow`, `AdminBoosterProbabilityRow` |
| `dto` | Запросы/ответы (13 файлов) | `GameConfigurationWriteRequest`, `GameConfigurationResponse`, `ConfigurationVersionDetail`, `ConfigurationVersionSummary`, `ConfigDiffResponse`, `ConfigDiffEntry`, `ConfigValidationResponse`, `ConfigMetadataResponse`, `ParameterMetadata`, `CrashSettingsDto`, `BoosterSettingsDto`, `PointsSettingsDto`, `ThemeProbabilitiesDto` |
| `service` | Оркестрация | `ConfigAdminService` (CRUD + активация + rollback), `ConfigAdminValidator` (семантическая валидация), `ConfigAdminDiffService` (пошаговый diff), `ConfigMetadataService` (метаданные формы), `AdminConfigMapper` (маппинг), `LiveConfigPublisher` (публикация в live-таблицы) |
| `repository` | JDBC | `AdminAppRepository` (sequences), `AdminConfigRepository` (версии конфигурации), `AdminBoosterProbabilityRepository` (вероятности) |
| `web` | Контроллер | `ConfigAdminController` (10 эндпоинтов) |

#### Общий слой `ru.hackathon.airballoon.common`

| Файл | Назначение |
|------|-----------|
| `PageResponse<T>` | Универсальная обёртка пагинированного ответа |
| `error/GlobalExceptionHandler` | Обработка ошибок **только** админ-контроллеров (`basePackages="ru.hackathon.airballoon.admin"`) |
| `error/ApiErrorResponse` | Единый формат ошибок с `fieldErrors`, `traceId`, `currentVersion` |
| `error/FieldViolation` | Одна ошибка валидации поля |
| `error/ConfigValidationException` | 400 — ошибки валидации конфигурации |
| `error/VersionConflictException` | 409 — конфликт версий (optimistic locking) |
| `error/InvalidCredentialsException` | 401 — неверные учётные данные |
| `error/ResourceNotFoundException` | 404 — ресурс не найден |
| `error/ConfigStateException` | 409 — невалидный переход состояния |
| `web/TraceId` / `TraceIdFilter` | Генерация и прокидывание `X-Trace-Id` |

#### Миграция БД

`V307__admin_panel.sql` — создаёт таблицы (номер изменён при semantic integration, потому что
authoritative backend уже использует V306 для Puzzle/Profile):
- `admin_app` — последовательность ревизий (optimistic locking)
- `admin_user` — учётные записи администраторов (BCrypt-хеш пароля)
- `admin_session` — серверные сессии (токен SHA-256, TTL, revocation)
- `admin_config` — версионированные конфигурации (статусы DRAFT/ACTIVE/ARCHIVED)
- `admin_booster_probability` — вероятности бустеров по темам и уровням (GREEN 1–9, RED 1–12)
- `admin_audit` — аудит-журнал действий

#### Изменения в существующем коде

| Файл | Суть изменений |
|------|---------------|
| `application.yml` | Добавлены `app.security.admin-token-ttl` (PT8H) и `app.security.demo-player-token` |
| `docker-compose.yml` | Переменные окружения для admin-токена |
| `EconomyIntegrationTest.java` | Добавлены тесты: создание черновика, активация, откат, 401/409/400 ошибки |
| `CoreBackendAcceptanceDriver.java` | HTTP-хелперы для admin API (login, getAdminConfig, setPointsPerLevel) |

#### Исправления

- **JDBC/Instant mapping**: timestamp-поля Admin-сессий и аудита корректно преобразуются в `Instant`
- **`toWeights`**: вспомогательный метод для конверсии вероятностей в веса (basis points)
- **`GlobalExceptionHandler`**: ограничение scope через `basePackages` — предотвращает перехват `GameException` от игровых эндпоинтов (`/api/auth/me` → 401 вместо 500)
- **Трёхсторонний live merge**: Admin activation применяет только поля, изменённые относительно base revision, и не перезаписывает более свежие несвязанные runtime-настройки

---

### Frontend (React 19 / TypeScript / Vite)

#### Новый модуль `frontend/src/admin/` (12 файлов)

| Файл | Назначение | Ключевые экспорт |
|------|-----------|------------------|
| `types.ts` | Типизация всех DTO | `GameConfiguration`, `GameConfigurationWrite`, `ConfigMetadata`, `ParameterMetadata`, `AdminErrorBody`, `ValidationResult`, `DiffEntry`, `AuditEvent`, `PageResponse<T>` |
| `client.ts` | HTTP-клиент | `AdminClient` (login, logout, getCurrent, getMetadata, validate, createDraft, activate, versions, version, diff, rollback, audit), `AdminApiError`, `adminSession`, `clearAdminSession` |
| `model.ts` | Трансформация модели | `flatten` (nested → flat string map), `assemble` (flat → write request), `formParameters` (lineN шаблоны → concrete levels), `themeSum` (сумма вероятностей темы) |
| `format.ts` | Форматирование | `date`, `shortId`, `number`, `actionLabel`, `statusLabel`, `formatValue` |
| `components.tsx` | Переиспользуемые UI | `StatusPill`, `Modal`, `FieldRow` |
| `AdminApp.tsx` | Корень с навигацией | 4 таба: Обзор / Конфигурация / Версии / Аудит; логаут; ссылка «К игре» |
| `pages/Login.tsx` | Форма входа | логин/пароль, ошибка, busy-state |
| `pages/Overview.tsx` | Обзор | Текущая конфигурация (сводка), последние 5 версий |
| `pages/ConfigEditor.tsx` | Редактор конфигурации | Группировка по `general/crash/boosters/points`, live-суммы вероятностей, валидация → черновик → активация, обработка 409 |
| `pages/Versions.tsx` | Версии | Список (до 50), детали (модалка), diff (пошаговый), rollback с подтверждением |
| `pages/Audit.tsx` | Аудит-журнал | Фильтры (action/admin/version/даты), пагинация |

#### Тесты

| Файл | Кол-во тестов | Что проверяется |
|------|---------------|-----------------|
| `client.test.ts` | 5 | Логин → сессия в localStorage, Bearer-заголовок, 409 → currentVersion, 401 → сброс, истечение сессии |
| `model.test.ts` | 4 | Flatten/assemble раскрывает lineN-шаблоны, formParameters создаёт 9+12 уровней, themeSum = ~100, assemble zachitywaет revision |

#### Изменения в существующем коде

| Файл | Суть изменений |
|------|---------------|
| `App.tsx` | Hash-роутинг `#/admin` (hashchange listener); импорт `AdminApp`; на странице логина добавлена ссылка «Администрирование игры →» (`href="#/admin"`) |
| `styles/index.css` | Добавлен блок `/* Admin panel */` (~92 строки) — `.admin-*` классы для всей UI: карточки, таблицы, формы, модалки, статусы, пагинация, фильтры, адаптивный дизайн (`@media max-width: 760px`) |

---

### Инфраструктура

| Файл | Изменения |
|------|-----------|
| `docker-compose.yml` | Переменные `ADMIN_TOKEN_TTL`, `DEMO_PLAYER_TOKEN` |
| `frontend/nginx.conf` | Reverse proxy `/api/` → `backend:8080` (все admin-эндпоинты доступны через nginx) |
| `frontend/Dockerfile` | Multi-stage: `node:24-alpine` (build) → `nginx:1.27-alpine` (serve) |
| `frontend/.dockerignore` | Исключает `node_modules`, `dist`, `.vite` |

---

## API-эндпоинты

### Авторизация

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/admin/auth/login` | Логин (username/password), возвращает bearer-токен |
| POST | `/api/admin/auth/logout` | Выход (отзыв токена) |

### Конфигурация

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/admin/config/current` | Текущая активная конфигурация (ETag по ревизии) |
| GET | `/api/admin/config/metadata` | Метаданные полей формы (17 параметров, groups, types) |
| POST | `/api/admin/config/validate` | Валидация без сохранения |
| POST | `/api/admin/config` | Создание черновика (revision = active+1 → 201, иначе 409) |
| POST | `/api/admin/config/{id}/activate` | Активация черновика → 200 ACTIVE |
| GET | `/api/admin/config/versions` | Список версий (пагинация) |
| GET | `/api/admin/config/versions/{id}` | Детали версии |
| GET | `/api/admin/config/versions/{fromId}/diff/{toId}` | Diff между версиями |
| POST | `/api/admin/config/versions/{id}/rollback` | Откат к версии (создаёт новую ACTIVE) |

### Аудит

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/admin/audit` | Журнал действий (action/admin/version/даты, пагинация) |

---

## Поток работы

```
Логин → Обзор (сводка + последние версии)
     ↓
Редактирование → Валидация → Черновик (DRAFT)
     ↓
Активация → ACTIVE (публикация в live-таблицы)
     ↓
При конфликте (409) → Получение текущей rev → Пересохранение
```

---

## Проверки

| Что проверено | Как |
|---------------|-----|
| Typecheck (TypeScript strict) | `npm run typecheck` — 0 ошибок |
| Lint (ESLint + react-hooks v7) | `npm run lint --max-warnings 0` — 0 ошибок |
| Unit-тесты (Vitest) | `npm test` — 50/50 PASS (41 существующий + 9 admin) |
| Backend unit/integration/acceptance | `mvn verify -Pacceptance` — 423/423 PASS (338 + 85) |
| Flyway | Fresh V1→V307, upgrade V306→V307 и `validate` — PASS |
| Docker build | `docker compose build backend frontend` — успех |
| Backend smoke через nginx | `nginx -t`; POST login → token; GET current → ACTIVE; POST logout — PASS |
| `/api/auth/me` → 401 | Исправлено: GlobalExceptionHandler ограничен `basePackages="ru.hackathon.airballoon.admin"` |

---

## Архитектурные решения

1. **Без новых npm-зависимостей** — admin-модуль написан на чистом React + native fetch
2. **Hash-роутинг** — `#/admin` без react-router, state-based навигация внутри
3. **Сессия в localStorage** — ключ `air-balloon-admin-session`, TTL проверяется клиентом
4. **Optimistic locking** — `revision` в URL/body, проверка `revision == active + 1`
5. **Метаданные-driven форма** — `ConfigMetadata` определяет группы, типы, min/max для рендеринга полей
6. **`GlobalExceptionHandler` scoping** — `basePackages="ru.hackathon.airballoon.admin"` предотвращает перехват игровых исключений
7. **Live publish** — активация публикует в `game_config_versions` / `game_config_active` (переиспользуя существующий live-config subsystem)
8. **nginx reverse proxy** — единая точка входа, `/api/` проксируется на backend:8080

---

## Конфигурация

| Переменная | Значение по умолчанию | Описание |
|------------|----------------------|----------|
| `ADMIN_TOKEN_TTL` | `PT8H` | Время жизни bearer-токена |
| `DEMO_PLAYER_TOKEN` | `demo-player-token` | Токен игрока (для разграничения 401/403 в фильтре) |
| `SPRING_PROFILES_ACTIVE` | `demo` | Активирует `AdminDemoDataInitializer` (создаёт admin/admin) |
