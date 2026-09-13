# Reconnect, replay и recovery

## Authoritative snapshot

`GET /api/rounds/{roundId}` проверяет владельца и под блокировкой существующего
раунда догоняет его до серверного времени. Refresh / reconnect не запускает
новый раунд, не списывает ставку и не выполняет повторный cashout.
Отключение WebSocket не управляет жизненным циклом Game Engine.

Snapshot сохраняет прежние поля и добавляет:

| Поле | Значение |
| --- | --- |
| `id`, `roundId` | Один UUID; `id` сохранён для совместимости |
| `status`, `theme`, `betAmount`, `boosterMultiplier` | Исходная ставка и текущий статус |
| `currentMultiplier`/`effectiveMultiplier`, `flightMultiplier`, `currentLevel`, `roundScore` | Авторитетное состояние; flight управляет физическим прогрессом и crash, effective — отображением и cashout |
| `boosterActivated`, `boosterLevel` | Позиция x2/x3/x4 видна из стартового snapshot; activation меняет только состояние и очки; x1 не имеет позиции |
| `cashoutPerformed`, `cashoutMultiplier`, `winAmount`, `cashoutAt` | Зафиксированная выплата |
| `startedAt`, `timestamp`, `serverTime` | Начало, время состояния, время ответа |
| `sequence` | Последняя применённая последовательность в snapshot |
| `fairnessCommitment` | Исходный commitment |
| `crashMultiplier`, `outcome`, `finishedAt`, `fairnessReveal` | Финальные данные после падения/завершения |

Финальный result представлен существующим `outcome=LOSS|CASHED_OUT` вместе с
winAmount/cashout-полями. После cashout status остаётся CASHED_OUT до реального
crash; multiplier продолжает расти, но выплата, cashoutMultiplier и cashoutAt
уже не меняются. При reconnect после crash достаточно snapshot: ждать прошедший
realtime event не требуется.

`timestamp` — логическое время изменения состояния/границы, `serverTime` — время,
когда сервер сформировал событие или REST-ответ. При позднем tick событие уровня
может иметь timestamp=00:00:02 и serverTime=00:00:10. Replay сохраняет исходный
serverTime события; envelope replay-ответа имеет свежее время запроса.
Для анимации использовать серверную пару multiplier/timestamp и оценку смещения
по serverTime и RTT. Локальный Date.now() не определяет cashout или crash.

## Sequence и reconnect-протокол

Каждое игровое событие имеет `roundId`, `sequence`, `eventId`, `timestamp`,
`serverTime`, `type`, `data`. `sequence` начинается с 1 и увеличивается ровно на 1
на каждое событие данного раунда, включая ticks. `eventId = roundId + ":" + sequence`.
Повторная доставка после сбоя адаптера использует тот же eventId и serverTime.
`CONNECTION_READY` — служебное подтверждение соединения, не событие раунда.

Порядок восстановления frontend:

1. Открыть `/ws/rounds`, дождаться CONNECTION_READY и начать буферизовать события.
2. Получить GET snapshot нужного roundId.
3. Полностью восстановить UI из snapshot и установить cursor=snapshot.sequence.
4. Отбросить буферные события другого раунда и события `sequence <= cursor`.
5. Применять последующие события по sequence. Если есть разрыв, получить replay
   или новый snapshot; не вычислять отсутствующие business effects на клиенте.
6. При FINISHED показать result/reveal сразу и прекратить ожидание продолжения.

Открытие socket **перед** snapshot закрывает окно потери событий между двумя
операциями. Пример `EventCursor` в domain демонстрирует классификацию:
при исходном cursor=9: 10→ACCEPT, 12→GAP, 11→STALE. GAP продвигает high-water,
но запрещает слепое применение delta: reducer должен resync и заменить cursor
последовательностью полученного snapshot. Повтор 12 тоже STALE.
Это серверный контракт и тестовый helper; frontend в этой задаче не переписывался.

## Ограниченный replay

```http
GET /api/rounds/{roundId}/events?afterSequence=15
```

Ответ:

```json
{
  "roundId": "00000000-0000-0000-0000-000000000123",
  "events": [],
  "oldestAvailableSequence": 1,
  "latestSequence": 15,
  "snapshotRequired": false,
  "serverTime": "2026-09-11T00:00:10Z"
}
```

