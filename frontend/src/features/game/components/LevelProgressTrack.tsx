import { getBoosterIconByMultiplier } from '../../betting/lib/getBoosterIconByMultiplier'
import type { BetOption, Theme } from '../../betting/types'
import { getTrackLevelPosition } from '../lib/flightProgress'

type LevelProgressTrackProps = {
  boosterLevel: number
  boosterMultiplier: BetOption['multiplier']
  levels: number[]
  progress: number
  reachedLevels: number
  theme: Theme
}

export function LevelProgressTrack({
  boosterLevel,
  boosterMultiplier,
  levels,
  progress,
  reachedLevels,
  theme,
}: LevelProgressTrackProps) {
  const boosterIcon = getBoosterIconByMultiplier(boosterMultiplier)
  const spacing = 92
  const leadingOffset = 0.6
  const trackPosition = (getTrackLevelPosition(progress, levels.length) + leadingOffset) * spacing
  const reachedLevelCount = Number.isFinite(reachedLevels)
    ? Math.min(levels.length, Math.max(0, Math.trunc(reachedLevels)))
    : 0

  return (
    <aside className={`crash-levels theme-${theme}`} aria-label="Прогресс по уровням">
      <div
        className="crash-levels__world"
        style={{
          '--track-height': `${Math.max(0, levels.length - 1) * spacing}px`,
          '--track-bottom': `${leadingOffset * spacing}px`,
          '--track-position': `${trackPosition}px`,
        } as React.CSSProperties}
      >
        <span className="crash-levels__rail" />
        {levels.map((_, index) => {
          const level = index + 1
          const isBooster = boosterMultiplier > 1 && level === boosterLevel
          const isReached = index < reachedLevelCount

          return (
            <div
              className={`crash-level${isReached ? ' is-reached' : ''}${isBooster ? ' is-booster' : ''}`}
              aria-label={`Уровень ${level}: ${isReached ? 'пройден' : 'впереди'}`}
              data-level={level}
              data-reached={isReached ? 'true' : 'false'}
              data-testid="flight-level"
              key={level}
              style={{ '--level-y': `${(index + leadingOffset) * spacing}px` } as React.CSSProperties}
            >
              <span className="crash-level__dot" />
              <b>{level}</b>
              <span className="crash-level__guide" />
              {isBooster && boosterIcon && (
                <span className="crash-booster-badge">
                  <img alt="" src={boosterIcon} />
                  <strong>×{boosterMultiplier}</strong>
                </span>
              )}
            </div>
          )
        })}
      </div>
      <span className="crash-levels__marker-anchor">
        <span
          className="crash-levels__marker"
          data-flight-progress={progress.toFixed(6)}
          data-testid="level-progress-marker"
        />
      </span>
    </aside>
  )
}
