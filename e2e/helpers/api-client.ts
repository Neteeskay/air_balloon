import type { APIRequestContext, APIResponse } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { blocked } from './status';

export type UserState = {
  userId: string;
  username: string;
  displayName: string;
  bonusBalance: string | number;
  gameScore: string | number;
  lotteryTicketCount?: string | number;
};

export type Scenario8Offer = {
  offerId: string;
  roundId: string;
  price: number;
  ticketCount: number;
  minWinAmount: number;
  expiresAt: string;
  status: 'AVAILABLE' | 'EXPIRED' | 'CONSUMED';
};

export type Scenario8Purchase = {
  offerId: string;
  roundId: string;
  price: number;
  ticketCount: number;
  bonusBalance: number;
  lotteryTicketCount: number;
  replayed: boolean;
};

export type RoundView = {
  id: string;
  roundId: string;
  theme: 'GREEN' | 'RED';
  betAmount: string | number;
  boosterMultiplier: number;
  boosterLevel?: number;
  boosterActivated: boolean;
  currentMultiplier: string | number;
  currentLevel: number;
  totalLevels: number;
  levelThresholds: Array<string | number>;
  cashoutAvailable: boolean;
  cashoutPreviewAmount?: string | number;
  cashoutMultiplier?: string | number;
  cashoutPerformed: boolean;
  winAmount: string | number;
  roundScore: number;
  status: 'RUNNING' | 'CASHED_OUT' | 'CRASHED' | 'FINISHED';
  outcome?: 'CASHED_OUT' | 'LOSS';
  crashMultiplier?: string | number;
  fairnessCommitment: string;
  fairnessReveal?: Record<string, unknown>;
  sequence: number;
  serverTime: string;
};

export type RoundEvent = {
  type: string;
  roundId: string;
  sequence: number;
  eventId: string;
  timestamp: string;
  serverTime: string;
  data: Record<string, any>;
};

export type ReplayView = {
  roundId: string;
  events: RoundEvent[];
  oldestAvailableSequence: number;
  latestSequence: number;
  snapshotRequired: boolean;
  serverTime: string;
};

export class ApiClient {
  private catalogPromise?: Promise<any>;
  private adminBearer?: string;

  constructor(
    private readonly request: APIRequestContext,
    private readonly headers: Record<string, string> = {}
  ) {}

