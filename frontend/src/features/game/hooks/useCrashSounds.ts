import { useCallback, useEffect, useRef } from 'react'

type CrashSoundName = 'cashout' | 'crash' | 'level'

const FREQUENCIES: Record<CrashSoundName, number> = {
  cashout: 720,
  crash: 115,
  level: 510,
}

export function useCrashSounds(enabled: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null)

  const play = useCallback((name: CrashSoundName) => {
    if (!enabled) return

    const context = audioContextRef.current ?? new window.AudioContext()
    audioContextRef.current = context
    if (context.state === 'suspended') void context.resume()

    if (name === 'crash') {
      const duration = 0.72
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate)
      const samples = buffer.getChannelData(0)

      for (let index = 0; index < samples.length; index += 1) {
        const envelope = (1 - index / samples.length) ** 2.5
        samples[index] = (Math.random() * 2 - 1) * envelope
      }

      const noise = context.createBufferSource()
      const filter = context.createBiquadFilter()
      const noiseGain = context.createGain()
      const impact = context.createOscillator()
      const impactGain = context.createGain()

      noise.buffer = buffer
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(1350, context.currentTime)
      filter.frequency.exponentialRampToValueAtTime(170, context.currentTime + duration)
      noiseGain.gain.setValueAtTime(0.2, context.currentTime)
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration)
      impact.type = 'sine'
      impact.frequency.setValueAtTime(105, context.currentTime)
      impact.frequency.exponentialRampToValueAtTime(38, context.currentTime + 0.42)
      impactGain.gain.setValueAtTime(0.16, context.currentTime)
      impactGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45)
      noise.connect(filter).connect(noiseGain).connect(context.destination)
      impact.connect(impactGain).connect(context.destination)
      noise.start()
      impact.start()
      noise.stop(context.currentTime + duration)
      impact.stop(context.currentTime + 0.45)
      return
    }

    // TODO: Replace the level and cashout oscillator cues with final supplied sounds.
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const duration = 0.14

    oscillator.frequency.setValueAtTime(FREQUENCIES[name], context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(
      FREQUENCIES[name] * 1.2,
      context.currentTime + duration,
    )
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.1, context.currentTime + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + duration)
  }, [enabled])

  useEffect(() => () => {
    void audioContextRef.current?.close()
  }, [])

  return { play }
}
