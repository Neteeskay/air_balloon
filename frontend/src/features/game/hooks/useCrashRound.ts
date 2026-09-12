import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BetOption } from '../../betting/types'
import type { Theme } from '../../betting/types'
import { CRASH_TIMING, getCrashLevels, type CrashRoundMock } from '../mocks/crashRound'
import type { CrashGameFinish } from '../types'
import { useCrashSounds } from './useCrashSounds'

export type CrashRoundStatus = 'flying' | 'cashed-out' | 'crashed'

type UseCrashRoundOptions = {
  bet: number
  boosterMultiplier: BetOption['multiplier']
  crashAt: number
  initialCashoutCoefficient: number | null
  onCashout?: (multiplier: number) => void
  onFinish: (result: CrashGameFinish) => void
  roundId: string
  soundOn: boolean
  startedAt: number
  theme: Theme
}

const roundMoney = (value: number) => Math.round(value)

export function useCrashRound({
  bet,
  boosterMultiplier,
  crashAt,
  initialCashoutCoefficient,
  onCashout,
  onFinish,
  roundId,
  soundOn,
  startedAt,
  theme,
}: UseCrashRoundOptions) {
  const mock = useMemo<CrashRoundMock>(() => ({ boosterLevel: 4, crashAt, pointsPerLine: 10 }), [crashAt])
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
  const finishTimerRef = useRef<number | null>(null)
  const { play } = useCrashSounds(soundOn)
  const playRef = useRef(play)
  const finishRef = useRef(onFinish)
  const cashoutRef = useRef(onCashout)
  const initialCashoutRef = useRef(initialCashoutCoefficient)

  useEffect(() => {
    playRef.current = play
  }, [play])

  useEffect(() => {
    finishRef.current = onFinish
    cashoutRef.current = onCashout
    initialCashoutRef.current = initialCashoutCoefficient
  }, [initialCashoutCoefficient, onCashout, onFinish])

  useEffect(() => {
    const restoredCashout = initialCashoutRef.current !== null
    const restoredCoefficient = initialCashoutRef.current ?? 1
    statusRef.current = restoredCashout ? 'cashed-out' : 'flying'
    reachedLevelsRef.current = 0
    payoutRef.current = restoredCashout ? roundMoney(bet * restoredCoefficient) : 0
    setRawCoefficient(restoredCoefficient)
    setCoefficient(restoredCoefficient)
    setReachedLevels(0)
    setPoints(0)
    setCashoutCoefficient(initialCashoutRef.current)
    setCashoutPayout(payoutRef.current)
    setStatus(restoredCashout ? 'cashed-out' : 'flying')

    if (restoredCashout) {
      // A refreshed cashed-out round still has to complete its flight and
      // transition to the result screen at the persisted crash point.
      const discriminant = CRASH_TIMING.coefficientLinearPerSecond ** 2
        - 4 * CRASH_TIMING.coefficientQuadraticPerSecond * (1 - mock.crashAt)
      const crashSeconds = discriminant > 0
        ? (-CRASH_TIMING.coefficientLinearPerSecond + Math.sqrt(discriminant))
          / (2 * CRASH_TIMING.coefficientQuadraticPerSecond)
        : 0
      const remainingMs = Math.max(0, (crashSeconds - Math.max(0, (Date.now() - startedAt) / 1000)) * 1000)
      finishTimerRef.current = window.setTimeout(() => {
        statusRef.current = 'crashed'
        setStatus('crashed')
        playRef.current('crash')
        finishTimerRef.current = window.setTimeout(() => {
          finishRef.current({ payout: payoutRef.current })
        }, CRASH_TIMING.returnDelayMs)
      }, remainingMs)
      return () => {
        if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current)
      }
    }
    let animationFrame = 0

    const update = () => {
      if (statusRef.current === 'crashed') return

      const elapsedSeconds = Math.max(0, (Date.now() - startedAt) / 1000)
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
          finishRef.current({ payout: payoutRef.current })
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
  }, [bet, boosterMultiplier, levels, mock, roundId, startedAt])

  const cashout = useCallback(() => {
    if (statusRef.current !== 'flying' || reachedLevelsRef.current < 1) return

    const payout = roundMoney(bet * coefficient)
    statusRef.current = 'cashed-out'
    payoutRef.current = payout
    setCashoutCoefficient(coefficient)
    setCashoutPayout(payout)
    setStatus('cashed-out')
    cashoutRef.current?.(coefficient)
    play('cashout')

    const discriminant = CRASH_TIMING.coefficientLinearPerSecond ** 2
      - 4 * CRASH_TIMING.coefficientQuadraticPerSecond * (1 - mock.crashAt)
    const crashSeconds = discriminant > 0
      ? (-CRASH_TIMING.coefficientLinearPerSecond + Math.sqrt(discriminant))
        / (2 * CRASH_TIMING.coefficientQuadraticPerSecond)
      : 0
    const remainingMs = Math.max(0, (crashSeconds - Math.max(0, (Date.now() - startedAt) / 1000)) * 1000)
    finishTimerRef.current = window.setTimeout(() => {
      if (statusRef.current === 'crashed') return
      statusRef.current = 'crashed'
      setStatus('crashed')
      playRef.current('crash')
      finishTimerRef.current = window.setTimeout(() => {
        finishRef.current({ payout: payoutRef.current })
      }, CRASH_TIMING.returnDelayMs)
    }, remainingMs)
  }, [bet, coefficient, mock.crashAt, play, startedAt])

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
