import type { LoginResponse } from '../types/admin';

const SESSION_KEY = 'air-balloon-admin-session';

type SessionListener = (session: LoginResponse | null, reason?: 'expired' | 'logout') => void;
const listeners = new Set<SessionListener>();
let memorySession: LoginResponse | null = null;
let pendingReason: 'expired' | 'logout' | undefined;

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function isValidSession(value: unknown): value is LoginResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LoginResponse>;
  return (
    typeof candidate.accessToken === 'string' &&
    candidate.accessToken.length > 0 &&
    typeof candidate.tokenType === 'string' &&
    typeof candidate.expiresAt === 'string'
  );
}

export function isTokenExpired(expiresAt: string, now = Date.now()): boolean {
  const timestamp = Date.parse(expiresAt);
  return Number.isNaN(timestamp) || timestamp <= now;
}

export function getAuthSession(): LoginResponse | null {
  if (!memorySession) {
    const raw = storage()?.getItem(SESSION_KEY);
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isValidSession(parsed)) memorySession = parsed;
      } catch {
        storage()?.removeItem(SESSION_KEY);
      }
    }
  }
  if (memorySession && isTokenExpired(memorySession.expiresAt)) {
    clearAuthSession('expired');
  }
  return memorySession;
}

export function setAuthSession(session: LoginResponse): void {
  pendingReason = undefined;
  memorySession = session;
  storage()?.setItem(SESSION_KEY, JSON.stringify(session));
  listeners.forEach((listener) => listener(session));
}

export function clearAuthSession(reason?: 'expired' | 'logout'): void {
  pendingReason = listeners.size === 0 ? reason : undefined;
  memorySession = null;
  storage()?.removeItem(SESSION_KEY);
  listeners.forEach((listener) => listener(null, reason));
}

export function consumeAuthSessionReason(): 'expired' | 'logout' | undefined {
  const reason = pendingReason;
  pendingReason = undefined;
  return reason;
}

export function subscribeAuthSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetAuthSessionForTests(): void {
  memorySession = null;
  pendingReason = undefined;
  storage()?.removeItem(SESSION_KEY);
}
