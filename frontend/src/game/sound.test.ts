import { describe, expect, it, vi } from 'vitest'
import { GameAudio } from './sound'

describe('GameAudio', () => {
  it('stays silent before a gesture and disconnects nodes after playback', async () => {
    const start = vi.fn(); const sourceDisconnect = vi.fn(); const gainDisconnect = vi.fn()
    let ended = () => {}
    class AudioContextMock {
      state = 'running' as AudioContextState
      destination = {}
      decodeAudioData = vi.fn(async () => ({} as AudioBuffer))
      createBufferSource = () => ({ buffer: null, connect: vi.fn(), start, disconnect: sourceDisconnect, addEventListener: (_name: string, listener: () => void) => { ended = listener } })
      createGain = () => ({ gain: { value: 0 }, connect: vi.fn(), disconnect: gainDisconnect })
      resume = vi.fn(async () => {})
    }
    vi.stubGlobal('AudioContext', AudioContextMock)
    const audio = new GameAudio()
    const cue = { type: 'LEVEL_REACHED' as const, roundId: 'round-1', sequence: 10 }

    audio.play(cue)
    expect(start).not.toHaveBeenCalled()
    audio.unlock(); await Promise.resolve(); await Promise.resolve()
    audio.play(cue)
    expect(start).toHaveBeenCalledOnce()
    ended()
    expect(sourceDisconnect).toHaveBeenCalledOnce(); expect(gainDisconnect).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('mute suppresses both feedback sounds', async () => {
    const start = vi.fn()
    class AudioContextMock {
      state = 'running' as AudioContextState
      destination = {}
      decodeAudioData = vi.fn(async () => ({} as AudioBuffer))
      createBufferSource = () => ({ buffer: null, connect: vi.fn(), start, disconnect: vi.fn(), addEventListener: vi.fn() })
      createGain = () => ({ gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() })
      resume = vi.fn(async () => {})
    }
    vi.stubGlobal('AudioContext', AudioContextMock)
    const audio = new GameAudio(); audio.unlock(); await Promise.resolve(); await Promise.resolve(); audio.setMuted(true)
    audio.play({ type: 'LEVEL_REACHED', roundId: 'round-1', sequence: 10 })
    audio.play({ type: 'BOOSTER_ACTIVATED', roundId: 'round-1', sequence: 11 })
    expect(start).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
