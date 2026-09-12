import type { Theme } from '../types'

type BalloonImageProps = {
  theme: Theme
  small?: boolean
}

export function BalloonImage({ theme, small = false }: BalloonImageProps) {
  return (
    <div className={`balloon-crop balloon-crop--${theme}${small ? ' balloon-crop--small' : ''}`}>
      <img alt={`${theme === 'green' ? 'Зелёный' : 'Красный'} воздушный шар`} src="/assets/balls/balloons.png" />
    </div>
  )
}
