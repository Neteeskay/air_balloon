import { useCallback, useEffect, useMemo, useState } from 'react'
import { LineChart, HistogramChart } from '../chart'
import { AdminClient } from '../client'
import { number } from '../format'
import { seedFromString, simulateGames, survival, theoreticalCurve } from '../math'
import type { CrashParams, SimulationResult } from '../math'
import type { GameConfiguration } from '../types'

const MAX_GAMES = 1_000_000
const MONEY = 'бонусов'
const THEORY_COLOR = '#d97706'
const EMPIRIC_COLOR = '#2f6fa8'

const parseOr = (value: string, fallback: number) => {
  const trimmed = value.trim()
  if (trimmed === '') return fallback
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : NaN
}

export function Simulation({ client }: { client: AdminClient }) {
  const [config, setConfig] = useState<GameConfiguration | null>(null)
  const [loadError, setLoadError] = useState('')
  const [games, setGames] = useState('1000')
  const [bet, setBet] = useState('10')
  const [cashoutTarget, setCashoutTarget] = useState('2')
  const [seed, setSeed] = useState('')
  const [overrideAlpha, setOverrideAlpha] = useState('')
  const [overrideMaxMultiplier, setOverrideMaxMultiplier] = useState('')
  const [overrideMinCrashMultiplier, setOverrideMinCrashMultiplier] = useState('')
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [runError, setRunError] = useState('')

  const reload = useCallback(() => {
    setLoadError(''); setResult(null)
    client.getCurrent()
      .then(setConfig)
      .catch(e => setLoadError((e as Error).message))
  }, [client])
  useEffect(() => {
    client.getCurrent()
      .then(setConfig)
      .catch(e => setLoadError((e as Error).message))
  }, [client])

  const effectiveParams = useMemo((): CrashParams | null => {
    if (!config) return null
    const alpha = parseOr(overrideAlpha, config.crash.alpha)
    const maxMultiplier = parseOr(overrideMaxMultiplier, config.crash.maxMultiplier)
    const minCrashMultiplier = parseOr(overrideMinCrashMultiplier, config.crash.minCrashMultiplier)
    if ([alpha, maxMultiplier, minCrashMultiplier].some(v => Number.isNaN(v))) return null
    return { alpha, maxMultiplier, minCrashMultiplier }
  }, [config, overrideAlpha, overrideMaxMultiplier, overrideMinCrashMultiplier])

  const gamesN = parseOr(games, NaN)
  const betN = parseOr(bet, NaN)
  const targetN = parseOr(cashoutTarget, NaN)

  const invalidGames = !Number.isFinite(gamesN) || gamesN <= 0 || gamesN > MAX_GAMES
  const invalidBet = !Number.isFinite(betN) || betN <= 0
  const invalidTarget = !Number.isFinite(targetN) || targetN <= 1
  const paramsValid = effectiveParams !== null
  const targetAboveMax = effectiveParams !== null && Number.isFinite(targetN) && targetN > effectiveParams.maxMultiplier

  const run = useCallback(() => {
    setRunError('')
    if (!paramsValid) { setRunError('Проверьте параметры модели.'); return }
    if (invalidGames || invalidBet || invalidTarget) { setRunError('Проверьте значения: количество игр, ставка и целевой множитель.'); return }
    const seedValue = seed.trim() === '' ? undefined : seedFromString(seed)
    try {
      const res = simulateGames({
        ...effectiveParams!, games: Math.round(gamesN), bet: Math.round(betN * 100) / 100,
        cashoutTarget: targetN, seed: seedValue,
      })
      setResult(res)
    } catch (e) {
      setRunError((e as Error).message)
    }
  }, [effectiveParams, paramsValid, gamesN, betN, targetN, seed, invalidGames, invalidBet, invalidTarget])

  const theoreticalSeries = useMemo(() => effectiveParams
    ? [{ name: `Теория: P(X ≥ x)`, color: THEORY_COLOR, dashed: true, points: theoreticalCurve(effectiveParams) }]
    : [], [effectiveParams])

  const empiricalSeries = useMemo(() => result
    ? [{ name: `Симуляция (${result.games.toLocaleString('ru-RU')} игр)`, color: EMPIRIC_COLOR, points: result.empirical }]
    : [], [result])

  const theoreticalWinRate = effectiveParams && Number.isFinite(targetN) ? survival(targetN, effectiveParams) : null

  if (loadError) return <div className="admin-error">{loadError} <button className="admin-link-button" onClick={reload}>Повторить</button></div>
  if (!config) return <div className="admin-loading">Загружаем активную конфигурацию…</div>
  return <div>
    <div className="admin-page-head"><div><p className="admin-eyebrow">ПРОВЕРКА МОДЕЛИ</p><h1>Симуляция</h1>
      <p className="admin-hint">Посчитаем N игр по текущей модели: сколько выигрышей, сколько проигрышей и какой итоговый результат.</p></div></div>
    <div className="admin-sim-layout">
      <section className="admin-card">
        <h2 className="admin-card-title">Что симулируем</h2>
        <div className="admin-sim-form">
          <label className="admin-form-label"><span>Количество игр</span>
            <input type="number" min={1} max={MAX_GAMES} value={games} onChange={e => setGames(e.target.value)} />
            {invalidGames && <small className="admin-hint admin-hint-error">От 1 до {number(MAX_GAMES)}.</small>}
            {Number.isFinite(gamesN) && gamesN > 200_000 && !invalidGames && <small className="admin-hint">Запуск может занять несколько секунд.</small>}
          </label>
          <label className="admin-form-label"><span>Ставка на игру ({MONEY})</span>
            <input type="number" min={0} step="1" value={bet} onChange={e => setBet(e.target.value)} />
            {invalidBet && <small className="admin-hint admin-hint-error">Ставка должна быть больше нуля.</small>}
          </label>
          <label className="admin-form-label"><span>Целевой множитель выхода</span>
            <input type="number" min={1.01} step="0.05" value={cashoutTarget} onChange={e => setCashoutTarget(e.target.value)} />
            {invalidTarget && <small className="admin-hint admin-hint-error">Множитель должен быть больше 1.</small>}
            {!invalidTarget && targetAboveMax && <small className="admin-hint admin-hint-error">Выше максимума модели ({effectiveParams!.maxMultiplier}) — выигрышей не будет.</small>}
          </label>
          <label className="admin-form-label"><span>Случайный ключ (seed)</span>
            <input type="text" value={seed} onChange={e => setSeed(e.target.value)} placeholder="необязательно" />
            <small className="admin-hint">Одинаковый ключ — одинаковый результат.</small>
          </label>
        </div>
        <div className="admin-editor-controls admin-mt-14">
          <button className="admin-primary" onClick={run} disabled={invalidGames || invalidBet || invalidTarget || !paramsValid}>Запустить симуляцию</button>
        </div>
        {runError && <div role="alert" className="admin-error admin-mt-12">{runError}</div>}
      </section>
      <section className="admin-card">
        <div className="admin-card-head"><h2 className="admin-card-title">Модель</h2><span className="admin-pill">ревизия #{config.revision}</span></div>
        <div className="admin-fields admin-fields-3">
          <div className="admin-field-row"><dt>Наклон кривой (α)</dt><dd>{number(effectiveParams?.alpha ?? config.crash.alpha)}</dd></div>
          <div className="admin-field-row"><dt>Мин. множитель</dt><dd>{effectiveParams?.minCrashMultiplier ?? config.crash.minCrashMultiplier}</dd></div>
          <div className="admin-field-row"><dt>Макс. множитель</dt><dd>×{effectiveParams?.maxMultiplier ?? config.crash.maxMultiplier}</dd></div>
        </div>
        <h3 className="admin-section-label">Попробовать другой вариант модели<small>без сохранения — поля можно оставить пустыми</small></h3>
        <div className="admin-sim-form admin-sim-form-3">
          <label className="admin-form-label"><span>Наклон кривой (α)</span>
            <input type="number" min={0} max={1} step="0.01" value={overrideAlpha} onChange={e => setOverrideAlpha(e.target.value)} placeholder={String(config.crash.alpha)} />
          </label>
          <label className="admin-form-label"><span>Мин. множитель</span>
            <input type="number" min={0} step="0.1" value={overrideMinCrashMultiplier} onChange={e => setOverrideMinCrashMultiplier(e.target.value)} placeholder={String(config.crash.minCrashMultiplier)} />
          </label>
          <label className="admin-form-label"><span>Макс. множитель</span>
            <input type="number" min={1} step="1" value={overrideMaxMultiplier} onChange={e => setOverrideMaxMultiplier(e.target.value)} placeholder={String(config.crash.maxMultiplier)} />
          </label>
        </div>
        <p className="admin-hint">Чтобы применить новый вариант к самой игре, сохраните его на вкладке «Конфигурация».</p>
      </section>
    </div>
    {result ? <>
      <div className="admin-kpis admin-mb-16">
        <div className="admin-kpi">
          <span>Итоговый результат</span>
          <strong className={result.netResult > 0 ? 'admin-pos' : result.netResult < 0 ? 'admin-neg' : 'admin-neu'}>{result.netResult > 0 ? '+' : ''}{number(result.netResult)} {MONEY}</strong>
          <small>выплаты − ставки ({result.netResult > 0 ? 'игрок в плюсе' : result.netResult < 0 ? 'игрок в минусе' : 'в ноль'})</small>
        </div>
        <div className="admin-kpi">
          <span>Потрачено на ставки</span>
          <strong>{number(result.totalStakes)} {MONEY}</strong>
          <small>сумма всех ставок за {result.games.toLocaleString('ru-RU')} игр</small>
        </div>
        <div className="admin-kpi">
          <span>Выигрышных игр</span>
          <strong>{number(result.winCount)} из {number(result.games)}</strong>
          <small>{((result.winCount / result.games) * 100).toFixed(2)}% всех игр</small>
        </div>
        <div className="admin-kpi">
          <span>Теоретическая вероятность</span>
          <strong>{theoreticalWinRate !== null ? `${(theoreticalWinRate * 100).toFixed(2)}%` : '—'}</strong>
          <small>P(X ≥ {result.cashoutTarget}) по формуле модели</small>
        </div>
      </div>
      <section className="admin-card">
        <div className="admin-card-head"><h2 className="admin-card-title">Симуляция против теории</h2></div>
        <LineChart height={320} xLabel="X — множитель" yLabel="P(X ≥ x)" total={result.games} series={[...theoreticalSeries, ...empiricalSeries]} />
        <p className="admin-hint admin-mt-12">Пунктир — теоретическая вероятность P(X ≥ x) модели (непрерывный усечённый хвост на [1, max], без атомов). Сплошная линия — доля игр симуляции, где шар добрался до x. Чем больше игр, тем ближе симуляция к теории. Наведите курсор на график — покажет долю игр и их число, добравшихся до этого множителя и выше.</p>
      </section>
      <section className="admin-card admin-mb-0">
        <div className="admin-card-head"><h2 className="admin-card-title">Распределение коэффициентов</h2></div>
        <HistogramChart data={result.histogram} total={result.games} params={result.params} />
        <p className="admin-hint admin-mt-12">Первый столбец — низкий хвост распределения; у модели нет «мгновенных крахов» (α задаёт наклон кривой, а не вероятность сразу ×1). Пунктир — теоретическая доля игр в каждом диапазоне. Наведите курсор на столбец, чтобы увидеть точное число игр.</p>
      </section>
    </> : <section className="admin-card">
      <div className="admin-loading">Запустите симуляцию — здесь появятся итоговый результат и график.</div>
    </section>}
  </div>
}