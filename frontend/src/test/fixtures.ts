import type { ConfigMetadataResponse, GameConfigurationResponse } from '../types/admin';

export const currentConfig: GameConfigurationResponse = {
  id: 'config-10',
  revision: 10,
  status: 'ACTIVE',
  createdAt: '2026-09-11T10:00:00Z',
  createdBy: 'admin',
  activatedAt: '2026-09-11T10:05:00Z',
  activatedBy: 'admin',
  gameId: 'air-balloon',
  gameName: 'Воздушный Шар',
  gameType: 'CRASH',
  isActive: true,
  crash: {
    alpha: 0.85,
    maxMultiplier: 100,
    minCrashMultiplier: 1.5,
    multiplierGrowthRate: 0.15,
    fps: 60,
    delta: 0.0166666667,
  },
  boosters: {
    multiplierTier1Value: 1,
    multiplierTier2Value: 2,
    multiplierTier3Value: 3,
    multiplierTier4Value: 4,
    green: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`line${i + 1}LootProb`, 10])) as Record<string, number>,
    red: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`line${i + 1}LootProb`, 8])) as Record<string, number>,
  },
  points: { pointsPerLine: 10, pointsCashoutBonus: 25, pointsXNBonus: 50 },
};

export const metadata: ConfigMetadataResponse = {
  gameIdPolicy: 'IMMUTABLE',
  probabilityModel: 'WEIGHTS',
  greenLevelCount: 9,
  redLevelCount: 12,
  parameters: [
    { technicalName: 'gameId', displayName: 'Идентификатор игры', dataType: 'STRING', required: true, mutable: false },
    { technicalName: 'points.pointsPerLine', displayName: 'Очки за прохождение уровня', dataType: 'INTEGER', min: 0, max: 1000000, defaultValue: 10, required: true, mutable: true, group: 'POINTS' },
    { technicalName: 'crash.delta', displayName: 'Шаг изменения коэффициента', dataType: 'DECIMAL', min: 0, max: 1, defaultValue: 0.0166666667, required: true, mutable: true, group: 'CRASH' },
    ...Array.from({ length: 9 }, (_, i) => ({ technicalName: `boosters.green.line${i + 1}LootProb`, displayName: `GREEN level ${i + 1}`, dataType: 'DECIMAL', min: 0, max: 100, required: true, mutable: true, group: 'BOOSTERS' })),
    ...Array.from({ length: 12 }, (_, i) => ({ technicalName: `boosters.red.line${i + 1}LootProb`, displayName: `RED level ${i + 1}`, dataType: 'DECIMAL', min: 0, max: 100, required: true, mutable: true, group: 'BOOSTERS' })),
  ],
};
