# Tournament и live leaderboard

## Архитектура и источник очков

Пакет `ru.hackathon.airballoon.tournament` содержит domain, persistence (Spring JDBC), service, API, DI ports, demo. Используется Java 21, Spring Boot 3.5.16, PostgreSQL 17, Flyway. Минимальный общий каркас появился здесь, потому что исходный backend был пустым; подробности в [аудите](backend3-audit.md).

Выбран **снимок общего gameScore (вариант A)**. `participants.score` копирует полное значение из Backend №2. В турнир входят и очки, заработанные до вступления. Это не дельта «очки только за время турнира» и не дополнительный ledger. Backend №3 не вычисляет level/booster points и не изменяет баланс. Снимок нужен для сохранения итогов после окончания турнира и независимого SQL-индекса рейтинга.

```text
Backend #1 GameEngine -> Backend #2 ScoreService -> Spring ScoreChanged
    -> TournamentService -> PostgreSQL projection -> AFTER_COMMIT -> STOMP -> frontend
```

Backend №2 подключает `PlayerScoreSource.find(userId)` через Spring bean и публикует `ScoreChanged(PlayerScore)` **внутри своей транзакции**. `PlayerScore` содержит `userId`, `username`, `gameScore`, монотонно возрастающую per-user `version`, `changedAt`. Версия должна сохраняться в БД и не сбрасываться при рестарте. Событие синхронное: ошибки projection откатывают общую транзакцию. Данные и leaderboard согласованы, rollback не публикует live update. Если команда уже ввела свой event, достаточно одного адаптера из него в этот контракт.

`PlayerScoreSource.find` — обычное чтение без захвата пользовательского write lock: это исключает обратный порядок блокировок при вступлении. Если score изменился параллельно join, его событие после получения tournament lock применит более новую версию. Общий источник score должен использовать тот же datasource/transaction manager для атомарности. Внешний callback после commit тоже обрабатывается, но атомарность с экономикой тогда не гарантируется.

Транзакция обновления захватывает tournament row lock; несколько активных турниров обрабатываются в порядке UUID. UPSERT принимает только большую `score_version`, поэтому дубликаты и старые события не меняют score/revision. Более новая корректировка может уменьшить score. Ошибка отправки уже закоммиченного live update логируется и не превращает успешное начисление в ошибку для повторной команды.

## Lifecycle, timer и итоги

`PLANNED`: `now < startsAt`; `ACTIVE`: `startsAt <= now < endsAt`; `FINISHED`: `now >= endsAt`. Status вычисляется через внедряемый `Clock`, не хранится устаревающим полем в БД. `endsAt > startsAt` проверяется в Java и SQL.

События применяются только к активным турнирам и с `changedAt` внутри их интервала. Активность повторно проверяется **после** получения блокировки. Событие, поступившее после окончания, игнорируется даже с прежним timestamp. Это модель cutoff по времени обработки; нет grace period/replay старых событий в завершённый турнир. Снимок не меняется после cutoff, результаты не удаляются. Транзакция, принятая до cutoff, может закончить commit после него. Новые участники автоматически добавляются при первом допустимом score event; есть и явное вступление с чтением текущего общего score.

Ответ содержит `startsAt`, `endsAt`, `secondsRemaining`, `serverTime`. Countdown до конца считает frontend; секунды округляются вверх и никогда не отрицательны. До старта время до начала можно посчитать по `startsAt`. Ежесекундных WebSocket timer-событий и scheduler для смены status нет.

При нескольких активных турнирах `/active` выбирает наиболее поздно начавшийся (затем UUID), score updates поступают во все активные турниры. Production tournament создаёт доверенный сервис через `TournamentService.create`; публичного/admin CRUD пока нет (P1).

## Таблицы и ranking

Миграция `db/migration/V300__tournaments.sql`, схема `tournament`:

- `tournaments`: UUID, name, description, starts_at, ends_at, created_at, updated_at, revision.
- `participants`: tournament_id, user_id, username (снимок display name), score, score_version, joined_at, updated_at; PK `(tournament_id,user_id)`.

FK существует на tournament. FK на пользователей появится после согласования реальной схемы Backend №2; выдуманной таблицы users нет. При объединении миграций команды согласовать номер V300 **до** первого общего deployment, не менять уже применённые миграции. На существующей БД с V300 добавляемые младшие версии потребуют согласованной стратегии Flyway, а не автоматического `out-of-order`.

Сортировка: `score DESC, updated_at ASC, user_id ASC`. Индекс имеет этот же порядок с префиксом tournament_id. Позиции последовательные (1, 2, 3), включая одинаковые score. SQL использует LIMIT/OFFSET; top3 читается отдельно, currentPlayer ищется отдельно и получает `1 + count(стоящих выше)`. Полного чтения списка в Java на каждое событие нет. Получение полного ответа работает в `REPEATABLE_READ`, чтобы top3/page/current/count принадлежали одному снимку БД. Подсчёт позиции и общего числа остаётся O(N) по данным/индексу; решение рассчитано на хакатон, не миллионы участников при высокой частоте записей.

## REST

