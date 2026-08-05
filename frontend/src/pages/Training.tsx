import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, GraduationCap, Users, Award, CheckCircle, ExternalLink, Download, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useEmployees } from '../context/EmployeeContext';
import type { TrainingRecord, FullEmployee } from '../data/employeeData';

const TYPE_COLORS: Record<string, string> = {
  Safety: '#ef4444', Technical: '#3b82f6', Compliance: '#f59e0b',
  Leadership: '#8b5cf6', HSE: '#22c55e', Quality: '#06b6d4', IT: '#f97316',
};
const typeColor = (t: string) => TYPE_COLORS[t] ?? '#64748b';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const BLANK_FORM = {
  empId: '', name: '', type: 'Technical', mode: 'Internal' as 'Internal' | 'External',
  trainer: '', date: '', duration: '', result: '', remarks: '',
};

type FlatRecord = TrainingRecord & { emp: FullEmployee };

export default function Training() {
  const navigate   = useNavigate();
  const { employees, updateEmployee } = useEmployees();
  const activeEmployees = employees.filter(e => e.status !== 'resigned');

  const [search, setSearch]           = useState('');
  const [filterType, setFilterType]   = useState('all');
  const [filterMode, setFilterMode]   = useState('all');
  const [filterEmp, setFilterEmp]     = useState('all');
  const [filterYear, setFilterYear]   = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [showAdd, setShowAdd]         = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FlatRecord | null>(null);
  const [form, setForm]               = useState({ ...BLANK_FORM });

  const allRecords = useMemo<FlatRecord[]>(() => {
    const rows: FlatRecord[] = [];
    employees.forEach(e => (e.training ?? []).forEach(t => rows.push({ ...t, emp: e })));
    return rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }, [employees]);

  // Derive available years from records
  const years = useMemo(() => {
    const ys = new Set(allRecords.map(r => r.date?.slice(0, 4)).filter(Boolean));
    return [...ys].sort().reverse();
  }, [allRecords]);

  const types = useMemo(() => [...new Set(allRecords.map(r => r.type).filter(Boolean))], [allRecords]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return allRecords.filter(r => {
      if (s && !r.name.toLowerCase().includes(s) && !r.emp.name.toLowerCase().includes(s) && !r.trainer?.toLowerCase().includes(s)) return false;
      if (filterType !== 'all' && r.type !== filterType) return false;
      if (filterMode !== 'all' && r.mode !== filterMode) return false;
      if (filterEmp !== 'all' && r.emp.id !== filterEmp) return false;
      if (filterYear !== 'all' && r.date?.slice(0, 4) !== filterYear) return false;
      if (filterMonth !== 'all') {
        const m = parseInt(r.date?.slice(5, 7) ?? '0', 10);
        if (m !== parseInt(filterMonth, 10)) return false;
      }
      return true;
    });
  }, [allRecords, search, filterType, filterMode, filterEmp, filterYear, filterMonth]);

  // Stats based on filtered set
  const passRate = filtered.length ? Math.round(filtered.filter(r => r.result?.toLowerCase() === 'pass').length / filtered.length * 100) : 0;
  const internal = filtered.filter(r => r.mode === 'Internal').length;
  const external = filtered.filter(r => r.mode === 'External').length;

  const setF = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  const handleAdd = () => {
    if (!form.empId || !form.name.trim()) return;
    const target = employees.find(e => e.id === form.empId);
    if (!target) return;
    const newRecord: TrainingRecord = {
      id: String(Date.now()), name: form.name.trim(), type: form.type, mode: form.mode,
      trainer: form.trainer, date: form.date, duration: form.duration, result: form.result, remarks: form.remarks,
    };
    updateEmployee(target.id, { training: [...(target.training ?? []), newRecord] });
    setShowAdd(false);
    setForm({ ...BLANK_FORM });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const emp = employees.find(e => e.id === deleteTarget.emp.id);
    if (!emp) return;
    updateEmployee(emp.id, { training: emp.training.filter(t => t.id !== deleteTarget.id) });
    setDeleteTarget(null);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pw, 20, 'F');
    doc.setTextColor(241, 245, 249);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Training Management Report', 14, 13);

    // Sub-header: filter context
    const periodParts: string[] = [];
    if (filterYear !== 'all') periodParts.push(filterYear);
    if (filterMonth !== 'all') periodParts.push(MONTHS[parseInt(filterMonth, 10) - 1]);
    const period = periodParts.length ? periodParts.join(' — ') : 'All Time';
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Period: ${period}   |   Records: ${filtered.length}   |   Pass Rate: ${passRate}%   |   Internal: ${internal}   |   External: ${external}`, 14, 26);

    // Summary boxes
    const boxes = [
      { label: 'Total Sessions', value: String(filtered.length) },
      { label: 'Internal',       value: String(internal) },
      { label: 'External',       value: String(external) },
      { label: 'Pass Rate',      value: `${passRate}%` },
    ];
    const bw = (pw - 28 - 9) / 4;
    boxes.forEach((b, i) => {
      const bx = 14 + i * (bw + 3);
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(bx, 30, bw, 14, 2, 2, 'F');
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(b.label, bx + bw / 2, 36, { align: 'center' });
      doc.setTextColor(241, 245, 249);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(b.value, bx + bw / 2, 41, { align: 'center' });
    });

    // Table
    autoTable(doc, {
      startY: 48,
      head: [['Employee', 'Designation', 'Training Name', 'Type', 'Mode', 'Trainer', 'Date', 'Duration', 'Result']],
      body: filtered.map(r => [
        r.emp.name,
        r.emp.designation,
        r.name,
        r.type || '—',
        r.mode || '—',
        r.trainer || '—',
        r.date || '—',
        r.duration || '—',
        r.result || '—',
      ]),
      styles: { fontSize: 8, cellPadding: 3, textColor: [226, 232, 240], fillColor: [15, 23, 42] },
      headStyles: { fillColor: [30, 58, 138], textColor: [219, 234, 254], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [22, 33, 55] },
      columnStyles: {
        0: { cellWidth: 32 }, 1: { cellWidth: 28 }, 2: { cellWidth: 52 },
        3: { cellWidth: 22 }, 4: { cellWidth: 18 }, 5: { cellWidth: 28 },
        6: { cellWidth: 20 }, 7: { cellWidth: 18 }, 8: { cellWidth: 16 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 8) {
          const v = (data.cell.raw as string)?.toLowerCase();
          if (v === 'pass') data.cell.styles.textColor = [34, 197, 94];
          else if (v === 'fail') data.cell.styles.textColor = [239, 68, 68];
        }
      },
    });

    // Footer
    const pageCount = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(`Generated: ${new Date().toLocaleString('en-AE')}   |   Page ${i} of ${pageCount}`, pw / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
    }

    const filename = `Training_Report_${filterYear !== 'all' ? filterYear : 'All'}${filterMonth !== 'all' ? `_${MONTHS[parseInt(filterMonth,10)-1]}` : ''}.pdf`;
    doc.save(filename);
  };

  const periodLabel = [
    filterMonth !== 'all' ? MONTHS[parseInt(filterMonth, 10) - 1] : '',
    filterYear !== 'all' ? filterYear : '',
  ].filter(Boolean).join(' ') || 'All Time';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Stats — reflect current filter */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Sessions', value: filtered.length,  icon: <GraduationCap size={18} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)' },
          { label: 'Internal',       value: internal,          icon: <Users size={18} />,         color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.25)' },
          { label: 'External',       value: external,          icon: <Award size={18} />,         color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',   border: 'rgba(6,182,212,0.25)'  },
          { label: 'Pass Rate',      value: `${passRate}%`,    icon: <CheckCircle size={18} />,   color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.25)'  },
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

      {/* Controls row 1: search + employee + type + mode */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search training, employee, trainer..." className="input-dark" style={{ paddingLeft: 30 }} />
        </div>
        <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} className="input-dark" style={{ width: 170 }}>
          <option value="all">All Employees</option>
          {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-dark" style={{ width: 130 }}>
          <option value="all">All Types</option>
          {(types.length ? types : ['Safety','Technical','Compliance','Leadership','HSE','Quality','IT']).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterMode} onChange={e => setFilterMode(e.target.value)} className="input-dark" style={{ width: 120 }}>
          <option value="all">All Modes</option>
          <option value="Internal">Internal</option>
          <option value="External">External</option>
        </select>
        {/* Year */}
        <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth('all'); }} className="input-dark" style={{ width: 110 }}>
          <option value="all">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
          {years.length === 0 && <option value={String(new Date().getFullYear())}>{new Date().getFullYear()}</option>}
        </select>
        {/* Month — only enabled when a year is selected */}
        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="input-dark"
          style={{ width: 120, opacity: filterYear === 'all' ? 0.45 : 1 }}
          disabled={filterYear === 'all'}
        >
          <option value="all">All Months</option>
          {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
        </select>
        <button onClick={exportPDF} className="btn-secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          <Download size={13} /> PDF Report
        </button>
        <button onClick={() => setShowAdd(true)} className="btn-primary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          <Plus size={13} /> Add Training
        </button>
      </div>

      {/* Active filter label */}
      {(filterYear !== 'all' || filterMonth !== 'all') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Showing:</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6', background: 'rgba(59,130,246,0.12)', padding: '2px 10px', borderRadius: 12 }}>{periodLabel}</span>
          <button onClick={() => { setFilterYear('all'); setFilterMonth('all'); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>× Clear</button>
        </div>
      )}

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
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={`${r.emp.id}-${r.id}-${i}`}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {r.emp.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{r.emp.name}</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>{r.emp.designation}</div>
                    </div>
                    <button onClick={() => navigate(`/employees/${r.emp.id}`)} title="Open profile"
                      style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 2 }}>
                      <ExternalLink size={11} />
                    </button>
                  </div>
                </td>
                <td style={{ fontWeight: 500, color: '#e2e8f0', maxWidth: 200 }}>{r.name}</td>
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
                <td>
                  <button
                    onClick={() => setDeleteTarget(r)}
                    title="Delete record"
                    style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', cursor: 'pointer', padding: '3px 6px', display: 'flex', alignItems: 'center' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#475569' }}>
            <GraduationCap size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontSize: 14, marginBottom: 6 }}>No training records found</div>
            <div style={{ fontSize: 12 }}>{allRecords.length === 0 ? 'Click "Add Training" to record a session' : 'Try adjusting your filters'}</div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.06)' }}>
              <AlertTriangle size={15} color="#ef4444" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>Delete Training Record</span>
            </div>
            <div style={{ padding: '18px 20px' }}>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 6px' }}>Delete this record for <strong style={{ color: '#f1f5f9' }}>{deleteTarget.emp.name}</strong>?</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', margin: '0 0 4px' }}>{deleteTarget.name}</p>
              <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 20px' }}>{deleteTarget.date} · {deleteTarget.type} · {deleteTarget.mode}</p>
              <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 20px' }}>This action cannot be undone.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={confirmDelete} style={{ flex: 1, padding: '9px 0', background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Trash2 size={13} /> Yes, Delete
                </button>
                <button onClick={() => setDeleteTarget(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>)}
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
                    <option>Internal</option><option>External</option>
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
                    <option>Pass</option><option>Fail</option><option>Attended</option><option>In Progress</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Remarks</label>
                <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }} placeholder="Optional notes..." value={form.remarks} onChange={e => setF('remarks', e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleAdd} className="btn-primary" style={{ flex: 1, justifyContent: 'center', opacity: form.empId && form.name.trim() ? 1 : 0.5 }}>
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
