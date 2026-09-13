import { useEffect, useRef, useState } from 'react'
import { BarChart3, Gamepad2, Star, Trophy } from 'lucide-react'
import { FortuneWheelModal } from '../fortune/components/FortuneWheelModal'
import { useFortuneWheel } from '../fortune/hooks/useFortuneWheel'
import type { MockEquippedClothing, MockPuzzle, MockTheme } from '../../mocks/mockGame'
import type { FortuneWheelPrize } from '../../mocks/fortuneWheelPrizes'
import { PuzzlePieceGrid } from '../puzzles/components/PuzzlePieceGrid'
import { PuzzleCollectionPage } from '../puzzles/pages/PuzzleCollectionPage/PuzzleCollectionPage'
import { TopMenuActions } from '../betting/components/TopMenuActions'
import { TournamentModal } from '../betting/components/TournamentModal'
import { api as defaultApi } from '../../api'
import type { Api } from '../../api/types'
import type { OutfitRewardsState } from '../profile/OutfitRewardsPanel'
import { OutfitRewardsPanel } from '../profile/OutfitRewardsPanel'
import { ProfileHistoryModal } from '../history/ProfileHistoryModal'
import { asset, categories, findItem, items, normalizeOutfit, outfitImage, renderAssets, type Category, type Item, type Outfit } from './catalog'
import { ItemArt } from './ItemArt'
import './avatar.css'

function Lock() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3" fill="currentColor" /><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="3" /><circle cx="12" cy="15" r="1.5" fill="#938b80" /><path d="M12 15v3" stroke="#938b80" strokeWidth="2" /></svg>
}

const formatNumber = (value: number) => value.toLocaleString('ru-RU')

export { ItemArt } from './ItemArt'

export function PetPreview({ outfit }: { outfit: Outfit }) {
  const current = normalizeOutfit(outfit)
  const rendered = outfitImage(current)
  const [failed, setFailed] = useState<string | null>(null)
  return <div className="av-pet" role="img" aria-label={`${current.name}: ${findItem(current.head)?.name}, ${findItem(current.neck)?.name}`}>
    {failed === rendered ? <p className="av-render-error" role="alert">Не удалось загрузить образ. <button onClick={() => setFailed(null)}>Повторить</button></p> :
      <img key={rendered} className="av-pet-rendered" src={rendered} alt="" draggable={false} onError={() => setFailed(rendered)} />}
  </div>
}

type Props = {
  userId: string
  userName: string
  balance: number
  favoriteTheme: MockTheme
  gamesPlayed: number
  score: number
  wins: number
  petName: string
  puzzle: MockPuzzle
  unlockedClothingIds: string[]
  equippedClothing: MockEquippedClothing
  onFortunePrize: (prize: FortuneWheelPrize) => void
  soundOn: boolean
  onToggleSound: () => void
  onUnlockAudio?: () => void
  onSave: (petName: string, equipped: MockEquippedClothing) => void | Promise<void>
  api?: Api
  onLogout?: () => void | Promise<void>
  onClose: () => void
  outfitRewards?: OutfitRewardsState
  onRetryOutfitRewards?: () => void
}

