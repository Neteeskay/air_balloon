# Provably Fair: commit / reveal v1

Сервер фиксирует seed и результат до первого `ROUND_STARTED`. `RoundEngine.start`
вычисляет crash и позицию бустера существующими генераторами и записывает
`fairnessCommitment` в неизменяемый `GameRound`. При дальнейшем движении раунда
переносится именно первоначальный commitment, а не хеш пересчитанного результата.

## Что получает клиент

В ответе `POST /api/rounds` и `ROUND_STARTED.data.round` есть `fairnessCommitment`.
В `ROUND_STARTED.data.fairnessCommitment` также есть тот же хеш. Клиент должен
сохранить его вместе с roundId до окончания игры.

До падения `serverSeed`, будущий `crashMultiplier`, `canonicalInput` и reveal
отсутствуют. Будущий `boosterLevel` тоже скрыт; после фактической активации он
может отображаться. Cashout не разрешает reveal: шар ещё продолжает полёт.
Проверка выполняется одинаково для REST, realtime и replay, через явные DTO.

`GET /api/rounds/{roundId}/fairness` проверяет владельца и догоняет раунд до
серверного времени. Во время полёта:

```json
{
  "roundId": "00000000-0000-0000-0000-000000000123",
  "status": "COMMITTED",
  "commitment": "sha256:fb553c3b8fce90e8b7b024d5917254fb402b22b343ebf2cf96209cb8f6008456",
  "algorithm": "SHA-256",
  "format": "air-balloon-fairness:v1"
}
```

После CRASH/FINISHED возвращаются также `serverSeed` (строка), `crashMultiplier`,
`boosterLevel`, `verified`, `canonicalInput`. Для x1 boosterLevel отсутствует в
JSON и трактуется как `null`. Пример готового proof находится в
[`scripts/fixtures/fairness-proof.json`](../scripts/fixtures/fairness-proof.json).
`CRASH.data.fairnessReveal`, `ROUND_FINISHED.data.fairnessReveal` и финальный
`RoundView.fairnessReveal` используют этот же формат. До окончания reveal отсутствует.

## Канонические байты

Формат не зависит от JSON serializer, порядка ключей, локали или платформенных
переводов строк. Строго UTF-8, без BOM, LF (`0a`) после **каждой** строки, включая
последнюю. Фиксированный порядок:

```text
air-balloon-fairness:v1
roundId=00000000-0000-0000-0000-000000000123
serverSeed=42
crashMultiplier=8.42
boosterLevel=3
```

Правила значений:

- roundId: UUID в нижнем регистре, с дефисами.
- serverSeed: signed 64-bit decimal, без `+` и ведущих нулей. Это строка в JSON,
  чтобы JavaScript не потерял точность за пределами `Number.MAX_SAFE_INTEGER`.
- crashMultiplier: `BigDecimal.stripTrailingZeros().toPlainString()`. Например,
  `8.4200` → `8.42`, `2.0000` → `2`, `1E+3` → `1000`. Без exponent и округления.
- boosterLevel: decimal integer или буквальные четыре символа `null` для x1.

Типы допускают только ограниченный алфавит, поэтому разделители не могут попасть
в значение. Не добавлять пробелы, CRLF, кавычки, JSON-скобки или дополнительный LF.

```text
commitment = "sha256:" + lowercaseHex(SHA-256(UTF8(canonicalInput)))
```

Хеш примера выше:
`sha256:fb553c3b8fce90e8b7b024d5917254fb402b22b343ebf2cf96209cb8f6008456`.
Java и независимый Node.js verifier проверяют один и тот же golden vector.

## Проверка и демонстрация

Не доверять одному полю `verified=true` от сервера. Построить canonical input
заново из полей reveal, вычислить SHA-256 и сравнить с **сохранённым при старте**
commitment. Замена результата вместе с новым хешем не должна заменять исходный хеш.

Без запущенного backend, из корня репозитория, Node.js 18+:

```powershell
node scripts/verify-fairness.mjs --demo
node --test scripts/verify-fairness.test.mjs
```

Демо выводит:

```text
original: VERIFIED
tampered result: NOT VERIFIED
```

Для реального demo-раунда сохранить ответ fairness endpoint после завершения
в `proof.json` и передать исходный commitment вторым аргументом:

```powershell
node scripts/verify-fairness.mjs proof.json 'sha256:<сохранённый-при-старте-хеш>'
```

Скрипт возвращает exit code 0 при успешной проверке, 1 при несовпадении или
невалидном вводе. Он не использует серверные `verified` и `canonicalInput` как
доказательство. Изменение seed, crash, booster или roundId даёт NOT VERIFIED.

## Determinism и границы гарантии

Crash distribution заменена на house-edge piecewise-модель из
[`crash-math-model.md`](crash-math-model.md). NORMAL seed source, FIXED_SEED и
salted seed derivation не изменены. Одинаковые seed/config, theme и booster дают
одинаковые `U` и результат новой формулы. При одинаковом roundId и данных хеш
одинаков; разные roundId намеренно дают разные commitments даже в FIXED_SEED.

Это упрощённое доказательство неизменности заранее зафиксированных seed и
результата. Verifier проверяет canonical commitment reveal-полей; он не пересчитывает
`U` и crash только из seed, потому что v1 payload не включает config/theme/booster.
Он не доказывает беспристрастный выбор seed, распределение вероятностей или
неизменность конфигурации. Client seed / multi-party entropy здесь нет.
Существующий seed имеет 64 бита, генераторы остались прежними. FIXED_SEED с известным
seed предсказуем по определению и допускается только в dev/demo/test.

Внутренние `GameRound`, `GameEvent` и `RoundCheckpoint` содержат секреты; их нельзя
отдавать клиенту или логировать целиком. Их durable-хранение и доступ к нему
относятся к Backend №2. Retention финальных proof описан в
[reconnect-recovery.md](reconnect-recovery.md).
