import type { ParameterMetadata } from './types'

/** Русские названия параметров. Ключ — техническое имя из metadata сервера. */
export const RU_LABELS: Record<string, string> = {
  'gameId': 'Идентификатор игры',
  'gameName': 'Название игры',
  'isActive': 'Игра принимает раунды',
  'crash.alpha': 'Наклон кривой (α)',
  'crash.minCrashMultiplier': 'Мин. множитель при крахе',
  'crash.maxMultiplier': 'Максимальный множитель',
  'crash.multiplierGrowthRate': 'Скорость роста множителя',
  'crash.fps': 'Частота кадров (FPS)',
  'crash.delta': 'Шаг времени между кадрами',
  'boosters.multiplierTier1Value': 'Множитель бустера ×1',
  'boosters.multiplierTier2Value': 'Множитель бустера ×2',
  'boosters.multiplierTier3Value': 'Множитель бустера ×3',
  'boosters.multiplierTier4Value': 'Множитель бустера ×4',
  'points.pointsPerLine': 'Очки за пройденную линию',
  'points.pointsCashoutBonus': 'Бонус за вывод выигрыша',
  'points.pointsXNBonus': 'Бонус за бустер ×2 / ×3 / ×4',
}

/** Русские описания параметров (показываются в подсказке «?»). */
export const RU_DESCRIPTION: Record<string, string> = {
  'gameId': 'Служебный код игры, менять его нельзя.',
  'gameName': 'Отображаемое название игры.',
  'isActive': 'Пока игра выключена, новые раунды не принимаются.',
  'crash.alpha': 'Наклон кривой: чем больше α, тем сильнее кривая смещена к низким множителям и тем ниже выплаты игрокам. В модели нет «мгновенных крахов» — α задаёт форму распределения.',
  'crash.minCrashMultiplier': 'Гарантированный минимум множителя, с которым лопается шар.',
  'crash.maxMultiplier': 'Потолок множителя: больше этого значения выигрыш не растёт.',
  'crash.multiplierGrowthRate': 'На сколько множитель растёт за каждую секунду полёта.',
  'crash.fps': 'Как часто сервер пересчитывает полёт шара.',
  'crash.delta': 'Длительность одного кадра симуляции (обычно 1 / FPS).',
  'boosters.multiplierTier1Value': 'Обычная игра без бустера.',
  'boosters.multiplierTier2Value': 'Удвоение: шарик на линии с бустером ×2 летит в 2 раза быстрее.',
  'boosters.multiplierTier3Value': 'Утроение: шарик на линии с бустером ×3 летит в 3 раза быстрее.',
  'boosters.multiplierTier4Value': 'Учетверение: шарик на линии с бустером ×4 летит в 4 раза быстрее.',
  'points.pointsPerLine': 'Базовые очки за каждую пройденную линию.',
  'points.pointsCashoutBonus': 'Дополнительные очки за своевременный вывод выигрыша.',
  'points.pointsXNBonus': 'Дополнительные очки за сработавший бустер множителя.',
}

/** Русские пояснения «как параметр влияет на игру». */
export const RU_EFFECT: Record<string, string> = {
  'crash.alpha': 'Чем ниже α, тем чаще игра доживает до крупных множителей.',
  'crash.maxMultiplier': 'Слишком низкий потолок режет самые редкие и крупные выигрыши.',
  'crash.multiplierGrowthRate': 'Выше скорость — раунды короче и динамичнее.',
  'points.pointsPerLine': 'Влияет на скорость накопления очков игроком.',
}

const LINE_DESC = 'Вероятность, с которой линия приносит награду. Сумма вероятностей всех линий темы должна быть 100%.'
const LINE_EFFECT = 'Увеличьте долю «дорогой» линии — она будет выпадать чаще.'

/** Русское название параметра, включая строки зелёной/красной темы. */
export function ruName(p: ParameterMetadata): string {
  const line = /^boosters\.(green|red)\.(lineN|line(\d+))LootProb$/.exec(p.technicalName)
  if (line) {
    const theme = line[1] === 'green' ? 'Зелёная тема' : 'Красная тема'
    if (line[2] === 'lineN') return `Шанс линии — ${theme}`
    return `Линия ${line[3]} · ${theme}`
  }
  return RU_LABELS[p.technicalName] ?? p.displayName
}

/** Возвращает копию метаданных с русскими названиями и описаниями. */
export function ruParam(p: ParameterMetadata): ParameterMetadata {
  const line = /^boosters\.(green|red)\./.test(p.technicalName)
  return {
    ...p,
    displayName: ruName(p),
    description: line ? LINE_DESC : RU_DESCRIPTION[p.technicalName] ?? p.description,
    effectOnGame: line ? LINE_EFFECT : RU_EFFECT[p.technicalName] ?? p.effectOnGame,
  }
}