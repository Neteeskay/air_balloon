import type { CSSProperties } from 'react'
import {
  useFlightBackgroundProgress,
} from '../hooks/useFlightBackgroundProgress'

type DynamicFlightBackgroundProps = {
  progress: number
}

type DynamicBackgroundStyle = CSSProperties & {
  '--flight-bg-shift': string
  '--flight-bg-scale': number
  '--flight-bg-wash': number
}

const getSourceSet = (frame: number) => (
  `/assets/backgrounds/flight/flight-${String(frame + 1).padStart(2, '0')}-mobile.webp 768w, `
  + `/assets/backgrounds/flight/flight-${String(frame + 1).padStart(2, '0')}-desktop.webp 1440w`
)

export function DynamicFlightBackground({ progress }: DynamicFlightBackgroundProps) {
  const { blend, fromIndex, progress: normalized, toIndex } = useFlightBackgroundProgress(progress)
  const tail = Math.max(0, progress - 1)
  // Once the last source frame is reached, keep a very small compositor-only
  // drift in the background instead of freezing every visual property at 1.
  // The frame selection remains bounded to the supplied seven images.
  const motionProgress = normalized + Math.min(0.35, tail * 0.35)
  const style: DynamicBackgroundStyle = {
    '--flight-bg-shift': `${motionProgress * -7}%`,
    '--flight-bg-scale': 1 + motionProgress * 0.065,
    '--flight-bg-wash': Math.min(0.3, motionProgress * 0.22),
  }

  return (
    <div
      aria-hidden="true"
      className="dynamic-flight-background"
      data-background-frame={`${fromIndex + 1}-${toIndex + 1}`}
      data-flight-progress={normalized.toFixed(6)}
      style={style}
    >
      {[fromIndex, ...(toIndex === fromIndex ? [] : [toIndex])].map((index) => (
        <img
          alt=""
          className="dynamic-flight-background__frame is-active"
          decoding="async"
          key={index}
          src={`/assets/backgrounds/flight/flight-${String(index + 1).padStart(2, '0')}-desktop.webp`}
          srcSet={getSourceSet(index)}
          sizes="100vw"
          style={{ opacity: index === fromIndex ? 1 - blend : blend }}
        />
      ))}
      <span className="dynamic-flight-background__atmosphere" />
    </div>
  )
}
