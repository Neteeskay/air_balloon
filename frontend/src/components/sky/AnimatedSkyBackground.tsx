import type { CSSProperties } from 'react'
import { useSkyAnimation, type BirdSkyElement, type SkyElement } from './useSkyAnimation'

type SkyElementStyle = CSSProperties & {
  '--sky-drift': string
  '--sky-end-x': string
  '--sky-middle-x': string
  '--sky-scale': number
  '--sky-start-x': string
}

type BirdElementStyle = CSSProperties & {
  '--bird-end-x': string
  '--bird-end-y': string
  '--bird-middle-x': string
  '--bird-middle-y': string
  '--bird-scale': number
  '--bird-start-x': string
  '--bird-start-y': string
}

function getElementStyle(element: SkyElement): SkyElementStyle {
  const movesRight = element.direction === 'left-to-right'

  return {
    '--sky-drift': `${element.drift}vh`,
    '--sky-end-x': movesRight ? '112vw' : '-32vw',
    '--sky-middle-x': `${element.middleX}vw`,
    '--sky-scale': element.scale,
    '--sky-start-x': `${element.startX}vw`,
    animationDelay: `${element.delay}s`,
    animationDuration: `${element.duration}s`,
    top: `${element.top}%`,
  }
}

function getBirdStyle(bird: BirdSkyElement): BirdElementStyle {
  return {
    '--bird-end-x': `${bird.endX}vw`,
    '--bird-end-y': `${bird.endY}vh`,
    '--bird-middle-x': `${bird.middleX}vw`,
    '--bird-middle-y': `${bird.middleY}vh`,
    '--bird-scale': bird.scale,
    '--bird-start-x': `${bird.startX}vw`,
    '--bird-start-y': `${bird.startY}vh`,
    animationDelay: `${bird.delay}s`,
    animationDuration: `${bird.duration}s`,
  }
}

export function AnimatedSkyBackground() {
  const { birds, clouds } = useSkyAnimation()

  return (
    <div aria-hidden="true" className="animated-sky">
      {clouds.map((cloud) => (
        <img
          alt=""
          className="sky-element sky-cloud"
          key={cloud.id}
          src={`/assets/clouds/cloud-${cloud.variant + 1}.png`}
          style={getElementStyle(cloud)}
        />
      ))}
      {birds.map((bird) => (
        <span
          className="sky-element sky-bird-flight"
          data-direction={bird.direction}
          data-start-edge={bird.startEdge}
          key={bird.id}
          style={getBirdStyle(bird)}
        >
          <img
            alt=""
            className={`sky-bird${bird.mirrored ? ' is-mirrored' : ''}`}
            src="/assets/sky/bird.gif"
          />
        </span>
      ))}
    </div>
  )
}
