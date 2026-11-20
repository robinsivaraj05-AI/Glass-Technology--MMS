import { useEffect, useMemo, useState } from 'react';
import { History, RefreshCw, Download, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiFetch } from '../utils/api';

// Who changed what, in which module — last 31 days (Manager / Deputy Manager)
interface LogEntry {
  _id: string; at: string; userName: string; role: string; module: string;
  action: string; item: string; details: string; path: string; method: string;
}

const ROLE_LABEL: Record<string, string> = { manager: 'Manager', deputy_manager: 'Deputy Manager', shift_engineer: 'Engineer', guest: 'User' };
const ACTION_COLOR: Record<string, string> = {
  Created: '#16a34a', Updated: '#2563eb', Deleted: '#dc2626', 'Step date set': '#7c3aed',
  Login: '#64748b', 'Password changed': '#b45309', 'User added': '#0891b2',
};
const fmt = (s: string) => new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ActivityLog() {
  const [rows, setRows] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);
  const [module, setModule] = useState('');
  const [user, setUser] = useState('');
  const [hideLogins, setHideLogins] = useState(false);
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setRows(await apiFetch(`/api/activity-log?days=${days}`)); }
    catch (e: any) { setError(e?.message || 'Could not load the activity log'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [days]);   // eslint-disable-line react-hooks/exhaustive-deps

  const modules = useMemo(() => [...new Set(rows.map(r => r.module))].filter(Boolean).sort(), [rows]);
  const users   = useMemo(() => [...new Set(rows.map(r => r.userName))].filter(Boolean).sort(), [rows]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter(r =>
      (!module || r.module === module) && (!user || r.userName === user) && (!hideLogins || r.action !== 'Login') &&
      (!t || `${r.item} ${r.details} ${r.module} ${r.userName}`.toLowerCase().includes(t)));
  }, [rows, module, user, hideLogins, q]);

  const changes = shown.filter(r => r.action !== 'Login').length;
  const byModule = useMemo(() => {
    const m = new Map<string, number>();
    shown.filter(r => r.action !== 'Login').forEach(r => m.set(r.module, (m.get(r.module) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [shown]);

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(shown.map(r => ({
      'Date & Time': fmt(r.at), User: r.userName, Role: ROLE_LABEL[r.role] || r.role, Module: r.module,
      Action: r.action, Item: r.item, Details: r.details,
    })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Activity Log');
    const d = new Date(); const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    XLSX.writeFile(wb, `Activity_Log_${ymd}.xlsx`);
  };

  const sel: React.CSSProperties = { height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, background: '#fff', color: '#1e293b' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <History size={22} color="#6366f1"/>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>Activity Log</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Who changed what, in which module — kept for one month</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={load} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><RefreshCw size={13}/> Refresh</button>
          <button className="btn-secondary" onClick={exportXlsx} disabled={!shown.length} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><Download size={13}/> Export Excel</button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <div className="glass-card" style={{ padding: '12px 14px', borderTop: '3px solid #6366f1' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>{changes}</div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Changes ({days === 1 ? 'today' : `last ${days} days`})</div>
        </div>
        {byModule.map(([m, n]) => (
          <div key={m} className="glass-card" style={{ padding: '12px 14px', borderTop: '3px solid #cbd5e1', cursor: 'pointer' }} onClick={() => setModule(m)} title="Show only this module">
            <div style={{ fontSize: 22, fontWeight: 800, color: '#334155' }}>{n}</div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{m}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={sel} value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={1}>Today</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option>
        </select>
        <select style={sel} value={module} onChange={e => setModule(e.target.value)}>
          <option value="">All modules</option>{modules.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select style={sel} value={user} onChange={e => setUser(e.target.value)}>
          <option value="">All users</option>{users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search item or details…" style={{ ...sel, width: '100%', boxSizing: 'border-box', paddingLeft: 28 }}/>
        </div>
        <label style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
          <input type="checkbox" checked={hideLogins} onChange={e => setHideLogins(e.target.checked)}/> Hide logins
        </label>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'auto' }}>
        {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Loading…</div>
        : error ? <div style={{ padding: 32, textAlign: 'center', color: '#b91c1c' }}>{error}</div>
        : (
          <table className="data-table" style={{ fontSize: 12, minWidth: 1000 }}>
            <thead><tr><th style={{ width: 150 }}>Date &amp; Time</th><th style={{ width: 200 }}>User</th><th style={{ width: 170 }}>Module</th><th style={{ width: 110 }}>Action</th><th>Item</th><th>Changed</th></tr></thead>
            <tbody>
              {shown.map(r => (
                <tr key={r._id}>
                  <td style={{ whiteSpace: 'nowrap', color: '#475569' }}>{fmt(r.at)}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.userName || 'Unknown'}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{ROLE_LABEL[r.role] || r.role}</div>
                  </td>
                  <td style={{ fontWeight: 600, color: '#334155' }}>{r.module}</td>
                  <td><span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#fff', background: ACTION_COLOR[r.action] || '#64748b' }}>{r.action}</span></td>
                  <td style={{ color: '#1e293b', wordBreak: 'break-word' }}>{r.item || '—'}</td>
                  <td style={{ color: '#64748b', wordBreak: 'break-word' }}>{r.details || '—'}</td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No activity in this period.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
