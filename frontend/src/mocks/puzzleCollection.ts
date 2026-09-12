export type PuzzleCollectionMock = {
  id: string
  name: string
  locked: boolean
  rewardClothingId?: string
  rewardName: string
  totalFragments: number
}

export const HIGH_FLIGHT_PIECES = Array.from(
  { length: 12 },
  (_, index) => ({
    collected: `/assets/puzzle-pieces/pzS_${index + 1}.svg`,
    pending: `/assets/puzzle-pieces/npuzzleShina/npzS_${index + 1}.png`,
  }),
)

export const PUZZLE_COLLECTION_MOCKS: PuzzleCollectionMock[] = [
  {
    id: 'high-flight',
    name: 'Высокий полёт',
    locked: false,
    rewardClothingId: 'cloud-scarf',
    rewardName: 'Облачный шарфик',
    totalFragments: 12,
  },
  {
    id: 'coming-soon',
    name: 'Скоро',
    locked: true,
    rewardName: 'Новая награда',
    totalFragments: 12,
  },
]
