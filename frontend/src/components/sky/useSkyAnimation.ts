import { useState } from 'react'

export type SkyElement = {
  id: string
  direction: 'left-to-right' | 'right-to-left'
  duration: number
  delay: number
  top: number
  drift: number
  scale: number
  startX: number
  middleX: number
  variant: number
}

export type BirdSkyElement = {
  id: string
  direction: 'left-to-right' | 'right-to-left'
  mirrored: boolean
  duration: number
  delay: number
  scale: number
  startEdge: 'left' | 'right' | 'top'
  startX: number
  startY: number
  middleX: number
  middleY: number
  endX: number
  endY: number
}

const randomUnit = () => {
  if (!globalThis.crypto?.getRandomValues) return Math.random()

  const value = new Uint32Array(1)
  globalThis.crypto.getRandomValues(value)
  return value[0] / 4_294_967_296
}

const randomBetween = (min: number, max: number) => min + randomUnit() * (max - min)
const randomCount = () => Math.floor(randomBetween(1, 4))

function shuffled<T>(values: T[]) {
  const result = [...values]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomBetween(0, index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }

  return result
}

function createClouds(): SkyElement[] {
  const count = randomCount()
  const horizontalBands = count === 1
    ? [[-10, 80]]
    : count === 2
      ? [[-18, 18], [62, 96]]
      : [[-22, 0], [28, 50], [75, 96]]
  const verticalBands = shuffled([[7, 13], [18, 24], [29, 34]]).slice(0, count)

  return Array.from({ length: count }, (_, index) => {
    const startX = randomBetween(horizontalBands[index][0], horizontalBands[index][1])
    const direction = startX < 24
      ? 'left-to-right'
      : startX > 68
        ? 'right-to-left'
        : randomUnit() > 0.5 ? 'left-to-right' : 'right-to-left'
    const endX = direction === 'left-to-right' ? 112 : -32

    return {
      id: `cloud-${index}-${randomUnit().toString(36).slice(2)}`,
      direction,
      duration: randomBetween(48, 78),
      delay: -randomBetween(0, 2.5),
      top: randomBetween(verticalBands[index][0], verticalBands[index][1]),
      drift: randomBetween(-8, 8),
      scale: randomBetween(0.72, 1.18),
      startX,
      middleX: (startX + endX) / 2 + randomBetween(-7, 7),
      variant: Math.floor(randomBetween(0, 7)),
    }
  })
}

function createBirds(): BirdSkyElement[] {
  const count = randomCount()
  const directions: BirdSkyElement['direction'][] = Array.from(
    { length: count },
    () => randomUnit() > 0.5 ? 'left-to-right' : 'right-to-left',
  )

  if (count > 1 && directions.every((direction) => direction === directions[0])) {
    const indexToFlip = Math.floor(randomBetween(0, count))
    directions[indexToFlip] = directions[indexToFlip] === 'left-to-right'
      ? 'right-to-left'
      : 'left-to-right'
  }

  return directions.map((direction, index) => {
    const startEdge: BirdSkyElement['startEdge'] = randomUnit() < 0.3
      ? 'top'
      : direction === 'left-to-right' ? 'left' : 'right'
    const duration = randomBetween(7.5, 12.5)
    const startX = startEdge === 'left' ? -24 : startEdge === 'right' ? 112 : randomBetween(8, 86)
    const startY = startEdge === 'top' ? -18 : randomBetween(10, 56)
    const endX = direction === 'left-to-right' ? 112 : -24
    const endY = randomBetween(12, 58)

    return {
      id: `bird-${index}-${randomUnit().toString(36).slice(2)}`,
      direction,
      mirrored: direction === 'right-to-left',
      duration,
      delay: -duration * randomBetween(0.12, 0.78),
      scale: randomBetween(0.72, 1),
      startEdge,
      startX,
      startY,
      middleX: (startX + endX) / 2 + randomBetween(-9, 9),
      middleY: (startY + endY) / 2 + randomBetween(-8, 8),
      endX,
      endY,
    }
  })
}

export function useSkyAnimation() {
  const [sky] = useState(() => ({
    birds: createBirds(),
    clouds: createClouds(),
  }))

  return sky
}
