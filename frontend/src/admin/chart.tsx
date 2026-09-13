import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart as ReLineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { survival } from './math'
import type { CrashParams, HistogramData, Point } from './math'

export interface ChartSeries {
  name: string
  color: string
  dashed?: boolean
  points: Point[]
}

const VB_W = 720

function linearTicks(min: number, max: number, count: number): number[] {
  const range = max - min
  if (!Number.isFinite(range) || range <= 0) return [min, max]
  const rawStep = range / count
  const exp = Math.floor(Math.log10(rawStep))
  let step = Math.pow(10, exp)
  for (const m of [1, 2, 5, 10]) {
    if (rawStep / (step * m) <= 1) { step = step * m; break }
  }
  const ticks: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step / 2; v += step) {
    const rounded = Math.round(v * 1e6) / 1e6
    if (rounded >= min - 1e-9 && rounded <= max + 1e-9) ticks.push(rounded)
  }
  return ticks
}

function logTicks(min: number, max: number): number[] {
  const ticks: number[] = []
  const mantissas = [1, 2, 5]
  const decadeFloor = Math.floor(Math.log10(min))
  for (let decade = decadeFloor; Math.pow(10, decade) <= max * 1.0001; decade++) {
    const base = Math.pow(10, decade)
    for (const m of mantissas) {
      const v = base * m
      if (v >= min - 1e-9 && v <= max + 1e-9) ticks.push(Math.round(v * 1e6) / 1e6)
    }
  }
  if (!ticks.includes(min)) ticks.unshift(min)
  if (!ticks.includes(max)) ticks.push(max)
  return ticks.sort((a, b) => a - b)
}

/** Responsive chart width: falls back to a fixed value until the DOM reports a size. */
function useContainerWidth(fallback = VB_W): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(Math.max(120, el.clientWidth || fallback))
    measure()
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      ro.observe(el)
    }
    return () => ro?.disconnect()
  }, [fallback])
  return [ref, width]
}

const formatX = (x: number) => (x < 10 ? x.toFixed(1) : Number.isInteger(x) ? String(x) : x.toFixed(1))

/** Percent with enough precision that tiny shares don't collapse to 0%. */
const formatY = (y: number) => {
  if (!Number.isFinite(y)) return '—'
  const pct = y * 100
  if (pct <= 0) return '0%'
  if (pct >= 10) return `${Math.round(pct)}%`
  if (pct >= 1) return `${pct.toFixed(1)}%`
  if (pct >= 0.1) return `${pct.toFixed(2)}%`
  return `${pct.toFixed(3)}%`
}

/** Horizontal grid + axis label styles shared by all recharts charts. */
const AXIS_TICK = { fontSize: 11, fill: '#6B7280' }
const AXIS_LABEL = { fill: '#111827', fontSize: 12, fontWeight: 500 }

