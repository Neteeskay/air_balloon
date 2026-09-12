import { describe, expect, it } from 'vitest'
import { assemble, flatten, formParameters, themeSum } from './model'
import type { ConfigMetadata, GameConfiguration, ParameterMetadata } from './types'

const config: GameConfiguration = {
  id: 'id-1', revision: 1, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z', createdBy: 'admin',
  activatedAt: null, activatedBy: null, baseRevision: null, sourceVersionId: null,
  gameId: 'air-balloon', gameName: 'Воздушный шар', gameType: 'CRASH', isActive: true,
  crash: { alpha: 0.85, maxMultiplier: 100, minCrashMultiplier: 1, multiplierGrowthRate: 0.15, fps: 60, delta: 0.0166666667 },
  boosters: {
    multiplierTier1Value: 1, multiplierTier2Value: 2, multiplierTier3Value: 3, multiplierTier4Value: 4,
    green: { line1LootProb: 11.12, line2LootProb: 11.11, line3LootProb: 11.11, line4LootProb: 11.11, line5LootProb: 11.11, line6LootProb: 11.11, line7LootProb: 11.11, line8LootProb: 11.11, line9LootProb: 11.11 },
    red: { line1LootProb: 8.34, line2LootProb: 8.33, line3LootProb: 8.33, line4LootProb: 8.33, line5LootProb: 8.33, line6LootProb: 8.33, line7LootProb: 8.33, line8LootProb: 8.33, line9LootProb: 8.33, line10LootProb: 8.33, line11LootProb: 8.33, line12LootProb: 8.33 },
  },
  points: { pointsPerLine: 50, pointsCashoutBonus: 25, pointsXNBonus: 50 },
}

const p = (technicalName: string, displayName: string, group: string, dataType: string, extra: Partial<ParameterMetadata> = {}): ParameterMetadata => ({
  technicalName, displayName, description: null, dataType: dataType as ParameterMetadata['dataType'], unit: null,
  min: null, max: null, defaultValue: null, required: true, mutable: true, group: group as ParameterMetadata['group'],
  semanticType: null, allowedValues: null, effectOnGame: null, ...extra,
})

const metadata: ConfigMetadata = {
  gameIdPolicy: 'key', probabilityModel: 'weighted-per-level-sum-100', greenLevelCount: 9, redLevelCount: 12,
  parameters: [
    p('gameId', 'Game ID', 'general', 'string', { mutable: false }),
    p('gameName', 'Game name', 'general', 'string', { mutable: false }),
    p('crash.alpha', 'Alpha', 'crash', 'number', { min: 0, max: 1 }),
    p('crash.maxMultiplier', 'Max multiplier', 'crash', 'number', { semanticType: 'multiplier' }),
    p('boosters.multiplierTier1Value', 'Booster tier 1 multiplier', 'boosters', 'number', { allowedValues: ['1.0', '2.0', '3.0', '4.0'], semanticType: 'multiplier' }),
    p('boosters.green.lineNLootProb', 'green line loot probability (1..9)', 'boosters', 'percent', { semanticType: 'probability' }),
    p('boosters.red.lineNLootProb', 'red line loot probability (1..12)', 'boosters', 'percent', { semanticType: 'probability' }),
    p('points.pointsPerLine', 'Points per line', 'points', 'integer', { semanticType: 'value' }),
  ],
}

describe('admin config model', () => {
  it('flattens every editable parameter, expanding themed level templates', () => {
    const model = flatten(config, metadata)
    expect(model['gameId']).toBe('air-balloon')
    expect(model['crash.alpha']).toBe('0.85')
    expect(model['boosters.multiplierTier1Value']).toBe('1')
    expect(model['points.pointsPerLine']).toBe('50')
    expect(model['boosters.green.line1LootProb']).toBe('11.12')
    expect(model['boosters.green.line9LootProb']).toBe('11.11')
    expect(model['boosters.red.line1LootProb']).toBe('8.34')
    expect(model['boosters.red.line12LootProb']).toBe('8.33')
  })

  it('expands lineN templates into one parameter per level', () => {
    const params = formParameters(metadata)
    const green = params.filter(p => p.technicalName.startsWith('boosters.green.line') && /LootProb$/.test(p.technicalName))
    const red = params.filter(p => p.technicalName.startsWith('boosters.red.line') && /LootProb$/.test(p.technicalName))
    expect(green).toHaveLength(9)
    expect(red).toHaveLength(12)
    expect(green[8].technicalName).toBe('boosters.green.line9LootProb')
  })

  it('assembles a write request with the next revision and preserves untouched values', () => {
    const model = flatten(config, metadata)
    model['crash.alpha'] = '0.9'
    const write = assemble(model, config, 2)
    expect(write.revision).toBe(2)
    expect(write.gameId).toBe('air-balloon')
    expect(write.crash.alpha).toBeCloseTo(0.9)
    expect(write.crash.maxMultiplier).toBe(100)
    expect(write.boosters.green['line1LootProb']).toBeCloseTo(11.12)
    expect(write.points.pointsPerLine).toBe(50)
  })

  it('calculates per-theme probability sums', () => {
    const model = flatten(config, metadata)
    expect(themeSum(model, metadata, 'green')).toBeCloseTo(100, 1)
    expect(themeSum(model, metadata, 'red')).toBeCloseTo(100, 1)
    model['boosters.green.line3LootProb'] = '0'
    expect(themeSum(model, metadata, 'green')).toBeCloseTo(88.89)
  })
})