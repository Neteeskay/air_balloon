import { Modal } from '../../../components/ui/Modal'
import { LuckyMascot } from './LuckyMascot'
import { PuzzlePieceHint } from './PuzzlePieceHint'

type RulesModalProps = {
  onClose: () => void
  onOpenDetails?: () => void
}

export function RulesModal({ onClose, onOpenDetails }: RulesModalProps) {
  const openDetails = () => {
    onClose()
    if (onOpenDetails) {
      onOpenDetails()
      return
    }

    // Compatibility fallback for callers that have not received the route
    // callback yet. App reads this history state and keeps navigation in-place.
    const rulesReturnPath = window.location.pathname
    window.history.pushState({ rulesReturnPath }, '', '/rules')
    window.dispatchEvent(new PopStateEvent('popstate', { state: { rulesReturnPath } }))
  }

  return (
    <Modal className="rules-modal" onClose={onClose} title="Правила игры">
      <div className="rules-content">
        <ol className="rules-list">
          <li><b>Выбери ставку.</b> Её стоимость спишется с бонусного баланса после нажатия «Начать».</li>
          <li><b>Следи за полётом.</b> Вместе с шаром растёт коэффициент твоего выигрыша.</li>
          <li><b>Забери вовремя.</b> Если шар лопнет раньше, ставка сгорит. Если успеешь — получишь ставку × коэффициент.</li>
          <li><b>Активируй бустер.</b> Достигни отмеченного уровня, чтобы умножить текущий коэффициент на ×2, ×3 или ×4.(см. ниже, как они выглядят)</li>
          <li><b>Набирай очки.</b> Они начисляются за пройденные уровни и помогают получать игровые награды.</li>
          <li><b>Собирай пазлы.</b> За успешный cashout ты получаешь фрагмент пазла. Собери пазл полностью и открой подарок: это могут быть монеты, одежда для шиншиллы или другой бонус.</li>
        </ol>
        <section className="rules-boosters" aria-label="Подсказки о бустерах">
          <h3>Как работают бустеры</h3>
          <div>
            <PuzzlePieceHint multiplier={2} />
            <PuzzlePieceHint multiplier={3} />
            <PuzzlePieceHint multiplier={4} />
          </div>
        </section>
      </div>
      <div className="rules-actions">
        <button className="modal-action rules-more-button" onClick={openDetails} type="button">Подробнее</button>
        <button className="modal-action" onClick={onClose} type="button">Понятно</button>
      </div>
      <LuckyMascot
        audioSrc="/assets/audio/lucky.mp3"
        gifSrc="/assets/characters/chinchilla-wave-fullhd.gif"
      />
    </Modal>
  )
}
