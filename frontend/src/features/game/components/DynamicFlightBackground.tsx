import type { CSSProperties } from 'react'
import { useFlightBackgroundProgress } from '../hooks/useFlightBackgroundProgress'

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
    '--flight-bg-shift': `${normalized * -3.5}%`,
    '--flight-bg-scale': 1 + normalized * 0.045,
    '--flight-bg-wash': normalized * 0.16,
  }

  return (
    <div aria-hidden="true" className="dynamic-flight-background" style={style}>
      <img
        alt=""
        className="dynamic-flight-background__frame"
        src={`/assets/backgrounds/flight/flight-${String(fromIndex + 1).padStart(2, '0')}-desktop.webp`}
        srcSet={getSourceSet(fromIndex)}
        sizes="100vw"
        style={{ opacity: 1 - blend }}
      />
      {toIndex !== fromIndex && (
        <img
          alt=""
          className="dynamic-flight-background__frame"
          src={`/assets/backgrounds/flight/flight-${String(toIndex + 1).padStart(2, '0')}-desktop.webp`}
          srcSet={getSourceSet(toIndex)}
          sizes="100vw"
          style={{ opacity: blend }}
        />
      )}
      <span className="dynamic-flight-background__atmosphere" />
    </div>
  )
}
