import type { BoosterSettings, ConfigMetadata, CrashSettings, GameConfiguration, GameConfigurationWrite, ParameterMetadata, PointsSettings } from './types'

export type EditorModel = Record<string, string>

export const themeLevelKey = (theme: 'green' | 'red', level: number) => `boosters.${theme}.line${level}LootProb`

const themeLevelCount = (metadata: ConfigMetadata, theme: 'green' | 'red') =>
  theme === 'green' ? metadata.greenLevelCount : metadata.redLevelCount

/** Expand metadata "lineN" placeholder parameters into concrete per-level params. */
export function formParameters(metadata: ConfigMetadata, params: ParameterMetadata[] = metadata.parameters): ParameterMetadata[] {
  const out: ParameterMetadata[] = []
  for (const p of params) {
    const template = /^boosters\.(green|red)\.lineNLootProb$/.exec(p.technicalName)
    if (!template) { out.push(p); continue }
    const theme = template[1] as 'green' | 'red'
    for (let level = 1; level <= themeLevelCount(metadata, theme); level++) {
      out.push({
        ...p,
        technicalName: themeLevelKey(theme, level),
        displayName: `${p.displayName} · линия ${level}`,
      })
    }
  }
  return out
}

const levels = (metadata: ConfigMetadata, config: GameConfiguration, theme: 'green' | 'red') => {
  const out: Record<string, number> = {}
  for (let level = 1; level <= themeLevelCount(metadata, theme); level++) out[`line${level}LootProb`] = config.boosters[theme][`line${level}LootProb`]
  return out
}

export function flatten(config: GameConfiguration, metadata: ConfigMetadata): EditorModel {
  const model: EditorModel = {}
  const set = (name: string, value: unknown) => { model[name] = value === null || value === undefined ? '' : String(value) }
  set('gameId', config.gameId)
  set('gameName', config.gameName)
  set('gameType', config.gameType)
  set('isActive', config.isActive)
  set('crash.alpha', config.crash.alpha)
  set('crash.maxMultiplier', config.crash.maxMultiplier)
  set('crash.minCrashMultiplier', config.crash.minCrashMultiplier)
  set('crash.multiplierGrowthRate', config.crash.multiplierGrowthRate)
  set('crash.fps', config.crash.fps)
  set('crash.delta', config.crash.delta)
  set('boosters.multiplierTier1Value', config.boosters.multiplierTier1Value)
  set('boosters.multiplierTier2Value', config.boosters.multiplierTier2Value)
  set('boosters.multiplierTier3Value', config.boosters.multiplierTier3Value)
  set('boosters.multiplierTier4Value', config.boosters.multiplierTier4Value)
  for (const theme of ['green', 'red'] as const) {
    for (const [key, value] of Object.entries(levels(metadata, config, theme))) set(themeLevelKey(theme, Number(key.slice(4, -8))), value)
  }
  set('points.pointsPerLine', config.points.pointsPerLine)
  set('points.pointsCashoutBonus', config.points.pointsCashoutBonus)
  set('points.pointsXNBonus', config.points.pointsXNBonus)
  return model
}

export function themeSum(model: EditorModel, metadata: ConfigMetadata, theme: 'green' | 'red') {
  let sum = 0
  for (let level = 1; level <= themeLevelCount(metadata, theme); level++) {
    const value = Number(model[themeLevelKey(theme, level)])
    if (Number.isFinite(value)) sum += value
  }
  return sum
}

const num = (model: EditorModel, name: string, fallback: number) => {
  const value = model[name]
  if (value === '' || value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function assemble(model: EditorModel, base: GameConfiguration, revision: number): GameConfigurationWrite {
  const crash: CrashSettings = {
    alpha: num(model, 'crash.alpha', base.crash.alpha),
    maxMultiplier: num(model, 'crash.maxMultiplier', base.crash.maxMultiplier),
    minCrashMultiplier: num(model, 'crash.minCrashMultiplier', base.crash.minCrashMultiplier),
    multiplierGrowthRate: num(model, 'crash.multiplierGrowthRate', base.crash.multiplierGrowthRate),
    fps: num(model, 'crash.fps', base.crash.fps),
    delta: num(model, 'crash.delta', base.crash.delta),
  }
  const tiers: Pick<BoosterSettings, 'multiplierTier1Value' | 'multiplierTier2Value' | 'multiplierTier3Value' | 'multiplierTier4Value'> = {
    multiplierTier1Value: num(model, 'boosters.multiplierTier1Value', base.boosters.multiplierTier1Value),
    multiplierTier2Value: num(model, 'boosters.multiplierTier2Value', base.boosters.multiplierTier2Value),
    multiplierTier3Value: num(model, 'boosters.multiplierTier3Value', base.boosters.multiplierTier3Value),
    multiplierTier4Value: num(model, 'boosters.multiplierTier4Value', base.boosters.multiplierTier4Value),
  }
  const green: Record<string, number> = {}
  const red: Record<string, number> = {}
  for (const theme of ['green', 'red'] as const) {
    const source = base.boosters[theme] as Record<string, number>
    for (const key of Object.keys(source)) {
      const level = Number(key.replace('line', '').replace('LootProb', ''))
      if (Number.isNaN(level)) continue
      ;(theme === 'green' ? green : red)[key] = num(model, themeLevelKey(theme, level), source[key])
    }
  }
  const boosters: BoosterSettings = { ...tiers, green, red }
  const points: PointsSettings = {
    pointsPerLine: num(model, 'points.pointsPerLine', base.points.pointsPerLine),
    pointsCashoutBonus: num(model, 'points.pointsCashoutBonus', base.points.pointsCashoutBonus),
    pointsXNBonus: num(model, 'points.pointsXNBonus', base.points.pointsXNBonus),
  }
  return {
    gameId: model.gameId?.trim() || base.gameId,
    gameName: model.gameName?.trim() || base.gameName,
    gameType: 'CRASH',
    isActive: model.isActive === undefined || model.isActive === '' ? base.isActive : model.isActive === 'true',
    revision,
    crash,
    boosters,
    points,
  }
}