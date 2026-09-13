import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Api, User } from '../../api/types'
import type { MockEquippedClothing, MockPuzzle, MockTheme } from '../../mocks/mockGame'
import { AvatarProfile } from '../avatar/AvatarProfile'

type ProfileDto = {
  user?: { displayName?: string; username?: string; gameScore?: number; bonusBalance?: number }
  avatar?: { equipped?: { headId?: string | null; neckId?: string | null } }
  puzzles?: Array<{
    id?: string
    name?: string
    totalFragments?: number
    collectedFragments?: number
    completed?: boolean
    rewardClothingId?: string
    active?: boolean
  }>
  wardrobe?: WardrobeDto[]
}

type WardrobeDto = {
  id?: string
  displayName?: string
  slot?: string
  active?: boolean
  unlocked?: boolean
}

type ProfileViewModel = {
  userName: string
  score: number
  gamesPlayed: number
  wins: number
  favoriteTheme: MockTheme
  puzzle: MockPuzzle
  unlockedClothingIds: string[]
  equippedClothing: MockEquippedClothing
}

const DEFAULT_UNLOCKED = ['aviator', 'sunhat', 'bow']
const SUPPORTED_CLOTHING = new Set(['aviator', 'sunhat', 'bow', 'cloud-scarf'])

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function visualId(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase().replaceAll('_', '-')
}

function serverId(value: string) {
  return value.replaceAll('-', '_').toUpperCase()
}

function fallbackPuzzle(): MockPuzzle {
  return {
    id: 'high-flight',
    name: 'Высокий полёт',
    totalFragments: 12,
    collectedFragments: 8,
    rewardClothingId: 'cloud-scarf',
    completed: false,
  }
}

function historyItems(value: unknown) {
  const candidate = record(value)
  return Array.isArray(candidate.items) ? candidate.items.map(record) : []
}

function buildViewModel(
  profileValue: unknown,
  wardrobeValue: unknown,
  historyValue: unknown,
  user: User,
): ProfileViewModel {
  const profile = record(profileValue) as ProfileDto
  const profileUser = record(profile.user)
  const avatar = record(profile.avatar)
  const equipped = record(avatar.equipped)
  const puzzles = Array.isArray(profile.puzzles) ? profile.puzzles : []
  const sourcePuzzle = puzzles.find((value) => value?.active !== false) ?? puzzles[0]
  const fallback = fallbackPuzzle()
  const totalFragments = Math.max(1, Math.floor(numberOr(sourcePuzzle?.totalFragments, fallback.totalFragments)))
  const collectedFragments = Math.max(0, Math.min(totalFragments, Math.floor(numberOr(sourcePuzzle?.collectedFragments, 0))))
  const puzzle: MockPuzzle = {
    id: typeof sourcePuzzle?.id === 'string' ? sourcePuzzle.id.toLowerCase() : fallback.id,
    name: typeof sourcePuzzle?.name === 'string' && sourcePuzzle.name.trim() ? sourcePuzzle.name : fallback.name,
    totalFragments,
    collectedFragments,
    rewardClothingId: visualId(sourcePuzzle?.rewardClothingId) || fallback.rewardClothingId,
    completed: sourcePuzzle?.completed === true || collectedFragments === totalFragments,
  }

  const wardrobe = Array.isArray(wardrobeValue)
    ? wardrobeValue.map(record) as WardrobeDto[]
    : Array.isArray(profile.wardrobe) ? profile.wardrobe : []
  const unlocked = wardrobe
    .filter((item) => item.active !== false && item.unlocked === true)
    .map((item) => visualId(item.id))
    .filter((id) => SUPPORTED_CLOTHING.has(id))
  const unlockedClothingIds = wardrobe.length > 0 ? [...new Set(unlocked)] : DEFAULT_UNLOCKED
  const headId = visualId(equipped.headId)
  const neckId = visualId(equipped.neckId)
  const items = historyItems(historyValue)
  const themes = items.reduce<{ green: number; red: number }>((counts, item) => {
    const theme = typeof item.theme === 'string' ? item.theme.toLowerCase() : ''
    if (theme === 'green') counts.green++
    if (theme === 'red') counts.red++
    return counts
  }, { green: 0, red: 0 })

  return {
    userName: typeof profileUser.displayName === 'string' && profileUser.displayName.trim() ? profileUser.displayName : user.name,
    score: Math.max(0, Math.floor(numberOr(profileUser.gameScore, 0))),
    gamesPlayed: Math.max(0, Math.floor(numberOr(record(historyValue).total, items.length))),
    wins: items.filter((item) => item.result === 'WIN').length,
    favoriteTheme: themes.green > themes.red ? 'green' : 'red',
    puzzle,
    unlockedClothingIds,
    equippedClothing: {
      headId: headId === 'sunhat' ? 'sunhat' : 'aviator',
      neckId: neckId === 'cloud-scarf' ? 'cloud-scarf' : 'bow',
    },
  }
}

const fallbackView = (user: User): ProfileViewModel => buildViewModel({}, [], [], user)

type RealProfilePageProps = {
  api: Api
  user: User
  balance: number
  onClose: () => void
  /** Kept for route compatibility; rating is now opened from the tournament menu. */
  onOpenRating?: () => void
  onLogout?: () => void | Promise<void>
  soundOn?: boolean
  onToggleSound?: () => void
}

export function RealProfilePage({
  api,
  user,
  balance,
  onClose,
  onLogout,
  soundOn = true,
  onToggleSound = () => undefined,
}: RealProfilePageProps) {
  const [view, setView] = useState<ProfileViewModel | null>(null)
  const [loading, setLoading] = useState(true)
  const fallback = useMemo(() => fallbackView(user), [user])

  useEffect(() => {
    let live = true
    setLoading(true)
    void Promise.all([
      api.profile.get(),
      api.profile.wardrobe().catch(() => null),
      api.history.getPersonalHistory().catch(() => null),
    ]).then(([profile, wardrobe, history]) => {
      if (!live) return
      setView(buildViewModel(profile, wardrobe, history, user))
    }).catch(() => {
      if (live) setView(fallback)
    }).finally(() => {
      if (live) setLoading(false)
    })
    return () => { live = false }
  }, [api, fallback, user])

  const save = useCallback(async (_petName: string, equipped: MockEquippedClothing) => {
    await api.profile.equip(serverId(equipped.headId), serverId(equipped.neckId))
    setView((current) => current ? { ...current, equippedClothing: equipped } : current)
  }, [api])

  if (loading || !view) {
    return <main className="av-world av-profile-loading" role="status"><p>Загружаем профиль…</p></main>
  }

  return <AvatarProfile
    api={api}
    balance={balance}
    equippedClothing={view.equippedClothing}
    favoriteTheme={view.favoriteTheme}
    gamesPlayed={view.gamesPlayed}
    onClose={onClose}
    onFortunePrize={() => undefined}
    onLogout={onLogout}
    onSave={save}
    onToggleSound={onToggleSound}
    petName="Пушок"
    puzzle={view.puzzle}
    score={view.score}
    soundOn={soundOn}
    unlockedClothingIds={view.unlockedClothingIds}
    userId={user.id}
    userName={view.userName}
    wins={view.wins}
  />
}
