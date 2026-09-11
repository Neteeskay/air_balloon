import type { APIRequestContext, APIResponse } from '@playwright/test';
import { blocked } from './status';

export type UserState = {
  userId: string;
  username: string;
  displayName: string;
  bonusBalance: string | number;
  gameScore: string | number;
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

  async userState(userId: string): Promise<UserState> {
    const response = await this.request.get(`/api/users/${userId}/state`, { headers: this.headers });
    return this.requiredJson<UserState>(response, 'Persistent user/economy API is not integrated');
  }

  async startRound(theme: 'GREEN' | 'RED', betAmount: string, boosterMultiplier: number): Promise<RoundView> {
    const response = await this.request.post('/api/rounds', {
      headers: this.headers,
      data: { theme, betAmount, boosterMultiplier }
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

  async result(roundId: string): Promise<any> {
    const response = await this.request.get(`/api/rounds/${roundId}/result`, { headers: this.headers });
    return this.requiredJson<any>(response, 'Persistent round-result API is not integrated');
  }

  async adminConfig(adminToken: string): Promise<any> {
    const response = await this.request.get('/api/admin/config', {
      headers: { ...this.headers, 'X-Admin-Token': adminToken }
    });
    return this.requiredJson<any>(response, 'Runtime game-config API is not integrated');
  }

  async updateAdminConfig(adminToken: string, expectedVersion: number, config: any): Promise<any> {
    const response = await this.request.put('/api/admin/config', {
      headers: { ...this.headers, 'X-Admin-Token': adminToken },
      data: { expectedVersion, config }
    });
    return this.requiredJson<any>(response, 'Runtime game-config API is not integrated');
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
