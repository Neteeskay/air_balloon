import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LineChart } from './chart'
import { HelpPopover } from './components'

describe('LineChart', () => {
  it('renders a series polyline and axis labels', () => {
    const points = [
      { x: 1, y: 0.15 }, { x: 2, y: 0.075 }, { x: 10, y: 0.015 }, { x: 100, y: 0.0015 },
    ]
    const { container } = render(<LineChart series={[{ name: 'Теория', color: '#246b50', points }]} />)
    expect(container.querySelector('polyline')).toBeInTheDocument()
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
    expect(container.querySelector('polyline')).toBeInTheDocument()
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