import { BalloonImage } from './BalloonImage'
import type { Theme } from '../types'

type HeroBalloonProps = {
  theme: Theme
}

export function HeroBalloon({ theme }: HeroBalloonProps) {
  return (
    <section className="hero-balloon" aria-label="Выбранная тема">
      <BalloonImage theme={theme} />
      <p>Выше<br />больше<br />возможностей!</p>
    </section>
  )
}
