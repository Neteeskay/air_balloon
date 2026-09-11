# API / WebSocket contract

## Backend №2: HTTP API

JSON, даты UTC ISO-8601, идентификаторы UUID, бонусы/очки long.
Для значений > Number.MAX_SAFE_INTEGER frontend должен учитывать точность JS.

| Метод | URL | Ответ |
| --- | --- | --- |
| GET | /api/demo/users | UserState[] из трёх пользователей; только demo |
| GET | /api/users/{id}/state | UserState |
| GET | /api/history?page=0&size=20 | {items, page, size, total} |
| GET | /api/rounds/{id}/result | Завершённый результат с наградой |
| GET | /api/admin/config | {version, updatedAt, config} |
| PUT | /api/admin/config | Принимает {expectedVersion, config}, возвращает новый snapshot |

Admin endpoints требуют X-Admin-Token. Локальное Compose-значение:
local-demo-admin. Пустой ADMIN_TOKEN в standalone закрывает доступ.
Мутации экономики — внутренние Java-сервисы, публичных POST для balance/score нет.

UserState: userId, username, displayName, bonusBalance, gameScore, createdAt, updatedAt.

history.items: roundId, username, theme, betAmount, boosterTier,
boosterMultiplier (значение из версии конфигурации раунда), cashoutMultiplier,
crashMultiplier, winAmount, roundScore, result (WIN/LOSS), finishedAt.
size=1..100; сортировка finishedAt DESC, id. История глобальная.
WIN означает успешный cashout, в том числе после последующего crash.

result: roundId, result, betAmount, cashoutMultiplier, crashMultiplier,
winAmount, score, configVersion, reward.
reward: id, roundId, userId, type, rarity, createdAt.
До завершения — 409 ROUND_NOT_FINISHED.

Полная схема GameConfig, ограничения, Java-интерфейсы и порядок транзакций:
[backend-data-economy.md](backend-data-economy.md).

## Ошибки

~~~json
{
  "code": "INSUFFICIENT_BALANCE",
  "message": "Недостаточно бонусов",
  "timestamp": "2026-09-11T00:00:00Z"
}
~~~

400 — ошибка запроса/валидации; 403 — доступ к admin; 404 — объект отсутствует;
409 — бизнес-конфликт/устаревшая версия/ограничение БД.
Полный список кодов — в документе backend-data-economy.md.
Повтор debit/credit/score/reward с теми же параметрами возвращает успех,
с другой суммой/очками — IDEMPOTENCY_CONFLICT.

## Frontend и Game Engine

Nginx проксирует /api/ в backend:8080; Vite — в 127.0.0.1:8080.
Frontend-вход и баланс пока имитируются на клиенте. Для подключения серверных
профилей сопоставьте login с username из /api/demo/users и читайте state по UUID.
Публичный read-only user API не является системой авторизации.

Game Engine/WebSocket контракт ещё не опубликован Backend №1.
Перед интеграцией согласуйте API старта/cashout и realtime events,
сохраняя атомарные границы из RoundTransactions.
