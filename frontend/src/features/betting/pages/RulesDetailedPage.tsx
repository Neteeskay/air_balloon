import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { Api, Catalog } from '../../../api/types'
import { BalloonImage } from '../components/BalloonImage'
import { PuzzlePieceHint } from '../components/PuzzlePieceHint'
import type { BetOption, Theme } from '../types'
import './RulesDetailedPage.css'

type RulesDetailedPageProps = {
  api: Api
  onBack: () => void
  theme: Theme
  stakeOptions?: BetOption[]
}

const FALLBACK_OPTIONS: BetOption[] = [
  { id: 1, cost: 100, multiplier: 1 },
  { id: 2, cost: 250, multiplier: 2 },
  { id: 3, cost: 500, multiplier: 3 },
  { id: 4, cost: 1000, multiplier: 4 },
]

const formatNumber = (value: number) => new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
}).format(value)

function optionsFromCatalog(catalog: Catalog | null, initial: BetOption[]) {
  if (!catalog) return [...initial]
  const resolved = catalog.stakeOptions
    .filter(option => option.active)
    .map((option, index) => ({
      id: index + 1,
      cost: Number(option.amount),
      multiplier: option.boosterMultiplier as BetOption['multiplier'],
    }))
    .filter(option => [1, 2, 3, 4].includes(option.multiplier))
  return resolved.length > 0 ? resolved : [...initial]
}

function SectionHeading({ id, number, title }: { id: string; number: number; title: string }) {
  return (
    <div className="rules-detailed-section__heading">
      <span className="rules-detailed-section__number" aria-hidden="true">{number}</span>
      <h2 id={id}>{title}</h2>
    </div>
  )
}

function Formula({ children }: { children: ReactNode }) {
  return <div className="rules-detailed-formula"><strong>{children}</strong></div>
}

