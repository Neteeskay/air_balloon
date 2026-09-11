import { describe, expect, it } from 'vitest';
import { consumeAuthSessionReason, getAuthSession, isTokenExpired, setAuthSession } from './authSession';

describe('auth session', () => {
  it('detects token expiration', () => {
    const now = Date.parse('2026-09-11T10:00:00Z');
    expect(isTokenExpired('2026-09-11T09:59:59Z', now)).toBe(true);
    expect(isTokenExpired('2026-09-11T10:00:01Z', now)).toBe(false);
    expect(isTokenExpired('invalid', now)).toBe(true);
  });


  it('records expiration reason when an expired session is restored before listeners mount', () => {
    setAuthSession({ accessToken: 'expired', tokenType: 'Bearer', expiresAt: '2000-01-01T00:00:00Z' });
    expect(getAuthSession()).toBeNull();
    expect(consumeAuthSessionReason()).toBe('expired');
  });

  it('restores session from sessionStorage and never requires localStorage', () => {
    setAuthSession({ accessToken: 'secret', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00Z' });
    expect(getAuthSession()?.accessToken).toBe('secret');
    expect(sessionStorage.getItem('air-balloon-admin-session')).toContain('secret');
    expect(localStorage.getItem('air-balloon-admin-session')).toBeNull();
  });
});
