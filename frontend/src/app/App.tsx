import { useEffect, useState, type ReactNode } from 'react'

type FlightMode = 'RED' | 'GREEN'
type TutorialStep = 1 | 2 | 3

const ONBOARDING_KEY_PREFIX = 'air-balloon-flight-mode-onboarding-complete:'
const THEME_KEY = 'air-balloon-theme'

type CurrentUser = {
  userId: string
  displayName: string
}

function onboardingKey(userId: string) {
  return `${ONBOARDING_KEY_PREFIX}${userId}`
}

async function loadCurrentUser(signal: AbortSignal): Promise<CurrentUser | null> {
  if (import.meta.env.DEV) {
    const params = new URLSearchParams(window.location.search)
    const devUserId = params.get('devUserId')?.trim()

    if (devUserId) {
      return {
        userId: devUserId,
        displayName: params.get('devDisplayName')?.trim() || 'Игрок123',
      }
    }
  }

  const response = await fetch('/api/auth/me', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  })

  if (response.status === 401 || response.status === 403) return null
  if (!response.ok) throw new Error(`Unable to load current user: ${response.status}`)

  const user = await response.json() as Partial<CurrentUser>
  if (typeof user.userId !== 'string' || !user.userId.trim()) return null

  return {
    userId: user.userId,
    displayName: typeof user.displayName === 'string' && user.displayName.trim()
      ? user.displayName
      : 'Игрок123',
  }
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

function SettingsIcon() {
  return <Icon><circle cx="12" cy="12" r="3" /><path d="M19 13.4v-2.8l-2-.7-.5-1.2.9-1.9-2-2-1.9.9-1.2-.5-.7-2H8.8l-.7 2-1.2.5L5 4.8l-2 2 .9 1.9-.5 1.2-2 .7v2.8l2 .7.5 1.2-.9 1.9 2 2 1.9-.9 1.2.5.7 2h2.8l.7-2 1.2-.5 1.9.9 2-2-.9-1.9.5-1.2 2-.7Z" /></Icon>
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

function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [tutorialVisible, setTutorialVisible] = useState(false)
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(1)
  const [selectedMode, setSelectedMode] = useState<FlightMode | null>(() => {
    const mode = readStorage(THEME_KEY)
    return mode === 'RED' || mode === 'GREEN' ? mode : null
  })

  useEffect(() => {
    const controller = new AbortController()

    loadCurrentUser(controller.signal)
      .then((user) => {
        if (!user) return
        setCurrentUser(user)
        setTutorialStep(1)
        setTutorialVisible(readStorage(onboardingKey(user.userId)) !== 'true')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('Failed to resolve the authenticated user', error)
      })

    return () => controller.abort()
  }, [])

  const completeTutorial = () => {
    if (!currentUser) return
    writeStorage(onboardingKey(currentUser.userId), 'true')
    setTutorialVisible(false)
  }

  const chooseMode = (mode: FlightMode) => {
    if (tutorialVisible) {
      if (tutorialStep === 2 && mode === 'RED') setTutorialStep(3)
      if (tutorialStep === 3 && mode === 'GREEN') completeTutorial()
      return
    }

    writeStorage(THEME_KEY, mode)
    setSelectedMode(mode)
    window.dispatchEvent(new CustomEvent<FlightMode>('air-balloon:mode-selected', { detail: mode }))
  }

  return (
    <main className={`flight-mode-page ${tutorialVisible ? 'is-tutorial' : ''}`}>
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

      <div className="user-panel" aria-label={`Профиль ${currentUser?.displayName ?? 'Игрок123'}`}>
        <span className="user-panel__avatar"><UserIcon /></span>
        <strong>{currentUser?.displayName ?? 'Игрок123'}</strong>
        <span className="user-panel__divider" />
        <button type="button" aria-label="Настройки"><SettingsIcon /></button>
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

      <section className="rating-card" aria-label="Рейтинг участников">
        <span className="rating-card__trophy"><TrophyIcon /></span>
        <div><h2>Рейтинг участников</h2><p>Успей заработать больше всех очков<br />и получай награды!</p></div>
        <span className="rating-card__days"><ClockIcon />25 дней</span>
        <ArrowIcon />
      </section>

      {tutorialVisible && (
        <section className="tutorial-layer" aria-label={`Обучение, шаг ${tutorialStep} из 3`}>
          <div className="tutorial-sign tutorial-sign--left">Большие<br />приключения<br />начинаются<br />здесь ♡</div>
          <div className="tutorial-sign tutorial-sign--right">ВЫШЕ<br />ЯРЧЕ<br />ДАЛЬШЕ<br />♡</div>
          {tutorialStep === 1 && (
            <div className="tutorial-step tutorial-step--one" key="tutorial-step-1">
              <img className="chinchillot" src="/assets/flight-mode/chinchillot.png" alt="Шиншилот" draggable="false" />
              <button className="tutorial-dialog" type="button" onClick={() => setTutorialStep(2)}>
                <span className="tutorial-number">1</span>
                <strong>Привет, я Шиншилот!</strong>
                <span>Я очень люблю шарики.<br />Я научу тебя играть в мою<br />любимую игру.</span>
              </button>
            </div>
          )}
          {tutorialStep === 2 && (
            <div className="tutorial-step tutorial-step--two" key="tutorial-step-2">
              <svg className="tutorial-arcs" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true">
                <path pathLength="1" d="M330 775 C350 520 480 365 655 325" />
              </svg>
              <div className="tutorial-tip tutorial-tip--red">
                <span className="tutorial-number">2</span>
                <strong>Красный шар — 12 уровней.</strong>
                <span>Более рискованный режим.</span>
              </div>
            </div>
          )}
          {tutorialStep === 3 && (
            <div className="tutorial-step tutorial-step--three" key="tutorial-step-3">
              <svg className="tutorial-arcs" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true">
                <path pathLength="1" d="M1265 325 C1440 365 1568 520 1590 775" />
              </svg>
              <div className="tutorial-tip tutorial-tip--green">
                <span className="tutorial-number">3</span>
                <strong>Зелёный шар — 9 уровней.</strong>
                <span>Более спокойный режим.</span>
              </div>
            </div>
          )}
          <button className="tutorial-skip" type="button" onClick={completeTutorial}>Пропустить обучение <ArrowIcon /></button>
          <span className="visually-hidden" aria-live="polite">Шаг {tutorialStep} из 3</span>
        </section>
      )}
      </div>
    </main>
  )
}

export default App
