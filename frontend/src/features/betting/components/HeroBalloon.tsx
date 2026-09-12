import { BalloonImage } from './BalloonImage'
import type { Theme } from '../types'

type HeroBalloonProps = {
  theme: Theme
}

export function HeroBalloon({ theme }: HeroBalloonProps) {
  return (
    <section className="hero-balloon" aria-label={`Выбранная тема: ${theme === 'green' ? 'зелёный шар' : 'красный шар'}`}>
      <div className="hero-balloon__visual">
        <div aria-hidden="true" className="hero-balloon__theme hero-balloon__theme--green">
          <BalloonImage theme="green" />
        </div>
        <div aria-hidden="true" className="hero-balloon__theme hero-balloon__theme--red">
          <BalloonImage theme="red" />
        </div>
      </div>
      <p>Выше<br />больше<br />возможностей!</p>
    </section>
  )
}
