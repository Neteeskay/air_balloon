import { useEffect, useState } from 'react'
import type { Api, User } from '../../api/types'
import '../../features/avatar/avatar.css'
import { adaptGlobalRating } from '../rating/adapter'
import { useGlobalRating } from '../rating/useGlobalRating'

type ProfileDto = { user?: { displayName?: string; username?: string; gameScore?: number; bonusBalance?: number }; avatar?: { equipped?: { headId?: string|null; neckId?: string|null } }; puzzles?: Array<{ name?: string; collectedFragments?: number; totalFragments?: number; rewardClothingId?: string }> }
type WardrobeItem = { id: string; name?: string; slot?: string; unlocked?: boolean }

export function RealProfilePage({ api, user, balance, onClose, onOpenRating }: { api: Api; user: User; balance: number; onClose: () => void; onOpenRating?: () => void }) {
  const [profile, setProfile] = useState<ProfileDto | null>(null)
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([])
  const [headId, setHeadId] = useState<string|null>(null)
  const [neckId, setNeckId] = useState<string|null>(null)
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState('')
  const ratingQuery = useGlobalRating(api)
  const rating = ratingQuery.data ? adaptGlobalRating(ratingQuery.data) : null
  useEffect(() => { let live = true; Promise.all([api.profile.get(), api.profile.wardrobe()]).then(([p, w]) => { if (!live) return; const value = p as ProfileDto; setProfile(value); setWardrobe(Array.isArray(w) ? w as WardrobeItem[] : []); setHeadId(value.avatar?.equipped?.headId ?? null); setNeckId(value.avatar?.equipped?.neckId ?? null) }).catch(() => live && setStatus('Не удалось загрузить профиль')).catch(() => undefined); return () => { live = false } }, [api])
  const puzzle = profile?.puzzles?.[0]
  const save = async () => { try { await api.profile.equip(headId, neckId); setEditing(false); setStatus('Образ сохранён') } catch (e) { setStatus(e instanceof Error ? e.message : 'Не удалось сохранить образ') } }
  return <main className="av-world" style={{ minHeight: '100vh', overflow: 'auto' }}>
    <header className="av-header"><button className="av-blue av-back" onClick={onClose}>← Назад</button><h1>Мой профиль</h1><div className="av-balance"><strong>{balance.toLocaleString('ru-RU')}</strong> бонусов</div></header>
    <section className="av-profile-grid" style={{ maxWidth: 1100, margin: '2rem auto' }}>
      <article className="av-profile-card"><div className="av-user"><div className="av-user-portrait"><img src="/assets/avatar/chinchilla.png" alt="" /></div><div><h2>{user.name}</h2><span className="av-badge">🎁 Покоритель облаков</span></div></div><div className="av-profile-stats"><div><strong>{profile?.user?.gameScore ?? 0}<small>Игровые очки</small></strong></div><div><strong>{puzzle?.collectedFragments ?? 0}<small>Фрагментов</small></strong></div></div><div className="av-rating-summary" aria-label="Ваше место в рейтинге"><span>Глобальный рейтинг</span>{ratingQuery.error ? <small>{ratingQuery.error}</small> : rating ? <><strong>#{rating.currentPlayer.place}</strong><small>{rating.currentPlayer.points.toLocaleString('ru-RU')} игровых очков</small></> : <small role="status">Загружаем…</small>}{onOpenRating && <button className="av-blue" type="button" onClick={onOpenRating}>Открыть рейтинг →</button>}</div></article>
      <article className="av-profile-pet"><img className="av-pet-rendered" src="/assets/avatar/chinchilla.png" alt="Ваш чинчилла" /><button className="av-gold" onClick={() => setEditing(!editing)}>👕 {editing ? 'Закрыть гардероб' : 'Открыть гардероб'}</button></article>
      <article className="av-luck-card"><h2>🧩 Коллекция пазлов</h2><p>{puzzle?.name ?? 'Активный пазл'}</p><strong>{puzzle?.collectedFragments ?? 0} / {puzzle?.totalFragments ?? '—'}</strong><div className="av-progress"><i style={{ width: `${puzzle && puzzle.totalFragments ? Math.min(100, puzzle.collectedFragments! / puzzle.totalFragments * 100) : 0}%` }} /></div></article>
    </section>
    {editing && <section className="av-wardrobe" style={{ maxWidth: 1100, margin: '0 auto 2rem' }}><h2>Гардероб</h2><div className="av-items">{wardrobe.map(item => <button key={item.id} className={`av-item ${item.unlocked ? '' : 'is-locked'}`} disabled={!item.unlocked} onClick={() => (item.slot ?? '').toLowerCase().includes('neck') ? setNeckId(item.id) : setHeadId(item.id)}><span className="av-item-name">{item.name ?? item.id}</span>{item.unlocked ? 'Надеть' : '🔒'}</button>)}</div><button className="av-gold av-save" onClick={save}>Сохранить образ</button></section>}
    {status && <p role="status" style={{ textAlign: 'center' }}>{status}</p>}
  </main>
}
