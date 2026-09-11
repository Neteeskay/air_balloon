# Воздушный Шар — Admin Frontend

Production-like административная панель для существующего backend игры «Воздушный Шар».
Пользовательский игровой frontend здесь не реализуется.

## Стек

- React 18 + TypeScript strict + Vite
- React Router
- TanStack Query
- React Hook Form
- Zod
- Radix primitives для dialog/switch/tabs/tooltip
- Lucide icons
- Vitest + React Testing Library + MSW
- Playwright для E2E с реальным backend

UI реализован собственной лёгкой CSS-системой без тяжёлой дизайн-библиотеки.

## Источник API-контракта

В переданном архиве backend содержит только skeleton (`.gitkeep`) и не содержит реальный OpenAPI-файл или Java DTO.
Поэтому frontend основан на переданном `FRONTEND_API.txt` и `BACKEND_READY.txt`.

Важно:

- read-only поля ответа (`id`, `status`, `createdAt`, `createdBy`, `activatedAt`, `activatedBy` и т.п.) никогда не отправляются обратно как candidate request;
- candidate request строится отдельным адаптером и содержит только документированные настройки + исходный `revision`;
- имена GREEN/RED probability/weight полей не выдумываются: они берутся из фактического `GET /api/admin/config/current` и/или `GET /api/admin/config/metadata`;
- если backend сообщает 9/12 уровней, но фактические имена полей отсутствуют и в current, и в metadata, UI показывает диагностическое предупреждение и не создаёт неизвестные JSON-поля.

Если в рабочей backend-ветке доступен `/openapi/admin-api.yaml`, перед релизом нужно дополнительно сверить exact candidate schema и формат audit `from/to` с ним.

## Запуск

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Backend по умолчанию: `http://localhost:8080`

## Env

```env
VITE_API_BASE_URL=http://localhost:8080
```

Токены и пароли в env frontend не требуются.

Для реального Playwright E2E используются только test environment переменные:

```bash
E2E_ADMIN_USERNAME=admin
E2E_ADMIN_PASSWORD=admin
E2E_API_BASE_URL=http://localhost:8080
npx playwright install chromium
npm run e2e
```

Эти значения не попадают в production bundle.

## Admin routes

- `/admin/login` — вход администратора
- `/admin` — dashboard
- `/admin/config` — редактирование конфигурации
- `/admin/versions` — история версий
- `/admin/versions/:id` — детали версии, diff, activate/rollback
- `/admin/audit` — audit log

Все `/admin/**`, кроме `/admin/login`, защищены frontend route guard. Это только UX-защита; настоящая авторизация остаётся на backend.

## Auth flow

Используются:

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`

Bearer token хранится:

1. в памяти приложения;
2. в `sessionStorage` для восстановления после reload.

`localStorage` не используется. Пароль не сохраняется. Token не пишется в URL и не выводится в UI/console.

При `401` session очищается и пользователь возвращается на login. `expiresAt` контролируется отдельно; refresh-token flow не выдумывается.

## Используемые backend endpoints

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/config/current`
- `GET /api/admin/config/metadata`
- `POST /api/admin/config/validate`
- `POST /api/admin/config`
- `POST /api/admin/config/{id}/activate`
- `GET /api/admin/config/versions?page=&size=`
- `GET /api/admin/config/versions/{id}`
- `GET /api/admin/config/versions/{fromId}/diff/{toId}`
- `POST /api/admin/config/versions/{id}/rollback`
- `GET /api/admin/audit`

Никаких fake production endpoints нет.

## Редактирование конфигурации

Форма разделена на:

1. Основные
2. Crash-модель
3. Бустеры
4. Очки

Metadata используется для displayName, description, mutable, required, min/max и model-specific подсказок.

Flow:

```text
GET current + GET metadata
→ local UX validation
→ POST /api/admin/config/validate
→ POST /api/admin/config
→ DRAFT
→ POST /api/admin/config/{id}/activate
→ refetch current/versions/audit
```

`pointsPerLine` находится во вкладке «Очки» и проходит тот же обязательный flow.

### DRAFT

`POST /api/admin/config` создаёт новую версию. UI явно показывает, что DRAFT ещё не ACTIVE.

### Activation

Перед activation показывается summary изменений и предупреждение, что новая конфигурация применяется только к новым раундам.

### Conflict 409

При `CONFIG_VERSION_CONFLICT` frontend:

- не делает автоматический retry;
- не подменяет revision;
- не выполняет merge;
- показывает currentVersion и traceId;
- предлагает явно загрузить актуальную ACTIVE-конфигурацию.

## Версии, diff и rollback

История загружается с pagination.

Detail screen read-only и показывает:

- revision/status;
- create/activate metadata;
- General/Crash/Boosters/Points;
- diff относительно текущей ACTIVE.

Rollback поясняется как создание **новой ACTIVE version** на основе выбранной старой. Историческая запись напрямую не меняется.

## Audit log

Фильтры:

- action
- administrator
- version
- from
- to

`metadata` безопасно разбирается как JSON object или выводится plain text fallback. `dangerouslySetInnerHTML` не используется. Ключи, похожие на password/token/secret/authorization/apiKey, редактируются как `[скрыто]`.

## Error handling

Поддержаны:

- `400` + fieldErrors
- `401` — очистка session
- `403` — отдельный forbidden state/page
- `404` — empty/not-found
- `409` — code-aware UX, включая version conflict
- `500` — без stack trace, с traceId
- network error + retry

## Responsive / accessibility

Интерфейс рассчитан на 320–1920 px:

- desktop sidebar;
- mobile drawer;
- responsive form grids;
- horizontal scroll для таблиц;
- keyboard focus states;
- semantic labels;
- Radix focus trap/ESC в dialogs;
- status не передаётся одним цветом.

## Тесты

### Unit/component

Покрыты:

- LoginForm
- ProtectedRoute
- error mapping
- metadata/config model
- candidate request builder
- change summary
- probability/weight summary
- safe audit metadata parser
- token expiration/session storage
- decimal parsing/serialization

### MSW integration

Проверяются реальные формы HTTP-контракта frontend client:

- current config
- metadata
- validation success/error
- DRAFT save request body
- activation
- 409 conflict/currentVersion
- versions pagination
- version detail
- diff
- rollback
- audit filters
- 401 session clear
- 403 session preservation

### Playwright E2E

`e2e/admin-flow.spec.ts` рассчитан на **реальный backend** и выполняет:

login → config → pointsPerLine edit → validate → DRAFT → activate → versions/diff → audit → rollback исходной revision.

Тест восстанавливает исходную конфигурацию через rollback, чтобы не оставлять backend в случайном состоянии.

## Команды качества

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
```

## Известное ограничение исходных материалов

В переданном `air_balloon-main.zip` реального backend source/OpenAPI нет, только skeleton. Поэтому независимо подтвердить request DTO по Java/OpenAPI в этом архиве невозможно. Frontend специально не hardcode-ит недокументированные GREEN/RED JSON-поля и использует actual current/metadata response для них.