Возвращаются только события с `sequence > afterSequence`, в возрастающем порядке,
с тем же DTO, что и WebSocket. Владелец проверяется до чтения/догоняния раунда.
Отрицательный или нечисловой cursor: 400. Cursor впереди сервера, потерянное начало
буфера, истёкший replay или отсутствующий tail: `snapshotRequired=true`.
В этом случае tail может быть неполным; UI нужно восстановить через snapshot.

Храним последние 256 **всех** событий, включая ticks, чтобы разрывы были явными.
Конфигурация `game.resilience.replay-limit` допускает 1–500. Это bounded tail,
а не архив полного раунда. При 10 ticks/s окно обычно около 25 секунд и короче
при дополнительных событиях. Запрос replay может сам догнать состояние, как GET.

Порт `RoundEventStore`: `append`, `findAfter`, `latest`, `markFinished`, `cleanup`.
`InMemoryRoundEventStore` блокирует только буфер конкретного roundId, дедуплицирует
по sequence и сохраняет последнее событие как high-water для recovery.

## Recovery-контракт Backend №2

Порт `ActiveRoundStateStore`: `saveCheckpoint`, `load`, `activeRoundIds`,
`markFinished`, `cleanup`. В `test/dev` используется `InMemoryActiveRoundStateStore`,
а общий backend хранит checkpoints и replay JSONB в PostgreSQL.
`RoundCheckpoint.version=1`
фиксирует модель состояния/алгоритмов этой версии. Включает:

- Полный immutable `GameRound`: roundId/owner, seed, исходный commitment, crash,
  boosterLevel, theme/bet, полный config snapshot, startedAt и временные границы.
- status, currentMultiplier/currentLevel, roundScore, boosterActivated, cashout
  и win state, sequence. Уровни пересекаются последовательно: currentLevel задаёт
  crossedLevels=1..currentLevel; повторно начислять их не нужно.
- `pendingEvents`: незавершённая партия для повторения внешних эффектов.
- Успешный `cashoutKey` и первоначальный `cashoutResult` для повторов команды.

Checkpoint записывается перед эффектами каждой transition-партии, содержащей
ROUND_STARTED, LEVEL_REACHED, BOOSTER_ACTIVATED, CASHOUT_SUCCESS, CRASH или
ROUND_FINISHED. Одна партия может включать несколько границ при позднем tick.
После успешной обработки записывается подтверждение с пустым pendingEvents.
Обычный MULTIPLIER_UPDATE не создаёт checkpoint write. Существующий RoundRepository
по-прежнему получает актуальные snapshots, а RoundEventStore получает каждый event.

Алгоритм `GameService.recover(owner, roundId)`:

1. Если session существует, использовать её. Иначе создать единственную session
   из checkpoint под атомарным compute по roundId, проверив owner и версию/proof.
2. При наличии pendingEvents повторить сохранение snapshot, append в event store,
   идемпотентные credit/reward и публикацию **тех же** событий. Не пересчитывать выигрыш.
3. Если checkpoint уже подтверждён, загрузить более новый tail snapshot из
   RoundEventStore. Это сохраняет high-water ticks, которых нет в checkpoint:
   уже виденные клиентом eventId не будут использованы повторно.
4. Вызвать существующий `RoundEngine.advance` со старым config и текущим серверным
   временем. Пройти пропущенные границы; после downtime раунд может сразу FINISH.
5. Подтвердить эффекты и освободить session при FINISHED.

Durable implementation сохраняет checkpoint **до** подтверждения
побочных эффектов, а high-water event — **до** realtime-публикации. Удалять active
tail нельзя. Persistent адаптеры должны сохранять согласованный checkpoint/outbox
и high-water, поддерживать монотонные upsert и одного владельца раунда. Только
замены RoundRepository на PostgreSQL недостаточно. Backend №2 организует поиск
recoverable roundId при старте и вызывает recover до запуска очередного ticker.

`BalanceService.creditWin` остаётся идемпотентным по roundId; `RewardService` — тоже.
Ответ адаптера может потеряться после commit: эффект будет повторно вызван, но
ledger/rewards должны применить его один раз. Realtime имеет at-least-once delivery:
клиент дедуплицирует eventId. Replay/GET никогда не запускают новую business-команду.

