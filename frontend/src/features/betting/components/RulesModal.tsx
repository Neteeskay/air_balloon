import { Modal } from '../../../components/ui/Modal'
import { LuckyMascot } from './LuckyMascot'
import { PuzzlePieceHint } from './PuzzlePieceHint'

type RulesModalProps = {
  onClose: () => void
}

export function RulesModal({ onClose }: RulesModalProps) {
  return (
    <Modal className="rules-modal" onClose={onClose} title="Правила игры">
      <div className="rules-content">
        <ol className="rules-list">
          <li><b>Выбери ставку.</b> Её стоимость спишется с бонусного баланса после нажатия «Начать».</li>
          <li><b>Следи за полётом.</b> Вместе с шаром растёт коэффициент твоего выигрыша.</li>
          <li><b>Забери вовремя.</b> Если шар лопнет раньше, ставка сгорит. Если успеешь — получишь ставку × коэффициент.</li>
          <li><b>Активируй бустер.</b> Достигни отмеченного уровня, чтобы умножить текущий коэффициент на ×2, ×3 или ×4.(см. ниже, как они выглядят)</li>
          <li><b>Набирай очки.</b> Они начисляются за пройденные уровни и помогают получать игровые награды.</li>
          <li><b>Собирай пазлы.</b> За успешный cashout ты получаешь фрагмент пазла. Собери пазл полностью, чтобы получить подарок. А если это предмет шиншилле, то ты везунчик! Одень ее в подарок, а она может поделиться бустом!.</li>
        </ol>
        <section className="rules-boosters" aria-label="Подсказки о бустерах">
          <h3>Как работают бустеры</h3>
          <div>
            <PuzzlePieceHint multiplier={2} />
            <PuzzlePieceHint multiplier={3} />
            <PuzzlePieceHint multiplier={4} />
          </div>
        </section>
        <button className="modal-action" onClick={onClose} type="button">Понятно</button>
      </div>
      <LuckyMascot
        audioSrc="/assets/audio/lucky.mp3"
        gifSrc="/assets/characters/chinchilla-wave-fullhd.gif"
      />
    </Modal>
  )
}
