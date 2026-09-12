import type { GameTheme, ResultScreenData, RoundOutcome } from '../types/result';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? (value as UnknownRecord) : {};

const pick = (source: UnknownRecord, keys: string[]): unknown => {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
};

const toNumber = (value: unknown, field: string, fallback?: number): number => {
  if (value === undefined && fallback !== undefined) return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid result field: ${field}`);
  return parsed;
};

const toBoolean = (value: unknown, fallback = false): boolean => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return Boolean(value);
};

export const normalizeGameTheme = (value: unknown): GameTheme => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized.includes('green') || normalized === '9') return 'green';
  if (normalized.includes('red') || normalized === '12') return 'red';
  throw new Error(`Unknown game theme: ${String(value)}`);
};

export const normalizeRoundOutcome = (value: unknown): RoundOutcome => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['win', 'won', 'cashout', 'cashed_out', 'success'].includes(normalized)) return 'win';
  if (['loss', 'lost', 'crash', 'crashed', 'failed'].includes(normalized)) return 'loss';
  throw new Error(`Unknown round result: ${String(value)}`);
};

/**
 * Adapter for backend/state payloads. It deliberately does not perform any HTTP calls:
 * the backend remains the authority and the host application passes the completed round payload here.
 */
export const adaptRoundResult = (payload: unknown): ResultScreenData => {
  const source = asRecord(payload);
  const rewardSource = asRecord(pick(source, ['reward', 'roundReward']));
  const result = normalizeRoundOutcome(pick(source, ['result', 'outcome', 'roundResult', 'status']));
  const theme = normalizeGameTheme(pick(source, ['theme', 'gameTheme', 'gameType', 'gameMode']));

  const betAmount = toNumber(pick(source, ['betAmount', 'bet', 'stake']), 'betAmount');
  const crashMultiplier = toNumber(
    pick(source, ['crashMultiplier', 'crashPoint', 'finalMultiplier', 'potentialMaxMultiplier']),
    'crashMultiplier',
  );

  const payoutRaw = pick(source, ['payoutAmount', 'payout', 'winAmount']);
  const cashoutRaw = pick(source, ['cashoutMultiplier', 'cashoutAt', 'lockedMultiplier']);
  const potentialRaw = pick(source, ['potentialMaxMultiplier', 'maxReachedMultiplier', 'crashMultiplier']);

  return {
    roundId: String(pick(source, ['roundId', 'id']) ?? '') || undefined,
    result,
    theme,
    betAmount,
    payoutAmount: result === 'win' ? toNumber(payoutRaw, 'payoutAmount') : undefined,
    bonusBalance: toNumber(pick(source, ['bonusBalance', 'balance', 'bonusPoints']), 'bonusBalance'),
    cashoutMultiplier: result === 'win' ? toNumber(cashoutRaw, 'cashoutMultiplier') : undefined,
    crashMultiplier,
    potentialMaxMultiplier:
      result === 'win' ? toNumber(potentialRaw, 'potentialMaxMultiplier', crashMultiplier) : undefined,
    earnedPoints: toNumber(pick(source, ['earnedPoints', 'points', 'roundPoints']), 'earnedPoints', 0),
    reward: {
      count: toNumber(pick(rewardSource, ['count', 'quantity']) ?? pick(source, ['rewardCount']), 'reward.count', 0),
      label: String(pick(rewardSource, ['label', 'name']) ?? 'Новый фрагмент'),
    },
    playerName: String(pick(source, ['playerName', 'username', 'displayName']) ?? 'Игрок'),
    canRepeatBet: toBoolean(pick(source, ['canRepeatBet', 'repeatBetAvailable']), true),
  };
};
