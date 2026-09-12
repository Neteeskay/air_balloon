export type Category = 'head' | 'neck'
export type Outfit = { name: string; head: string; neck: string }
export type Item = {
  id: string
  category: Category
  name: string
  description: string
  sheet: string
  crop: [number, number, number, number]
  imageSize?: [number, number]
  reward?: boolean
}

export const asset = (name: string) => `/assets/avatar/${name}.png`

export const categories: { id: Category; name: string; title: string; hint: string; icon: string }[] = [
  { id: 'head', name: 'Голова', title: 'Головные уборы', hint: 'Выбирай настроение для следующего полёта.', icon: '🎩' },
  { id: 'neck', name: 'Шея', title: 'Одежда и аксессуары', hint: 'Некоторые предметы открываются за собранные пазлы.', icon: '🧣' },
]

export const items: Item[] = [
  { id: 'aviator', category: 'head', name: 'Авиатор', description: 'Повышает удачу в полёте.', sheet: 'aviator', crop: [0, 0, 461, 400], imageSize: [461, 400] },
  { id: 'sunhat', category: 'head', name: 'Соломенная шляпа', description: 'Солнечное настроение и ромашка на память о лете.', sheet: 'headwear', crop: [0, 35, 485, 390] },
  { id: 'bow', category: 'neck', name: 'Красная бабочка', description: 'Праздничный акцент на каждый день.', sheet: 'neckwear', crop: [500, 85, 480, 330] },
  { id: 'cloud-scarf', category: 'neck', name: 'Облачный шарфик', description: 'Даёт буст ×2 на один раунд.', sheet: 'neckwear', crop: [25, 25, 465, 405], reward: true },
]

export const defaultOutfit: Outfit = { name: 'Пушок', head: 'aviator', neck: 'bow' }
export const findItem = (id: string | null) => items.find((item) => item.id === id)

export function normalizeOutfit(value: unknown): Outfit {
  const saved = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    name: typeof saved.name === 'string' && saved.name.trim() ? saved.name.trim().slice(0, 24) : defaultOutfit.name,
    head: saved.head === 'sunhat' ? 'sunhat' : 'aviator',
    neck: saved.neck === 'cloud-scarf' ? 'cloud-scarf' : 'bow',
  }
}

export const renderAssets = {
  'aviator:bow': asset('rendered-aviator-bow-v2'),
  'aviator:cloud-scarf': asset('rendered-aviator-cloud-scarf-v3'),
  'sunhat:bow': asset('rendered-sunhat-bow'),
  'sunhat:cloud-scarf': asset('rendered-sunhat-cloud-scarf-v2'),
} as const

export function outfitImage(outfit: Outfit) {
  return renderAssets[`${outfit.head}:${outfit.neck}` as keyof typeof renderAssets]
}
