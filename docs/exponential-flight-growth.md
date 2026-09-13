# Exponential flight growth

Физический коэффициент раунда рассчитывается только из времени сервера:

```text
flightMultiplier(t) = floor4(exp(growthRate * elapsedSeconds))
t(X) = ln(X) / growthRate
```

`elapsedSeconds` отсчитывается от сохранённого `startedAt`. Поэтому одинаковые
`startedAt`, elapsed time и snapshot конфигурации дают одинаковый результат при
любом FPS, количестве тиков, задержках scheduler и reconnect. Тики определяют
только частоту публикации `MULTIPLIER_UPDATE`.

`growthRate` — существующий `multiplierGrowthRate` из Admin/config, в `1/с`.
Новая семантика сохраняет начальный наклон прежней кривой: около `t=0`
`exp(k*t) ≈ 1+k*t`, но затем скорость плавно увеличивается.

Для production default `growthRate=0.2/с` pacing выглядит так:

| Multiplier | Старая linear, c | Новая exponential, c |
| ---: | ---: | ---: |
| X1.2 | 1.00 | 0.912 |
| X1.5 | 2.50 | 2.028 |
| X2 | 5.00 | 3.466 |
| X3 | 10.00 | 5.494 |
| X5 | 20.00 | 8.048 |
| X10 | 45.00 | 11.513 |
| X20 | 95.00 | 14.979 |
| X50 | 245.00 | 19.561 |
| X100 | 495.00 | 23.026 |

Значения новой модели округлены вверх до первой серверной миллисекунды, на
которой scale-4 `flightMultiplier` действительно пересекает границу.

Уровни не имеют фиксированных X. Для активного `maxCrashMultiplier = maxX`
backend строит `N` thresholds логарифмически: `T_i = maxX^(i/N)` (GREEN N=9,
RED N=12), с canonical scale 4 и прямым присваиванием `T_N = maxX`. Поэтому
последний уровень всегда совпадает с потолком текущей конфигурации, а времена
достижения уровней равномерны на идеальной exponential-кривой. Эти thresholds
попадают в catalog и round snapshot; изменение Admin-конфигурации влияет только
на новые раунды.

Crash point по-прежнему генерируется и фиксируется до старта раунда. Экспонента
не участвует в RNG, truncated-Pareto, alpha/house edge или commitment/reveal —
она меняет только time-to-X. При пересечении между тиками engine публикует crash
ровно на precommitted X, а все level thresholds ниже либо равные crash обрабатывает
по порядку; если crash совпадает с последним threshold, сначала публикуется этот
`LEVEL_REACHED`, затем `CRASH`. Booster на самой crash-границе не активируется.

Booster применяется только к `effectiveMultiplier/currentMultiplier`, то есть к
отображению, cashout и payout. Balloon, level track, thresholds и crash comparison
используют `flightMultiplier`. После cashout физический полёт продолжается по той
же кривой до crash.
