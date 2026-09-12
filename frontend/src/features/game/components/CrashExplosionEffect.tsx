import type { Theme } from '../../betting/types'
import { CRASH_TIMING } from '../mocks/crashRound'

type CrashExplosionEffectProps = {
  theme: Theme
}

export function CrashExplosionEffect({ theme }: CrashExplosionEffectProps) {
  return (
    <span
      aria-hidden="true"
      className={`crash-explosion-sprite crash-explosion-sprite--${theme}`}
      style={{ '--explosion-duration': `${CRASH_TIMING.explosionDurationMs}ms` } as React.CSSProperties}
    />
  )
}