export function AvatarProfile({
  userId,
  userName,
  balance,
  favoriteTheme,
  gamesPlayed,
  score,
  wins,
  petName,
  puzzle,
  unlockedClothingIds,
  equippedClothing,
  onFortunePrize,
  soundOn,
  onToggleSound,
  onUnlockAudio,
  onSave,
  api,
  onLogout,
  onClose,
  outfitRewards,
  onRetryOutfitRewards,
}: Props) {
  const initial: Outfit = normalizeOutfit({ name: petName, head: equippedClothing.headId, neck: equippedClothing.neckId })
  const [saved, setSaved] = useState<Outfit>(initial)
  const [draft, setDraft] = useState<Outfit>(initial)
  const [editing, setEditing] = useState(false)
  const [category, setCategory] = useState<Category>('head')
  const [selectedId, setSelectedId] = useState(initial.head)
  const [renaming, setRenaming] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [fortuneOpen, setFortuneOpen] = useState(false)
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [tournamentOpen, setTournamentOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const confirmPanel = useRef<HTMLElement>(null)
  const categoryInfo = categories.find((value) => value.id === category)!
  const selected = findItem(selectedId) ?? items[0]
  const selectedUnlocked = unlockedClothingIds.includes(selected.id)
  const equipped = draft[category] === selected.id
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft)
  const rewardItem = findItem(puzzle.rewardClothingId)
  const progress = Math.round((puzzle.collectedFragments / puzzle.totalFragments) * 100)
  const fortune = useFortuneWheel({ onPrize: onFortunePrize, userId })
  const tournamentApi = api ?? defaultApi
  const profileStats = [
    { id: 'score', icon: <Star />, value: formatNumber(score), label: 'Игровые очки' },
    { id: 'games', icon: <Gamepad2 />, value: formatNumber(gamesPlayed), label: 'Игр сыграно' },
    { id: 'wins', icon: <Trophy />, value: formatNumber(wins), label: 'Побед' },
    { id: 'mode', icon: <BarChart3 />, value: favoriteTheme === 'red' ? 'Красный шар' : 'Зелёный шар', label: 'Любимый режим' },
  ]

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const node = dialog.current!
    Object.values(renderAssets).forEach((src) => { const preload = new Image(); preload.src = src })
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    node.showModal()
    return () => { node.close(); document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  useEffect(() => { title.current?.focus() }, [editing])
  useEffect(() => { if (renaming) nameInput.current?.focus() }, [renaming])
  useEffect(() => { if (confirmLeave) confirmPanel.current?.querySelector('button')?.focus(); else title.current?.focus() }, [confirmLeave])

  const leave = () => {
    if (editing && dirty) { setConfirmLeave(true); return }
    if (editing) { setEditing(false); setError(''); setInfo('') } else onClose()
  }
  const openEditor = () => { setDraft(saved); setCategory('head'); setSelectedId(saved.head); setEditing(true); setNotice(''); setError(''); setInfo('') }
  const chooseCategory = (next: Category) => { setCategory(next); setSelectedId(draft[next]); setInfo('') }
  const selectItem = (item: Item) => { setSelectedId(item.id); setInfo('') }
  const equipSelected = () => {
    if (!selectedUnlocked || selected.category !== category) return
    setDraft((value) => normalizeOutfit({ ...value, [category]: selected.id }))
  }
  const save = () => {
    if (!draft.name.trim()) { setError('Дай питомцу имя — от 1 до 24 символов.'); setRenaming(true); return }
    const outfit = normalizeOutfit(draft)
    const complete = () => {
      setSaved(outfit); setDraft(outfit); setEditing(false); setNotice('Образ сохранён'); setError(''); setInfo(''); setRenaming(false)
    }
    try {
      const result = onSave(outfit.name, { headId: outfit.head, neckId: outfit.neck })
      if (result && typeof result.then === 'function') {
        void result.then(complete).catch((reason) => {
          setError(reason instanceof Error ? reason.message : 'Не удалось сохранить образ')
        })
      } else complete()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить образ')
    }
  }
  return <dialog ref={dialog} className="av-dialog" aria-label={editing ? undefined : 'Профиль'} aria-labelledby={editing ? 'av-title' : undefined} onCancel={(event) => {
    event.preventDefault()
    if (fortuneOpen) { if (!fortune.isSpinning) setFortuneOpen(false); return }
    if (collectionOpen) { setCollectionOpen(false); return }
    if (tournamentOpen) { setTournamentOpen(false); return }
    if (historyOpen) { setHistoryOpen(false); return }
    if (confirmLeave) setConfirmLeave(false); else if (info) setInfo(''); else leave()
  }}>
    <div className={`av-world ${editing ? 'av-world--editor' : ''}`} onPointerDownCapture={onUnlockAudio} onKeyDownCapture={onUnlockAudio}>
      <div inert={confirmLeave || fortuneOpen || collectionOpen || tournamentOpen || historyOpen}>
      <header className="av-header">
        <button className="av-blue av-back" onClick={leave}><span aria-hidden="true">←</span> Назад</button>
        {editing && <h1 id="av-title" ref={title} tabIndex={-1}>Настройка образа</h1>}
        <div className="av-balance" aria-label={`Бонусный баланс: ${formatNumber(balance)}`}><img src={asset('coin')} alt="" /><strong>{formatNumber(balance)}</strong></div>
        <TopMenuActions
          onOpenRules={() => { setProfileMenuOpen(false); setInfo(info ? '' : 'За каждый завершённый полёт ты получаешь фрагмент. Собери пазл полностью, чтобы открыть одежду. Полученный предмет можно надеть здесь, в гардеробе. Прогресс и образ сохраняются в профиле аккаунта.') }}
          onOpenTournament={() => { setProfileMenuOpen(false); setTournamentOpen(true) }}
          onOpenHistory={() => { setProfileMenuOpen(false); setHistoryOpen(true) }}
          onProfile={editing ? leave : () => undefined}
          onLogout={onLogout}
          onToggleProfileMenu={onLogout ? () => setProfileMenuOpen((value) => !value) : undefined}
          onCloseProfileMenu={() => setProfileMenuOpen(false)}
          profileMenuOpen={profileMenuOpen}
          onToggleSound={onToggleSound}
          soundOn={soundOn}
        />
      </header>
      {info && <div className="av-info" role="status"><p>{info}</p><button onClick={() => setInfo('')} aria-label="Закрыть подсказку">×</button></div>}
      {editing ? <>
        <div className="av-editor">
          <nav className="av-categories" aria-label="Категории образа">{categories.map((value) => <button key={value.id} className={category === value.id ? 'is-active' : ''} aria-pressed={category === value.id} onClick={() => chooseCategory(value.id)}><span aria-hidden="true">{value.icon}</span>{value.name}</button>)}</nav>
          <section className="av-preview" aria-label="Примерка образа">
            <PetPreview outfit={draft} />
            <div className="av-pedestal" />
            <div className="av-pet-name">{renaming ? <form onSubmit={(event) => { event.preventDefault(); if (draft.name.trim()) setRenaming(false) }}><input ref={nameInput} aria-label="Имя питомца" maxLength={24} value={draft.name} onChange={(event) => { setDraft((value) => ({ ...value, name: event.target.value })); setError('') }} /><button aria-label="Подтвердить имя" type="submit">✓</button></form> : <button onClick={() => setRenaming(true)} aria-label="Изменить имя питомца">{draft.name}<span aria-hidden="true">✎</span></button>}</div>
            <p className="av-quote">«Маленькие детали делают<br />большие приключения!»</p>
          </section>
          <section className="av-wardrobe" aria-labelledby="av-category-title">
            <div className="av-wardrobe-heading"><span aria-hidden="true">{categoryInfo.icon}</span><div><h2 id="av-category-title">{categoryInfo.title}</h2><p>{categoryInfo.hint}</p></div></div>
            <div className="av-items">{items.filter((item) => item.category === category).map((item) => {
              const unlocked = unlockedClothingIds.includes(item.id)
              return <button key={item.id} className={`av-item av-item--${item.id} ${selectedId === item.id ? 'is-selected' : ''} ${unlocked ? '' : 'is-locked'}`} aria-label={`${item.name}${unlocked ? '' : ', заблокировано'}`} aria-pressed={selectedId === item.id} onClick={() => selectItem(item)}>
                <ItemArt item={item} />{!unlocked && <span className="av-lock"><Lock /></span>}
                <span className="av-item-name">{item.name}</span>{draft[category] === item.id && <span className="av-check" aria-label="Надето">✓</span>}
                {!unlocked && <small>{item.reward ? 'Собери пазл' : 'Откроется позже'}</small>}
              </button>
            })}{[1, 2].map((value) => <div className="av-item av-coming" key={`coming-${category}-${value}`} role="img" aria-label="Скоро"><span aria-hidden="true">✦</span><Lock /><strong>Скоро</strong><small>Новый предмет</small></div>)}</div>
            <div className="av-detail" aria-live="polite"><div className="av-detail-art"><ItemArt item={selected} /></div><div className="av-detail-copy"><h3>{selected.name}</h3><p>{selected.description}</p><span className="av-cosmetic">✦ Меняет внешний вид</span></div><div className="av-equip">
              <button disabled={!selectedUnlocked || equipped} onClick={equipSelected}>{!selectedUnlocked ? <><Lock /> Закрыто</> : equipped ? 'Надето ✓' : 'Надеть'}</button>
            </div>{!selectedUnlocked && <p className="av-locked-reason">Собери пазл «{puzzle.name}»: {puzzle.collectedFragments} / {puzzle.totalFragments}</p>}</div>
          </section>
        </div>
        <footer className="av-savebar">{error && <p className="av-error" role="alert">{error}</p>}<button className="av-gold av-save" onClick={save}>Сохранить образ</button></footer>
      </> : <>
        {notice && <p className="av-success" role="status">✓ {notice}</p>}
        <div className="av-profile-grid">
          <section className="av-profile-card"><div className="av-user"><div className="av-user-portrait"><img src={asset('chinchilla')} alt="" /></div><div><h2>{userName}</h2><span className="av-badge">🎁 Покоритель облаков</span></div></div><div className="av-profile-stats">{profileStats.map((stat) => <div key={stat.id}><span className={`av-stat-icon av-stat-icon--${stat.id}`} aria-hidden="true">{stat.icon}</span><strong>{stat.value}<small>{stat.label}</small></strong></div>)}</div><button className="av-history-button" type="button" onClick={() => { setHistoryOpen(true); setProfileMenuOpen(false) }}><span aria-hidden="true">☷</span> История игр <span aria-hidden="true">→</span></button><blockquote>«Выше облаков —<br />больше возможностей!»</blockquote></section>
          <section className="av-profile-pet"><PetPreview outfit={saved} /><div className="av-pedestal" /><button className="av-gold" onClick={openEditor}><span aria-hidden="true">👕</span> Открыть гардероб</button></section>
          <section className="av-luck-card"><h2>🎁 Ежедневная удача</h2><p>Крути колесо раз в сутки и забирай приз!</p><div className="av-wheel" aria-hidden="true"><i>▼</i><span>☁</span><span>🧩</span><span>⭐</span><span>×2</span><span>🎁</span><span>☁</span><b>✦</b></div><button className="av-gold av-fortune-button" type="button" disabled={!fortune.canSpin} onClick={() => setFortuneOpen(true)}>{fortune.canSpin ? 'Крутить колесо' : `Через ${fortune.remainingLabel}`}</button></section>
        </div>
        <section className="av-collections">
          <div className="av-collections-heading">
            <h2><span aria-hidden="true">🧩</span> Коллекция пазлов</h2>
            <p>Собирай фрагменты и открывай новые картинки!</p>
            <button type="button" onClick={() => setCollectionOpen(true)}>Вся коллекция <span aria-hidden="true">→</span></button>
          </div>
          <div className="av-collection-grid">
            <article>
              <PuzzlePieceGrid collectedFragments={puzzle.collectedFragments} totalFragments={puzzle.totalFragments} compact />
              <div><h3>{puzzle.name}</h3><span className="av-progress"><i style={{ width: `${progress}%` }} /></span><small className="av-progress-label">🧩 {puzzle.collectedFragments} / {puzzle.totalFragments}</small><p>🎁 Награда: {rewardItem?.name ?? 'Облачный шарфик'}</p></div>
            </article>
            <article className="is-locked">
              <PuzzlePieceGrid collectedFragments={0} compact locked />
              <div><h3>Скоро</h3><span className="av-progress"><i style={{ width: '0%' }} /></span><small className="av-progress-label">🔒 Недоступно</small><p>🎁 Новая награда</p></div>
            </article>
          </div>
        </section>
        <OutfitRewardsPanel state={outfitRewards} onRetry={onRetryOutfitRewards} />
      </>}
      </div>
      {confirmLeave && <div className="av-confirm-shade"><section ref={confirmPanel} className="av-confirm" role="alertdialog" aria-modal="true" aria-labelledby="av-confirm-title"><h2 id="av-confirm-title">Оставить изменения?</h2><p>Ты ещё не сохранил новый образ.</p><button className="av-gold" onClick={() => { setConfirmLeave(false); save() }}>Сохранить и вернуться</button><button onClick={() => { setDraft(saved); setConfirmLeave(false); setEditing(false); setError(''); setInfo(''); setRenaming(false) }}>Выйти без сохранения</button><button onClick={() => setConfirmLeave(false)}>Продолжить примерку</button></section></div>}
      <FortuneWheelModal
        canSpin={fortune.canSpin}
        isOpen={fortuneOpen}
        isSpinning={fortune.isSpinning}
        onClose={() => setFortuneOpen(false)}
        onSpin={fortune.startSpin}
        onSpinComplete={fortune.completeSpin}
        prizes={fortune.prizes}
        remainingLabel={fortune.remainingLabel}
        result={fortune.result}
        rotation={fortune.rotation}
      />
      {tournamentOpen && <TournamentModal api={tournamentApi} onClose={() => setTournamentOpen(false)} />}
      {historyOpen && <ProfileHistoryModal api={tournamentApi} onClose={() => setHistoryOpen(false)} />}
      {collectionOpen && <PuzzleCollectionPage onClose={() => setCollectionOpen(false)} puzzle={puzzle} />}
    </div>
  </dialog>
}
