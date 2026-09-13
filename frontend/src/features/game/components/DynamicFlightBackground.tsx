import type { CSSProperties } from 'react'
import {
  FLIGHT_BACKGROUND_COUNT,
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
  const style: DynamicBackgroundStyle = {
    '--flight-bg-shift': `${normalized * -7}%`,
    '--flight-bg-scale': 1 + normalized * 0.065,
    '--flight-bg-wash': normalized * 0.22,
  }

  return (
    <div
      aria-hidden="true"
      className="dynamic-flight-background"
      data-background-frame={`${fromIndex + 1}-${toIndex + 1}`}
      data-flight-progress={normalized.toFixed(6)}
      style={style}
    >
      {Array.from({ length: FLIGHT_BACKGROUND_COUNT }, (_, index) => {
        const opacity = index === fromIndex
          ? 1 - blend
          : index === toIndex
            ? blend
            : 0
        return (
        <img
          alt=""
          className={`dynamic-flight-background__frame${opacity > 0 ? ' is-active' : ''}`}
          decoding="async"
          key={index}
          src={`/assets/backgrounds/flight/flight-${String(index + 1).padStart(2, '0')}-desktop.webp`}
          srcSet={getSourceSet(index)}
          sizes="100vw"
          style={{ opacity }}
        />
        )
      })}
      <span className="dynamic-flight-background__atmosphere" />
    </div>
  )
}
