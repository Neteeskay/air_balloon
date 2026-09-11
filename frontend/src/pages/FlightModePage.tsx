import { useState, type ReactNode } from 'react'
import type { CurrentUser } from '../types/auth'

type FlightMode = 'RED' | 'GREEN'
type TutorialStep = 1 | 2 | 3 | 4 | 5

const ONBOARDING_KEY_PREFIX = 'air-balloon-flight-mode-onboarding-complete:'
const THEME_KEY_PREFIX = 'air-balloon-theme:'


function onboardingKey(userId: string) {
  return `${ONBOARDING_KEY_PREFIX}${userId}`
}

function themeKey(userId: string) {
  return `${THEME_KEY_PREFIX}${userId}`
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // The screen remains usable when browser storage is unavailable.
  }
}

function Icon({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">{children}</svg>
}

function ArrowIcon() {
  return <Icon><path d="M5 12h13M14 7l5 5-5 5" /></Icon>
}

function UserIcon() {
  return <Icon><circle cx="12" cy="8" r="4" /><path d="M4.8 20c.7-4 3.2-6 7.2-6s6.5 2 7.2 6" /></Icon>
}

function LogoutIcon() {
  return <Icon><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" /></Icon>
}

function ClockIcon() {
  return <Icon><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></Icon>
}

function TrophyIcon() {
  return <Icon className="trophy-icon"><path d="M8 4h8v4c0 4-1.4 6-4 7-2.6-1-4-3-4-7V4Z" /><path d="M8 6H4c0 3 1.2 5 4.6 5M16 6h4c0 3-1.2 5-4.6 5M12 15v4M8 21h8M9 19h6" /></Icon>
}

function SignalIcon() {
  return <span className="signal" aria-hidden="true"><i /><i /><i /></span>
}

type ModeCardProps = {
  mode: FlightMode
  title: string
  levels: number
  description: string
  balloon: string
  selected: boolean
  tutorialStep: TutorialStep | null
  onChoose: (mode: FlightMode) => void
}

function ModeCard({ mode, title, levels, description, balloon, selected, tutorialStep, onChoose }: ModeCardProps) {
  const activeTutorial = tutorialStep === (mode === 'RED' ? 2 : 3)
  return (
    <article className={`mode-card mode-card--${mode.toLowerCase()} ${activeTutorial ? 'is-tutorial-target' : ''}`}>
      <img className="mode-card__balloon" src={balloon} alt="" draggable="false" />
      <div className="mode-card__copy">
        <h2>{title}</h2>
        <div className="mode-card__levels"><SignalIcon /><strong>{levels} уровней</strong></div>
        <p>{description}</p>
      </div>
      <button
        className="mode-card__button"
        type="button"
        aria-pressed={selected}
        aria-label={`Выбрать ${title.toLowerCase()}, ${levels} уровней`}
        onClick={() => onChoose(mode)}
      >
        Выбрать <ArrowIcon />
      </button>
    </article>
  )
}

export default function FlightModePage({ currentUser, onLogout }: { currentUser: CurrentUser; onLogout: () => void }) {
  const [tutorialVisible, setTutorialVisible] = useState(
    () => readStorage(onboardingKey(currentUser.userId)) !== 'true',
  )
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(1)
  const [selectedMode, setSelectedMode] = useState<FlightMode | null>(() => {
    const mode = readStorage(themeKey(currentUser.userId))
    return mode === 'RED' || mode === 'GREEN' ? mode : null
  })


  const completeTutorial = () => {
    writeStorage(onboardingKey(currentUser.userId), 'true')
    setTutorialVisible(false)
  }

  const advanceTutorial = () => {
    if (tutorialStep === 1) {
      setTutorialStep(2)
      return
    }

    if (tutorialStep === 2) {
      setTutorialStep(3)
      return
    }

    if (tutorialStep === 3) {
      setTutorialStep(4)
      return
    }

    if (tutorialStep === 4) {
      setTutorialStep(5)
      return
    }

    completeTutorial()
  }

  const chooseMode = (mode: FlightMode) => {
    if (tutorialVisible) return

    writeStorage(themeKey(currentUser.userId), mode)
    setSelectedMode(mode)
    window.dispatchEvent(new CustomEvent<FlightMode>('air-balloon:mode-selected', { detail: mode }))
  }

  return (
    <main
      className={`flight-mode-page ${tutorialVisible ? 'is-tutorial' : ''}`}
      tabIndex={tutorialVisible ? 0 : undefined}
      onClick={tutorialVisible ? advanceTutorial : undefined}
      onKeyDown={tutorialVisible ? (event) => {
        if (event.target !== event.currentTarget) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        advanceTutorial()
      } : undefined}
    >
      <div className="scene-background" aria-hidden="true" />
      <img className="birds birds--standard" src="/assets/flight-mode/birds-3.png" alt="" draggable="false" />

      <div className="flight-stage">

      <header className="flight-header">
        <img className="flight-logo" src="/assets/flight-mode/logo.png" alt="Воздушный шар" draggable="false" />
        <h1>Выбери режим полёта</h1>
        <p>{tutorialVisible
          ? 'Шиншилот поможет быстро разобраться.'
          : 'Красный шар — для любителей риска. Зелёный шар — для спокойного полёта.'}</p>
      </header>

      <div className="user-panel" aria-label={`Профиль ${currentUser.displayName}`}>
        <span className="user-panel__avatar"><UserIcon /></span>
        <strong>{currentUser.displayName}</strong>
        <span className="user-panel__divider" />
        <button type="button" aria-label="Выйти" title="Выйти" onClick={onLogout}><LogoutIcon /></button>
      </div>

      <section className="mode-grid" aria-label="Выбор режима полёта">
        <ModeCard
          mode="RED"
          title="Красный шар"
          levels={12}
          description="Более рискованный маршрут"
          balloon="/assets/flight-mode/balloon-red.png"
          selected={selectedMode === 'RED'}
          tutorialStep={tutorialVisible ? tutorialStep : null}
          onChoose={chooseMode}
        />
        <ModeCard
          mode="GREEN"
          title="Зелёный шар"
          levels={9}
          description="Более спокойный полёт"
          balloon="/assets/flight-mode/balloon-green.png"
          selected={selectedMode === 'GREEN'}
          tutorialStep={tutorialVisible ? tutorialStep : null}
          onChoose={chooseMode}
        />
      </section>

      <section className={`rating-card ${tutorialVisible && tutorialStep === 5 ? 'is-tutorial-target' : ''}`} aria-label="Рейтинг участников">
        <span className={`rating-card__trophy ${tutorialVisible && tutorialStep === 4 ? 'is-tutorial-target' : ''}`}><TrophyIcon /></span>
        <div><h2>Рейтинг участников</h2><p>Успей заработать больше всех очков<br />и получай награды!</p></div>
        <span className="rating-card__days"><ClockIcon />25 дней</span>
        <ArrowIcon />
      </section>

      {tutorialVisible && (
        <section className="tutorial-layer" aria-label={`Обучение, шаг ${tutorialStep} из 5`}>
          {tutorialStep === 1 && (
            <div className="tutorial-step tutorial-step--one" key="tutorial-step-1">
              <img className="chinchillot" src="/assets/flight-mode/chinchillot.png" alt="Шиншилот" draggable="false" />
              <button className="tutorial-dialog" type="button">
                <strong>Привет! Я Шиншилот 🐭</strong>
                <span>Я быстро покажу тебе, что здесь к чему.<br />Начнём с выбора воздушного шара!</span>
              </button>
            </div>
          )}
          {tutorialStep === 2 && (
            <div className="tutorial-step tutorial-step--two" key="tutorial-step-2">
              <div className="tutorial-tip tutorial-tip--red">
                <strong>Красный шар — для тех, кто любит риск!</strong>
                <span>Здесь тебя ждут <b>12 уровней</b> и более сложный маршрут.<br />Выбирай его, если хочешь больше испытаний.</span>
              </div>
            </div>
          )}
          {tutorialStep === 3 && (
            <div className="tutorial-step tutorial-step--three" key="tutorial-step-3">
              <div className="tutorial-tip tutorial-tip--green">
                <strong>Зелёный шар — для спокойного полёта</strong>
                <span>Здесь <b>9 уровней</b> и более простой маршрут.<br />Отличный вариант, если хочешь сначала освоиться.</span>
              </div>
            </div>
          )}
          {tutorialStep === 4 && (
            <div className="tutorial-step tutorial-step--four" key="tutorial-step-4">
              <div className="tutorial-tip tutorial-tip--trophy">
                <strong>А вот и твоя цель — кубок! 🏆</strong>
                <span>Зарабатывай очки во время игры и старайся подняться как можно выше.<br />Чем лучше играешь — тем ближе награда!</span>
              </div>
            </div>
          )}
          {tutorialStep === 5 && (
            <div className="tutorial-step tutorial-step--five" key="tutorial-step-5">
              <div className="tutorial-tip tutorial-tip--rating">
                <strong>Здесь находится рейтинг игроков.</strong>
                <span>В нём видно, кто набрал больше всего очков за текущий период.<br />До конца рейтинга осталось <b>25 дней</b>, так что успей подняться выше!</span>
              </div>
            </div>
          )}
          <button
            className="tutorial-skip"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              completeTutorial()
            }}
          >
            Пропустить обучение <ArrowIcon />
          </button>
          <span className="visually-hidden" aria-live="polite">Шаг {tutorialStep} из 5</span>
        </section>
      )}
      </div>
    </main>
  )
}