- `GET /api/tournaments/active` → `{"active":true,"tournament":{...}}`; без активного турнира `200 {"active":false}`.
- `GET /api/tournaments/{uuid}/leaderboard?page=0&size=50` → tournament, top3, participants, currentPlayer, totalParticipants, page, size, updatedAt. `page >= 0`, `1 <= size <= 100`. Пустая страница допустима, currentPlayer сохраняется независимо от неё.
- `POST /api/tournaments/{uuid}/participants/me` → `204`, идемпотентное вступление. Входного DTO с score/userId нет. Пользователь берётся из проверенного `Principal`, общие очки — из `PlayerScoreSource`.

Ошибки tournament API: `{"code":"...","message":"..."}`. 400 INVALID_ARGUMENT/INVALID_PAGINATION, 401 AUTHENTICATION_REQUIRED, 404 TOURNAMENT_NOT_FOUND/PLAYER_NOT_FOUND, 409 TOURNAMENT_NOT_ACTIVE, 503 SCORE_SOURCE_UNAVAILABLE. Advice ограничен TournamentController и не перехватывает будущие ошибки других модулей.

## Текущий пользователь и имена

Дефолтный `CurrentPlayerResolver` читает UUID из `Principal.getName()`. Для другой auth-модели предоставьте свой bean. Сейчас auth Backend №2 отсутствует: анонимный GET разрешён, currentPlayer=null, POST join вернёт 401. Нет публичного `?currentPlayerId` или доверенного `X-User-Id`; test auth filter существует только в `src/test`.

`tournament.mask-other-player-names=true`: первые три Unicode code point чужого имени заменяются на `***`; Alexander → ***xander, Maks → ***s, имена длиной <=3 → ***. Свой display name всегда полный. Flag=false отключает masking. Анонимному зрителю все имена считаются чужими. UUID по контракту публичный: masking здесь скрывает часть display name, но не обеспечивает анонимность идентификаторов.

## Realtime

Один общий Spring STOMP endpoint `/ws` (native WebSocket, без SockJS). Subscribe:

`/topic/tournaments/{uuid}/leaderboard`

```json
{
  "type": "LEADERBOARD_UPDATE",
  "tournamentId": "e1791a36-8c57-4d8e-bf08-2c28ff0b7533",
  "revision": 7,
  "topPlayers": [{"userId":"19e20480-dddd-4a68-88cf-4ba88032d16f","position":1,"score":1200}],
  "changedPlayer": {"userId":"19e20480-dddd-4a68-88cf-4ba88032d16f","position":1,"score":1200},
  "totalParticipants": 24,
  "updatedAt": "2026-09-11T12:00:00Z"
}
```

Отправляется top20 (настраивается `live-top-size`, 3–100) и changedPlayer, даже если он за пределами top20. В broadcast нет username: это исключает утечку персонализированного ответа на общем topic. Frontend получает имена через REST. Это уведомление для обновления рейтинга: при изменении полной страницы/позиции своего пользователя нужно повторить GET, поскольку положение других участников тоже сдвигается.

Клиент подписывается, затем делает GET, буферизует ранние события и учитывает только revision больше полученной. Повторный GET после reconnect обязателен. WebSocket best effort, durable outbox/replay отсутствуют. Сравнение revision защищает от перестановки post-commit отправок при конкуренции. Для нескольких backend nodes встроенного in-memory broker недостаточно; текущий запуск — одна instance.

Подписки публичны, endpoint same-origin. Клиентские STOMP SEND запрещены, включая отправку прямо в broker `/topic`. Для существующего transport Backend №1 выставить `tournament.standalone-websocket-enabled=false` и использовать его `SimpMessagingTemplate` или bean `LeaderboardPublisher`. Сохранить аналогичную защиту от SEND в tournament topics в общем transport. Второй WebSocket stack не нужен.

## Demo

Профили `demo` или `dev`, но **никогда при активном `prod`**, включают 24 участника: Alex, Sofia, Lucky777, SkyMan, Rocket, Nika и др. В отсутствие реального PlayerScoreSource работает явно названный `DemoScoreSource` (лёгкий fake, только для демонстрации). При подключённом реальном source фиктивные пользователи не создаются: Backend №2 должен подготовить свои demo users.

Название: «Воздушная гонка». Один турнир на UTC-день, 00:00–24:00, UUID участников и турнира детерминированы. Повторный старт не сбрасывает scores/versions. Исторические турниры сохраняются. На следующем дне новый demo турнир создаётся при следующем запуске или тике включённой simulation; при отключённой simulation работающий через полночь процесс не продлевает турнир автоматически.

`tournament.demo-tournament-simulation-enabled=false` по умолчанию. При true раз в `tournament.demo-simulation-delay-ms=5000` одному demo player начисляется +50/+100/+200 через fake score event. Simulator независим от production. В automated tests scheduler выключен, проверка вызывает одну итерацию вручную. Это не доказательство интеграции реального ScoreService.

Запуск: из `backend` — `./mvnw spring-boot:run -Dspring-boot.run.profiles=demo`; PowerShell — `.\mvnw.cmd spring-boot:run '-Dspring-boot.run.profiles=demo'`. PostgreSQL берётся из корневого Compose. Чтобы включить simulation: environment `TOURNAMENT_DEMO_TOURNAMENT_SIMULATION_ENABLED=true`. Подробные команды и фактические результаты: [acceptance-tests.md](acceptance-tests.md).
