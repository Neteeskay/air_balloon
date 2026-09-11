import { useState } from 'react'

type FlightMode = 'RED' | 'GREEN'
type TutorialStep = 1 | 2 | 3

const ONBOARDING_KEY = 'air-balloon-flight-mode-onboarding-complete'
const THEME_KEY = 'air-balloon-theme'

function onboardingWasCompleted() {
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === 'true'
  } catch {
    return false
  }
}

function rememberOnboardingCompletion() {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, 'true')
  } catch {
    // The page must remain usable when storage is unavailable.
  }
}

function rememberMode(mode: FlightMode) {
  try {
    window.localStorage.setItem(THEME_KEY, mode)
  } catch {
    // The existing game integration can still consume the dispatched event.
  }

  window.dispatchEvent(new CustomEvent<FlightMode>('air-balloon:mode-selected', { detail: mode }))
}

function savedMode(): FlightMode | null {
  try {
    const mode = window.localStorage.getItem(THEME_KEY)
    return mode === 'RED' || mode === 'GREEN' ? mode : null
  } catch {
    return null
  }
}

function App() {
  const [tutorialVisible, setTutorialVisible] = useState(() => !onboardingWasCompleted())
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(1)
  const [selectedMode, setSelectedMode] = useState<FlightMode | null>(savedMode)

  const completeTutorial = () => {
    rememberOnboardingCompletion()
    setTutorialVisible(false)
  }

  const advanceTutorial = (step: TutorialStep) => {
    if (step !== tutorialStep) return
    if (step === 3) {
      completeTutorial()
      return
    }
    setTutorialStep((step + 1) as TutorialStep)
  }

  const selectMode = (mode: FlightMode) => {
    rememberMode(mode)
    setSelectedMode(mode)
  }

  return (
    <main className={`flight-mode-page ${tutorialVisible ? 'is-tutorial' : 'is-standard'}`}>
      <div className="flight-mode-stage">
        <img
          className="flight-mode-art"
          src={tutorialVisible
            ? '/assets/flight-mode/onboarding.png'
            : '/assets/flight-mode/mode-selection.png'}
          alt=""
          draggable="false"
        />

        {tutorialVisible ? (
          <section className="tutorial-controls" aria-label={`Обучение, шаг ${tutorialStep} из 3`}>
          <button
            className="hotspot tutorial-hotspot tutorial-hotspot--intro"
            type="button"
            aria-label="Шаг 1. Привет, я Шиншилот! Я научу тебя играть."
            aria-current={tutorialStep === 1 ? 'step' : undefined}
            disabled={tutorialStep !== 1}
            onClick={() => advanceTutorial(1)}
          />
          <button
            className="hotspot tutorial-hotspot tutorial-hotspot--red"
            type="button"
            aria-label="Шаг 2. Красный шар — 12 уровней. Более рискованный режим."
            aria-current={tutorialStep === 2 ? 'step' : undefined}
            disabled={tutorialStep !== 2}
            onClick={() => advanceTutorial(2)}
          />
          <button
            className="hotspot tutorial-hotspot tutorial-hotspot--green"
            type="button"
            aria-label="Шаг 3. Зелёный шар — 9 уровней. Более спокойный режим."
            aria-current={tutorialStep === 3 ? 'step' : undefined}
            disabled={tutorialStep !== 3}
            onClick={() => advanceTutorial(3)}
          />
          <button
            className="hotspot tutorial-skip"
            type="button"
            aria-label="Пропустить обучение"
            onClick={completeTutorial}
          />
          <span className="visually-hidden" aria-live="polite">Шаг {tutorialStep} из 3</span>
          </section>
        ) : (
          <section className="mode-controls" aria-label="Выбор режима полёта">
          <button
            className="hotspot mode-hotspot mode-hotspot--red"
            type="button"
            aria-label="Выбрать красный шар, 12 уровней"
            aria-pressed={selectedMode === 'RED'}
            onClick={() => selectMode('RED')}
          />
          <button
            className="hotspot mode-hotspot mode-hotspot--green"
            type="button"
            aria-label="Выбрать зелёный шар, 9 уровней"
            aria-pressed={selectedMode === 'GREEN'}
            onClick={() => selectMode('GREEN')}
          />
          </section>
        )}
      </div>
    </main>
  )
}

export default App
