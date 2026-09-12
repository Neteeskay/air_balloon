import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BET_OPTIONS } from '../data/betOptions'
import { pickRandomPuzzleIds } from '../lib/pickRandomPuzzleIds'
import type { BetSelectionModal, Theme } from '../types'

const BOOSTER_HINT_SEEN_KEY = 'air-balloon:booster-hint-seen'

function hasSeenBoosterHint() {
  try {
    return window.sessionStorage.getItem(BOOSTER_HINT_SEEN_KEY) === 'true'
  } catch {
    return false
  }
}

function rememberBoosterHint() {
  try {
    window.sessionStorage.setItem(BOOSTER_HINT_SEEN_KEY, 'true')
  } catch {
    // The hint still works for the current page when storage is unavailable.
  }
}

type UseBetSelectionOptions = {
  initialTheme: Theme
  balance: number
  onThemeChange: (theme: Theme) => void
  onStart: (stake: number, booster: 1 | 2 | 3 | 4) => void
  onTopUp: () => void
}

export function useBetSelection({ initialTheme, balance, onThemeChange, onStart, onTopUp }: UseBetSelectionOptions) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [selectedId, setSelectedId] = useState<number | null>(2)
  const [puzzleIds, setPuzzleIds] = useState(() => pickRandomPuzzleIds(4))
  const [modal, setModal] = useState<BetSelectionModal>(null)
  const [notice, setNotice] = useState('')
  const [activatingId, setActivatingId] = useState<number | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [boosterHintOpen, setBoosterHintOpen] = useState(false)
  const noticeTimerRef = useRef<number | null>(null)
  const startTimerRef = useRef<number | null>(null)
  const activationTimerRef = useRef<number | null>(null)

  const selectedOption = useMemo(
    () => BET_OPTIONS.find((option) => option.id === selectedId) ?? null,
    [selectedId],
  )

  const showNotice = useCallback((message: string, duration = 2600) => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current)
    setNotice(message)
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), duration)
  }, [])

  const switchTheme = () => {
    if (isStarting) return
    const nextTheme = theme === 'green' ? 'red' : 'green'
    setTheme(nextTheme)
    onThemeChange(nextTheme)
    setSelectedId(2)
    setPuzzleIds(pickRandomPuzzleIds(4))
  }

  const selectOption = (id: number) => {
    const option = BET_OPTIONS.find((candidate) => candidate.id === id)

    if (!option || option.cost > balance) {
      showNotice('Не хватает бонусов')
      return
    }

    setSelectedId(id)

    if (option.multiplier === 1) {
      setBoosterHintOpen(false)
    } else if (!hasSeenBoosterHint()) {
      rememberBoosterHint()
      setBoosterHintOpen(true)
    }
  }

  const startGame = () => {
    if (!selectedOption || selectedOption.cost > balance || isStarting) return

    const option = selectedOption
    setIsStarting(true)
    setActivatingId(option.id)

    startTimerRef.current = window.setTimeout(() => {
      showNotice('Переход в игру…', 2200)
      onStart(option.cost, option.multiplier)
    }, 420)

    activationTimerRef.current = window.setTimeout(() => {
      setActivatingId(null)
      setIsStarting(false)
    }, 1050)
  }

  useEffect(() => () => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current)
    if (startTimerRef.current !== null) window.clearTimeout(startTimerRef.current)
    if (activationTimerRef.current !== null) window.clearTimeout(activationTimerRef.current)
  }, [])

  return {
    balance,
    activatingId,
    boosterHintOpen,
    canStart: Boolean(selectedOption && selectedOption.cost <= balance && !isStarting),
    closeModal: () => setModal(null),
    closeBoosterHint: () => setBoosterHintOpen(false),
    modal,
    notice,
    openRules: () => setModal('rules'),
    openTournament: () => setModal('tournament'),
    puzzleIds,
    selectedId,
    selectedMultiplier: selectedOption?.multiplier ?? null,
    selectOption,
    startGame,
    switchTheme,
    theme,
    topUpBalance: onTopUp,
  }
}