Порты доступны как Spring beans с `ConditionalOnMissingBean`: durable adapter
подставляется через DI. Новый конструктор GameService принимает оба порта явно;
старый конструктор сохранён с memory defaults для существующих embedders/tests.

## Cashout idempotency

Необязательный `Idempotency-Key: <UUID>` в прежнем POST cashout. Область ключа —
owner + roundId + cashout. Первый успешный результат фиксируется, одинаковый key
возвращает его повторно, в том числе после FINISHED или recovery. serverTime ответа
будет свежим, остальные данные — от первоначального cashout; актуальный статус
нужно получить через GET. Другой key или отсутствие key сохраняют прежние 409.
Ошибочные cashout-команды не кешируются. Невалидный UUID даёт 400.

Хранится только один успешный key на раунд, вместе с checkpoint; бесконечного
словаря запросов нет. Гарантия действует в пределах finished-retention (24h по
умолчанию). Это не заменяет ledger idempotency Backend №2.

## Scheduler, cleanup и наблюдаемость

Production ticker раз в game.tick-millis передаёт каждый round независимому
virtual thread. Atomic флаг разрешает максимум одну scheduler-задачу на round;
при долгом вызове повторные ticks не создают очередь. Исключение одного round
логируется и не останавливает другие. Business lock остаётся отдельным на round.
Для тестов сохранён синхронный tickAll; production использует вариант с executor.

После FINISHED и успешных эффектов session удаляется немедленно: освобождаются
lock, retry queue и active reference. Индивидуальных периодических timer tasks
нет, поэтому отменять timer для каждого шара не требуется. Завершённый round больше
не попадает в dispatch; уже запущенный tick после удаления становится no-op.
При завершении приложения executor закрывается через lifecycle bean.

| Настройка | По умолчанию | Политика |
| --- | --- | --- |
| `game.resilience.replay-limit` | 256 | Событий на round, максимум 500 |
| `game.resilience.replay-retention` | 15m | После успешного FINISHED |
| `game.resilience.finished-retention` | 24h | Финальные snapshots, proof и checkpoints/idempotency |
| `game.resilience.cleanup-millis` | 30000 | Период уборки |

GET не продлевает retention. Активные/ожидающие интеграции rounds не удаляются по
TTL. Cleanup работает при включённом scheduler; при ручном управлении движком
хост вызывает `GameService.cleanup()`. Retention физически очищается периодически.
После истечения finished history доступ к раунду возвращает 404. Durable repository
может использовать собственную политику истории через optional cleanup hook.

INFO logs на START/CASHOUT/BOOSTER/CRASH/FINISHED содержат event, roundId, sequence,
status; отклонённый cashout — roundId/code. Seed и полные snapshots не логируются.
Actuator в проекте отсутствует, monitoring stack не добавлен. `activeRoundCount()`
доступен для будущего gauge (включает раунды с ожидающими эффектами).

## Ограничения и доказательства

Memory-адаптеры теряют данные при настоящем завершении JVM. PostgreSQL adapters
`PostgresActiveRoundStateStore` и `PostgresRoundEventStore` переживают рестарт;
startup runner перечисляет активные roundId и восстанавливает их без клиентского GET.
Recovery tests
имитируют замену процесса новой service instance с сохранившимися stores и
проверяют JSON round-trip checkpoint; это проверка контракта/алгоритма, не durable
хранилище. Старый owner должен быть остановлен до восстановления. Межпроцессного
fencing, распределённых locks и cross-store transactions здесь нет. Атомарность
start/debit и durable ledger/outbox относятся к Backend №2.

`ReconnectIT` использует настоящий HTTP/WebSocket и production scheduler с
управляемым server Clock. Проверены отключение, refresh после уровня/бустера,
reconnect после cashout и после crash. `RecoveryTest` проверяет config/sequence,
ambiguous payout/event failures, write-ahead и checkpoint serialization.
`ReliabilityTest` проверяет 100 параллельных rounds, 100 seed-сценариев, медленный
и падающий consumer. `ReplayCleanupTest` проверяет gaps, порядок 10/12/11, TTL,
отсутствие ticks после FINISHED и конкурентный idempotent cashout.
