import { useState } from 'react';
import LoginPage from '../pages/LoginPage';
import FlightModePage from '../pages/FlightModePage';
import type { CurrentUser } from '../types/auth';

const AUTH_SESSION_KEY = 'air-balloon-auth-session';

function readSession(): CurrentUser | null {
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CurrentUser>;
    if (typeof value.userId !== 'string' || !value.userId.trim()) return null;
    if (typeof value.displayName !== 'string' || !value.displayName.trim()) return null;
    return { userId: value.userId, displayName: value.displayName };
  } catch {
    return null;
  }
}

function writeSession(user: CurrentUser | null) {
  try {
    if (user) window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // The app remains usable for the current tab when storage is unavailable.
  }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(readSession);

  if (!currentUser) {
    return <LoginPage onAuthenticated={(user) => {
      writeSession(user);
      setCurrentUser(user);
    }} />;
  }

  return <FlightModePage currentUser={currentUser} onLogout={() => {
    writeSession(null);
    setCurrentUser(null);
  }} />;
}
