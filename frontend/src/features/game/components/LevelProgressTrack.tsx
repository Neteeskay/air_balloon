import { getBoosterIconByMultiplier } from '../../betting/lib/getBoosterIconByMultiplier'
import type { BetOption, Theme } from '../../betting/types'

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
  const lastLevel = levels[levels.length - 1]
  const rawCoefficient = 1 + progress * (lastLevel - 1)
  const firstLevel = levels[0]
  let levelPosition = -0.6 + Math.min(1, Math.max(0, (rawCoefficient - 1) / (firstLevel - 1))) * 0.6

  for (let index = 0; index < levels.length - 1; index += 1) {
    if (rawCoefficient >= levels[index]) {
      const segmentProgress = Math.min(
        1,
        (rawCoefficient - levels[index]) / (levels[index + 1] - levels[index]),
      )
      levelPosition = index + segmentProgress
    }
  }

  if (rawCoefficient >= levels[levels.length - 1]) levelPosition = levels.length - 1

  const spacing = 92
  const naturalMarkerY = (levelPosition + 0.6) * spacing

  return (
    <aside className={`crash-levels theme-${theme}`} aria-label="Прогресс по уровням">
      <div
        className="crash-levels__world"
        style={{
          // Keep the rail exactly between the first and last marker centers.
          // This prevents a dangling line beyond the final level.
          '--track-height': `${(levels.length - 1) * spacing}px`,
          '--track-bottom': `${spacing * 0.6}px`,
          '--track-position': `${naturalMarkerY}px`,
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
              key={level}
              style={{ '--level-y': `${(index + 0.6) * spacing}px` } as React.CSSProperties}
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
      <span className="crash-levels__marker" />
    </aside>
  )
}
