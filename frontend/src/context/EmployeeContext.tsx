import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockEmployees, type FullEmployee } from '../data/employeeData';

interface EmployeeContextType {
  employees: FullEmployee[];
  loading: boolean;
  addEmployee: (emp: FullEmployee) => Promise<void>;
  updateEmployee: (id: string, patch: Partial<FullEmployee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

const API = '/api/employees';

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<FullEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        console.log('[EMP] pinging health...');
        const h = await fetch('/api/health');
        console.log('[EMP] health status:', h.status);
        if (cancelled) return;

        console.log('[EMP] fetching employees...');
        const res = await fetch(API, { headers: { 'Content-Type': 'application/json' } });
        console.log('[EMP] employees status:', res.status);
        const text = await res.text();
        console.log('[EMP] employees raw (first 200):', text.slice(0, 200));
        if (!res.ok) throw new Error(text);
        let data: FullEmployee[] = JSON.parse(text);
        console.log('[EMP] parsed count:', data.length);

        if (data.length === 0) {
          await fetch(`${API}/seed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mockEmployees),
          });
          const r2 = await fetch(API);
          data = await r2.json();
        }

        if (!cancelled) {
          setEmployees(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('[EMP] error:', err);
        if (!cancelled) {
          setEmployees(mockEmployees);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const addEmployee = async (emp: FullEmployee) => {
    try {
      const created: FullEmployee = await apiFetch(API, {
        method: 'POST',
        body: JSON.stringify(emp),
      });
      setEmployees(prev => [...prev, created]);
    } catch {
      // Optimistic fallback
      setEmployees(prev => [...prev, emp]);
    }
  };

  const updateEmployee = async (id: string, patch: Partial<FullEmployee>) => {
    // Optimistic update
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
    try {
      await apiFetch(`${API}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    } catch {
      // If API fails, local state already updated — acceptable for demo
    }
  };

  const deleteEmployee = async (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    try {
      await apiFetch(`${API}/${id}`, { method: 'DELETE' });
    } catch {
      // Optimistic delete — local state already removed
    }
  };

  const refetch = async () => {
    try {
      const data: FullEmployee[] = await apiFetch(API);
      setEmployees(data);
    } catch {
      // keep existing state on error
    }
  };

  return (
    <EmployeeContext.Provider value={{ employees, loading, addEmployee, updateEmployee, deleteEmployee, refetch }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployees() {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error('useEmployees must be used within EmployeeProvider');
  return ctx;
}