export function LineChart({
  series,
  height = 370,
  xLabel = 'X — множитель',
  yLabel = 'P(X ≥ x)',
  logX = true,
  showLegend = true,
  total,
}: {
  series: ChartSeries[]
  height?: number
  xLabel?: string
  yLabel?: string
  logX?: boolean
  showLegend?: boolean
  /** Number of games behind the empirical series — enables the «N игр» in the hover tooltip. */
  total?: number
}) {
  const [wrapRef, width] = useContainerWidth()

  // Series share the same log-spaced sample X values (math.sampleXs).
  const data = useMemo(() => {
    const src = series[0]?.points ?? []
    return src.map((pt, i) => {
      const row: Record<string, number> = { x: pt.x }
      series.forEach((s, si) => { row[`s${si}`] = s.points[i]?.y ?? NaN })
      return row
    })
  }, [series])

  const allX = series.flatMap(s => s.points.map(p => p.x))
  let xMin = Math.min(...allX)
  let xMax = Math.max(...allX)
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= xMin) {
    xMin = Math.min(xMin, 1)
    xMax = Math.max(xMax, xMin + 1)
  }
  const xTicks = logX ? logTicks(xMin, xMax) : linearTicks(xMin, xMax, 6)

  return <div className="admin-chart" data-testid="line-chart">
    <div className="admin-chart-inner" ref={wrapRef}>
      {showLegend && series.length > 1 && <div className="admin-chart-legend">
        {series.map(s => <span key={s.name} className="admin-chart-legend-item">
          <i className="admin-chart-swatch" style={{ background: s.color, borderTopStyle: s.dashed ? 'dashed' : undefined }} />
          {s.name}
        </span>)}
      </div>}
      <ReLineChart width={width} height={height} data={data} margin={{ top: 16, right: 20, bottom: 44, left: 54 }}>
        <CartesianGrid vertical={false} stroke="#E5E7EB" strokeWidth={1} />
        <XAxis dataKey="x" type="number" scale={logX ? 'log' : 'linear'} domain={[xMin, xMax]} ticks={xTicks}
          tickFormatter={formatX} axisLine={false} tickLine={false} tick={AXIS_TICK}
          label={{ value: xLabel, position: 'insideBottom', offset: -14, style: AXIS_LABEL }} />
        <YAxis type="number" domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tickFormatter={formatY}
          axisLine={false} tickLine={false} width={46} tick={AXIS_TICK}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', dy: 8, style: { ...AXIS_LABEL, textAnchor: 'middle' } }} />
        <Tooltip content={<LineTip total={total} />} cursor={{ stroke: '#9CA3AF', strokeDasharray: '3 3' }} />
        {series.map((s, i) => <Line key={`${s.name}-${i}`} dataKey={`s${i}`} name={s.name} stroke={s.color}
          strokeWidth={2.5} strokeDasharray={s.dashed ? '6 4' : undefined} dot={false} activeDot={{ r: 4 }} />)}
        <ReferenceLine y={0} stroke="#D1D5DB" strokeWidth={1.5} />
      </ReLineChart>
    </div>
  </div>
}

/** Custom recharts tooltip content for the line chart. */
export function LineTip({ active, payload, label, total }: any) {
  if (!active || !payload?.length) return null
  const x = Number(payload[0]?.payload?.x ?? label)
  if (!Number.isFinite(x)) return null
  return <div className="admin-chart-tip" data-testid="line-chart-tooltip">
    <strong className="admin-chart-tip-title">×{formatX(x)}</strong>
    {payload.map((p: any) => {
      const count = total !== undefined ? Math.round(p.value * total) : undefined
      return <div key={p.name} className="admin-chart-tip-row">
        <span className="admin-chart-tip-swatch" style={{ background: p.color || p.stroke }} />
        <span className="admin-chart-tip-name">{p.name}</span>
        <span className="admin-chart-tip-val">{formatY(p.value)}{count !== undefined ? ` · ${count.toLocaleString('ru-RU')} из ${total.toLocaleString('ru-RU')} игр` : ''}</span>
      </div>
    })}
  </div>
}

/** Format a single point for table/hint use. */
// eslint-disable-next-line react-refresh/only-export-components
export const pointLabel = (p: Point) => ({ x: formatX(p.x), y: formatY(p.y) })

const HIST_BIN_COLOR = '#3B82F6'
const HIST_THEORY_COLOR = '#6B7280'

const HIST_BIN_TOP = '#60A5FA'
const HIST_BIN_BOTTOM = '#3B82F6'

function niceHistMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  for (const m of [0.05, 0.1, 0.2, 0.25, 0.5, 1]) {
    if (value <= m) return m
  }
  return Math.ceil(value * 10) / 10
}

