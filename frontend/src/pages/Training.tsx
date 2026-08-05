import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, X, GraduationCap, Users, Award, CheckCircle, ExternalLink } from 'lucide-react';
import { useEmployees } from '../context/EmployeeContext';
import type { TrainingRecord, FullEmployee } from '../data/employeeData';

const TYPE_COLORS: Record<string, string> = {
  Safety:      '#ef4444',
  Technical:   '#3b82f6',
  Compliance:  '#f59e0b',
  Leadership:  '#8b5cf6',
  HSE:         '#22c55e',
  Quality:     '#06b6d4',
  IT:          '#f97316',
};
const typeColor = (t: string) => TYPE_COLORS[t] ?? '#64748b';

const BLANK_FORM = {
  empId: '', name: '', type: 'Technical', mode: 'Internal' as 'Internal' | 'External',
  trainer: '', date: '', duration: '', result: '', remarks: '',
};

export default function Training() {
  const navigate = useNavigate();
  const { employees, updateEmployee } = useEmployees();

  const [search, setSearch]           = useState('');
  const [filterType, setFilterType]   = useState('all');
  const [filterMode, setFilterMode]   = useState('all');
  const [filterEmp, setFilterEmp]     = useState('all');
  const [showAdd, setShowAdd]         = useState(false);
  const [form, setForm]               = useState({ ...BLANK_FORM });

  // Flatten all training records with employee info
  const allRecords = useMemo(() => {
    const rows: (TrainingRecord & { emp: FullEmployee })[] = [];
    employees.forEach(e => {
      (e.training ?? []).forEach(t => rows.push({ ...t, emp: e }));
    });
    return rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }, [employees]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return allRecords.filter(r => {
      if (s && !r.name.toLowerCase().includes(s) && !r.emp.name.toLowerCase().includes(s) && !r.trainer?.toLowerCase().includes(s)) return false;
      if (filterType !== 'all' && r.type !== filterType) return false;
      if (filterMode !== 'all' && r.mode !== filterMode) return false;
      if (filterEmp !== 'all' && r.emp.id !== filterEmp) return false;
      return true;
    });
  }, [allRecords, search, filterType, filterMode, filterEmp]);

  const types    = [...new Set(allRecords.map(r => r.type).filter(Boolean))];
  const passRate = allRecords.length ? Math.round(allRecords.filter(r => r.result?.toLowerCase() === 'pass').length / allRecords.length * 100) : 0;
  const internal = allRecords.filter(r => r.mode === 'Internal').length;
  const external = allRecords.filter(r => r.mode === 'External').length;

  const setF = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  const handleAdd = () => {
    if (!form.empId || !form.name.trim()) return;
    const target = employees.find(e => e.id === form.empId);
    if (!target) return;
    const newRecord: TrainingRecord = {
      id: String(Date.now()),
      name: form.name.trim(), type: form.type, mode: form.mode,
      trainer: form.trainer, date: form.date, duration: form.duration,
      result: form.result, remarks: form.remarks,
    };
    updateEmployee(target.id, { training: [...(target.training ?? []), newRecord] });
    setShowAdd(false);
    setForm({ ...BLANK_FORM });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Sessions',  value: allRecords.length, icon: <GraduationCap size={18} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)' },
          { label: 'Internal',        value: internal,           icon: <Users size={18} />,         color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.25)' },
          { label: 'External',        value: external,           icon: <Award size={18} />,         color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',   border: 'rgba(6,182,212,0.25)'  },
          { label: 'Pass Rate',       value: `${passRate}%`,     icon: <CheckCircle size={18} />,   color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.25)'  },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '14px 18px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ color: s.color }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#f1f5f9', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: s.color, marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search training, employee, trainer..." className="input-dark" style={{ paddingLeft: 30 }} />
        </div>
        <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} className="input-dark" style={{ width: 180 }}>
          <option value="all">All Employees</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-dark" style={{ width: 140 }}>
          <option value="all">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
          {types.length === 0 && ['Safety','Technical','Compliance','Leadership','HSE','Quality','IT'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterMode} onChange={e => setFilterMode(e.target.value)} className="input-dark" style={{ width: 130 }}>
          <option value="all">All Modes</option>
          <option value="Internal">Internal</option>
          <option value="External">External</option>
        </select>
        <button onClick={() => setShowAdd(true)} className="btn-primary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          <Plus size={13} /> Add Training
        </button>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'auto', padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Training Name</th>
              <th>Type</th>
              <th>Mode</th>
              <th>Trainer</th>
              <th>Date</th>
              <th>Duration</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={`${r.emp.id}-${r.id}-${i}`}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {r.emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{r.emp.name}</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>{r.emp.designation}</div>
                    </div>
                    <button
                      onClick={() => navigate(`/employees/${r.emp.id}`)}
                      title="Open profile"
                      style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 2 }}
                    ><ExternalLink size={11} /></button>
                  </div>
                </td>
                <td style={{ fontWeight: 500, color: '#e2e8f0', maxWidth: 220 }}>{r.name}</td>
                <td>
                  <span style={{ fontSize: 10, fontWeight: 600, color: typeColor(r.type), background: typeColor(r.type) + '20', padding: '2px 8px', borderRadius: 12, whiteSpace: 'nowrap' }}>
                    {r.type}
                  </span>
                </td>
                <td>
                  <span className={`badge ${r.mode === 'Internal' ? 'badge-gray' : 'badge-blue'}`} style={{ fontSize: 10 }}>{r.mode}</span>
                </td>
                <td style={{ fontSize: 12, color: '#64748b' }}>{r.trainer || '—'}</td>
                <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{r.date || '—'}</td>
                <td style={{ fontSize: 12, color: '#94a3b8' }}>{r.duration || '—'}</td>
                <td>
                  <span style={{ fontSize: 11, fontWeight: 600, color: r.result?.toLowerCase() === 'pass' ? '#22c55e' : r.result?.toLowerCase() === 'fail' ? '#ef4444' : '#94a3b8' }}>
                    {r.result || '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#475569' }}>
            <GraduationCap size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontSize: 14, marginBottom: 6 }}>No training records found</div>
            <div style={{ fontSize: 12 }}>Click "Add Training" to record a session</div>
          </div>
        )}
      </div>

      {/* Add Training Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => { setShowAdd(false); setForm({ ...BLANK_FORM }); }}>
          <div className="modal-content" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                <GraduationCap size={16} color="#3b82f6" /> Add Training Record
              </div>
              <button onClick={() => { setShowAdd(false); setForm({ ...BLANK_FORM }); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Employee *</label>
                <select className="input-dark" value={form.empId} onChange={e => setF('empId', e.target.value)}>
                  <option value="">— Select Employee —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Training Name *</label>
                <input type="text" className="input-dark" placeholder="e.g. LOTO Procedure Training" value={form.name} onChange={e => setF('name', e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Type</label>
                  <select className="input-dark" value={form.type} onChange={e => setF('type', e.target.value)}>
                    {['Safety','Technical','Compliance','Leadership','HSE','Quality','IT'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Mode</label>
                  <select className="input-dark" value={form.mode} onChange={e => setF('mode', e.target.value)}>
                    <option>Internal</option>
                    <option>External</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Trainer</label>
                  <input type="text" className="input-dark" placeholder="Trainer name" value={form.trainer} onChange={e => setF('trainer', e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Date</label>
                  <input type="date" className="input-dark" value={form.date} onChange={e => setF('date', e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Duration</label>
                  <input type="text" className="input-dark" placeholder="e.g. 4 hours / 2 days" value={form.duration} onChange={e => setF('duration', e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Result</label>
                  <select className="input-dark" value={form.result} onChange={e => setF('result', e.target.value)}>
                    <option value="">— Select —</option>
                    <option>Pass</option>
                    <option>Fail</option>
                    <option>Attended</option>
                    <option>In Progress</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Remarks</label>
                <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }} placeholder="Optional notes..." value={form.remarks} onChange={e => setF('remarks', e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleAdd}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center', opacity: form.empId && form.name.trim() ? 1 : 0.5 }}
                >
                  <Plus size={13} /> Save Training Record
                </button>
                <button onClick={() => { setShowAdd(false); setForm({ ...BLANK_FORM }); }} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
