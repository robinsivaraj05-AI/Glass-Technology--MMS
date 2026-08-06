import React, { createContext, useContext, useState, useEffect } from 'react';
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
  { email: 'manager@mms.com', password: 'mgr@2026', role: 'manager' as UserRole,        name: 'Senthil Babu', empId: 'EMP-000', department: 'Electrical & Instrumentation, IT' },
  { email: 'deputy@mms.com',  password: 'dm@2026',  role: 'deputy_manager' as UserRole, name: 'Rajesh Kumar', empId: 'EMP-001', department: 'Electrical & Instrumentation, IT' },
  { email: 'shift@mms.com',   password: 'se@2026',  role: 'shift_engineer' as UserRole, name: 'Arun Selvam',  empId: 'EMP-002', department: 'Electrical & Instrumentation' },
  { email: 'guest@mms.com',   password: 'guest123', role: 'guest' as UserRole,          name: 'Guest User',   empId: 'EMP-005', department: 'General' },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('mms_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { localStorage.removeItem('mms_user'); }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    const cred = DEMO_CREDENTIALS.find(c => c.email === email && c.password === password);
    if (cred) {
      // Restore any profile fields the user previously saved for this account
      let savedProfile: Partial<User> = {};
      try {
        const raw = localStorage.getItem('mms_user');
        if (raw) {
          const prev = JSON.parse(raw) as User;
          if (prev.id === cred.empId) {
            savedProfile = { phone: prev.phone, shift: prev.shift, dateOfJoining: prev.dateOfJoining, employeeId: prev.employeeId };
          }
        }
      } catch {}
      const u: User = {
        ...mockUser,
        ...savedProfile,
        id: cred.empId,
        name: cred.name,
        email: cred.email,
        role: cred.role,
        employeeId: savedProfile.employeeId ?? cred.empId,
        department: cred.department,
      };
      setUser(u);
      localStorage.setItem('mms_user', JSON.stringify(u));
      localStorage.setItem('mms_token', 'demo-jwt-token-' + cred.role);
      setLoading(false);
      return true;
    }
    setLoading(false);
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('mms_user');
    localStorage.removeItem('mms_token');
  };

  const updateUser = (patch: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      localStorage.setItem('mms_user', JSON.stringify(updated));
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
