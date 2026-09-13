/** Small one-shot UI sounds used by the theme-selection controls. */

export const WATER_DROP_SOUND_SRC = '/assets/audio/water-drop.wav'

let waterDropAudio: HTMLAudioElement | null = null

function playSafely(audio: HTMLAudioElement) {
  try {
    void Promise.resolve(audio.play()).catch(() => {})
  } catch {
    // jsdom and older browsers may throw synchronously when media is absent.
  }
}

/**
 * Play the water-drop cue without making UI actions depend on audio loading.
 * Browsers allow this call when it is made from the user's button gesture;
 * autoplay/decoding failures are intentionally ignored.
 */
export function playWaterDrop(enabled = true) {
  if (!enabled || typeof window === 'undefined' || typeof Audio === 'undefined') return

  try {
    waterDropAudio ??= new Audio(WATER_DROP_SOUND_SRC)
  } catch {
    return
  }
  waterDropAudio.preload = 'auto'
  waterDropAudio.volume = 0.72
  waterDropAudio.currentTime = 0
  playSafely(waterDropAudio)
}
