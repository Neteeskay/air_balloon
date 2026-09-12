import { Tooltip } from '../../../components/ui/Tooltip'
import { BalloonImage } from './BalloonImage'
import { PuzzlePieceHint } from './PuzzlePieceHint'
import { getBoosterIconByMultiplier } from '../lib/getBoosterIconByMultiplier'
import type { BetOption, Theme } from '../types'

type LevelsIndicatorProps = {
  boosterHintOpen: boolean
  multiplier: BetOption['multiplier'] | null
  onCloseBoosterHint: () => void
  theme: Theme
}

export function LevelsIndicator({
  boosterHintOpen,
  multiplier,
  onCloseBoosterHint,
  theme,
}: LevelsIndicatorProps) {
  const levels = theme === 'green' ? 9 : 12
  const compactLevels = Array.from({ length: levels }, (_, index) => levels - index)
  const boosterIcon = getBoosterIconByMultiplier(multiplier)

  return (
    <aside className="levels" aria-label={`${levels} уровней темы`}>
      <div className="theme-label">
        <BalloonImage small theme={theme} />
        <div>
          <strong>{theme === 'green' ? 'Зелёный шар' : 'Красный шар'}</strong>
          <span>{levels} уровней</span>
        </div>
      </div>
      <ol className="level-track">
        {compactLevels.map((level, index) => (
          <li className={index === compactLevels.length - 1 ? 'is-current' : ''} key={level}>
            {boosterIcon && multiplier !== 1 && level === (theme === 'green' ? 6 : 8) ? (
              <Tooltip
                className="level-boost-anchor"
                content={(
                  <PuzzlePieceHint
                    multiplier={multiplier ?? 2}
                    onClose={boosterHintOpen ? onCloseBoosterHint : undefined}
                  />
                )}
                forceOpen={boosterHintOpen}
              >
                <button
                  aria-label={`Что даёт бустер ×${multiplier ?? 2}`}
                  className="level-boost-trigger"
                  type="button"
                >
                  <img alt="" className="level-boost-image" src={boosterIcon} />
                </button>
              </Tooltip>
            ) : (
              <span className="level-dot" />
            )}
            <span className="level-number">{level}</span>
          </li>
        ))}
      </ol>
    </aside>
  )
}
