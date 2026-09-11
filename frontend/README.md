# Frontend «Воздушный Шар»

React 19 + TypeScript + Vite. Маршрутизация экранами выполнена в едином state-flow без URL-router; глобальная библиотека состояния не требуется. Состояние раунда инкапсулирует `GameSession`, данные приходят только через адаптеры `src/api`.

## Локальный запуск

```bash
npm ci
npm run dev
```

По умолчанию включён `VITE_API_MODE=mock`: backend не нужен, весь сценарий игры кликабелен. Входы: `anna/balloon1`, `maks/balloon2`, `liza/balloon3`. Каждый новый локальный mock-профиль получает 5 000 бонусов. Баланс, очки и история сохраняются в `localStorage`; это только demo data, не production-авторитетность.

Открыть `http://127.0.0.1:5173`. Внизу игрового экрана есть «Демо-лаборатория» с пресетами `WIN`, `LOSE`, `BOOSTER`, `RECONNECT`, симуляцией disconnect и переключением баланса 50/5000.

```bash
npm test
npm run build
```

## Data source

| Переменная | Значение |
| --- | --- |
| `VITE_API_MODE` | `mock` (default) или `real` |
| `VITE_API_BASE_URL` | пусто для same-origin; необязательный base URL REAL API |

`real.ts` уже реализует опубликованные start/snapshot/cashout/replay/fairness/result/history/user-state вызовы и native WebSocket. Он не подделывает отсутствующую server auth и не угадывает каталог ставок. Поэтому полноценный REAL-вход останется заблокирован до согласования этих двух частей в `integration/backend-core`.

Vite проксирует `/api` и `/ws` на `127.0.0.1:8080`. Production Nginx proxy должен быть добавлен/сверен при слиянии с CORE-инфраструктурой; текущий Docker-образ в mock-режиме полностью автономен.

## Docker

Из корня:

```bash
docker compose up -d --build frontend
```

Сборка standalone demo использует MOCK. Для будущего REAL image передайте build args `VITE_API_MODE=real` и `VITE_API_BASE_URL`.

Архитектура подключения: [frontend-integration.md](../docs/frontend-integration.md).
