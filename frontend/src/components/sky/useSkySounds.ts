import { useCallback, useEffect, useRef } from 'react'

type UseSkySoundsOptions = {
  enabled: boolean
  flightActive?: boolean
}

const MIN_BIRD_DELAY = 1800
const MAX_BIRD_DELAY = 5000

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

export function useSkySounds({ enabled, flightActive = false }: UseSkySoundsOptions) {
  const contextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const ambientSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const windSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const windGainRef = useRef<GainNode | null>(null)
  const birdTimerRef = useRef<number | null>(null)
  const birdBusyUntilRef = useRef(0)
  const seagullBufferRef = useRef<AudioBuffer | null>(null)
  const seagullLoadRef = useRef<Promise<void> | null>(null)
  const enabledRef = useRef(enabled)
  const flightActiveRef = useRef(flightActive)
  const disposedRef = useRef(false)

  enabledRef.current = enabled
  flightActiveRef.current = flightActive

  const clearBirdTimer = useCallback(() => {
    if (birdTimerRef.current !== null) {
      window.clearTimeout(birdTimerRef.current)
      birdTimerRef.current = null
    }
  }, [])

  const loadSeagull = useCallback((context: AudioContext) => {
    if (seagullBufferRef.current || seagullLoadRef.current) return

    seagullLoadRef.current = fetch('/assets/audio/seagull.ogg')
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load seagull sound: ${response.status}`)
        return response.arrayBuffer()
      })
      .then((audioData) => context.decodeAudioData(audioData))
      .then((buffer) => {
        seagullBufferRef.current = buffer
      })
      .catch(() => {
        seagullLoadRef.current = null
      })
  }, [])

  const playSynthBirdCall = useCallback((context: AudioContext, output: AudioNode) => {
    const startAt = context.currentTime
    const callLength = randomBetween(0.32, 0.48)
    const baseFrequency = randomBetween(1450, 2200)
    const callGain = context.createGain()

    callGain.gain.setValueAtTime(0.0001, startAt)
    callGain.gain.exponentialRampToValueAtTime(0.035, startAt + 0.025)
    callGain.gain.exponentialRampToValueAtTime(0.0001, startAt + callLength)
    callGain.connect(output)

    let lastOscillator: OscillatorNode | null = null

    for (let note = 0; note < 2; note += 1) {
      const oscillator = context.createOscillator()
      const noteStart = startAt + note * 0.13
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(baseFrequency * (1 + note * 0.08), noteStart)
      oscillator.frequency.exponentialRampToValueAtTime(baseFrequency * 1.55, noteStart + 0.09)
      oscillator.frequency.exponentialRampToValueAtTime(baseFrequency * 0.92, noteStart + 0.18)
      oscillator.connect(callGain)
      oscillator.start(noteStart)
      oscillator.stop(noteStart + 0.2)
      lastOscillator = oscillator
    }

    lastOscillator?.addEventListener('ended', () => {
      callGain.disconnect()
    }, { once: true })

    return callLength * 1000
  }, [])

  const playSeagullCall = useCallback((context: AudioContext, output: AudioNode, buffer: AudioBuffer) => {
    const source = context.createBufferSource()
    const callGain = context.createGain()

    source.buffer = buffer
    callGain.gain.value = 0.018
    source.connect(callGain).connect(output)
    source.addEventListener('ended', () => {
      source.disconnect()
      callGain.disconnect()
    }, { once: true })
    source.start()

    return buffer.duration * 1000
  }, [])

  const playBirdCall = useCallback(async (context: AudioContext, output: AudioNode) => {
    if (
      disposedRef.current
      || !enabledRef.current
      || performance.now() < birdBusyUntilRef.current
    ) return

    if (context.state === 'suspended') {
      try {
        await context.resume()
      } catch {
        return
      }
    }

    if (context.state !== 'running' || disposedRef.current || !enabledRef.current) return

    const seagullBuffer = seagullBufferRef.current
    const duration = seagullBuffer && Math.random() < 0.4
      ? playSeagullCall(context, output, seagullBuffer)
      : playSynthBirdCall(context, output)

    birdBusyUntilRef.current = performance.now() + duration + 100
  }, [playSeagullCall, playSynthBirdCall])

  const scheduleBirdCall = useCallback((context: AudioContext, output: AudioNode) => {
    clearBirdTimer()
    birdTimerRef.current = window.setTimeout(async () => {
      birdTimerRef.current = null
      await playBirdCall(context, output)
      if (!disposedRef.current && enabledRef.current) scheduleBirdCall(context, output)
    }, randomBetween(MIN_BIRD_DELAY, MAX_BIRD_DELAY))
  }, [clearBirdTimer, playBirdCall])

  const startAmbient = useCallback((context: AudioContext, output: AudioNode) => {
    if (ambientSourceRef.current) return

    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate)
    const channel = buffer.getChannelData(0)
    let previous = 0

    for (let index = 0; index < channel.length; index += 1) {
      const whiteNoise = Math.random() * 2 - 1
      previous = previous * 0.985 + whiteNoise * 0.015
      channel[index] = previous * 1.8
    }

    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const ambientGain = context.createGain()

    source.buffer = buffer
    source.loop = true
    filter.type = 'lowpass'
    filter.frequency.value = 720
    ambientGain.gain.value = 0.045
    source.connect(filter).connect(ambientGain).connect(output)
    source.start()
    ambientSourceRef.current = source
  }, [])

  const startWind = useCallback((context: AudioContext, output: AudioNode) => {
    if (windSourceRef.current) return

    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate)
    const channel = buffer.getChannelData(0)
    let smoothed = 0

    for (let index = 0; index < channel.length; index += 1) {
      smoothed = smoothed * 0.72 + (Math.random() * 2 - 1) * 0.28
      channel[index] = smoothed
    }

    const source = context.createBufferSource()
    const highpass = context.createBiquadFilter()
    const lowpass = context.createBiquadFilter()
    const windGain = context.createGain()

    source.buffer = buffer
    source.loop = true
    highpass.type = 'highpass'
    highpass.frequency.value = 180
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 1850
    windGain.gain.value = 0.0001
    source.connect(highpass).connect(lowpass).connect(windGain).connect(output)
    source.start()
    windSourceRef.current = source
    windGainRef.current = windGain
    windGain.gain.setTargetAtTime(flightActiveRef.current ? 0.11 : 0.0001, context.currentTime, 0.22)
  }, [])

  const unlockSkySounds = useCallback(async () => {
    if (!enabledRef.current) return

    const AudioContextConstructor = window.AudioContext
    const context = contextRef.current ?? new AudioContextConstructor()

    if (!contextRef.current) {
      const masterGain = context.createGain()
      masterGain.gain.value = 1
      masterGain.connect(context.destination)
      contextRef.current = context
      masterGainRef.current = masterGain
    }

    if (context.state === 'suspended') await context.resume()

    const masterGain = masterGainRef.current
    if (!masterGain) return

    masterGain.gain.setTargetAtTime(1, context.currentTime, 0.04)
    startAmbient(context, masterGain)
    startWind(context, masterGain)
    loadSeagull(context)
    if (birdTimerRef.current === null) scheduleBirdCall(context, masterGain)
  }, [loadSeagull, scheduleBirdCall, startAmbient, startWind])

  useEffect(() => {
    const context = contextRef.current
    const masterGain = masterGainRef.current

    if (!enabled) {
      clearBirdTimer()
      birdBusyUntilRef.current = 0
      if (context && masterGain) masterGain.gain.setTargetAtTime(0.0001, context.currentTime, 0.04)
      return
    }

    if (context && masterGain) {
      masterGain.gain.setTargetAtTime(1, context.currentTime, 0.04)
      if (birdTimerRef.current === null) scheduleBirdCall(context, masterGain)
    }
  }, [clearBirdTimer, enabled, scheduleBirdCall])

  useEffect(() => {
    const context = contextRef.current
    const windGain = windGainRef.current
    if (!context || !windGain) return

    windGain.gain.setTargetAtTime(
      enabled && flightActive ? 0.11 : 0.0001,
      context.currentTime,
      flightActive ? 0.28 : 0.45,
    )
  }, [enabled, flightActive])

  useEffect(() => {
    disposedRef.current = false

    return () => {
      disposedRef.current = true
      clearBirdTimer()
      ambientSourceRef.current?.stop()
      windSourceRef.current?.stop()
      void contextRef.current?.close()
    }
  }, [clearBirdTimer])

  return { unlockSkySounds }
}
