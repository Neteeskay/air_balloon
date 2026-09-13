import { getBoosterIconByMultiplier } from '../../betting/lib/getBoosterIconByMultiplier'
import type { BetOption, Theme } from '../../betting/types'
import { getLevelMarkerProgress } from '../lib/flightProgress'

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
  const firstMarker = getLevelMarkerProgress(0, levels.length)

  return (
    <aside className={`crash-levels theme-${theme}`} aria-label="Прогресс по уровням">
      <div
        className="crash-levels__world"
        style={{
          // Keep the rail exactly between the first and last marker centers.
          // This prevents a dangling line beyond the final level.
          '--track-height': `${(1 - firstMarker) * 100}%`,
          '--track-bottom': `${firstMarker * 100}%`,
        } as React.CSSProperties}
      >
        <span className="crash-levels__rail" />
        {levels.map((_, index) => {
          const level = index + 1
          const isBooster = boosterMultiplier > 1 && level === boosterLevel
          const isReached = level <= reachedLevels

          return (
            <div
              className={`crash-level${isReached ? ' is-reached' : ''}${isBooster ? ' is-booster' : ''}`}
              data-level-progress={getLevelMarkerProgress(index, levels.length).toFixed(6)}
              data-testid="flight-level"
              key={level}
              style={{ '--level-y': `${getLevelMarkerProgress(index, levels.length) * 100}%` } as React.CSSProperties}
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
      <span
        className="crash-levels__marker"
        data-flight-progress={progress.toFixed(6)}
        data-testid="level-progress-marker"
        style={{ '--flight-y': `${progress * 100}%` } as React.CSSProperties}
      />
    </aside>
  )
}