  async health(): Promise<void> {
    let response: APIResponse;
    try {
      response = await this.request.get('/actuator/health', { headers: this.headers });
    } catch (error) {
      blocked(`Core backend is unreachable: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response!.ok()) blocked(`Core backend health endpoint returned HTTP ${response!.status()}`);
  }

  async demoUsers(): Promise<UserState[]> {
    const response = await this.request.get('/api/demo/users', { headers: this.headers });
    return this.requiredJson<UserState[]>(response, 'Demo Login user API is not integrated');
  }

  async login(username: string, password: string): Promise<UserState> {
    const response = await this.request.post('/api/auth/demo-login', { headers: this.headers, data: { username, password } });
    return this.requiredJson<UserState>(response, 'REAL demo login is unavailable');
  }

  async me(): Promise<UserState> {
    return this.requiredJson<UserState>(await this.request.get('/api/auth/me', { headers: this.headers }), 'Current-user auth is unavailable');
  }

  async currentState(): Promise<UserState> {
    return this.requiredJson<UserState>(await this.request.get('/api/current-user/state', { headers: this.headers }), 'Current-user state is unavailable');
  }

  async catalog(): Promise<any> {
    this.catalogPromise ??= this.requiredJson<any>(
      await this.request.get('/api/game/catalog', { headers: this.headers }),
      'Catalog is unavailable'
    );
    return this.catalogPromise;
  }

  async stakeOption(boosterMultiplier: number): Promise<{ amount: string | number; boosterMultiplier: number }> {
    const catalog = await this.catalog();
    if (!Array.isArray(catalog.stakeOptions) || catalog.stakeOptions.length !== 4) {
      throw new Error('Catalog must expose exactly four authoritative stakeOptions');
    }
    const option = catalog.stakeOptions.find((item: any) => item.boosterMultiplier === boosterMultiplier);
    if (!option) throw new Error(`Catalog has no stake option paired with x${boosterMultiplier}`);
    return option;
  }

  async userState(userId: string): Promise<UserState> {
    const response = await this.request.get(`/api/users/${userId}/state`, { headers: this.headers });
    return this.requiredJson<UserState>(response, 'Persistent user/economy API is not integrated');
  }

  async startRound(theme: 'GREEN' | 'RED', _legacyBetAmount: string, boosterMultiplier: number, idempotencyKey = randomUUID()): Promise<RoundView> {
    const option = await this.stakeOption(boosterMultiplier);
    const response = await this.request.post('/api/rounds', {
      headers: { ...this.headers, 'Idempotency-Key': idempotencyKey },
      data: { theme, betAmount: option.amount, boosterMultiplier: option.boosterMultiplier }
    });
    return this.requiredJson<RoundView>(response, 'Game Core start-round API is not integrated', 201);
  }

  async cashout(roundId: string, idempotencyKey?: string): Promise<{ response: APIResponse; body: any }> {
    const headers = { ...this.headers, ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) };
    const response = await this.request.post(`/api/rounds/${roundId}/cashout`, { headers });
    if ([404, 405, 501].includes(response.status())) blocked('Game Core cashout API is not integrated');
    return { response, body: await safeJson(response) };
  }

  async snapshot(roundId: string): Promise<RoundView> {
    const response = await this.request.get(`/api/rounds/${roundId}`, { headers: this.headers });
    return this.requiredJson<RoundView>(response, 'Game Core snapshot API is not integrated');
  }

  async replay(roundId: string, afterSequence: number): Promise<ReplayView> {
    const response = await this.request.get(`/api/rounds/${roundId}/events`, {
      headers: this.headers,
      params: { afterSequence }
    });
    return this.requiredJson<ReplayView>(response, 'Game Core replay API is not integrated');
  }

  async fairness(roundId: string): Promise<any> {
    const response = await this.request.get(`/api/rounds/${roundId}/fairness`, { headers: this.headers });
    return this.requiredJson<any>(response, 'Game Core fairness API is not integrated');
  }

  async history(page = 0, size = 100): Promise<any> {
    const response = await this.request.get('/api/history', { headers: this.headers, params: { page, size } });
    return this.requiredJson<any>(response, 'Persistent history API is not integrated');
  }

  async personalHistory(page = 0, size = 100): Promise<any> {
    const response = await this.request.get('/api/current-user/history', { headers: this.headers, params: { page, size } });
    return this.requiredJson<any>(response, 'Personal history API is not integrated');
  }

  async result(roundId: string): Promise<any> {
    const response = await this.request.get(`/api/rounds/${roundId}/result`, { headers: this.headers });
    return this.requiredJson<any>(response, 'Persistent round-result API is not integrated');
  }

  async scenario8Offer(roundId: string): Promise<{ response: APIResponse; body: Scenario8Offer | null }> {
    const response = await this.request.get('/api/current-user/upsell/lottery-tickets/offer', {
      headers: this.headers,
      params: { roundId }
    });
    if ([404, 405, 501].includes(response.status())) blocked(`Scenario 8 offer API is not integrated (HTTP ${response.status()})`);
    return { response, body: response.status() === 204 ? null : await safeJson(response) as Scenario8Offer };
  }

  async scenario8Purchase(offerId: string, idempotencyKey: string, extra: Record<string, unknown> = {}): Promise<{ response: APIResponse; body: any }> {
    const response = await this.request.post('/api/current-user/upsell/lottery-tickets/purchase', {
      headers: { ...this.headers, 'Idempotency-Key': idempotencyKey },
      data: { offerId, ...extra }
    });
    if ([404, 405, 501].includes(response.status())) blocked(`Scenario 8 purchase API is not integrated (HTTP ${response.status()})`);
    return { response, body: await safeJson(response) };
  }

  async adminConfig(_legacyAdminToken?: string): Promise<any> {
    const response = await this.request.get('/api/admin/config/current', {
      headers: { ...this.headers, Authorization: `Bearer ${await this.adminToken()}` }
    });
    return normalizeAdmin(await this.requiredJson<any>(response, 'Runtime game-config API is not integrated'));
  }

  async updateAdminConfig(_legacyAdminToken: string, expectedVersion: number, config: any): Promise<any> {
    const token = await this.adminToken();
    const currentResponse = await this.request.get('/api/admin/config/current', {
      headers: { ...this.headers, Authorization: `Bearer ${token}` }
    });
    const current = await this.requiredJson<any>(currentResponse, 'Runtime game-config API is not integrated');
    const draftResponse = await this.request.post('/api/admin/config', {
      headers: { ...this.headers, Authorization: `Bearer ${token}` },
      data: adminWrite(current, Math.max(expectedVersion + 1, current.revision + 1), config)
    });
    const draft = await this.requiredJson<any>(draftResponse, 'Runtime game-config draft API is not integrated', 201);
    const activated = await this.request.post(`/api/admin/config/${draft.id}/activate`, {
      headers: { ...this.headers, Authorization: `Bearer ${token}` }
    });
    this.catalogPromise = undefined;
    return normalizeAdmin(await this.requiredJson<any>(activated, 'Runtime game-config activation API is not integrated'));
  }

  async validateAdminConfig(config: any): Promise<APIResponse> {
    const token = await this.adminToken();
    const currentResponse = await this.request.get('/api/admin/config/current', {
      headers: { ...this.headers, Authorization: `Bearer ${token}` }
    });
    const current = await this.requiredJson<any>(currentResponse, 'Runtime game-config API is not integrated');
    return this.request.post('/api/admin/config/validate', {
      headers: { ...this.headers, Authorization: `Bearer ${token}` },
      data: adminWrite(current, current.revision + 1, config)
    });
  }

  async waitForSnapshot(roundId: string, predicate: (round: RoundView) => boolean, timeoutMs = 120_000): Promise<RoundView> {
    const deadline = Date.now() + timeoutMs;
    let latest: RoundView | undefined;
    while (Date.now() < deadline) {
      latest = await this.snapshot(roundId);
      if (predicate(latest)) return latest;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`Timed out waiting for round ${roundId}; last state=${JSON.stringify(latest)}`);
  }

  private async requiredJson<T>(response: APIResponse, unavailableReason: string, expectedStatus = 200): Promise<T> {
    if ([404, 405, 501].includes(response.status())) blocked(`${unavailableReason} (HTTP ${response.status()})`);
    if (response.status() !== expectedStatus) {
      throw new Error(`Expected HTTP ${expectedStatus}, got ${response.status()}: ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  private async adminToken(): Promise<string> {
    if (this.adminBearer) return this.adminBearer;
    const response = await this.request.post('/api/admin/auth/login', {
      headers: this.headers,
      data: { username: 'admin', password: 'admin' }
    });
    const body = await this.requiredJson<any>(response, 'Admin bearer login is unavailable');
    const token = String(body.accessToken ?? '');
    if (!token) throw new Error('Admin login response did not include accessToken');
    this.adminBearer = token;
    return token;
  }
}

function normalizeAdmin(value: any): any {
  return {
    version: value.revision,
    id: value.id,
    config: {
      gameId: value.gameId,
      gameName: value.gameName,
      gameType: value.gameType,
      isActive: value.isActive,
      alpha: value.crash.alpha,
      maxCrashMultiplier: value.crash.maxMultiplier,
      minCrashMultiplier: value.crash.minCrashMultiplier,
      growthRate: value.crash.multiplierGrowthRate,
      fps: value.crash.fps,
      delta: value.crash.delta,
      boosterValues: [value.boosters.multiplierTier1Value, value.boosters.multiplierTier2Value,
        value.boosters.multiplierTier3Value, value.boosters.multiplierTier4Value],
      green: value.boosters.green,
      red: value.boosters.red,
      pointsPerLevel: value.points.pointsPerLine,
      pointsCashoutBonus: value.points.pointsCashoutBonus,
      pointsXNBonus: value.points.pointsXNBonus
    }
  };
}

function adminWrite(current: any, revision: number, config: any): any {
  const boosters = Array.isArray(config.boosterValues) ? config.boosterValues : [
    current.boosters.multiplierTier1Value, current.boosters.multiplierTier2Value,
    current.boosters.multiplierTier3Value, current.boosters.multiplierTier4Value
  ];
  return {
    gameId: current.gameId,
    gameName: config.gameName ?? current.gameName,
    gameType: current.gameType,
    isActive: config.isActive ?? current.isActive,
    revision,
    crash: {
      alpha: config.alpha ?? current.crash.alpha,
      maxMultiplier: config.maxCrashMultiplier ?? current.crash.maxMultiplier,
      minCrashMultiplier: config.minCrashMultiplier ?? current.crash.minCrashMultiplier,
      multiplierGrowthRate: config.growthRate ?? current.crash.multiplierGrowthRate,
      fps: current.crash.fps,
      delta: current.crash.delta
    },
    boosters: {
      multiplierTier1Value: boosters[0], multiplierTier2Value: boosters[1],
      multiplierTier3Value: boosters[2], multiplierTier4Value: boosters[3],
      green: current.boosters.green, red: current.boosters.red
    },
    points: {
      pointsPerLine: config.pointsPerLevel ?? current.points.pointsPerLine,
      pointsCashoutBonus: config.pointsCashoutBonus ?? current.points.pointsCashoutBonus,
      pointsXNBonus: config.pointsXNBonus ?? current.points.pointsXNBonus
    }
  };
}

async function safeJson(response: APIResponse): Promise<any> {
  const text = await response.text();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return text; }
}

export function historyItems(page: any): any[] {
  if (!page || !Array.isArray(page.items)) throw new Error('History response must contain items[]');
  return page.items;
}
