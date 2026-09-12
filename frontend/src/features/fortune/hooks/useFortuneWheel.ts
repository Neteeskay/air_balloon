import { useCallback, useEffect, useState } from 'react'
import { FORTUNE_WHEEL_PRIZES, type FortuneWheelPrize } from '../../../mocks/fortuneWheelPrizes'

export const FORTUNE_WHEEL_DAY_MS = 24 * 60 * 60 * 1000
export const FORTUNE_WHEEL_TURNS = 6

const storageKey = (userId: string) => `air-balloon:fortune-wheel:last-spin:${userId}`

function readLastSpin(userId: string) {
  try {
    const value = Number(window.localStorage.getItem(storageKey(userId)))
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

function formatRemainingTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

type UseFortuneWheelOptions = {
  onPrize: (prize: FortuneWheelPrize) => void
  random?: () => number
  userId: string
}

export function useFortuneWheel({ onPrize, random = Math.random, userId }: UseFortuneWheelOptions) {
  const [lastSpinAt, setLastSpinAt] = useState(() => readLastSpin(userId))
  const [now, setNow] = useState(Date.now)
  const [rotation, setRotation] = useState(0)
  const [selectedPrize, setSelectedPrize] = useState<FortuneWheelPrize | null>(null)
  const [result, setResult] = useState<FortuneWheelPrize | null>(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const remainingMs = Math.max(0, lastSpinAt + FORTUNE_WHEEL_DAY_MS - now)
  const canSpin = remainingMs === 0 && !isSpinning

  useEffect(() => {
    if (remainingMs === 0) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [remainingMs])

  const startSpin = useCallback(() => {
    if (!canSpin) return

    const winningIndex = Math.min(
      FORTUNE_WHEEL_PRIZES.length - 1,
      Math.floor(Math.max(0, random()) * FORTUNE_WHEEL_PRIZES.length),
    )
    const prize = FORTUNE_WHEEL_PRIZES[winningIndex]
    const sectorAngle = 360 / FORTUNE_WHEEL_PRIZES.length
    const targetAngle = (360 - winningIndex * sectorAngle) % 360

    setSelectedPrize(prize)
    setResult(null)
    setIsSpinning(true)
    setRotation((current) => {
      const currentAngle = ((current % 360) + 360) % 360
      const alignment = (targetAngle - currentAngle + 360) % 360
      return current + FORTUNE_WHEEL_TURNS * 360 + alignment
    })
  }, [canSpin, random])

  const completeSpin = useCallback(() => {
    if (!isSpinning || !selectedPrize) return

    const completedAt = Date.now()
    try {
      window.localStorage.setItem(storageKey(userId), String(completedAt))
    } catch {
      // The current session still respects the cooldown if storage is unavailable.
    }
    setLastSpinAt(completedAt)
    setNow(completedAt)
    setIsSpinning(false)
    setResult(selectedPrize)
    onPrize(selectedPrize)
  }, [isSpinning, onPrize, selectedPrize, userId])

  return {
    canSpin,
    completeSpin,
    isSpinning,
    prizes: FORTUNE_WHEEL_PRIZES,
    remainingLabel: formatRemainingTime(remainingMs),
    remainingMs,
    result,
    rotation,
    selectedPrize,
    startSpin,
  }
}
