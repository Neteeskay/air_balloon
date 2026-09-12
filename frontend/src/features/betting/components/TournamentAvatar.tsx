import type { CSSProperties } from 'react'
import type { TournamentParticipant } from '../types'

type TournamentAvatarProps = Pick<TournamentParticipant, 'avatar' | 'avatarHue' | 'name'> & {
  large?: boolean
}

type AvatarStyle = CSSProperties & { '--avatar-hue': number }

export function TournamentAvatar({ avatar, avatarHue, large = false, name }: TournamentAvatarProps) {
  return (
    <span
      aria-label={`Аватар игрока ${name}`}
      className={`tournament-avatar${large ? ' tournament-avatar--large' : ''}`}
      role="img"
      style={{ '--avatar-hue': avatarHue } as AvatarStyle}
    >
      {avatar}
    </span>
  )
}