function formatEdge(value: number): string {
  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

/**
 * Frequency histogram of crash multipliers with a log X axis. The first bin
 * starts at minCrashMultiplier and holds the natural low tail of the truncated
 * Pareto (no instant-crash atom). When the model params are supplied, a dashed
 * theoretical line connects the expected share survival(lo) - survival(hi).
 */
export function HistogramChart({
  data,
  total,
  params,
  height = 350,
  xLabel = 'X — множитель',
  yLabel = 'доля игр',
}: {
  data: HistogramData
  total: number
  params?: CrashParams
  height?: number
  xLabel?: string
  yLabel?: string
}) {
  const uid = useId().replace(/:/g, '')
  const [wrapRef, width] = useContainerWidth()
  const { minValue, bins } = data

  const rows = useMemo(() => bins.map(b => ({
    mid: Math.sqrt(b.lo * b.hi),
    range: `×${formatEdge(b.lo)} – ×${formatEdge(b.hi)}`,
    count: b.count,
    share: total > 0 ? b.count / total : 0,
    theo: params ? survival(b.lo, params) - survival(b.hi, params) : NaN,
  })), [bins, total, params])

  const theoMax = params === undefined ? 0 : Math.max(...rows.map(r => (Number.isFinite(r.theo) ? r.theo : 0)))
  const yMax = niceHistMax(Math.max(...rows.map(r => r.share), theoMax))
  let xMax = bins.length > 0 ? bins[bins.length - 1].hi : minValue
  if (!Number.isFinite(xMax) || xMax <= minValue) xMax = minValue + 1
  const xTicks = logTicks(minValue, xMax)

  return <div className="admin-chart" data-testid="histogram-chart">
    <div className="admin-chart-inner" ref={wrapRef}>
      <div className="admin-chart-legend">
        <span className="admin-chart-legend-item"><i className="admin-chart-swatch" style={{ background: HIST_BIN_COLOR }} />симуляция · {total.toLocaleString('ru-RU')} игр</span>
        {params !== undefined && <span className="admin-chart-legend-item"><i className="admin-chart-swatch" style={{ background: 'transparent', borderTop: `3px dashed ${HIST_THEORY_COLOR}` }} />теория</span>}
      </div>
      <ComposedChart width={width} height={height} data={rows} margin={{ top: 16, right: 20, bottom: 44, left: 54 }}>
        <defs>
          <linearGradient id={`${uid}b`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={HIST_BIN_TOP} />
            <stop offset="100%" stopColor={HIST_BIN_BOTTOM} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#E5E7EB" strokeWidth={1} />
        <XAxis dataKey="mid" type="number" scale="log" domain={[minValue, xMax]} ticks={xTicks}
          tickFormatter={formatX} axisLine={false} tickLine={false} tick={AXIS_TICK}
          label={{ value: xLabel, position: 'insideBottom', offset: -14, style: AXIS_LABEL }} />
        <YAxis type="number" domain={[0, yMax]} ticks={linearTicks(0, yMax, 4)} tickFormatter={formatY}
          axisLine={false} tickLine={false} width={46} tick={AXIS_TICK}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', dy: 8, style: { ...AXIS_LABEL, textAnchor: 'middle' } }} />
        <Tooltip content={<HistTip />} cursor={{ fill: 'rgba(156, 163, 175, 0.1)', stroke: '#9CA3AF', strokeDasharray: '3 3' }} />
        <Bar dataKey="share" name="симуляция" fill={`url(#${uid}b)`} radius={[5, 5, 0, 0]} barSize={12} />
        {params && <Line dataKey="theo" name="теория" stroke={HIST_THEORY_COLOR} strokeDasharray="5 4"
          strokeWidth={2} dot={false} type="linear" />}
        <ReferenceLine y={0} stroke="#D1D5DB" strokeWidth={1.5} />
      </ComposedChart>
    </div>
  </div>
}

/** Custom recharts tooltip content for the histogram. */
export function HistTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  const hasTheo = Number.isFinite(row.theo)
  return <div className="admin-chart-tip" data-testid="histogram-tooltip">
    <strong className="admin-chart-tip-title">{row.range}</strong>
    <div className="admin-chart-tip-row">
      <span className="admin-chart-tip-swatch" style={{ background: HIST_BIN_COLOR }} />
      <span className="admin-chart-tip-name">симуляция</span>
      <span className="admin-chart-tip-val">{row.count.toLocaleString('ru-RU')} игр · {formatY(row.share)}</span>
    </div>
    {hasTheo && <div className="admin-chart-tip-row">
      <span className="admin-chart-tip-swatch" style={{ background: 'transparent', borderTop: `2px dashed ${HIST_THEORY_COLOR}` }} />
      <span className="admin-chart-tip-name">теория</span>
      <span className="admin-chart-tip-val">{formatY(row.theo)}</span>
    </div>}
  </div>
}
