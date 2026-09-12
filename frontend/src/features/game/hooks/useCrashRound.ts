import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BetOption } from '../../betting/types'
import type { Theme } from '../../betting/types'
import { CRASH_TIMING, createCrashRoundMock, getCrashLevels } from '../mocks/crashRound'
import type { CrashGameFinish } from '../types'
import { useCrashSounds } from './useCrashSounds'

export type CrashRoundStatus = 'flying' | 'cashed-out' | 'crashed'

type UseCrashRoundOptions = {
  bet: number
  boosterMultiplier: BetOption['multiplier']
  crashAt?: number
  initialCashoutMultiplier?: number | null
  onCashout?: (multiplier: number) => void
  onFinish: (result: CrashGameFinish) => void
  roundId: string | number
  soundOn: boolean
  startedAt?: number
  theme: Theme
}

const roundMoney = (value: number) => Math.round(value)

export function useCrashRound({
  bet,
  boosterMultiplier,
  crashAt,
  initialCashoutMultiplier = null,
  onCashout,
  onFinish,
  roundId,
  soundOn,
  startedAt,
  theme,
}: UseCrashRoundOptions) {
  const mock = useMemo(() => {
    const generated = createCrashRoundMock()
    return crashAt ? { ...generated, crashAt } : generated
  }, [crashAt])
  const levels = useMemo(() => getCrashLevels(theme), [theme])
  const [rawCoefficient, setRawCoefficient] = useState(1)
  const [coefficient, setCoefficient] = useState(1)
  const [reachedLevels, setReachedLevels] = useState(0)
  const [points, setPoints] = useState(0)
  const [cashoutCoefficient, setCashoutCoefficient] = useState<number | null>(null)
  const [cashoutPayout, setCashoutPayout] = useState(0)
  const [status, setStatus] = useState<CrashRoundStatus>('flying')
  const statusRef = useRef<CrashRoundStatus>('flying')
  const reachedLevelsRef = useRef(0)
  const payoutRef = useRef(0)
  const cashoutCoefficientRef = useRef<number | null>(initialCashoutMultiplier)
  const finishTimerRef = useRef<number | null>(null)
  const { play } = useCrashSounds(soundOn)
  const playRef = useRef(play)

  useEffect(() => {
    playRef.current = play
  }, [play])

  useEffect(() => {
    const initialStatus: CrashRoundStatus = initialCashoutMultiplier ? 'cashed-out' : 'flying'
    const initialPayout = initialCashoutMultiplier ? roundMoney(bet * initialCashoutMultiplier) : 0
    statusRef.current = initialStatus
    reachedLevelsRef.current = 0
    payoutRef.current = initialPayout
    cashoutCoefficientRef.current = initialCashoutMultiplier
    setRawCoefficient(1)
    setCoefficient(1)
    setReachedLevels(0)
    setPoints(0)
    setCashoutCoefficient(initialCashoutMultiplier)
    setCashoutPayout(initialPayout)
    setStatus(initialStatus)

    const elapsedBeforeMount = startedAt ? Math.max(0, Date.now() - startedAt) : 0
    const animationStartedAt = performance.now() - elapsedBeforeMount
    let animationFrame = 0

    const update = (now: number) => {
      if (statusRef.current === 'crashed') return

      const elapsedSeconds = (now - animationStartedAt) / 1000
      const nextRaw = Math.min(
        mock.crashAt,
        1
          + elapsedSeconds * CRASH_TIMING.coefficientLinearPerSecond
          + elapsedSeconds ** 2 * CRASH_TIMING.coefficientQuadraticPerSecond,
      )
      const nextReached = levels.filter((threshold) => nextRaw >= threshold).length
      const boosterThreshold = levels[mock.boosterLevel - 1]
      const boosterActive = boosterMultiplier > 1 && nextRaw >= boosterThreshold
      const nextCoefficient = nextRaw * (boosterActive ? boosterMultiplier : 1)

      if (nextReached > reachedLevelsRef.current) {
        reachedLevelsRef.current = nextReached
        setReachedLevels(nextReached)
        setPoints(nextReached * mock.pointsPerLine)
        playRef.current('level')
      }

      setRawCoefficient(nextRaw)
      setCoefficient(nextCoefficient)

      if (nextRaw >= mock.crashAt) {
        statusRef.current = 'crashed'
        setStatus('crashed')
        playRef.current('crash')
        finishTimerRef.current = window.setTimeout(() => {
          onFinish({
            payout: payoutRef.current,
            cashoutMultiplier: cashoutCoefficientRef.current,
            crashMultiplier: mock.crashAt,
            reachedLevels: reachedLevelsRef.current,
          })
        }, CRASH_TIMING.returnDelayMs)
        return
      }

      animationFrame = window.requestAnimationFrame(update)
    }

    animationFrame = window.requestAnimationFrame(update)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current)
    }
  }, [bet, boosterMultiplier, initialCashoutMultiplier, levels, mock, onFinish, roundId, startedAt])

  const cashout = useCallback(() => {
    if (statusRef.current !== 'flying' || reachedLevelsRef.current < 1) return

    const payout = roundMoney(bet * coefficient)
    statusRef.current = 'cashed-out'
    payoutRef.current = payout
    cashoutCoefficientRef.current = coefficient
    setCashoutCoefficient(coefficient)
    setCashoutPayout(payout)
    setStatus('cashed-out')
    onCashout?.(coefficient)
    play('cashout')
  }, [bet, coefficient, onCashout, play])

  return {
    canCashout: status === 'flying' && reachedLevels > 0,
    cashout,
    cashoutCoefficient,
    cashoutPayout,
    coefficient,
    levels,
    mock,
    points,
    potentialPayout: roundMoney(bet * coefficient),
    rawCoefficient,
    reachedLevels,
    status,
  }
}
