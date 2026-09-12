export type Category = 'head' | 'neck' | 'clothes'
export type Outfit = { name: string; head: 'aviator' | 'sunhat'; neck: 'bow' | 'cloud-scarf'; clothes: null }
export type Item = { id: string; category: Category; name: string; description: string; sheet: string; crop: [number, number, number, number]; locked?: string; price?: number }
export const asset = (name: string) => `/assets/avatar/${name}.png`
export const categories: { id: Category; name: string; title: string; hint: string; icon: string }[] = [
  { id: 'head', name: 'Голова', title: 'Головные уборы', hint: 'Два головных убора — выбирай настроение!', icon: '🎩' },
  { id: 'neck', name: 'Шея', title: 'Шарфы и украшения', hint: 'Бабочка или облачный шарфик — к любому головному убору.', icon: '🧣' },
  { id: 'clothes', name: 'Одежда', title: 'Одежда', hint: 'Скоро появится', icon: '👕' },
]
export const items: Item[] = [
  { id: 'aviator', category: 'head', name: 'Авиатор', description: 'Очки авиатора для воздушных путешествий.', sheet: 'headwear', crop: [550, 40, 335, 140] },
  { id: 'sunhat', category: 'head', name: 'Соломенная шляпа', description: 'Солнечное настроение и ромашка на память о лете.', sheet: 'headwear', crop: [0, 35, 485, 390] },
  { id: 'cloud-scarf', category: 'neck', name: 'Облачный шарфик', description: 'Мягкий шарфик с маленькими белыми облаками.', sheet: 'neckwear', crop: [25, 25, 465, 405] },
  { id: 'bow', category: 'neck', name: 'Красная бабочка', description: 'Праздничный акцент на каждый день.', sheet: 'neckwear', crop: [500, 85, 480, 330] },
]
export const defaultOutfit: Outfit = { name: 'Пушок', head: 'aviator', neck: 'bow', clothes: null }
export const findItem = (id: string | null) => items.find(i => i.id === id)
export const outfitKey = (scope: string) => `air-balloon-avatar-v1:${scope}`
// Explicit allow-list migrates outfits from the earlier unrestricted prototype.
export function normalizeOutfit(value: unknown): Outfit {
  const saved = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    name: typeof saved.name === 'string' && saved.name.trim() ? saved.name.trim().slice(0, 24) : defaultOutfit.name,
    head: saved.head === 'sunhat' ? 'sunhat' : 'aviator',
    neck: saved.neck === 'cloud-scarf' ? 'cloud-scarf' : 'bow',
    clothes: null,
  }
}
export function readOutfit(scope: string): Outfit {
  try { return normalizeOutfit(JSON.parse(localStorage.getItem(outfitKey(scope)) ?? 'null')) }
  catch { return { ...defaultOutfit } }
}
export const renderAssets = {
  'aviator:bow': asset('rendered-aviator-bow-v2'),
  'aviator:cloud-scarf': asset('rendered-aviator-cloud-scarf-v3'),
  'sunhat:bow': asset('rendered-sunhat-bow'),
  'sunhat:cloud-scarf': asset('rendered-sunhat-cloud-scarf-v2'),
} as const
export function outfitImage(outfit: Outfit) { return renderAssets[`${outfit.head}:${outfit.neck}`] }
