import type {
  ConfigMetadataResponse,
  ConfigParameterMetadata,
  GameConfigurationCandidateRequest,
  GameConfigurationResponse,
} from '../../../types/admin';

export interface EditableConfigModel {
  gameId: string;
  gameName: string;
  gameType: string;
  isActive: boolean;
  crash: {
    alpha: string;
    maxMultiplier: string;
    minCrashMultiplier: string;
    multiplierGrowthRate: string;
    fps: string;
    delta: string;
  };
  boosters: {
    multiplierTier1Value: string;
    multiplierTier2Value: string;
    multiplierTier3Value: string;
    multiplierTier4Value: string;
    green: Record<string, string>;
    red: Record<string, string>;
  };
  points: {
    pointsPerLine: string;
    pointsCashoutBonus: string;
    pointsXNBonus: string;
  };
}

export interface ChangeSummaryItem {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

export function numberToInput(value: number): string {
  return String(value);
}

export function parseDecimalInput(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('EMPTY_NUMBER');
  if (trimmed.includes(',') && trimmed.includes('.')) throw new Error('INVALID_NUMBER');
  const normalized = trimmed.replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) throw new Error('INVALID_NUMBER');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error('INVALID_NUMBER');
  return parsed;
}

export function toEditableConfig(config: GameConfigurationResponse): EditableConfigModel {
  return {
    gameId: config.gameId,
    gameName: config.gameName,
    gameType: config.gameType,
    isActive: config.isActive,
    crash: {
      alpha: numberToInput(config.crash.alpha),
      maxMultiplier: numberToInput(config.crash.maxMultiplier),
      minCrashMultiplier: numberToInput(config.crash.minCrashMultiplier),
      multiplierGrowthRate: numberToInput(config.crash.multiplierGrowthRate),
      fps: numberToInput(config.crash.fps),
      delta: numberToInput(config.crash.delta),
    },
    boosters: {
      multiplierTier1Value: numberToInput(config.boosters.multiplierTier1Value),
      multiplierTier2Value: numberToInput(config.boosters.multiplierTier2Value),
      multiplierTier3Value: numberToInput(config.boosters.multiplierTier3Value),
      multiplierTier4Value: numberToInput(config.boosters.multiplierTier4Value),
      green: Object.fromEntries(
        Object.entries(config.boosters.green).map(([key, value]) => [key, numberToInput(value)]),
      ),
      red: Object.fromEntries(
        Object.entries(config.boosters.red).map(([key, value]) => [key, numberToInput(value)]),
      ),
    },
    points: {
      pointsPerLine: numberToInput(config.points.pointsPerLine),
      pointsCashoutBonus: numberToInput(config.points.pointsCashoutBonus),
      pointsXNBonus: numberToInput(config.points.pointsXNBonus),
    },
  };
}

function parseNumericRecord(record: Record<string, string>): Record<string, number> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, parseDecimalInput(value)]));
}

export function buildCandidateRequest(
  model: EditableConfigModel,
  revision: number,
): GameConfigurationCandidateRequest {
  return {
    revision,
    gameId: model.gameId,
    gameName: model.gameName,
    gameType: model.gameType,
    isActive: model.isActive,
    crash: {
      alpha: parseDecimalInput(model.crash.alpha),
      maxMultiplier: parseDecimalInput(model.crash.maxMultiplier),
      minCrashMultiplier: parseDecimalInput(model.crash.minCrashMultiplier),
      multiplierGrowthRate: parseDecimalInput(model.crash.multiplierGrowthRate),
      fps: parseDecimalInput(model.crash.fps),
      delta: parseDecimalInput(model.crash.delta),
    },
    boosters: {
      multiplierTier1Value: parseDecimalInput(model.boosters.multiplierTier1Value),
      multiplierTier2Value: parseDecimalInput(model.boosters.multiplierTier2Value),
      multiplierTier3Value: parseDecimalInput(model.boosters.multiplierTier3Value),
      multiplierTier4Value: parseDecimalInput(model.boosters.multiplierTier4Value),
      green: parseNumericRecord(model.boosters.green),
      red: parseNumericRecord(model.boosters.red),
    },
    points: {
      pointsPerLine: parseDecimalInput(model.points.pointsPerLine),
      pointsCashoutBonus: parseDecimalInput(model.points.pointsCashoutBonus),
      pointsXNBonus: parseDecimalInput(model.points.pointsXNBonus),
    },
  };
}

export function metadataMap(metadata?: ConfigMetadataResponse): Map<string, ConfigParameterMetadata> {
  return new Map(metadata?.parameters.map((parameter) => [parameter.technicalName, parameter]) ?? []);
}

export function humanizeTechnicalName(name: string): string {
  const leaf = name.split('.').at(-1) ?? name;
  return leaf
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^./, (value) => value.toUpperCase());
}

