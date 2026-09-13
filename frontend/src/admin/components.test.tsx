import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HistogramChart, HistTip, LineChart, LineTip } from './chart'
import { HelpPopover } from './components'

describe('LineChart', () => {
  it('renders recharts lines and axis labels', () => {
    const points = [
      { x: 1, y: 0.15 }, { x: 2, y: 0.075 }, { x: 10, y: 0.015 }, { x: 100, y: 0.0015 },
    ]
    const { container } = render(<LineChart series={[{ name: 'Теория', color: '#246b50', points }]} />)
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(1)
    expect(screen.getByText('P(X ≥ x)')).toBeInTheDocument()
    expect(screen.getByText('X — множитель')).toBeInTheDocument()
  })

  it('does not show a legend for a single series but shows it for multiple', () => {
    const series = [
      { name: 'Теория', color: '#246b50', points: [{ x: 1, y: 0.5 }] },
      { name: 'Факт', color: '#2f6fa8', points: [{ x: 1, y: 0.5 }] },
    ]
    const single = render(<LineChart series={series.slice(0, 1)} />)
    expect(single.queryByText('Теория')).not.toBeInTheDocument()
    const both = render(<LineChart series={series} />)
    expect(both.getByText('Теория')).toBeInTheDocument()
    expect(both.getByText('Факт')).toBeInTheDocument()
  })

  it('tolerates a degenerate single-point domain', () => {
    const { container } = render(<LineChart series={[{ name: 'Фикс', color: '#246b50', points: [{ x: 3, y: 1 }] }]} />)
    expect(container.querySelector('.recharts-surface')).toBeInTheDocument()
  })

  it('tooltip content shows percent and reaching-game count', () => {
    render(<LineTip active payload={[
      { name: 'Симуляция', value: 0.25, color: '#2f6fa8' },
      { name: 'Теория', value: 0.5, color: '#d97706' },
    ]} label={2} total={1000} />)
    expect(screen.getByText('×2.0')).toBeInTheDocument()
    expect(screen.getByText(/25% · 250 из 1 000 игр/)).toBeInTheDocument()
    expect(screen.getByText(/50% · 500 из 1 000 игр/)).toBeInTheDocument()
  })
})

describe('HistogramChart', () => {
  const data = {
    minValue: 1,
    bins: [
      { lo: 1, hi: 2, count: 850 },
      { lo: 2, hi: 10, count: 55 },
      { lo: 10, hi: 100, count: 5 },
    ],
  }

  it('renders axis labels, the legend game count and one bar per bin', () => {
    const { container } = render(<HistogramChart data={data} total={1000} />)
    expect(screen.getByText('X — множитель')).toBeInTheDocument()
    expect(screen.getByText('доля игр')).toBeInTheDocument()
    expect(screen.getByText(/симуляция · 1 000 игр/i)).toBeInTheDocument()
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(3)
  })

  it('skips zero-count bins (no bar rectangle)', () => {
    const { container } = render(<HistogramChart data={{ minValue: 1, bins: [{ lo: 1, hi: 2, count: 0 }] }} total={10} />)
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(0)
  })

  it('tooltip content shows count and theory share', () => {
    render(<HistTip active payload={[{ payload: { range: '×1.00 – ×2.00', count: 850, share: 0.85, theo: 0.87 } }]} />)
    expect(screen.getByText(/850 игр/)).toBeInTheDocument()
    expect(screen.getByText(/87%/)).toBeInTheDocument()
  })

  it('fmtY does not collapse tiny shares to 0%', () => {
    render(<LineTip active payload={[{ name: 'Симуляция', value: 0.0004, color: '#2f6fa8' }]} label={100} total={1_000_000} />)
    expect(screen.getByText(/0\.040%/)).toBeInTheDocument()
  })
})

describe('HelpPopover', () => {
  it('opens on click, closes via Escape and outside click', () => {
    render(<div><HelpPopover content={<p>Справочный текст</p>} /><div data-testid="outside" /></div>)
    const trigger = screen.getByRole('button', { name: /Подробнее о параметре/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(screen.getByText('Справочный текст')).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Справочный текст')).not.toBeInTheDocument()
    fireEvent.click(trigger)
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByText('Справочный текст')).not.toBeInTheDocument()
  })
})