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
    id: 'puzzle-1',
    name: 'Вокруг света',
    locked: false,
    rewardClothingId: 'cloud-scarf',
    rewardName: 'Облачный шарфик',
    totalFragments: 12,
  },
  {
    id: 'puzzle-2',
    name: 'Космическая экспедиция',
    locked: false,
    rewardClothingId: 'space-hat',
    rewardName: 'Космическая шапка',
    totalFragments: 8,
  },
  {
    id: 'puzzle-3',
    name: 'Небесное путешествие',
    locked: false,
    rewardClothingId: 'traveler-costume',
    rewardName: 'Костюм путешественника',
    totalFragments: 6,
  },
]
