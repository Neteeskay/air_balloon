import { BalloonImage } from './BalloonImage'
import type { Theme } from '../types'

type LevelsIndicatorProps = {
  theme: Theme
}

export function LevelsIndicator({ theme }: LevelsIndicatorProps) {
  const levels = theme === 'green' ? 9 : 12
  const compactLevels = Array.from({ length: levels }, (_, index) => levels - index)

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
            <span className="level-dot" />
            <span className="level-number">{level}</span>
          </li>
        ))}
      </ol>
    </aside>
  )
}
