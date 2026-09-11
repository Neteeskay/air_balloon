import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/adminApi';
import {
  clearAuthSession,
  consumeAuthSessionReason,
  getAuthSession,
  setAuthSession,
  subscribeAuthSession,
} from '../../../services/authSession';
import type { LoginRequest, LoginResponse } from '../../../types/admin';

interface AuthContextValue {
  session: LoginResponse | null;
  sessionMessage: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearSessionMessage: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialSession] = useState(() => {
    const value = getAuthSession();
    return { value, reason: value ? undefined : consumeAuthSessionReason() };
  });
  const [session, setSession] = useState<LoginResponse | null>(initialSession.value);
  const [sessionMessage, setSessionMessage] = useState<string | null>(
    initialSession.reason === 'expired' ? 'Сессия истекла. Войдите снова.' : null,
  );
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribeAuthSession((next, reason) => {
        setSession(next);
        if (!next && reason === 'expired') setSessionMessage('Сессия истекла. Войдите снова.');
        if (!next) queryClient.clear();
      }),
    [queryClient],
  );

  useEffect(() => {
    if (!session) return;
    let timer: number | undefined;
    const scheduleExpiryCheck = () => {
      const delay = Date.parse(session.expiresAt) - Date.now();
      if (delay <= 0) {
        clearAuthSession('expired');
        return;
      }
      timer = window.setTimeout(scheduleExpiryCheck, Math.min(delay, 2_147_000_000));
    };
    scheduleExpiryCheck();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [session]);

  const login = useCallback(async (credentials: LoginRequest) => {
    const result = await adminApi.login(credentials);
    setAuthSession(result);
    setSessionMessage(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminApi.logout();
    } catch {
      // Local session is cleared even if server-side token revocation cannot be reached.
    } finally {
      clearAuthSession('logout');
      setSessionMessage(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      sessionMessage,
      login,
      logout,
      clearSessionMessage: () => setSessionMessage(null),
    }),
    [login, logout, session, sessionMessage],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
