import { useEffect, useId, useRef, useState } from 'react'
import { asset, categories, defaultOutfit, findItem, items, outfitKey, readOutfit, normalizeOutfit, outfitImage, renderAssets, type Category, type Item, type Outfit } from './catalog'
import './avatar.css'

function Lock() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3" fill="currentColor" /><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="3" /><circle cx="12" cy="15" r="1.5" fill="#938b80" /><path d="M12 15v3" stroke="#938b80" strokeWidth="2" /></svg>
}

export function ItemArt({ item, className = '' }: { item: Item; className?: string }) {
  const [x, y, width, height] = item.crop
  const clip = useId()
  const pendant = item.sheet === 'pendant'
  return <svg className={`av-item-art ${className}`} viewBox={`${x} ${y} ${width} ${height}`} aria-hidden="true"><defs><clipPath id={clip}><rect x={x} y={y} width={width} height={height} /></clipPath></defs><image clipPath={`url(#${clip})`} href={asset(item.sheet)} width={pendant ? 1536 : 1448} height={pendant ? 1024 : 1086} /></svg>
}

export function PetPreview({ outfit }: { outfit: Outfit }) {
  const current = normalizeOutfit(outfit)
  const rendered = outfitImage(current)
  const [failed, setFailed] = useState<string | null>(null)
  return <div className="av-pet" role="img" aria-label={`${current.name}: ${findItem(current.head)?.name}, ${findItem(current.neck)?.name}`}>
    {failed === rendered ? <p className="av-render-error" role="alert">Не удалось загрузить образ. <button onClick={() => setFailed(null)}>Повторить</button></p> :
      <img key={rendered} className="av-pet-rendered" src={rendered} alt="" draggable={false} onError={() => setFailed(rendered)} />}
  </div>
}

