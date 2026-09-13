import { afterEach, describe, expect, it, vi } from 'vitest'
import { BACKGROUND_MUSIC_SRC, BackgroundMusic } from './backgroundMusic'

class FakeAudio {
  loop = false
  preload = ''
  volume = 1
  muted = false
  paused = true
  play = vi.fn(async () => { this.paused = false })
  pause = vi.fn(() => { this.paused = true })
}

describe('BackgroundMusic', () => {
  afterEach(() => {
    window.localStorage.removeItem('air-balloon:background-music-muted')
    vi.restoreAllMocks()
  })

  function setup() {
    window.localStorage.removeItem('air-balloon:background-music-muted')
    const element = new FakeAudio()
    const manager = new BackgroundMusic(() => element as unknown as HTMLAudioElement)
    manager.mount()
    return { element, manager }
  }

  it('creates one looping track and starts on the first user gesture', async () => {
    const element = new FakeAudio()
    const factory = vi.fn(() => element as unknown as HTMLAudioElement)
    const manager = new BackgroundMusic(factory)
    manager.mount()
    manager.mount()

    expect(factory).toHaveBeenCalledTimes(1)
    expect(element.loop).toBe(true)
    expect(element.volume).toBe(0.2)
    expect(element).toBeDefined()

    window.dispatchEvent(new Event('click'))
    await Promise.resolve()
    expect(element.play).toHaveBeenCalledTimes(1)
  })

  it('pauses while the admin app is active and resumes after returning with a gesture', async () => {
    const { element, manager } = setup()
    window.dispatchEvent(new Event('pointerdown'))
    await Promise.resolve()
    expect(element.play).toHaveBeenCalledTimes(1)

    manager.setUserAppActive(false)
    expect(element.pause).toHaveBeenCalledTimes(1)
    manager.setUserAppActive(true)
    window.dispatchEvent(new Event('pointerdown'))
    await Promise.resolve()
    expect(element.play).toHaveBeenCalledTimes(2)
  })

  it('does not overlap play calls and swallows autoplay rejection', async () => {
    const { element, manager } = setup()
    let resolvePlay!: () => void
    element.play = vi.fn(() => new Promise<void>(resolve => { resolvePlay = () => { element.paused = false; resolve() } }))

    const first = manager.play()
    const second = manager.play()
    expect(element.play).toHaveBeenCalledTimes(1)
    resolvePlay()
    await Promise.all([first, second])

    element.paused = true
    element.play = vi.fn(() => Promise.reject(new Error('blocked')))
    await expect(manager.play()).resolves.toBeUndefined()
    expect(BACKGROUND_MUSIC_SRC).toBe('/assets/audio/upward-loop.mp3')
  })

  it('pauses on mute, resumes on unmute, and persists the manual preference', async () => {
    const { element, manager } = setup()
    await manager.play()

    manager.setMuted(true)
    expect(element.muted).toBe(true)
    expect(element.pause).toHaveBeenCalled()
    expect(manager.isMuted()).toBe(true)
    expect(window.localStorage.getItem('air-balloon:background-music-muted')).toBe('true')

    manager.setMuted(false)
    await Promise.resolve()
    expect(element.muted).toBe(false)
    expect(element.play).toHaveBeenCalledTimes(2)
    expect(manager.isMuted()).toBe(false)
  })

  it('does not auto-resume a manual mute after an Admin pause', async () => {
    const { element, manager } = setup()
    manager.setMuted(true)
    manager.setUserAppActive(false)
    manager.setUserAppActive(true)
    window.dispatchEvent(new Event('pointerdown'))
    await Promise.resolve()

    expect(element.play).not.toHaveBeenCalled()
    expect(manager.isMuted()).toBe(true)
  })

  it('keeps a rapid mute click safe while play is pending', async () => {
    const { element, manager } = setup()
    let resolvePlay!: () => void
    element.play = vi.fn(() => new Promise<void>(resolve => { resolvePlay = () => { element.paused = false; resolve() } }))

    void manager.play()
    manager.setMuted(true)
    resolvePlay()
    await Promise.resolve()
    await Promise.resolve()

    expect(element.pause).toHaveBeenCalled()
    expect(manager.isMuted()).toBe(true)
  })
})
