# Crash math: контракт будущей Admin UI

Backend versioned config имеет один набор canonical-полей. Изменение создаёт новую
версию без рестарта. Активный раунд остаётся на своём snapshot; новая версия
применяется только к новым раундам.

| Поле | Тип | Допустимое значение | Смысл и эффект | Restart | Active round | New rounds |
| --- | --- | --- | --- | --- | --- | --- |
| `alpha` | decimal | `0 <= alpha < 1` | House edge; увеличивает вероятность немедленного crash и пропорционально уменьшает survival | NO | NO | YES |
| `minCrashMultiplier` | decimal, scale <=4 | `> 0`; для переменного диапазона `<= 1` | Результат ветки `U < alpha`; текущий product default x1 | NO | NO | YES |
| `maxCrashMultiplier` | decimal, scale <=4 | `>= minCrashMultiplier`, `<= 1000000` | Технический верхний clamp | NO | NO | YES |

UI не должна отправлять синонимы `distributionParameter` или `houseEdge`: source
of truth — только `alpha`. Эти поля не публикуются player catalog.

Для preview при target в применимой области:

```text
P(X >= 2)  = (1 - alpha) / 2
P(X >= 5)  = (1 - alpha) / 5
P(X >= 10) = (1 - alpha) / 10
```

При `alpha=0.03`: 48.5%, 19.4%, 9.7% соответственно.
