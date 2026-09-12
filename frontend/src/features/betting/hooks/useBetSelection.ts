import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { pickRandomPuzzleIds } from '../lib/pickRandomPuzzleIds'
import type { BetOption, BetSelectionModal, Theme } from '../types'

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
  balance: number
  theme: Theme
  onStartGame: (round: { bet: number; boosterMultiplier: BetOption['multiplier'] }) => void | Promise<void>
  onSwitchTheme: () => void
  onTopUp: () => void
  options?: BetOption[]
}

export function useBetSelection({
  balance,
  onStartGame,
  onSwitchTheme,
  onTopUp,
  options = [],
}: UseBetSelectionOptions) {
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
    () => options.find((option) => option.id === selectedId) ?? null,
    [options, selectedId],
  )

  const showNotice = useCallback((message: string, duration = 2600) => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current)
    setNotice(message)
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), duration)
  }, [])

  const switchTheme = () => {
    if (isStarting) return
    onSwitchTheme()
    setSelectedId(2)
    setPuzzleIds(pickRandomPuzzleIds(4))
  }

  const selectOption = (id: number) => {
    const option = options.find((candidate) => candidate.id === id)

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
      void Promise.resolve(onStartGame({ bet: option.cost, boosterMultiplier: option.multiplier })).catch(() => showNotice('Не удалось начать раунд'))
    }, 720)

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
    topUpBalance: onTopUp,
  }
}
