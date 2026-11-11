import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { User, UserRole } from '../types';
import { mockUser } from '../data/mockData';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, role?: UserRole) => Promise<boolean>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_CREDENTIALS = [
  { email: 'manager@mms.com', password: 'mgr@2026', role: 'manager' as UserRole,        name: 'Senthil Babu',  empId: 'EMP-000', department: 'Electrical & Instrumentation, IT' },
  { email: 'deputy@mms.com',  password: 'dm@2026',  role: 'deputy_manager' as UserRole, name: 'Rabin Sivaraj', empId: 'EMP-001', department: 'Electrical & Instrumentation, IT' },
  { email: 'shift@mms.com',   password: 'se@2026',  role: 'shift_engineer' as UserRole, name: 'Arun Selvam',   empId: 'EMP-002', department: 'Electrical & Instrumentation' },
  { email: 'guest@mms.com',   password: 'guest123', role: 'guest' as UserRole,          name: 'Guest User',    empId: 'EMP-005', department: 'General' },
];

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
    sessionStorage.removeItem('mms_token');
    sessionStorage.removeItem('mms_expiry');
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

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
    if (stored && Date.now() < expiry) {
      try { setUser(JSON.parse(stored)); } catch { sessionStorage.clear(); }
    } else {
      // Stale or expired — clear everything so user must re-authenticate
      sessionStorage.removeItem('mms_user');
      sessionStorage.removeItem('mms_token');
      sessionStorage.removeItem('mms_expiry');
    }
    setLoading(false);
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    try {\n      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });\n      if (response.ok) {\n        const data = await response.json();\n        const u: User = { ...mockUser, id: data.user.id, name: data.user.name, email: data.user.email, role: data.user.role, department: data.user.department || '', employeeId: data.user.employeeId || '' };\n        setUser(u);\n        sessionStorage.setItem('mms_user', JSON.stringify(u));\n        sessionStorage.setItem('mms_token', data.token);\n        sessionStorage.setItem('mms_expiry', String(Date.now() + INACTIVITY_MS));\n        setLoading(false);\n        return true;\n      }\n    } catch { /* Development demo login may be used only when backend is unavailable. */ }\n    if (!import.meta.env.DEV) { setLoading(false); return false; }\n    const cred = DEMO_CREDENTIALS.find(c => c.email === email && c.password === password);
    if (cred) {
      // Restore any profile fields the user saved in a previous session
      let saved: Partial<User> = {};
      try {
        const raw = localStorage.getItem(profileKey(cred.empId));
        if (raw) saved = JSON.parse(raw);
      } catch {}
      const u: User = {
        ...mockUser,
        ...saved,
        id: cred.empId,
        name: saved.name ?? cred.name,
        email: cred.email,
        role: cred.role,
        employeeId: saved.employeeId ?? cred.empId,
        department: saved.department ?? cred.department,
      };
      setUser(u);
      sessionStorage.setItem('mms_user', JSON.stringify(u));
      sessionStorage.setItem('mms_token', 'demo-jwt-token-' + cred.role);
      sessionStorage.setItem('mms_expiry', String(Date.now() + INACTIVITY_MS));
      setLoading(false);
      return true;
    }
    setLoading(false);
    return false;
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
