/**
 * Persistent user-facing background music.
 *
 * This module intentionally owns one HTMLAudioElement for the lifetime of the
 * page. Route components can mount/unmount freely without resetting playback.
 */

export const BACKGROUND_MUSIC_VOLUME = 0.2
export const BACKGROUND_MUSIC_SRC = '/assets/audio/upward-loop.mp3'

type AudioFactory = (src: string) => HTMLAudioElement

const defaultAudioFactory: AudioFactory = (src) => new Audio(src)

export class BackgroundMusic {
  private audio: HTMLAudioElement | null = null
  private audioFactory: AudioFactory
  private active = false
  private muted = false
  private volume = BACKGROUND_MUSIC_VOLUME
  private listenersAttached = false
  private playPromise: Promise<void> | null = null

  constructor(audioFactory: AudioFactory = defaultAudioFactory) {
    this.audioFactory = audioFactory
    this.muted = this.readMutedPreference()
  }

  private readonly onUserGesture = () => {
    if (this.active && !this.muted) void this.play()
  }

  private readMutedPreference() {
    if (typeof window === 'undefined') return false
    try { return window.localStorage.getItem('air-balloon:background-music-muted') === 'true' } catch { return false }
  }

  private persistMutedPreference() {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem('air-balloon:background-music-muted', String(this.muted)) } catch { /* storage is optional */ }
  }

  private ensureAudio() {
    if (typeof window === 'undefined') return null
    if (!this.audio) {
      const audio = this.audioFactory(BACKGROUND_MUSIC_SRC)
      audio.loop = true
      audio.preload = 'auto'
      audio.volume = this.muted ? 0 : this.volume
      this.audio = audio
    }
    return this.audio
  }

  private attachGestureListeners() {
    if (this.listenersAttached || typeof window === 'undefined') return
    const options: AddEventListenerOptions = { passive: true }
    window.addEventListener('pointerdown', this.onUserGesture, options)
    window.addEventListener('touchstart', this.onUserGesture, options)
    window.addEventListener('click', this.onUserGesture, options)
    window.addEventListener('keydown', this.onUserGesture, options)
    this.listenersAttached = true
  }

  private detachGestureListeners() {
    if (!this.listenersAttached || typeof window === 'undefined') return
    window.removeEventListener('pointerdown', this.onUserGesture)
    window.removeEventListener('touchstart', this.onUserGesture)
    window.removeEventListener('click', this.onUserGesture)
    window.removeEventListener('keydown', this.onUserGesture)
    this.listenersAttached = false
  }

  /** Called while the user application is mounted (including all its routes). */
  mount() {
    this.active = true
    this.ensureAudio()
    this.attachGestureListeners()
  }

  /** Stops playback and releases page listeners when the user app unmounts. */
  unmount() {
    this.active = false
    this.pause()
    // The user app is no longer allowed to start playback while Admin owns
    // the document. A fresh gesture after remount may create the next request.
    this.playPromise = null
    this.detachGestureListeners()
  }

  /** Toggle user/admin ownership without creating another audio element. */
  setUserAppActive(active: boolean) {
    if (active) this.mount()
    else this.unmount()
  }

  play = async () => {
    const audio = this.ensureAudio()
    if (!audio || !this.active || this.muted) return
    if (this.playPromise) return this.playPromise
    if (!audio.paused) return

    // Browsers reject autoplay until a gesture. This is expected and must not
    // become an application error or an unhandled promise rejection.
    let result: Promise<void> | void
    try {
      result = audio.play()
    } catch {
      result = Promise.reject(new Error('Background music playback was blocked'))
    }
    this.playPromise = Promise.resolve(result)
      .catch(() => undefined)
      .finally(() => {
        this.playPromise = null
        // A pending play() can settle after a rapid mute/pause click. Apply
        // the final preference once more so playback cannot leak through.
        if (this.muted) this.audio?.pause()
      })
    return this.playPromise
  }

  /** Unlock/play entry point for existing app gesture handlers. */
  unlock = () => { void this.play() }

  pause = () => {
    this.audio?.pause()
  }

  setMuted = (muted: boolean) => {
    this.muted = muted
    this.persistMutedPreference()
    const audio = this.ensureAudio()
    if (!audio) return
    audio.muted = muted
    audio.volume = muted ? 0 : this.volume
    if (muted) this.pause()
    else if (this.active) void this.play()
  }

  setVolume = (volume: number) => {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.audio && !this.muted) this.audio.volume = this.volume
  }

  /** Exposed for diagnostics/tests; callers must not replace the element. */
  getAudioElement = () => this.audio
  isMuted = () => this.muted
}

export const backgroundMusic = new BackgroundMusic()