export function RulesDetailedPage({ api, onBack, theme, stakeOptions = FALLBACK_OPTIONS }: RulesDetailedPageProps) {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catalogUnavailable, setCatalogUnavailable] = useState(false)

  useEffect(() => {
    let live = true
    void api.catalog.get().then(value => {
      if (live) setCatalog(value)
    }).catch(() => {
      if (live) setCatalogUnavailable(true)
    })
    return () => { live = false }
  }, [api])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onBack()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onBack])

  const options = useMemo(
    () => optionsFromCatalog(catalog, stakeOptions.length > 0 ? stakeOptions : FALLBACK_OPTIONS)
      .sort((left, right) => left.cost - right.cost),
    [catalog, stakeOptions],
  )
  const greenLevels = catalog?.levels.GREEN ?? 9
  const redLevels = catalog?.levels.RED ?? 12
  const pointsPerLevel = catalog?.pointsPerLevel
  const cashoutPoints = catalog?.cashoutPoints
  const routeLabel = theme === 'green' ? `GREEN · ${greenLevels} уровней` : `RED · ${redLevels} уровней`
  return (
    <main className={`rules-detailed-page rules-detailed-page--${theme}`}>
      <div className="rules-detailed-page__sky" aria-hidden="true" />
      <div className="rules-detailed-page__shell">
        <header className="rules-detailed-header">
          <button aria-label="Назад" className="rules-detailed-back" onClick={onBack} type="button">
            <ArrowLeft size={20} strokeWidth={2.7} aria-hidden="true" />
            <span>Назад</span>
          </button>
          <div className="rules-detailed-header__title"><h1>Подробные правила</h1></div>
          <span className="rules-detailed-route">{routeLabel}</span>
        </header>

        <section className="rules-detailed-hero" aria-labelledby="rules-detailed-intro">
          <div className="rules-detailed-hero__art" aria-hidden="true">
            <BalloonImage theme={theme} />
          </div>
          <div>
            <h2 id="rules-detailed-intro">Риск растёт вместе с коэффициентом</h2>
            <p>Выберите ставку и бустер, следите за полётом и нажмите «Забрать» до того, как шар лопнет. Чем дольше длится полёт, тем выше возможный выигрыш.</p>
          </div>
        </section>

        <nav className="rules-detailed-nav" aria-label="Разделы подробных правил">
          <a href="#rules-stake">Ставка</a>
          <a href="#rules-flight">Полёт</a>
          <a href="#rules-booster">Бустер</a>
          <a href="#rules-result">Результат</a>
          <a href="#rules-points">Очки</a>
          <a href="#rules-rewards">Награды</a>
        </nav>

        {catalogUnavailable && (
          <p className="rules-detailed-catalog-note" role="status">Не удалось обновить список ставок. Ниже показаны варианты, уже доступные в игре.</p>
        )}

        <div className="rules-detailed-sections">
          <section className="rules-detailed-section" id="rules-stake" aria-labelledby="rules-stake-title">
            <SectionHeading id="rules-stake-title" number={1} title="Ставка и карточка-фрагмент" />
            <p>Каждая карточка выбирает сразу два параметра: сумму ставки и силу бустера. Картинка пазла помогает различать варианты, но сама по себе не добавляет фрагмент в коллекцию.</p>
            <div className="rules-detailed-option-row" aria-label="Доступные пары ставки и бустера">
              {options.map((option, index) => (
                <article className="rules-detailed-option" key={`${option.id}-${option.cost}-${option.multiplier}`}>
                  <img src={`/assets/puzzle-pieces/pzS_${(index % 12) + 1}.svg`} alt="" />
                  <span><b>{formatNumber(option.cost)}</b><small>бонусов</small></span>
                  <strong>{option.multiplier === 1 ? 'без бустера' : `бустер ×${option.multiplier}`}</strong>
                </article>
              ))}
            </div>
            <p className="rules-detailed-note">Баланс изменится только после нажатия «Начать». Если бонусов не хватает, выбрать такую ставку не получится.</p>
          </section>

          <section className="rules-detailed-section" id="rules-flight" aria-labelledby="rules-flight-title">
            <SectionHeading id="rules-flight-title" number={2} title="Маршрут и рост коэффициента" />
            <p>Полёт начинается с коэффициента ×1, а затем он постепенно растёт. На зелёном маршруте {greenLevels} уровней, на красном — {redLevels}. Красный маршрут длиннее, но высокий коэффициент ещё не гарантирует выигрыш.</p>
            <div className="rules-detailed-two-column">
              <Formula>Возможный выигрыш = ставка × текущий коэффициент</Formula>
              <div className="rules-detailed-stat"><span className="rules-detailed-stat__label">Сейчас выбран</span><strong>{routeLabel}</strong></div>
            </div>
            <p className="rules-detailed-note">Кнопка «Забрать» станет активной после первого пройденного уровня. На кнопке всегда показана сумма, которую можно получить прямо сейчас; она округляется вниз до целого бонуса.</p>
          </section>

          <section className="rules-detailed-section" id="rules-booster" aria-labelledby="rules-booster-title">
            <SectionHeading id="rules-booster-title" number={3} title="Когда срабатывает бустер" />
            <p>×1 означает полёт без усиления. Для бустеров ×2, ×3 и ×4 на маршруте заранее отмечен особый уровень. Долетите до него до нажатия «Забрать» — и текущий коэффициент сразу умножится.</p>
            <div className="rules-detailed-booster-grid">
              <PuzzlePieceHint multiplier={2} />
              <PuzzlePieceHint multiplier={3} />
              <PuzzlePieceHint multiplier={4} />
            </div>
          </section>

          <section className="rules-detailed-section" id="rules-result" aria-labelledby="rules-result-title">
            <SectionHeading id="rules-result-title" number={4} title="Забрать или рискнуть дальше" />
            <div className="rules-detailed-outcomes">
              <article className="rules-detailed-outcome rules-detailed-outcome--win">
                <span className="rules-detailed-outcome__icon" aria-hidden="true">✓</span>
                <div><h3>Забрали вовремя</h3><p>Нажатие «Забрать» фиксирует коэффициент и сумму выигрыша. Шар ещё может продолжить полёт, но ваша выплата уже не изменится.</p></div>
              </article>
              <article className="rules-detailed-outcome rules-detailed-outcome--loss">
                <span className="rules-detailed-outcome__icon" aria-hidden="true">×</span>
                <div><h3>Не успели забрать</h3><p>Если шар лопнул раньше, ставка сгорает, а выигрыш за этот полёт равен нулю.</p></div>
              </article>
            </div>
            <Formula>Выигрыш = ставка × коэффициент в момент нажатия «Забрать»</Formula>
          </section>

          <section className="rules-detailed-section" id="rules-points" aria-labelledby="rules-points-title">
            <SectionHeading id="rules-points-title" number={5} title="Игровые очки — не бонусы" />
            <p>Бонусы нужны для ставок и пополняются выигрышами. Игровые очки показывают ваш прогресс в профиле и рейтинге — поставить их на кон нельзя.</p>
            <div className="rules-detailed-points-grid">
              <article><span>За уровень</span><strong>{pointsPerLevel === undefined ? 'за каждый пройденный' : `+${formatNumber(pointsPerLevel)}`}</strong><p>Пока вы ещё не нажали «Забрать».</p></article>
              <article><span>За «Забрать»</span><strong>{cashoutPoints === undefined ? 'за удачный полёт' : `+${formatNumber(cashoutPoints)}`}</strong><p>Дополнительные очки за вовремя зафиксированный выигрыш.</p></article>
              <article><span>За бустер</span><strong>{api.mode === 'mock' ? '×2: +200 · ×3: +300 · ×4: +400' : 'за сработавший бустер'}</strong><p>Чем сильнее бустер, тем больше очков.</p></article>
            </div>
            <p className="rules-detailed-note">{api.mode === 'mock' ? 'В демо начисляется +100 за уровень, +50 за кнопку «Забрать» и +200, +300 или +400 за бустер. ' : ''}Все очки, заработанные до завершения полёта, остаются у вас. После нажатия «Забрать» новые уровни больше не добавляют очков.</p>
          </section>

          <section className="rules-detailed-section" id="rules-rewards" aria-labelledby="rules-rewards-title">
            <SectionHeading id="rules-rewards-title" number={6} title="Пазлы и подарки" />
            <p>Если вы вовремя забрали выигрыш и текущий пазл ещё не собран, получите один новый фрагмент. После неудачного полёта фрагмент не выдаётся.</p>
            <div className="rules-detailed-reward-grid">
              <article><img className="rules-detailed-reward-art" src="/assets/puzzle-pieces/pzS_1.svg" alt="Фрагмент пазла" /><div><h3>1. Собирайте пазлы</h3><p>Каждый фрагмент занимает своё место в коллекции профиля.</p></div></article>
              <article><img className="rules-detailed-reward-art" src="/assets/puzzle-pieces/pzS_6.svg" alt="Собранный фрагмент пазла" /><div><h3>2. Откройте подарок</h3><p>За собранный пазл вы получите подарок: это могут быть монеты, одежда для шиншиллы или другой бонус.</p></div></article>
              <article className="rules-detailed-reward-grid__pet"><img src="/assets/avatar/rendered-aviator-cloud-scarf-v3.png" alt="Один из вариантов награды для шиншиллы" /><div><h3>3. Используйте награду</h3><p>Если подарком станет одежда, её эффект будет указан в описании: это может быть разовый буст или другая игровая помощь.</p></div></article>
            </div>
          </section>
        </div>

        <footer className="rules-detailed-footer">
          <p>Главное правило: нажмите «Забрать» до того, как шар лопнет.</p>
          <button className="rules-detailed-footer__button" onClick={onBack} type="button"><ArrowLeft size={19} aria-hidden="true" /> Вернуться к игре</button>
        </footer>
      </div>
    </main>
  )
}
