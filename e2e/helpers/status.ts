export type AcceptanceStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT RUN';

export class AcceptanceBlockedError extends Error {
  constructor(reason: string) {
    super(`[BLOCKED] ${reason}`);
    this.name = 'AcceptanceBlockedError';
  }
}

export function blocked(reason: string): never {
  throw new AcceptanceBlockedError(reason);
}

export function isBlockedMessage(message: string | undefined): boolean {
  return Boolean(message?.includes('[BLOCKED]'));
}
