# Authoritative crash math model

Эта модель является единственной crash distribution для новых раундов.
Предыдущая степенная формула deprecated и допустима только как описание
исторических snapshot, где crash уже был вычислен и сохранён.

## Формула

Сервер получает `U ~ Uniform[0,1)` из существующего salted deterministic stream:

```text
if U < alpha:
    X = minCrashMultiplier
else:
    X = (1 - alpha) / (1 - U)

X_final = min(X, maxCrashMultiplier)
```

Равенство `U == alpha` относится ко второй ветке. `alpha` — house edge и должно
удовлетворять `0 <= alpha < 1`. `minCrashMultiplier > 0`,
`maxCrashMultiplier >= minCrashMultiplier`. Для переменного диапазона текущий
product contract ограничивает min значением не выше x1: без этого строгая
piecewise-формула могла бы вернуть результат ниже configured min. `min=max`
сохраняет существующий deterministic fixed-range режим demo/test.

Внутренние decimal-операции используют `BigDecimal` и `MathContext.DECIMAL128`.
После `maxMultiplier` clamp сервер применяет `setScale(4, RoundingMode.DOWN)`.
Именно это значение сохраняется, входит в fairness commitment/reveal и становится
authoritative crash result. После рестарта оно не генерируется повторно.

## Вероятности

Для применимой области `1 <= x <= maxCrashMultiplier`, до эффекта верхнего clamp:

```text
P(X >= x) = (1 - alpha) / x
```

При `minCrashMultiplier=1` непосредственная атомарная масса на x1 равна `alpha`
до эффекта output precision. Для ставки `B` и фиксированного допустимого target x
теоретическое ожидание выплаты равно `B × (1-alpha)`, прибыли — `-B × alpha`.

## Determinism и fairness

Production seed создаётся серверным cryptographic source, FIXED_SEED разрешён
только в demo/test. Смешивание seed и независимые salts crash/booster не менялись.
Одинаковые seed, theme, selected booster и config дают одинаковые `U` и `X_final`.
Commitment фиксирует уже округлённый crash и booster level до `ROUND_STARTED`;
reveal появляется только после crash.

Исторические активные раунды продолжают использовать сохранённые crash/config
snapshot. Legacy-маркер snapshot существует только для чтения таких данных;
`CrashPointGenerator` не позволяет создать с ним новый результат.
