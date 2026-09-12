import { useEffect, useRef } from 'react'

type LuckyMascotProps = {
  gifSrc: string
  audioSrc: string
}

export function LuckyMascot({ gifSrc, audioSrc }: LuckyMascotProps) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = 0
    void audio.play().catch(() => {})

    return () => {
      audio.pause()
      audio.currentTime = 0
    }
  }, [audioSrc])

  return (
    <div aria-hidden="true" className="lucky-mascot">
      <img alt="" src={gifSrc} />
      <audio ref={audioRef} src={audioSrc} />
    </div>
  )
}
