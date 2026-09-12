import { Shuffle } from 'lucide-react'
import { BalloonImage } from './BalloonImage'
import type { Theme } from '../types'

type ThemeSwitcherProps = {
  theme: Theme
  onSwitch: () => void
}

export function ThemeSwitcher({ theme, onSwitch }: ThemeSwitcherProps) {
  return (
    <button className="theme-switch" onClick={onSwitch} type="button">
      <BalloonImage small theme={theme === 'green' ? 'red' : 'green'} />
      <Shuffle size={20} />
      <span className="visually-hidden">Сменить тему</span>
    </button>
  )
}
