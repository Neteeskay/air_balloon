import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FORTUNE_WHEEL_PRIZES } from '../../../mocks/fortuneWheelPrizes'
import { FORTUNE_WHEEL_DAY_MS, useFortuneWheel } from './useFortuneWheel'

const NOW = new Date('2026-09-12T12:00:00Z')

describe('useFortuneWheel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => vi.useRealTimers())

  it('uses the selected sector for both the stop angle and awarded result', () => {
    const onPrize = vi.fn()
    const random = vi.fn(() => .999)
    const { result } = renderHook(() => useFortuneWheel({ onPrize, random, userId: 'demo' }))

    act(() => result.current.startSpin())

    const expectedPrize = FORTUNE_WHEEL_PRIZES.at(-1)!
    const sectorAngle = 360 / FORTUNE_WHEEL_PRIZES.length
    const expectedAngle = (360 - (FORTUNE_WHEEL_PRIZES.length - 1) * sectorAngle) % 360
    expect(result.current.selectedPrize).toBe(expectedPrize)
    expect(result.current.rotation % 360).toBe(expectedAngle)
    expect(result.current.isSpinning).toBe(true)

    act(() => result.current.completeSpin())

    expect(result.current.result).toBe(expectedPrize)
    expect(onPrize).toHaveBeenCalledOnce()
    expect(onPrize).toHaveBeenCalledWith(expectedPrize)
    expect(result.current.canSpin).toBe(false)
  })

  it('restores the daily cooldown from localStorage and unlocks after 24 hours', () => {
    const onPrize = vi.fn()
    const first = renderHook(() => useFortuneWheel({ onPrize, random: () => 0, userId: 'demo' }))
    act(() => first.result.current.startSpin())
    act(() => first.result.current.completeSpin())
    first.unmount()

    const restored = renderHook(() => useFortuneWheel({ onPrize, random: () => 0, userId: 'demo' }))
    expect(restored.result.current.canSpin).toBe(false)

    vi.setSystemTime(NOW.getTime() + FORTUNE_WHEEL_DAY_MS)
    act(() => vi.advanceTimersByTime(1000))
    expect(restored.result.current.canSpin).toBe(true)
  })
})
