import { PUZZLE_IDS } from '../data/puzzles'

export function pickRandomPuzzleIds(
  count: number,
  random: () => number = Math.random,
): number[] {
  const available = [...PUZZLE_IDS]

  for (let index = available.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1))
    ;[available[index], available[nextIndex]] = [available[nextIndex], available[index]]
  }

  return available.slice(0, count)
}
