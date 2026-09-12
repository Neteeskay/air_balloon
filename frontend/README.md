# Frontend «Воздушный Шар»

React 19 + TypeScript + Vite. Маршрутизация экранами выполнена в едином state-flow без URL-router; глобальная библиотека состояния не требуется. Состояние раунда инкапсулирует `GameSession`, данные приходят только через адаптеры `src/api`.

## Локальный запуск

```bash
npm ci
npm run dev
```

Vite development по умолчанию использует `VITE_API_MODE=mock`: backend не нужен, весь сценарий игры кликабелен. Входы: `anna/balloon1`, `maks/balloon2`, `liza/balloon3`. Каждый новый локальный mock-профиль получает 5 000 бонусов. Баланс, очки и история сохраняются в `localStorage`; это только demo data, не production-авторитетность.

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

`real.ts` использует server-side cookie session и principal-scoped API: auth/current user, catalog, balance, start/snapshot/replay/cashout/result, personal history и fairness. Game realtime работает через native `/ws/rounds`, Tournament — через отдельный STOMP `/ws`. При `401 AUTH_REQUIRED` приложение закрывает realtime вместе с игровым экраном и возвращается к форме входа.

Vite проксирует `/api` и `/ws` на `127.0.0.1:8080`. Production Nginx проксирует те же public-origin пути в backend; browser-код не обращается к Docker hostname.

## Docker

Из корня:

```bash
docker compose up -d --build frontend
```

Compose по умолчанию собирает REAL image. Для автономной UI-демонстрации передайте build arg `VITE_API_MODE=mock`; REAL mode никогда автоматически не переключается на mock.

Архитектура подключения: [frontend-integration.md](../docs/frontend-integration.md).

## Scenario 8

После WIN на Result screen может появиться «Закрепить успех?». Offer приходит с backend,
покупка отправляется с idempotency key; после успеха обновляются баланс и счётчик
виртуальных билетов. Отказ/закрытие считаются DECLINED. `sessionStorage` подавляет
повторный popup до новой browser-session; LOSS popup не запускает.
