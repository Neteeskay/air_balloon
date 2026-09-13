# Authoritative crash math model

Эта модель является единственной crash distribution для новых раундов
(`HOUSE_EDGE_V2`). Предыдущая piecewise-модель (`HOUSE_EDGE_V1`) deprecated и
допустима только для чтения исторических snapshot, где crash уже вычислен и
сохранён (маркер `LEGACY_POWER_SNAPSHOT` для ещё более старых данных).

## Формула

Сервер получает `U ~ Uniform[0,1)` из существующего salted deterministic stream:

```text
p = 1 / (1 - alpha)

X = [ U * maxCrashMultiplier^(-p) + (1 - U) * minCrashMultiplier^(-p) ] ^ (-1 / p)
X_final = setScale(4, RoundingMode.DOWN)
```

Это непрерывное усечённое распределение Парето на отрезке
`[minCrashMultiplier, maxCrashMultiplier]`. Отображение `[0,1) -> [min, max]`
монотонно и **не содержит вероятностных атомов на нижней границе**: `U=0` даёт
ровно `min`, жёсткой массы на `minMultiplier` нет. Верхняя граница достижима:
самая верхняя полоса floor4 `[max - 0.0001, max)` округляется вверх до
`maxCrashMultiplier` (например, `99.9999... -> 100.0000`). Масса этой полосы
мала (доли процента и меньше), поэтому гистограмма сохраняет непрерывный вид
без «клэмп-пика» на максимуме.

`alpha` — параметр наклона (form/shape) и house edge, `0 <= alpha < 1`:
чем ближе к 1, тем сильнее кривая смещена к низким множителям и тем ниже
выплаты. При `alpha=0` (`p=1`) модель сводится к гармоническому хвосту
`X = 1 / (U/max + (1-U)/min)`. `minCrashMultiplier > 0`,
`maxCrashMultiplier >= minCrashMultiplier`; product contract по-прежнему
ограничивает переменный диапазон `min <= 1`. `min=max` сохраняет существующий
deterministic fixed-range режим demo/test.

Для дробного `p` Java-`BigDecimal` не умеет возводить в степень, поэтому
вычисление ведётся в `double` (IEEE-754, >= 15 значащих цифр) и один раз
округляется вниз `floor4`. Именно это значение сохраняется, входит в
fairness commitment/reveal и становится authoritative crash result. После
рестарта оно не генерируется повторно.

## Вероятности

Для применимой области `min <= x <= maxCrashMultiplier`:

```text
P(X >= x) = (x^-p - maxCrashMultiplier^-p)
            / (minCrashMultiplier^-p - maxCrashMultiplier^-p)
```

Границы: `P(X >= min) = 1`, `P(X >= max) = 0` в непрерывной модели; из-за
перевода верхней floor4-полосы в `max` у точки `max` появляется крошечная
дискретная масса `P(X = max) = P(X >= max - 0.0001)`, которая при практических
значениях параметров пренебрежимо мала.
Для ставки `B` и фиксированного допустимого target `t` теоретическое ожидание
выплаты равно `B × t × P(X >= t)`, прибыли — `B × (t × P(X >= t) - 1)`.

## Determinism и fairness

Production seed создаётся серверным cryptographic source, FIXED_SEED разрешён
только в demo/test. Смешивание seed и независимые salts crash/booster не менялись.
Одинаковые seed, theme, selected booster и config дают одинаковые `U`, `X_final`.
Commitment фиксирует уже округлённый crash и booster level до `ROUND_STARTED`;
reveal появляется только после crash.

Исторические активные раунды продолжают использовать сохранённые crash/config
snapshot. Legacy-маркеры snapshot существуют только для чтения таких данных;
`CrashPointGenerator` не позволяет создать с ними новый результат.