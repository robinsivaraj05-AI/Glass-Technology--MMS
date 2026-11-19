import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { User, UserRole } from '../types';
import { mockUser } from '../data/mockData';
import { TOKEN_KEY, UNAUTHORIZED_EVENT } from '../utils/authFetch';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  /** true on success, otherwise an error message to show */
  login: (email: string, password: string) => Promise<true | string>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Profile fields that survive across sessions (name, phone, etc.) — keyed by empId
const profileKey = (empId: string) => `mms_profile_${empId}`;

// Session expires after 5 minutes of inactivity
const INACTIVITY_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem('mms_user');
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem('mms_expiry');
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // Server rejected the token (expired / invalid) → back to the login screen
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  // ── Inactivity timer — only runs while logged in ──────────────────────────
  useEffect(() => {
    if (!user) return;

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      sessionStorage.setItem('mms_expiry', String(Date.now() + INACTIVITY_MS));
      timerRef.current = setTimeout(logout, INACTIVITY_MS);
    };

    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer(); // start immediately

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, resetTimer));
    };
  }, [user, logout]);

  // ── Restore session on mount (tab-scoped, respects expiry) ────────────────
  useEffect(() => {
    const stored = sessionStorage.getItem('mms_user');
    const expiry = parseInt(sessionStorage.getItem('mms_expiry') || '0', 10);
    if (stored && sessionStorage.getItem(TOKEN_KEY) && Date.now() < expiry) {
      try { setUser(JSON.parse(stored)); } catch { sessionStorage.clear(); }
    } else {
      // Stale or expired — clear everything so user must re-authenticate
      sessionStorage.removeItem('mms_user');
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem('mms_expiry');
    }
    setLoading(false);
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (email: string, password: string): Promise<true | string> => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        return data.message || (res.status >= 500 ? 'Server is starting up — please try again in a moment.' : 'Invalid email or password.');
      }
      const su = data.user as { name: string; email: string; role: UserRole; department: string; employeeId: string; mustChangePassword?: boolean };
      // Restore any profile fields the user saved in a previous session
      let saved: Partial<User> = {};
      try {
        const raw = localStorage.getItem(profileKey(su.employeeId));
        if (raw) saved = JSON.parse(raw);
      } catch {}
      const u: User = {
        ...mockUser,
        ...saved,
        id: su.employeeId,
        name: saved.name ?? su.name,
        email: su.email,
        role: su.role,
        employeeId: saved.employeeId ?? su.employeeId,
        department: saved.department ?? su.department,
        mustChangePassword: !!su.mustChangePassword,
      };
      sessionStorage.setItem(TOKEN_KEY, data.token);
      sessionStorage.setItem('mms_user', JSON.stringify(u));
      sessionStorage.setItem('mms_expiry', String(Date.now() + INACTIVITY_MS));
      setUser(u);
      return true;
    } catch {
      return 'Cannot reach the server. Check your connection and try again.';
    } finally {
      setLoading(false);
    }
  };

  // ── Update user profile ───────────────────────────────────────────────────
  const updateUser = (patch: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      sessionStorage.setItem('mms_user', JSON.stringify(updated));
      // Persist profile customisations so they survive re-login
      const { name, phone, shift, dateOfJoining, employeeId, department } = updated;
      localStorage.setItem(profileKey(updated.id), JSON.stringify({ name, phone, shift, dateOfJoining, employeeId, department }));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
