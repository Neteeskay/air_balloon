import { useEffect, type CSSProperties } from 'react'
import type { FortuneWheelPrize } from '../../../mocks/fortuneWheelPrizes'
import './FortuneWheelModal.css'

type FortuneWheelModalProps = {
  canSpin: boolean
  isOpen: boolean
  isSpinning: boolean
  onClose: () => void
  onSpin: () => void
  onSpinComplete: () => void
  prizes: FortuneWheelPrize[]
  remainingLabel: string
  result: FortuneWheelPrize | null
  rotation: number
}

function PrizeIcon({ type }: Pick<FortuneWheelPrize, 'type'>) {
  if (type === 'coins') return <img src="/assets/avatar/coin.png" alt="" />
  return <span aria-hidden="true">{type === 'puzzle' ? '🧩' : '🏆'}</span>
}

function resultText(prize: FortuneWheelPrize) {
  if (prize.type === 'puzzle') return 'Фрагмент пазла добавлен в коллекцию!'
  if (prize.type === 'coins') return `На баланс начислено ${prize.amount} монет!`
  return `В рейтинг добавлено ${prize.amount} очков!`
}

export function FortuneWheelModal({
  canSpin,
  isOpen,
  isSpinning,
  onClose,
  onSpin,
  onSpinComplete,
  prizes,
  remainingLabel,
  result,
  rotation,
}: FortuneWheelModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (!isSpinning) onClose()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, isSpinning, onClose])

  if (!isOpen) return null

  const colors = prizes.map((prize, index) => {
    const start = index * (360 / prizes.length)
    const end = (index + 1) * (360 / prizes.length)
    return `${prize.color} ${start}deg ${end}deg`
  }).join(', ')

  return (
    <div className="fortune-modal-shade" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSpinning) onClose()
    }}>
      <section
        className="fortune-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fortune-title"
        aria-describedby="fortune-subtitle"
      >
        <button
          className="fortune-modal__close"
          type="button"
          aria-label="Закрыть колесо фортуны"
          disabled={isSpinning}
          onClick={onClose}
        >×</button>

        <header className="fortune-modal__header">
          <h2 id="fortune-title">Колесо фортуны</h2>
          <p id="fortune-subtitle">Крути колесо раз в сутки и получай награды!</p>
          <span>◷ <b>1 вращение</b> каждые 24 часа</span>
        </header>

        <div className="fortune-wheel-stage">
          <div
            className={`fortune-wheel-rotor${isSpinning ? ' is-spinning' : ''}`}
            style={{
              '--wheel-colors': colors,
              '--wheel-rotation': `${rotation}deg`,
            } as CSSProperties}
            onTransitionEnd={(event) => {
              if (event.propertyName === 'transform' && isSpinning) onSpinComplete()
            }}
          >
            <div className="fortune-wheel-disc">
              {prizes.map((prize, index) => (
                <div
                  className={`fortune-wheel-sector fortune-wheel-sector--${prize.type}`}
                  key={prize.id}
                  style={{ '--sector-angle': `${index * (360 / prizes.length)}deg` } as CSSProperties}
                >
                  <div className="fortune-wheel-sector__content">
                    <PrizeIcon type={prize.type} />
                    <strong>{prize.valueLabel}</strong>
                    <small>{prize.title}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <img className="fortune-wheel-frame" src="/assets/fortune-wheel/frame.png" alt="" />
          <div className="fortune-wheel-hub" aria-hidden="true">
            <img src="/assets/avatar/coin.png" alt="" />
          </div>
        </div>

        {result ? (
          <div className="fortune-result" role="status">
            <PrizeIcon type={result.type} />
            <div><strong>Ваш приз!</strong><span>{resultText(result)}</span></div>
          </div>
        ) : (
          <button
            className="fortune-spin-button"
            type="button"
            disabled={!canSpin}
            onClick={onSpin}
          >
            {isSpinning ? 'Колесо вращается…' : canSpin ? 'Крутить' : `Доступно через ${remainingLabel}`}
          </button>
        )}

        <p className="fortune-modal__cooldown">
          ◷ {isSpinning
            ? 'Колесо выбирает ваш приз…'
            : canSpin
              ? 'Сегодняшнее вращение доступно'
              : `Следующее вращение через ${remainingLabel}`}
        </p>

        <section className="fortune-prize-guide" aria-label="Что можно получить">
          <h3>Что можно получить</h3>
          <div>
            <article><span>🏆</span><p><strong>Игровые очки</strong><small>+20, +30, +50, +100</small></p></article>
            <article><img src="/assets/avatar/coin.png" alt="" /><p><strong>Монеты</strong><small>25, 50, 100</small></p></article>
            <article><span>🧩</span><p><strong>Фрагмент пазла</strong><small>Часть коллекции</small></p></article>
          </div>
        </section>
      </section>
    </div>
  )
}
