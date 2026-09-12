import type { Point } from './math'

export interface ChartSeries {
  name: string
  color: string
  dashed?: boolean
  points: Point[]
}

const VB_W = 720
const M = { top: 18, right: 18, bottom: 40, left: 56 }

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

const formatX = (x: number) => (x < 10 ? x.toFixed(1) : Number.isInteger(x) ? String(x) : x.toFixed(1))

const formatY = (y: number) => `${Math.round(y * 100)}%`

export function LineChart({
  series,
  height = 320,
  xLabel = 'X — множитель',
  yLabel = 'P(X ≥ x)',
  logX = true,
  showLegend = true,
}: {
  series: ChartSeries[]
  height?: number
  xLabel?: string
  yLabel?: string
  logX?: boolean
  showLegend?: boolean
}) {
  const points = series.flatMap(s => s.points)
  let xMin = Math.min(...points.map(p => p.x))
  let xMax = Math.max(...points.map(p => p.x))
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= xMin) {
    xMin = Math.min(xMin, 1)
    xMax = Math.max(xMax, xMin + 1)
  }
  const yMax = 1
  const chartW = VB_W - M.left - M.right
  const chartH = height - M.top - M.bottom
  const scaleX = (x: number) => M.left + (logX
    ? (Math.log10(x) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin))
    : (x - xMin) / (xMax - xMin)) * chartW
  const scaleY = (y: number) => M.top + (1 - Math.min(yMax, Math.max(0, y)) / yMax) * chartH
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1]
  const xTicks = logX ? logTicks(xMin, xMax) : linearTicks(xMin, xMax, 6)
  const line = (s: ChartSeries) => s.points.map(p => `${scaleX(p.x).toFixed(2)},${scaleY(p.y).toFixed(2)}`).join(' ')

  return <div className="admin-chart" data-testid="line-chart">
    <div className="admin-chart-inner">
      {showLegend && series.length > 1 && <div className="admin-chart-legend">
        {series.map(s => <span key={s.name} className="admin-chart-legend-item">
          <i className="admin-chart-swatch" style={{ background: s.color, borderTopStyle: s.dashed ? 'dashed' : undefined }} />
          {s.name}
        </span>)}
      </div>}
      <svg viewBox={`0 0 ${VB_W} ${height}`} role="img" aria-label={yLabel} width="100%" height={height}>
        {yTicks.map(y => <g key={y}>
          <line x1={M.left} x2={VB_W - M.right} y1={scaleY(y)} y2={scaleY(y)} className="admin-chart-grid" />
          <text x={M.left - 8} y={scaleY(y) + 4} textAnchor="end" className="admin-chart-axis">{formatY(y)}</text>
        </g>)}
        {xTicks.map(x => <g key={x}>
          <line x1={scaleX(x)} x2={scaleX(x)} y1={M.top} y2={M.top + chartH} className="admin-chart-grid" />
          <text x={scaleX(x)} y={M.top + chartH + 16} textAnchor="middle" className="admin-chart-axis">{formatX(x)}</text>
        </g>)}
        {series.map(s => <polyline key={s.name} points={line(s)} fill="none" stroke={s.color}
          strokeWidth={2.2} strokeDasharray={s.dashed ? '6 4' : undefined} strokeLinejoin="round" />)}
        <text x={VB_W / 2} y={height - 2} textAnchor="middle" className="admin-chart-axis-label">{xLabel}</text>
        <text x={14} y={M.top + chartH / 2} textAnchor="middle" className="admin-chart-axis-label"
          transform={`rotate(-90 14 ${M.top + chartH / 2})`}>{yLabel}</text>
      </svg>
    </div>
  </div>
}

/** Format a single point for table/hint use. */
export const pointLabel = (p: Point) => ({ x: formatX(p.x), y: formatY(p.y) })