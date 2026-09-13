import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LevelProgressTrack } from './LevelProgressTrack'

const redLevels = [1.2, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20]

function renderTrack(reachedLevels: number) {
  return render(
    <LevelProgressTrack
      boosterLevel={7}
      boosterMultiplier={3}
      levels={redLevels}
      progress={Math.min(1, reachedLevels / redLevels.length)}
      reachedLevels={reachedLevels}
      theme="red"
    />,
  )
}

describe('LevelProgressTrack', () => {
  it('colours every authoritative level through the end of the red route', () => {
    const view = renderTrack(0)

    for (let reachedLevels = 0; reachedLevels <= redLevels.length; reachedLevels += 1) {
      view.rerender(
        <LevelProgressTrack
          boosterLevel={7}
          boosterMultiplier={3}
          levels={redLevels}
          progress={Math.min(1, reachedLevels / redLevels.length)}
          reachedLevels={reachedLevels}
          theme="red"
        />,
      )

      const dots = [...view.container.querySelectorAll<HTMLElement>('[data-level]')]
      expect(dots).toHaveLength(12)
      expect(dots.filter((level) => level.dataset.reached === 'true')).toHaveLength(reachedLevels)
      expect(dots.slice(0, reachedLevels).every((level) => level.classList.contains('is-reached'))).toBe(true)
      expect(dots.slice(reachedLevels).every((level) => !level.classList.contains('is-reached'))).toBe(true)
    }
  })

  it('bounds malformed server counts without limiting valid routes', () => {
    const below = renderTrack(-2)
    expect(below.container.querySelectorAll('.crash-level.is-reached')).toHaveLength(0)
    below.unmount()

    const above = renderTrack(99)
    expect(above.container.querySelectorAll('.crash-level.is-reached')).toHaveLength(12)
    above.rerender(
      <LevelProgressTrack
        boosterLevel={7}
        boosterMultiplier={3}
        levels={redLevels}
        progress={0}
        reachedLevels={Number.NaN}
        theme="red"
      />,
    )
    expect(above.container.querySelectorAll('.crash-level.is-reached')).toHaveLength(0)
  })

  it('does not lose server-reached levels when a booster jumps ahead of the visual position', () => {
    const view = render(
      <LevelProgressTrack
        boosterLevel={3}
        boosterMultiplier={4}
        levels={redLevels}
        progress={3 / redLevels.length}
        reachedLevels={7}
        theme="red"
      />,
    )

    const dots = [...view.container.querySelectorAll<HTMLElement>('[data-level]')]
    expect(dots.slice(0, 7).every(level => level.dataset.reached === 'true')).toBe(true)
    expect(dots.slice(7).every(level => level.dataset.reached === 'false')).toBe(true)
  })
})