type Props = { scope: string; userName: string; balance: number | null; score: number | null; onClose: () => void }
export function AvatarProfile({ scope, userName, balance, score, onClose }: Props) {
  const [saved, setSaved] = useState(() => readOutfit(scope))
  const [draft, setDraft] = useState<Outfit>(saved)
  const [editing, setEditing] = useState(false)
  const [category, setCategory] = useState<Category>('head')
  const [selectedId, setSelectedId] = useState<string>(saved.head ?? defaultOutfit.head!)
  const [renaming, setRenaming] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const confirmPanel = useRef<HTMLElement>(null)
  const categoryInfo = categories.find(c => c.id === category)!
  const selected = findItem(selectedId)!
  const equipped = draft[category] === selected.id
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const node = dialog.current!
    Object.values(renderAssets).forEach(src => { const preload = new Image(); preload.src = src })
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
  const openEditor = () => { setDraft(saved); setCategory('head'); setSelectedId(saved.head ?? 'aviator'); setEditing(true); setNotice(''); setError(''); setInfo('') }
  const chooseCategory = (next: Category) => { if (next === 'clothes') return; setCategory(next); setSelectedId(draft[next] ?? items.find(i => i.category === next)!.id); setInfo('') }
  const selectItem = (item: Item) => {
    setSelectedId(item.id); setInfo('')
    if (item.category !== 'clothes' && items.some(available => available.id === item.id)) setDraft(value => normalizeOutfit({ ...value, [item.category]: item.id }))
  }
  const save = () => {
    if (!draft.name.trim()) { setError('Дай питомцу имя — от 1 до 24 символов.'); setRenaming(true); return }
    const outfit = normalizeOutfit(draft)
    try { localStorage.setItem(outfitKey(scope), JSON.stringify(outfit)) }
    catch { setError('Не удалось сохранить образ в браузере. Разреши локальное хранилище и попробуй ещё раз.'); return }
    setSaved(outfit); setDraft(outfit); setEditing(false); setNotice('Образ сохранён'); setError(''); setInfo(''); setRenaming(false)
  }
  const format = (value: number | null) => value === null ? '—' : value.toLocaleString('ru-RU')

  return <dialog ref={dialog} className="av-dialog" aria-labelledby="av-title" onCancel={event => { event.preventDefault(); if (confirmLeave) setConfirmLeave(false); else if (info) setInfo(''); else leave() }}>
    <div className={`av-world ${editing ? 'av-world--editor' : ''}`}>
      <div inert={confirmLeave}>
      <header className="av-header">
        <button className="av-blue av-back" onClick={leave}><span aria-hidden="true">←</span> Назад</button>
        <h1 id="av-title" ref={title} tabIndex={-1}>{editing ? 'Настройка образа' : 'Мой профиль'}</h1>
        <div className="av-balance" aria-label={`Бонусный баланс: ${format(balance)}`}><img src={asset('coin')} alt="" /><strong>{format(balance)}</strong></div>
        <button className="av-blue av-help" onClick={() => setInfo(info ? '' : 'Выбирай головной убор и аксессуар на шею — доступны четыре готовых образа. Одежда скоро появится. Примерка сразу видна на питомце. Нажми «Сохранить образ», чтобы оставить изменения. Образ сохраняется для этого профиля в текущем браузере.')}><span aria-hidden="true">?</span> Правила</button>
        <button className="av-blue av-profile-icon" aria-label={editing ? 'Вернуться в профиль' : 'Закрыть профиль'} onClick={leave}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4" /><path d="M4 22v-3a8 8 0 0 1 16 0v3Z" /></svg></button>
      </header>
      {info && <div className="av-info" role="status"><p>{info}</p><button onClick={() => setInfo('')} aria-label="Закрыть подсказку">×</button></div>}
      {editing ? <>
        <div className="av-editor">
          <nav className="av-categories" aria-label="Категории образа">{categories.map(c => <button key={c.id} className={category === c.id ? 'is-active' : ''} disabled={c.id === 'clothes'} aria-pressed={category === c.id} onClick={() => chooseCategory(c.id)}><span aria-hidden="true">{c.icon}</span>{c.name}{c.id === 'clothes' && <small>Скоро появится</small>}</button>)}</nav>
          <section className="av-preview" aria-label="Примерка образа">
            <PetPreview outfit={draft} />
            <div className="av-pedestal" />
            <div className="av-pet-name">{renaming ? <form onSubmit={event => { event.preventDefault(); if (draft.name.trim()) setRenaming(false) }}><input ref={nameInput} aria-label="Имя питомца" maxLength={24} value={draft.name} onChange={event => { setDraft(value => ({ ...value, name: event.target.value })); setError('') }} /><button aria-label="Подтвердить имя" type="submit">✓</button></form> : <button onClick={() => setRenaming(true)} aria-label="Изменить имя питомца">{draft.name}<span aria-hidden="true">✎</span></button>}</div>
            <p className="av-quote">«Маленькие детали делают<br />большие приключения!»</p>
          </section>
          <section className="av-wardrobe" aria-labelledby="av-category-title">
            <div className="av-wardrobe-heading"><span aria-hidden="true">{categoryInfo.icon}</span><div><h2 id="av-category-title">{categoryInfo.title}</h2><p>{categoryInfo.hint}</p></div></div>
            <div className="av-items">{items.filter(i => i.category === category).map(item => <button key={item.id} className={`av-item ${selectedId === item.id ? 'is-selected' : ''} ${item.locked ? 'is-locked' : ''}`} aria-label={`${item.name}${item.locked ? ', заблокировано' : ''}`} aria-pressed={selectedId === item.id} onClick={() => selectItem(item)}>
              <ItemArt item={item} />{item.locked && <span className="av-lock"><Lock /></span>}
              <span className="av-item-name">{item.name}</span>{draft[category] === item.id && <span className="av-check" aria-label="Надето">✓</span>}
              {item.price ? <span className="av-price"><img src={asset('coin')} alt="" />{item.price}</span> : item.locked && <small>{item.id === 'wreath' ? 'Собери коллекцию' : 'Откроется позже'}</small>}
            </button>)}</div>
            <div className="av-detail" aria-live="polite"><div className="av-detail-art"><ItemArt item={selected} /></div><div className="av-detail-copy"><h3>{selected.name}</h3><p>{selected.description}</p><span className="av-cosmetic">✦ Только для красоты</span></div><div className="av-equip">
              <button disabled={!!selected.locked || equipped} onClick={() => setDraft(value => (normalizeOutfit({ ...value, [category]: selected.id })))}>{selected.locked ? <><Lock /> Закрыто</> : equipped ? 'Надето ✓' : 'Надеть'}</button>
            </div>{selected.locked && <p className="av-locked-reason">{selected.locked}</p>}</div>
          </section>
        </div>
        <footer className="av-savebar">{error && <p className="av-error" role="alert">{error}</p>}<button className="av-gold av-save" onClick={save}>Сохранить образ</button><p>Внешний вид не влияет на баланс и результат игры</p></footer>
      </> : <>
        {notice && <p className="av-success" role="status">✓ {notice}</p>}
        <div className="av-profile-grid">
          <section className="av-profile-card"><div className="av-user"><div className="av-user-portrait"><img src={asset('chinchilla')} alt="" /></div><div><h2>{userName}</h2><span className="av-badge">🎁 Покоритель облаков</span></div></div><div className="av-profile-stats"><div><span>⭐</span><strong>{format(score)}<small>Игровые очки</small></strong></div><div><span>☁</span><strong>{format(balance)}<small>Бонусный баланс</small></strong></div><div><span>🧢</span><strong>2 категории<small>Для твоего образа</small></strong></div><div><span>♥</span><strong>{saved.name}<small>Твой пушистый друг</small></strong></div></div><blockquote>«Выше облаков —<br />больше возможностей!»</blockquote></section>
          <section className="av-profile-pet"><PetPreview outfit={saved} /><div className="av-pedestal" /><button className="av-gold" onClick={openEditor}><span aria-hidden="true">👕</span> Настроить образ</button></section>
          <section className="av-luck-card"><h2>🎁 Ежедневная удача</h2><p>Новые сюрпризы впереди!</p><div className="av-wheel" aria-hidden="true"><i>▼</i><span>☁</span><span>🧩</span><span>⭐</span><span>×2</span><span>🎁</span><span>☁</span><b>✦</b></div><div className="av-soon"><span>◷</span> Колесо удачи появится позже</div></section>
        </div>
        <section className="av-collections"><div className="av-collections-heading"><h2>🧩 Коллекция пазлов</h2><p>Собирай воспоминания о новых путешествиях</p><span className="av-badge">Скоро</span></div><div className="av-collection-grid"><article><div className="av-collection-picture"><Lock /></div><div><h3>Солнечное побережье</h3><p>Коллекция ещё не открыта</p><span className="av-progress" /></div></article><article><div className="av-collection-picture av-collection-picture--sky"><Lock /></div><div><h3>Небесное путешествие</h3><p>Коллекция ещё не открыта</p><span className="av-progress" /></div></article></div></section>
      </>}
      </div>
      {confirmLeave && <div className="av-confirm-shade"><section ref={confirmPanel} className="av-confirm" role="alertdialog" aria-modal="true" aria-labelledby="av-confirm-title"><h2 id="av-confirm-title">Оставить изменения?</h2><p>Ты ещё не сохранил новый образ.</p><button className="av-gold" onClick={() => { setConfirmLeave(false); save() }}>Сохранить и вернуться</button><button onClick={() => { setDraft(saved); setConfirmLeave(false); setEditing(false); setError(''); setInfo(''); setRenaming(false) }}>Выйти без сохранения</button><button onClick={() => setConfirmLeave(false)}>Продолжить примерку</button></section></div>}
    </div>
  </dialog>
}
