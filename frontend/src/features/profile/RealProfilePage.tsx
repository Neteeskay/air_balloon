import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Api, User } from '../../api/types'
import type { MockEquippedClothing, MockPuzzle, MockTheme } from '../../mocks/mockGame'
import { PUZZLE_COLLECTION_MOCKS } from '../../mocks/puzzleCollection'
import { AvatarProfile } from '../avatar/AvatarProfile'
import type { OutfitRewardsState } from './OutfitRewardsPanel'

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
  puzzles: MockPuzzle[]
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

function fallbackPuzzles(): MockPuzzle[] {
  return PUZZLE_COLLECTION_MOCKS.map((definition, index) => ({
    id: definition.id,
    name: definition.name,
    totalFragments: definition.totalFragments,
    collectedFragments: index === 0 ? 8 : 0,
    rewardClothingId: definition.rewardClothingId ?? '',
    rewardName: definition.rewardName,
    completed: false,
  }))
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
  const wardrobe = Array.isArray(wardrobeValue)
    ? wardrobeValue.map(record) as WardrobeDto[]
    : Array.isArray(profile.wardrobe) ? profile.wardrobe : []
  const rewardNames = new Map(wardrobe.map(item => [visualId(item.id), item.displayName ?? '']))
  const fallbacks = fallbackPuzzles()
  const sourcePuzzles = (Array.isArray(profile.puzzles) ? profile.puzzles : [])
    .filter(value => value?.active !== false)
  const puzzles = (sourcePuzzles.length > 0 ? sourcePuzzles : fallbacks).map((sourcePuzzle, index): MockPuzzle => {
    const sourceId = visualId(sourcePuzzle?.id)
    const fallback = fallbacks.find(item => item.id === sourceId) ?? fallbacks[index] ?? fallbacks[0]
    const totalFragments = Math.max(1, Math.floor(numberOr(sourcePuzzle?.totalFragments, fallback.totalFragments)))
    const collectedFragments = Math.max(0, Math.min(totalFragments, Math.floor(numberOr(sourcePuzzle?.collectedFragments, 0))))
    const rewardClothingId = visualId(sourcePuzzle?.rewardClothingId) || fallback.rewardClothingId
    return {
      id: sourceId || fallback.id,
      name: typeof sourcePuzzle?.name === 'string' && sourcePuzzle.name.trim() ? sourcePuzzle.name : fallback.name,
      totalFragments,
      collectedFragments,
      rewardClothingId,
      rewardName: rewardNames.get(rewardClothingId) || fallback.rewardName,
      completed: sourcePuzzle?.completed === true || collectedFragments === totalFragments,
    }
  })
  const puzzle = puzzles.find(value => !value.completed) ?? puzzles[0]
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
    puzzles,
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
  const [currentBalance, setCurrentBalance] = useState(balance)
  const [outfitRewards, setOutfitRewards] = useState<OutfitRewardsState>({ status: 'loading', items: [] })
  const fallback = useMemo(() => fallbackView(user), [user])

  useEffect(() => { setCurrentBalance(balance) }, [balance])

  const refreshOutfitRewards = useCallback(async () => {
    setOutfitRewards((current) => ({ status: 'loading', items: current.items }))
    try {
      const items = await api.profile.getOutfitRewards()
      setOutfitRewards({ status: 'ready', items: Array.isArray(items) ? items : [] })
    } catch {
      setOutfitRewards((current) => ({ status: 'error', items: current.items }))
    }
  }, [api])

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
    void refreshOutfitRewards()
    return () => { live = false }
  }, [api, fallback, refreshOutfitRewards, user])

  const save = useCallback(async (_petName: string, equipped: MockEquippedClothing) => {
    const result = await api.profile.equip(serverId(equipped.headId), serverId(equipped.neckId))
    setView((current) => current ? { ...current, equippedClothing: equipped } : current)
    await refreshOutfitRewards()
    const wallet = await api.economy.getBalance().catch(() => null)
    if (wallet) setCurrentBalance(wallet.bonusBalance)
    else {
      const balanceAfter = record(result).balanceAfter
      if (typeof balanceAfter === 'number' && Number.isFinite(balanceAfter)) setCurrentBalance(balanceAfter)
    }
  }, [api, refreshOutfitRewards])

  if (loading || !view) {
    return <main className="av-world av-profile-loading" role="status"><p>Загружаем профиль…</p></main>
  }

  return <AvatarProfile
    api={api}
    balance={currentBalance}
    equippedClothing={view.equippedClothing}
    favoriteTheme={view.favoriteTheme}
    gamesPlayed={view.gamesPlayed}
    onClose={onClose}
    onFortunePrize={() => undefined}
    onLogout={onLogout}
    onSave={save}
    onToggleSound={onToggleSound}
    outfitRewards={outfitRewards}
    onRetryOutfitRewards={() => { void refreshOutfitRewards() }}
    petName="Пушок"
    puzzle={view.puzzle}
    puzzles={view.puzzles}
    score={view.score}
    soundOn={soundOn}
    unlockedClothingIds={view.unlockedClothingIds}
    userId={user.id}
    userName={view.userName}
    wins={view.wins}
  />
}
