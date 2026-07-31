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
        // Wake up Render backend first (free tier cold start ~50s)
        await fetch('/api/health');
        if (cancelled) return;

        let data: FullEmployee[] = await apiFetch(API);

        if (data.length === 0) {
          await apiFetch(`${API}/seed`, {
            method: 'POST',
            body: JSON.stringify(mockEmployees),
          });
          data = await apiFetch(API);
        }

        if (!cancelled) {
          setEmployees(data);
          setLoading(false);
        }
      } catch {
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
