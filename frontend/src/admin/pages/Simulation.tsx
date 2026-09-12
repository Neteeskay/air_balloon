import { useCallback, useEffect, useMemo, useState } from 'react'
import { LineChart } from '../chart'
import { AdminClient } from '../client'
import { number } from '../format'
import { seedFromString, simulateGames, survival, theoreticalCurve } from '../math'
import type { CrashParams, SimulationResult } from '../math'
import type { GameConfiguration } from '../types'

const MAX_GAMES = 1_000_000
const MONEY = 'бонусов'

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
    if (!paramsValid) { setRunError('Проверьте переопределения параметров модели.'); return }
    if (invalidGames || invalidBet || invalidTarget) { setRunError('Проверьте значения: N, ставка и целевой множитель должны быть корректными.'); return }
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
    ? [{ name: `Теория P(X ≥ x) = (1 − α)/x, α = ${effectiveParams.alpha}`, color: '#246b50', points: theoreticalCurve(effectiveParams) }]
    : [], [effectiveParams])

  const empiricalSeries = useMemo(() => result
    ? [{ name: `Фактическая симуляция (N = ${result.games})`, color: '#2f6fa8', points: result.empirical }]
    : [], [result])

  const theoreticalWinRate = effectiveParams && Number.isFinite(targetN) ? survival(targetN, effectiveParams.alpha) : null

  if (loadError) return <div className="admin-error">{loadError} <button className="admin-link-button" onClick={reload}>Повторить</button></div>
  if (!config) return <div className="admin-loading">Загружаем активную конфигурацию…</div>
  return <div>
    <div className="admin-page-head"><div><p className="admin-eyebrow">ИССЛЕДОВАНИЕ МОДЕЛИ</p><h1>Симуляция N игр</h1>
      <p className="admin-hint">Для каждой игры генерируется точка краша X по математической модели, затем рассчитывается финансовый результат стратегии «выйти при множителе target».</p></div></div>
    <div className="admin-sim-layout">
      <section className="admin-card admin-mb-16">
        <h2 className="admin-card-title">Параметры симуляции</h2>
        <div className="admin-sim-form">
          <label className="admin-form-label"><span>N — количество игр</span>
            <input type="number" min={1} max={MAX_GAMES} value={games} onChange={e => setGames(e.target.value)} />
            {invalidGames && <small className="admin-hint admin-hint-error">От 1 до {number(MAX_GAMES)}.</small>}
            {Number.isFinite(gamesN) && gamesN > 200_000 && <small className="admin-hint">Запуск может занять несколько секунд.</small>}
          </label>
          <label className="admin-form-label"><span>Ставка на одну игру ({MONEY})</span>
            <input type="number" min={0} step="1" value={bet} onChange={e => setBet(e.target.value)} />
            {invalidBet && <small className="admin-hint admin-hint-error">Ставка должна быть больше нуля.</small>}
          </label>
          <label className="admin-form-label"><span>Целевой множитель выхода</span>
            <input type="number" min={1.01} step="0.05" value={cashoutTarget} onChange={e => setCashoutTarget(e.target.value)} />
            {invalidTarget && <small className="admin-hint admin-hint-error">Множитель должен быть больше 1.</small>}
            {!invalidTarget && targetAboveMax && <small className="admin-hint admin-hint-error">Выше максимума модели ({effectiveParams!.maxMultiplier}) — выигрышных игр не будет.</small>}
          </label>
          <label className="admin-form-label"><span>Seed (необязательно)</span>
            <input type="text" value={seed} onChange={e => setSeed(e.target.value)} placeholder="пусто = случайно" />
            <small className="admin-hint">Одинаковый seed даёт одинаковый результат симуляции.</small>
          </label>
        </div>
        <div className="admin-editor-controls">
          <button className="admin-primary" onClick={run}>Запустить симуляцию</button>
        </div>
        {runError && <div role="alert" className="admin-error">{runError}</div>}
      </section>
      <section className="admin-card admin-mb-16">
        <div className="admin-card-head"><h2 className="admin-card-title">Конфигурация математической модели</h2>
          <span className="admin-pill">ревизия #{config.revision}</span></div>
        <dl className="admin-fields admin-fields-3 admin-mb-20">
          <div className="admin-field-row"><dt>Alpha</dt><dd>{number(effectiveParams?.alpha ?? config.crash.alpha)}</dd></div>
          <div className="admin-field-row"><dt>Min crash multiplier</dt><dd>{effectiveParams?.minCrashMultiplier ?? config.crash.minCrashMultiplier}</dd></div>
          <div className="admin-field-row"><dt>Max multiplier</dt><dd>{effectiveParams?.maxMultiplier ?? config.crash.maxMultiplier}</dd></div>
        </dl>
        <div className="admin-sim-exp">
          <h3 className="admin-section-label">Эксперимент без активации<small>оставьте пустым — используется активная версия</small></h3>
          <div className="admin-sim-form admin-sim-form-3">
            <label className="admin-form-label"><span>α (переопределение)</span>
              <input type="number" min={0} max={1} step="0.01" value={overrideAlpha} onChange={e => setOverrideAlpha(e.target.value)} placeholder={String(config.crash.alpha)} />
            </label>
            <label className="admin-form-label"><span>Min crash multiplier</span>
              <input type="number" min={0} step="0.1" value={overrideMinCrashMultiplier} onChange={e => setOverrideMinCrashMultiplier(e.target.value)} placeholder={String(config.crash.minCrashMultiplier)} />
            </label>
            <label className="admin-form-label"><span>Max multiplier</span>
              <input type="number" min={1} step="1" value={overrideMaxMultiplier} onChange={e => setOverrideMaxMultiplier(e.target.value)} placeholder={String(config.crash.maxMultiplier)} />
            </label>
          </div>
          <p className="admin-hint">Чтобы изменения применились к самой игре, сохраните и активируйте их в разделе «Конфигурация». Новая симуляция подхватит новую активную ревизию — так можно сравнить результат до и после изменения параметров.</p>
        </div>
      </section>
    </div>
    {result ? <section className="admin-card admin-mb-16">
      <div className="admin-card-head"><h2 className="admin-card-title">Финансовый результат</h2>
        <span className={`admin-verdict admin-verdict-${result.verdict}`}>{result.verdict === 'plus' ? 'Плюс' : result.verdict === 'minus' ? 'Минус' : 'Ноль'}</span></div>
      <dl className="admin-fields admin-fields-3">
        <div className="admin-field-row"><dt>Количество игр</dt><dd>{number(result.games)}</dd></div>
        <div className="admin-field-row"><dt>Размер ставки</dt><dd>{number(result.bet)} {MONEY}</dd></div>
        <div className="admin-field-row"><dt>Общая сумма ставок</dt><dd>{number(result.totalStakes)} {MONEY}</dd></div>
        <div className="admin-field-row"><dt>Общая сумма выплат</dt><dd>{number(result.totalPayouts)} {MONEY}</dd></div>
        <div className="admin-field-row"><dt>Итоговый результат = выплаты − ставки</dt><dd className={result.netResult > 0 ? 'admin-pos' : result.netResult < 0 ? 'admin-neg' : 'admin-neu'}>{result.netResult > 0 ? '+' : ''}{number(result.netResult)} {MONEY}</dd></div>
        <div className="admin-field-row"><dt>Средний результат на игру</dt><dd>{result.averageNet} {MONEY}</dd></div>
        <div className="admin-field-row"><dt>Выигрышные игры (X ≥ {result.cashoutTarget})</dt><dd>{number(result.winCount)} из {number(result.games)} · {((result.winCount / result.games) * 100).toFixed(2)}%</dd></div>
        <div className="admin-field-row"><dt>Теоретическая вероятность выигрыша</dt><dd>{theoreticalWinRate !== null ? `${(theoreticalWinRate * 100).toFixed(2)}%` : '—'}</dd></div>
        <div className="admin-field-row"><dt>Вердикт</dt><dd>{result.verdict === 'plus' ? 'Игрок в плюсе' : result.verdict === 'minus' ? 'Игрок в минусе' : 'Нулевой результат'}</dd></div>
      </dl>
    </section> : <section className="admin-card admin-mb-16">
      <div className="admin-loading">Запустите симуляцию, чтобы увидеть финансовый результат и график.</div>
    </section>}
    <section className="admin-card">
      <div className="admin-card-head"><h2 className="admin-card-title">Результаты N игр и теоретическая зависимость</h2></div>
      <LineChart height={340} xLabel="X — множитель" yLabel="P(X ≥ x)" series={[...theoreticalSeries, ...empiricalSeries]} />
      <p className="admin-hint admin-mt-12">Теоретическая линия строится по формуле P(X ≥ x) = (1 − α) / x. Эмпирическая кривая — доля игр симуляции, где точка краша X ≥ x. С ростом N эмпирическая кривая приближается к теоретической.</p>
    </section>
  </div>
}