export function labelForField(name: string, metadata?: ConfigMetadataResponse): string {
  const russianLabels: Record<string, string> = {
    gameId: 'Идентификатор игры',
    gameName: 'Название игры',
    gameType: 'Тип игры',
    isActive: 'Новые раунды разрешены',
    'crash.alpha': 'Преимущество системы',
    'crash.maxMultiplier': 'Максимальный коэффициент',
    'crash.minCrashMultiplier': 'Минимальный коэффициент завершения',
    'crash.multiplierGrowthRate': 'Скорость роста коэффициента',
    'crash.fps': 'Частота обновления',
    'crash.delta': 'Шаг изменения коэффициента',
    'boosters.multiplierTier1Value': 'Множитель 1',
    'boosters.multiplierTier2Value': 'Множитель 2',
    'boosters.multiplierTier3Value': 'Множитель 3',
    'boosters.multiplierTier4Value': 'Множитель 4',
    'points.pointsPerLine': 'Очки за прохождение уровня',
    'points.pointsCashoutBonus': 'Бонус за досрочное завершение',
    'points.pointsXNBonus': 'Бонус за активацию бустера',
  };
  if (russianLabels[name]) return russianLabels[name];
  const line = name.match(/boosters\.(green|red)\..*?(\d+)/i);
  if (line) return `${line[1] === 'green' ? 'Зелёный' : 'Красный'} бустер · линия ${line[2]}`;
  const item = metadata?.parameters.find((parameter) => parameter.technicalName === name);
  if (item?.displayName && /[А-Яа-яЁё]/.test(item.displayName)) return item.displayName.trim();
  return 'Параметр конфигурации';
}

function flattenConfig(config: GameConfigurationCandidateRequest): Record<string, unknown> {
  const result: Record<string, unknown> = {
    gameId: config.gameId,
    gameName: config.gameName,
    gameType: config.gameType,
    isActive: config.isActive,
    'crash.alpha': config.crash.alpha,
    'crash.maxMultiplier': config.crash.maxMultiplier,
    'crash.minCrashMultiplier': config.crash.minCrashMultiplier,
    'crash.multiplierGrowthRate': config.crash.multiplierGrowthRate,
    'crash.fps': config.crash.fps,
    'crash.delta': config.crash.delta,
    'boosters.multiplierTier1Value': config.boosters.multiplierTier1Value,
    'boosters.multiplierTier2Value': config.boosters.multiplierTier2Value,
    'boosters.multiplierTier3Value': config.boosters.multiplierTier3Value,
    'boosters.multiplierTier4Value': config.boosters.multiplierTier4Value,
    'points.pointsPerLine': config.points.pointsPerLine,
    'points.pointsCashoutBonus': config.points.pointsCashoutBonus,
    'points.pointsXNBonus': config.points.pointsXNBonus,
  };
  Object.entries(config.boosters.green).forEach(([key, value]) => {
    result[`boosters.green.${key}`] = value;
  });
  Object.entries(config.boosters.red).forEach(([key, value]) => {
    result[`boosters.red.${key}`] = value;
  });
  return result;
}

export function getChangeSummary(
  original: GameConfigurationResponse,
  candidate: GameConfigurationCandidateRequest,
  metadata?: ConfigMetadataResponse,
): ChangeSummaryItem[] {
  const before = flattenConfig({
    revision: original.revision,
    gameId: original.gameId,
    gameName: original.gameName,
    gameType: original.gameType,
    isActive: original.isActive,
    crash: original.crash,
    boosters: original.boosters,
    points: original.points,
  });
  const after = flattenConfig(candidate);
  return Object.keys(after)
    .filter((key) => !Object.is(before[key], after[key]))
    .map((key) => ({ field: key, label: labelForField(key, metadata), before: before[key], after: after[key] }));
}

export function getProbabilityKeys(
  theme: 'green' | 'red',
  config: GameConfigurationResponse,
  metadata?: ConfigMetadataResponse,
): string[] {
  const prefix = `boosters.${theme}.`;
  const fromMetadata =
    metadata?.parameters
      .map((parameter) => parameter.technicalName)
      .filter((name) => name.startsWith(prefix))
      .map((name) => name.slice(prefix.length)) ?? [];
  const keys = new Set([...Object.keys(config.boosters[theme]), ...fromMetadata]);
  return [...keys].sort((a, b) => {
    const an = Number(a.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
    const bn = Number(b.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
    return an - bn || a.localeCompare(b);
  });
}

export function isNormalizedProbabilityModel(probabilityModel?: string | null): boolean {
  const value = probabilityModel?.toLowerCase() ?? '';
  return value.includes('normalized');
}

export function probabilitySummary(values: Record<string, string>): number | null {
  try {
    return Object.values(values).reduce((sum, value) => sum + parseDecimalInput(value), 0);
  } catch {
    return null;
  }
}
