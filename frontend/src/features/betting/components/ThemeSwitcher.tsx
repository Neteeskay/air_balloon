import { Shuffle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BalloonImage } from './BalloonImage'
import type { Theme } from '../types'

type ThemeSwitcherProps = {
  theme: Theme
  onSwitch: () => void
}

type ThemeTransition = {
  from: Theme
  to: Theme
}

const THEME_TRANSITION_MS = 600
const THEME_COMMIT_DELAY_MS = 300

export function ThemeSwitcher({ theme, onSwitch }: ThemeSwitcherProps) {
  const [transition, setTransition] = useState<ThemeTransition | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const commitTimerRef = useRef<number | null>(null)
  const finishTimerRef = useRef<number | null>(null)
  const restartFrameRef = useRef<number | null>(null)
  const enterFrameRef = useRef<number | null>(null)
  const themeRef = useRef(theme)
  const isTransitioningRef = useRef(false)

  themeRef.current = theme

  const setScreenTransitionPhase = useCallback((phase: 'preparing' | 'leaving' | 'entering' | null, targetTheme?: Theme) => {
    const gameShell = buttonRef.current?.closest<HTMLElement>('.game-shell')
    if (!gameShell) return

    gameShell.classList.remove(
      'is-theme-leaving',
      'is-theme-entering',
      'is-theme-preparing',
      'is-theme-switching',
      'is-switching-to-green',
      'is-switching-to-red',
    )

    if (phase === 'preparing' && targetTheme) {
      gameShell.classList.add('is-theme-preparing', `is-switching-to-${targetTheme}`)
    } else if (phase && targetTheme) {
      gameShell.classList.add(
        `is-theme-${phase}`,
        'is-theme-switching',
        `is-switching-to-${targetTheme}`,
      )
    }
  }, [])

  const clearTransition = useCallback(() => {
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current)
    if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current)
    if (restartFrameRef.current !== null) window.cancelAnimationFrame(restartFrameRef.current)
    if (enterFrameRef.current !== null) window.cancelAnimationFrame(enterFrameRef.current)
    commitTimerRef.current = null
    finishTimerRef.current = null
    restartFrameRef.current = null
    enterFrameRef.current = null
    isTransitioningRef.current = false
    setScreenTransitionPhase(null)
  }, [setScreenTransitionPhase])

  const startTransition = () => {
    const currentTheme = themeRef.current
    const nextTheme = currentTheme === 'green' ? 'red' : 'green'

    isTransitioningRef.current = true
    setTransition({ from: nextTheme, to: currentTheme })
    setScreenTransitionPhase('preparing', nextTheme)
    void buttonRef.current?.closest<HTMLElement>('.game-shell')?.offsetWidth
    setScreenTransitionPhase('leaving', nextTheme)

    commitTimerRef.current = window.setTimeout(() => {
      themeRef.current = nextTheme
      onSwitch()
      commitTimerRef.current = null

      enterFrameRef.current = window.requestAnimationFrame(() => {
        enterFrameRef.current = null
        setScreenTransitionPhase('entering', nextTheme)
      })
    }, THEME_COMMIT_DELAY_MS)

    finishTimerRef.current = window.setTimeout(() => {
      setTransition(null)
      finishTimerRef.current = null
      isTransitioningRef.current = false
      setScreenTransitionPhase(null)
    }, THEME_TRANSITION_MS)
  }

  useEffect(() => () => clearTransition(), [clearTransition])

  const handleSwitch = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      clearTransition()
      setTransition(null)
      onSwitch()
      return
    }

    const shouldRestart = isTransitioningRef.current
    clearTransition()

    if (shouldRestart) {
      setTransition(null)
      restartFrameRef.current = window.requestAnimationFrame(() => {
        restartFrameRef.current = null
        startTransition()
      })
      return
    }

    startTransition()
  }

  return (
    <button
      aria-busy={Boolean(transition)}
      className="theme-switch"
      onClick={handleSwitch}
      ref={buttonRef}
      type="button"
    >
      <span aria-hidden="true" className={`theme-switch-balloon${transition ? ' is-transitioning' : ''}`}>
        {transition ? (
          <>
            <span className="theme-switch-balloon__layer theme-switch-balloon__layer--from">
              <BalloonImage small theme={transition.from} />
            </span>
            <span className="theme-switch-balloon__layer theme-switch-balloon__layer--to">
              <BalloonImage small theme={transition.to} />
            </span>
          </>
        ) : (
          <BalloonImage small theme={theme === 'green' ? 'red' : 'green'} />
        )}
      </span>
      <Shuffle size={20} />
      <span className="visually-hidden">Сменить тему</span>
    </button>
  )
}
