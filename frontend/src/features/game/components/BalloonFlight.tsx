import { BalloonImage } from '../../betting/components/BalloonImage'
import type { Theme } from '../../betting/types'
import type { CrashRoundStatus } from '../hooks/useCrashRound'
import { CrashExplosionEffect } from './CrashExplosionEffect'

type BalloonFlightProps = {
  progress: number
  reachedLevels: number
  pointsPerLine: number
  status: CrashRoundStatus
  theme: Theme
}

export function BalloonFlight({
  progress,
  reachedLevels,
  pointsPerLine,
  status,
  theme,
}: BalloonFlightProps) {
  return (
    <div
      className={`crash-balloon crash-balloon--${status}`}
      data-flight-progress={progress.toFixed(6)}
      data-testid="flight-balloon"
      style={{ '--flight-y': `${progress * 100}%` } as React.CSSProperties}
    >
      {status === 'crashed' ? (
        <CrashExplosionEffect theme={theme} />
      ) : (
        <div className="crash-balloon__float">
          <BalloonImage theme={theme} />
        </div>
      )}
      {reachedLevels > 0 && status !== 'crashed' && (
        <span className="points-popup" key={reachedLevels}>+{pointsPerLine}</span>
      )}
    </div>
  )
}
