import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Save, RefreshCw, X, Lock, CalendarDays, BarChart2, Pencil, CheckCircle2, UserPlus, Trash2, Calendar, CalendarRange, Clock, FileDown, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import OvertimeTab from './OvertimeTab';
import { exportAttendancePDF } from '../utils/generatePDF';

// ── Attendance codes ──────────────────────────────────────────────────────────
interface CodeDef { code: string; label: string; bg: string; text: string; border: string; }

const CODES: CodeDef[] = [
  { code:'PR', label:'Present',               bg:'#bbf7d0', text:'#14532d', border:'#4ade80' },
  { code:'WO', label:'Weekly Off',            bg:'#fef08a', text:'#713f12', border:'#facc15' },
  { code:'WH', label:'Work From Home',        bg:'#bae6fd', text:'#0c4a6e', border:'#38bdf8' },
  { code:'SD', label:'Special Duty',          bg:'#fed7aa', text:'#7c2d12', border:'#fb923c' },
  { code:'CO', label:'Compensate Off',        bg:'#fecaca', text:'#7f1d1d', border:'#f87171' },
  { code:'PL', label:'Planned Leave',         bg:'#e9d5ff', text:'#4c1d95', border:'#c084fc' },
  { code:'AL', label:'Annual Leave',          bg:'#fbcfe8', text:'#831843', border:'#f472b6' },
  { code:'OD', label:'On Duty',               bg:'#6ee7b7', text:'#064e3b', border:'#34d399' },
  { code:'RP', label:'Req. Permission',       bg:'#fef9c3', text:'#854d0e', border:'#fde047' },
  { code:'SL', label:'Special Leave',         bg:'#ddd6fe', text:'#3b0764', border:'#a78bfa' },
  { code:'NH', label:'National Holiday',      bg:'#e0e7ff', text:'#1e1b4b', border:'#818cf8' },
  { code:'A',  label:'First Shift',           bg:'#d1fae5', text:'#065f46', border:'#6ee7b7' },
  { code:'B',  label:'Second Shift',          bg:'#fef3c7', text:'#78350f', border:'#fbbf24' },
  { code:'C',  label:'Night Shift',           bg:'#c7d2fe', text:'#312e81', border:'#818cf8' },
];
const CODE_MAP   = Object.fromEntries(CODES.map(c => [c.code, c]));
const WORK_CODES = new Set(['PR','WH','SD','OD','A','B','C','RP']);
const MONTHS     = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
const SUMMARY_COLS = ['PR','WO','WH','SD','PL','AL','CO','OD','RP','A','B','C','SL','NH'];

type Tab = 'entry' | 'summary' | 'overtime';
interface TeamMember { empId: string; empName: string; role: string; sortOrder: number; }
type Entries = Record<string, Record<number, string>>;
type Remarks = Record<string, Record<number, string>>;

const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
const DOW_LETTER  = 'SMTWTFS';

// ── Main component ────────────────────────────────────────────────────────────
export default function Attendance() {
  const { user } = useAuth();
  const canEdit = user?.role === 'deputy_manager' || user?.role === 'manager';

  const now = new Date();
  const [tab,    setTab]    = useState<Tab>('entry');
  const [year,   setYear]   = useState(now.getFullYear());
  const [month,  setMonth]  = useState(now.getMonth() + 1);
  const [team,   setTeam]   = useState<TeamMember[]>([]);
  const [entries, setEntries] = useState<Entries>({});
  const [remarks, setRemarks] = useState<Remarks>({});
  const [dirty,   setDirty]   = useState<Set<string>>(new Set());
  const [saving,    setSaving]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);

  // Multi-cell selection: keys are "empId:day"
  const [selCells, setSelCells] = useState<Set<string>>(new Set());
  const [anchor,   setAnchor]   = useState<{ empIdx: number; day: number } | null>(null);
  const cellKey = (empId: string, day: number) => `${empId}:${day}`;

  // Work Summary mode
  const [summaryMode, setSummaryMode] = useState<'monthly' | 'yearly'>('monthly');
  const [yearlyEntries, setYearlyEntries] = useState<Entries>({});
  const [loadingYearly, setLoadingYearly] = useState(false);

  // Add Employee modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmp, setNewEmp] = useState({ empId:'', empName:'', role:'' });
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);

  // ── Data loading ─────────────────────────────────────────────────────────
  const loadTeam = useCallback(() => {
    fetch('/api/attendance/team')
      .then(r => r.json())
      .then((d: TeamMember[]) => setTeam(d.sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch(console.error);
  }, []);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const loadYearly = useCallback(async () => {
    setLoadingYearly(true);
    try {
      const r = await fetch(`/api/attendance/yearly?year=${year}`);
      const records: Array<{ empId: string; entries: { day: number; code: string }[] }> = await r.json();
      const map: Entries = {};
      records.forEach(rec => {
        map[rec.empId] = {};
        rec.entries.forEach(e => { map[rec.empId][e.day] = e.code; });
      });
      setYearlyEntries(map);
    } catch (e) { console.error(e); }
    finally { setLoadingYearly(false); }
  }, [year]);

  useEffect(() => { if (summaryMode === 'yearly') loadYearly(); }, [summaryMode, loadYearly]);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/attendance?year=${year}&month=${month}`);
      const records: Array<{ empId: string; entries: { day: number; code: string; remark?: string }[] }> = await r.json();
      const map: Entries = {};
      const remarksMap: Remarks = {};
      records.forEach(rec => {
        map[rec.empId] = {};
        remarksMap[rec.empId] = {};
        rec.entries.forEach(e => {
          map[rec.empId][e.day] = e.code;
          if (e.remark) remarksMap[rec.empId][e.day] = e.remark;
        });
      });
      setEntries(map);
      setRemarks(remarksMap);
      setDirty(new Set());
      setSelCells(new Set());
      setAnchor(null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  // ── Entry helpers ─────────────────────────────────────────────────────────
  const getCode = (empId: string, day: number) => entries[empId]?.[day] ?? '';

  const applyCode = (code: string) => {
    if (!selCells.size) return;
    const affected = new Set<string>();
    setEntries(prev => {
      const next = { ...prev };
      selCells.forEach(key => {
        const [empId, dayStr] = key.split(':');
        next[empId] = { ...next[empId], [Number(dayStr)]: code };
        affected.add(empId);
      });
      return next;
    });
    setDirty(prev => { const n = new Set(prev); affected.forEach(id => n.add(id)); return n; });
  };

  const clearCode = () => {
    if (!selCells.size) return;
    const affected = new Set<string>();
    setEntries(prev => {
      const next = { ...prev };
      selCells.forEach(key => {
        const [empId, dayStr] = key.split(':');
        const e = { ...next[empId] };
        delete e[Number(dayStr)];
        next[empId] = e;
        affected.add(empId);
      });
      return next;
    });
    setDirty(prev => { const n = new Set(prev); affected.forEach(id => n.add(id)); return n; });
  };

  const updateRemark = (empId: string, day: number, remark: string) => {
    setRemarks(prev => ({ ...prev, [empId]: { ...(prev[empId] ?? {}), [day]: remark } }));
    setDirty(prev => { const n = new Set(prev); n.add(empId); return n; });
  };

  // Cell click handler with Ctrl / Shift multi-select
  const handleCellClick = (empId: string, day: number, empIdx: number, e: React.MouseEvent) => {
    if (!canEdit) return;
    const key = cellKey(empId, day);
    if (e.ctrlKey || e.metaKey) {
      setSelCells(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
      setAnchor({ empIdx, day });
    } else if (e.shiftKey && anchor) {
      const r0 = Math.min(anchor.empIdx, empIdx), r1 = Math.max(anchor.empIdx, empIdx);
      const d0 = Math.min(anchor.day, day),     d1 = Math.max(anchor.day, day);
      const n = new Set<string>();
      for (let ri = r0; ri <= r1; ri++)
        for (let di = d0; di <= d1; di++)
          n.add(cellKey(team[ri].empId, di));
      setSelCells(n);
    } else {
      setSelCells(new Set([key]));
      setAnchor({ empIdx, day });
    }
  };

  // Click employee name → select entire row
  const handleRowSelect = (empId: string, empIdx: number) => {
    if (!canEdit) return;
    setSelCells(new Set(days.map(d => cellKey(empId, d))));
    setAnchor({ empIdx, day: 1 });
  };

  // Click day header → select entire column
  const handleColSelect = (day: number) => {
    if (!canEdit) return;
    setSelCells(new Set(team.map(m => cellKey(m.empId, day))));
    setAnchor(null);
  };

  // ── Add Employee ─────────────────────────────────────────────────────────
  const addEmployee = async () => {
    if (!newEmp.empId.trim() || !newEmp.empName.trim() || !newEmp.role.trim()) {
      setAddError('All fields are required.'); return;
    }
    setAddSaving(true); setAddError('');
    try {
      const r = await fetch('/api/attendance/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmp),
      });
      if (!r.ok) { const d = await r.json(); setAddError(d.error || 'Failed'); return; }
      setShowAddModal(false);
      setNewEmp({ empId:'', empName:'', role:'' });
      loadTeam();
    } catch (e) { setAddError(String(e)); }
    finally { setAddSaving(false); }
  };

  const removeEmployee = async (empId: string, empName: string) => {
    if (!confirm(`Remove ${empName} from the team?`)) return;
    await fetch(`/api/attendance/team/${empId}`, { method: 'DELETE' });
    loadTeam();
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveAll = async () => {
    if (!dirty.size) return;
    setSaving(true);
    try {
      const records = team.filter(m => dirty.has(m.empId)).map(m => ({
        empId: m.empId, empName: m.empName,
        entries: Object.entries(entries[m.empId] ?? {}).map(([day, code]) => ({
          day: Number(day), code,
          remark: remarks[m.empId]?.[Number(day)] || '',
        })),
      }));
      await fetch('/api/attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, records }),
      });
      setDirty(new Set());
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  // ── Month nav ─────────────────────────────────────────────────────────────
  const clearSel = () => { setSelCells(new Set()); setAnchor(null); };
  const prevMonth = () => { clearSel(); if (month === 1) { setYear(y => y-1); setMonth(12); } else setMonth(m => m-1); };
  const nextMonth = () => { clearSel(); if (month === 12) { setYear(y => y+1); setMonth(1); } else setMonth(m => m+1); };

  // ── Summary helpers ───────────────────────────────────────────────────────
  const countCode   = (empId: string, code: string) => Object.values(entries[empId] ?? {}).filter(c => c === code).length;
  const workingDays = (empId: string) => Object.values(entries[empId] ?? {}).filter(c => WORK_CODES.has(c)).length;

  // ── Shared controls bar ───────────────────────────────────────────────────
  const ctrlBar = (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:'10px 18px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
      {/* Tab switcher */}
      <div style={{ display:'flex', background:'#f1f5f9', borderRadius:10, padding:3, gap:2 }}>
        {([
          ['entry',    'Attendance Sheet', <CalendarDays size={13}/>],
          ['summary',  'Work Summary',     <BarChart2 size={13}/>],
          ['overtime', 'Overtime',         <Clock size={13}/>],
        ] as const).map(([t, label, icon]) => (
          <button key={t} onClick={() => setTab(t as Tab)} style={{
            display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, transition:'all 0.15s',
            background: tab === t ? '#fff' : 'transparent',
            color: tab === t ? '#1e293b' : '#94a3b8',
            boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      <div style={{ flex:1 }} />

      {/* Month navigation */}
      <div style={{ display:'flex', alignItems:'center', gap:6, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'5px 10px' }}>
        <button onClick={prevMonth} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748b', padding:2, display:'flex' }}><ChevronLeft size={15}/></button>
        <span style={{ fontSize:14, fontWeight:700, color:'#1e293b', minWidth:132, textAlign:'center' }}>{MONTHS[month-1]} {year}</span>
        <button onClick={nextMonth} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748b', padding:2, display:'flex' }}><ChevronRight size={15}/></button>
      </div>

      {/* Refresh (not on overtime tab — it has its own) */}
      {tab !== 'overtime' && (
        <button onClick={loadAttendance} disabled={loading} style={{ background:'none', border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 11px', color:'#64748b', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:12 }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }}/> Refresh
        </button>
      )}

      {/* Export PDF */}
      <button
        onClick={async () => {
          setExporting(true);
          try { await exportAttendancePDF(team, entries, year, month, remarks); }
          finally { setExporting(false); }
        }}
        disabled={exporting || team.length === 0}
        title="Download PDF report for management"
        style={{ display:'flex', alignItems:'center', gap:5, background: exporting ? '#f1f5f9' : '#1e3a8a', color: exporting ? '#94a3b8' : '#fff', border:'none', borderRadius:8, padding:'6px 14px', cursor: exporting ? 'default' : 'pointer', fontSize:12, fontWeight:700, transition:'all 0.15s' }}>
        <FileDown size={13} style={{ animation: exporting ? 'pulse 1s linear infinite' : undefined }}/>
        {exporting ? 'Generating…' : 'Export PDF'}
      </button>

      {/* Add Employee (managers only, entry tab) */}
      {canEdit && tab === 'entry' && (
        <button onClick={() => { setShowAddModal(true); setAddError(''); setNewEmp({ empId:'', empName:'', role:'' }); }}
          style={{ display:'flex', alignItems:'center', gap:5, background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:600, color:'#15803d' }}>
          <UserPlus size={13}/> Add Employee
        </button>
      )}

      {/* Save / View-only */}
      {tab === 'entry' && (canEdit ? (
        <button onClick={saveAll} disabled={!dirty.size || saving} style={{
          background: dirty.size ? '#1d4ed8' : '#f1f5f9',
          color: dirty.size ? '#fff' : '#94a3b8',
          border:`1px solid ${dirty.size ? '#1d4ed8' : '#e2e8f0'}`,
          borderRadius:8, padding:'6px 18px', cursor: dirty.size ? 'pointer' : 'default',
          display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:700, transition:'all 0.15s',
        }}>
          {dirty.size ? <Save size={13}/> : <CheckCircle2 size={13}/>}
          {saving ? 'Saving…' : dirty.size ? `Save Changes (${dirty.size})` : 'All Saved'}
        </button>
      ) : (
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#94a3b8', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 12px' }}>
          <Lock size={12}/> View Only
        </div>
      ))}
    </div>
  );

  const activeEntries  = summaryMode === 'yearly' ? yearlyEntries : entries;
  const activeTotalDays = summaryMode === 'yearly'
    ? Array.from({length:12}, (_,i) => daysInMonth(year, i+1)).reduce((a,b) => a+b, 0)
    : daysInMonth(year, month);
  const summaryCountCode   = (empId: string, code: string) => Object.values(activeEntries[empId] ?? {}).filter(c => c === code).length;
  const summaryWorkingDays = (empId: string) => Object.values(activeEntries[empId] ?? {}).filter(c => WORK_CODES.has(c)).length;

  return (
    <div style={{ background:'#f1f5f9', height:'calc(100vh - 60px)', padding:'14px 18px', display:'flex', flexDirection:'column', gap:10, overflow:'hidden' }}>
      {ctrlBar}

      {tab === 'entry' ? (
        <EntryTab
          year={year} month={month} days={days}
          team={team} entries={entries} dirty={dirty}
          canEdit={canEdit}
          selCells={selCells} cellKey={cellKey}
          handleCellClick={handleCellClick}
          handleRowSelect={handleRowSelect}
          handleColSelect={handleColSelect}
          clearSel={clearSel}
          getCode={getCode} applyCode={applyCode} clearCode={clearCode}
          removeEmployee={removeEmployee}
          remarks={remarks} updateRemark={updateRemark}
        />
      ) : tab === 'summary' ? (
        <SummaryTab
          year={year} month={month} days={days}
          team={team} entries={activeEntries}
          totalDays={activeTotalDays}
          summaryMode={summaryMode} setSummaryMode={setSummaryMode}
          loadingYearly={loadingYearly}
          countCode={summaryCountCode} workingDays={summaryWorkingDays}
        />
      ) : (
        <OvertimeTab year={year} month={month} team={team} canEdit={canEdit}/>
      )}

      {/* ── Add Employee Modal ── */}
      {showAddModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:16, padding:'28px 32px', width:420, boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <UserPlus size={18} color="#1d4ed8"/>
                <span style={{ fontSize:16, fontWeight:700, color:'#1e293b' }}>Add New Employee</span>
              </div>
              <button onClick={() => setShowAddModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}><X size={16}/></button>
            </div>

            {(['empName','empId','role'] as const).map(field => (
              <div key={field} style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, fontWeight:600, color:'#64748b', display:'block', marginBottom:4 }}>
                  {field === 'empName' ? 'Full Name' : field === 'empId' ? 'Employee ID' : 'Designation / Role'}
                </label>
                <input
                  value={newEmp[field]}
                  onChange={e => setNewEmp(prev => ({ ...prev, [field]: e.target.value }))}
                  placeholder={field === 'empName' ? 'Mr. John Doe' : field === 'empId' ? 'GT099' : 'Shift Engineer - A'}
                  style={{ width:'100%', padding:'8px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' }}
                  onKeyDown={e => e.key === 'Enter' && addEmployee()}
                />
              </div>
            ))}

            {addError && <div style={{ color:'#dc2626', fontSize:12, marginBottom:12, background:'#fef2f2', padding:'6px 10px', borderRadius:6 }}>{addError}</div>}

            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button onClick={() => setShowAddModal(false)} style={{ flex:1, padding:'9px', border:'1px solid #e2e8f0', borderRadius:8, cursor:'pointer', fontSize:13, color:'#64748b', background:'#f8fafc' }}>Cancel</button>
              <button onClick={addEmployee} disabled={addSaving} style={{ flex:2, padding:'9px', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700, color:'#fff', background:'#1d4ed8' }}>
                {addSaving ? 'Adding…' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 1: Attendance Entry Grid ──────────────────────────────────────────────
interface EntryTabProps {
  year: number; month: number; days: number[];
  team: TeamMember[]; entries: Entries; dirty: Set<string>;
  canEdit: boolean;
  selCells: Set<string>;
  cellKey: (empId: string, day: number) => string;
  handleCellClick: (empId: string, day: number, empIdx: number, e: React.MouseEvent) => void;
  handleRowSelect: (empId: string, empIdx: number) => void;
  handleColSelect: (day: number) => void;
  clearSel: () => void;
  getCode: (empId: string, day: number) => string;
  applyCode: (code: string) => void;
  clearCode: () => void;
  removeEmployee: (empId: string, empName: string) => void;
  remarks: Remarks;
  updateRemark: (empId: string, day: number, remark: string) => void;
}

function EntryTab({ year, month, days, team, entries, dirty, canEdit, selCells, cellKey, handleCellClick, handleRowSelect, handleColSelect, clearSel, getCode, applyCode, clearCode, removeEmployee, remarks, updateRemark }: EntryTabProps) {
  const getDow = (d: number) => new Date(year, month - 1, d).getDay();

  // Derive shared code across all selected cells (if all same → show it, else 'Mixed')
  const selCodeValues = Array.from(selCells).map(key => {
    const [empId, dayStr] = key.split(':');
    return getCode(empId, Number(dayStr));
  });
  const allSame  = selCodeValues.length > 0 && selCodeValues.every(c => c === selCodeValues[0]);
  const selCode  = allSame ? selCodeValues[0] : (selCodeValues.length > 0 ? 'Mixed' : '');
  const selDef   = (selCode && selCode !== 'Mixed') ? CODE_MAP[selCode] : null;
  const selCount = selCells.size;
  const selEmpCount = new Set(Array.from(selCells).map(k => k.split(':')[0])).size;


  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, flex:1, minHeight:0 }}>
      {/* Manager instruction strip */}
      {canEdit && (
        <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'7px 14px', display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#1d4ed8', flexShrink:0 }}>
          <Pencil size={13}/>
          <span><strong>Edit mode:</strong> Click a cell · <strong>Ctrl+click</strong> to add/remove · <strong>Shift+click</strong> for range · Click <strong>name</strong> to select full row · Click <strong>day number</strong> to select full column</span>
          {selCount > 0 && <span style={{ marginLeft:'auto', background:'#1d4ed8', color:'#fff', borderRadius:6, padding:'2px 10px', fontWeight:700 }}>{selCount} cell{selCount>1?'s':''} selected</span>}
        </div>
      )}

      {/* Grid */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden', flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
        <div style={{ overflowX:'auto', overflowY:'auto', flex:1 }}>
          <table style={{ borderCollapse:'separate', borderSpacing:0, tableLayout:'fixed' }}>
            <colgroup>
              <col style={{ width:10 }}/>
              <col style={{ width:150 }}/>
              <col style={{ width:30 }}/>
              {days.map(d => <col key={d} style={{ width:48 }}/>)}
            </colgroup>

            {/* Header */}
            <thead>
              <tr>
                <th style={thS(0, '#1e3a8a', '#fff', 4, true)}>SL</th>
                <th style={{ ...thS(10, '#1e3a8a', '#fff', 4, true), textAlign:'left', paddingLeft:10 }}>Employee Name</th>
                <th style={thS(160, '#1e3a8a', '#93c5fd', 4, true)}>Emp ID</th>
                {days.map(d => {
                  const dow = getDow(d);
                  const isSun = dow === 0, isSat = dow === 6;
                  const colSelected = canEdit && Array.from(selCells).some(k => k.endsWith(`:${d}`));
                  return (
                    <th key={d}
                      onClick={() => handleColSelect(d)}
                      title={canEdit ? 'Click to select entire column' : undefined}
                      style={{ border:'1px solid #e2e8f0', padding:'4px 2px', textAlign:'center', fontSize:11, fontWeight:700, position:'sticky', top:0, zIndex:1, cursor: canEdit ? 'pointer' : 'default', background: colSelected ? '#bfdbfe' : isSun ? '#fee2e2' : isSat ? '#dcfce7' : '#dbeafe', color: isSun ? '#b91c1c' : isSat ? '#15803d' : '#1e3a8a', whiteSpace:'nowrap', width:48 }}>
                      <div style={{ fontSize:13 }}>{d}</div>
                      <div style={{ fontSize:8, fontWeight:400, opacity:0.8 }}>{DOW_LETTER[dow]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {team.map((m, idx) => {
                const rowBg = idx % 2 === 0 ? '#f8fafc' : '#fff';
                const isDirty = dirty.has(m.empId);
                const rowAllSelected = canEdit && days.every(d => selCells.has(cellKey(m.empId, d)));
                return (
                  <tr key={m.empId}>
                    <td style={{ ...tdS(0, rowBg), textAlign:'center', color:'#94a3b8', fontSize:9, width:10 }}>{idx+1}</td>
                    <td
                      onClick={() => handleRowSelect(m.empId, idx)}
                      title={canEdit ? 'Click to select entire row' : undefined}
                      style={{ ...tdS(10, rowAllSelected ? '#dbeafe' : isDirty ? '#eff6ff' : rowBg), fontWeight:600, fontSize:12, paddingLeft:10, width:150, cursor: canEdit ? 'pointer' : 'default' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, overflow:'hidden' }}>
                        {isDirty && <span style={{ width:7, height:7, borderRadius:'50%', background:'#3b82f6', flexShrink:0 }}/>}
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, color: isDirty ? '#1d4ed8' : '#1e293b' }}>{m.empName}</span>
                        {canEdit && (
                          <button onClick={e => { e.stopPropagation(); removeEmployee(m.empId, m.empName); }}
                            title="Remove employee" style={{ background:'none', border:'none', cursor:'pointer', color:'#fca5a5', padding:2, flexShrink:0, display:'flex', opacity:0.6 }}
                            onMouseEnter={e => (e.currentTarget.style.opacity='1')} onMouseLeave={e => (e.currentTarget.style.opacity='0.6')}>
                            <Trash2 size={11}/>
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize:10, color:'#94a3b8', fontWeight:400 }}>{m.role}</div>
                    </td>
                    <td style={{ ...tdS(160, rowBg), textAlign:'center', fontWeight:700, color:'#2563eb', fontSize:11, width:30 }}>{m.empId}</td>

                    {days.map(d => {
                      const code = getCode(m.empId, d);
                      const def  = code ? CODE_MAP[code] : null;
                      const dow  = getDow(d);
                      const isSun = dow === 0;
                      const isSelected = selCells.has(cellKey(m.empId, d));
                      const remark = remarks[m.empId]?.[d] || '';
                      const tipLabel = def?.label || '';
                      const tooltipText = [tipLabel, remark ? `Note: ${remark}` : '', canEdit && !tipLabel ? 'Click to select · Ctrl+click · Shift+click for range' : ''].filter(Boolean).join('\n');
                      return (
                        <td
                          key={d}
                          onClick={e => handleCellClick(m.empId, d, idx, e)}
                          title={tooltipText || undefined}
                          style={{
                            border: '1px solid #e2e8f0',
                            boxShadow: isSelected ? 'inset 0 0 0 3px #1d4ed8' : 'none',
                            textAlign:'center', fontSize:12, fontWeight:800,
                            height:46, width:48, padding:0,
                            background: def ? def.bg : (isSun ? '#fef2f2' : rowBg),
                            color: def ? def.text : '#d1d5db',
                            cursor: canEdit ? 'pointer' : 'default',
                            userSelect:'none',
                            boxSizing:'border-box',
                            transition:'filter 0.1s',
                            position: 'relative',
                          }}
                          onMouseEnter={e => { if (canEdit && !isSelected) (e.currentTarget as HTMLElement).style.filter = 'brightness(0.9)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = ''; }}
                        >
                          {code || (canEdit ? <span style={{ fontSize:14, color:'#e2e8f0' }}>·</span> : '')}
                          {remark && (
                            <span style={{
                              position:'absolute', top:0, right:0,
                              width:0, height:0,
                              borderStyle:'solid',
                              borderWidth:'0 10px 10px 0',
                              borderColor:`transparent #f59e0b transparent transparent`,
                              display:'block',
                            }}/>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            {/* Footer totals row */}
            <tfoot>
              <tr>
                <td colSpan={3} style={{ position:'sticky', left:0, zIndex:3, background:'#0f172a', color:'#fff', fontWeight:700, fontSize:11, textAlign:'center', padding:'7px 4px', boxShadow:'3px 0 6px rgba(0,0,0,0.15)' }}>TOTAL</td>
                {days.map(d => {
                  const cnt = team.filter(m => { const c = getCode(m.empId, d); return c && c !== 'WO' && c !== 'NH'; }).length;
                  return <td key={d} style={{ border:'1px solid #e2e8f0', textAlign:'center', fontWeight:700, fontSize:11, background: cnt > 0 ? '#dbeafe' : '#f8fafc', color: cnt > 0 ? '#1d4ed8' : '#cbd5e1', height:36 }}>{cnt > 0 ? cnt : ''}</td>;
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Bottom Code Picker Panel ── */}
      {canEdit && (
        <div style={{
          flexShrink:0,
          background:'#fff',
          border:'2px solid #e2e8f0',
          borderRadius:12,
          boxShadow:'0 -2px 12px rgba(0,0,0,0.07)',
          padding:'10px 20px',
          display:'flex', alignItems:'center', gap:14,
          minHeight:148,
        }}>
          {selCount > 0 ? (
            <>
              {/* Selection info */}
              <div style={{ minWidth:160, flexShrink:0 }}>
                <div style={{ fontSize:14, fontWeight:800, color:'#1d4ed8' }}>{selCount} cell{selCount>1?'s':''} selected</div>
                <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{selEmpCount} employee{selEmpCount>1?'s':''} · {MONTHS[month-1]} {year}</div>
                {selDef ? (
                  <div style={{ marginTop:5, display:'inline-flex', alignItems:'center', gap:5, background:selDef.bg, color:selDef.text, border:`1px solid ${selDef.border}`, borderRadius:6, padding:'3px 10px', fontSize:11, fontWeight:700 }}>
                    {selCode} — {selDef.label}
                  </div>
                ) : selCode === 'Mixed' ? (
                  <div style={{ marginTop:5, fontSize:11, color:'#f59e0b', fontWeight:600 }}>Mixed statuses</div>
                ) : (
                  <div style={{ marginTop:5, fontSize:11, color:'#94a3b8' }}>No status set</div>
                )}
              </div>

              {/* Divider */}
              <div style={{ width:1, alignSelf:'stretch', background:'#e2e8f0', flexShrink:0 }}/>

              {/* Code buttons */}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:'#94a3b8', marginBottom:5, fontWeight:600 }}>APPLY TO ALL {selCount} SELECTED CELL{selCount>1?'S':''}</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                  {CODES.map(c => {
                    const isActive = selCode === c.code;
                    return (
                      <button key={c.code} onClick={() => applyCode(c.code)} title={c.label} style={{
                        background: c.bg, color: c.text,
                        border: `2px solid ${isActive ? c.text : c.border}`,
                        borderRadius:8, padding:'5px 10px',
                        cursor:'pointer', fontSize:12, fontWeight:800,
                        boxShadow: isActive ? `0 0 0 3px ${c.text}30` : 'none',
                        transform: isActive ? 'scale(1.1)' : 'scale(1)',
                        transition:'all 0.1s', minWidth:44,
                      }}>
                        {c.code}
                        <div style={{ fontSize:8, fontWeight:400, opacity:0.8, lineHeight:1.1, marginTop:1 }}>{c.label.split(' ')[0]}</div>
                      </button>
                    );
                  })}
                  <button onClick={clearCode} style={{ background:'#fef2f2', color:'#dc2626', border:'2px solid #fecaca', borderRadius:8, padding:'5px 10px', cursor:'pointer', fontSize:12, fontWeight:700, minWidth:52 }}>
                    ✕<div style={{ fontSize:8, fontWeight:400, marginTop:1 }}>Clear</div>
                  </button>
                </div>
              </div>

              {/* Remark input — only for single cell */}
              {selCount === 1 && (() => {
                const [sEmpId, sDayStr] = Array.from(selCells)[0].split(':');
                const sDay = Number(sDayStr);
                const currentRemark = remarks[sEmpId]?.[sDay] || '';
                return (
                  <>
                    <div style={{ width:1, alignSelf:'stretch', background:'#e2e8f0', flexShrink:0 }}/>
                    <div style={{ minWidth:200, flexShrink:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:5 }}>
                        <MessageSquare size={12} color="#f59e0b"/>
                        <span style={{ fontSize:10, fontWeight:700, color:'#92400e' }}>REMARK / NOTE</span>
                      </div>
                      <textarea
                        rows={3}
                        value={currentRemark}
                        onChange={e => updateRemark(sEmpId, sDay, e.target.value)}
                        placeholder="e.g. Late due to traffic · Permission for hospital · On-site visit…"
                        style={{
                          width:220, padding:'6px 10px',
                          border:'1.5px solid #fcd34d', borderRadius:8,
                          fontSize:11, color:'#1e293b', background:'#fffbeb',
                          resize:'none', outline:'none', lineHeight:1.4,
                          fontFamily:'inherit', boxSizing:'border-box',
                        }}
                      />
                      {currentRemark && (
                        <button onClick={() => updateRemark(sEmpId, sDay, '')}
                          style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, color:'#f59e0b', padding:'2px 0', display:'block' }}>
                          Clear remark
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* Deselect */}
              <button onClick={clearSel} title="Clear selection" style={{ background:'none', border:'1px solid #e2e8f0', borderRadius:8, padding:7, cursor:'pointer', color:'#94a3b8', display:'flex', flexShrink:0 }}>
                <X size={15}/>
              </button>
            </>
          ) : (
            <div style={{ color:'#94a3b8', fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
              <Pencil size={14} style={{ opacity:0.4 }}/>
              Click a cell · Ctrl+click to multi-select · Shift+click for range · click a name or day number to select row/column
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab 2: Work Summary Table ─────────────────────────────────────────────────
interface SummaryTabProps {
  year: number; month: number; days: number[];
  team: TeamMember[]; entries: Entries;
  totalDays: number;
  summaryMode: 'monthly' | 'yearly';
  setSummaryMode: (m: 'monthly' | 'yearly') => void;
  loadingYearly: boolean;
  countCode: (empId: string, code: string) => number;
  workingDays: (empId: string) => number;
}

function SummaryTab({ year, month, team, totalDays, summaryMode, setSummaryMode, loadingYearly, countCode, workingDays, entries }: SummaryTabProps) {
  const [yearView, setYearView] = useState<'totals' | 'monthly'>('totals');
  const [breakCode, setBreakCode] = useState('WORK');

  // decode yearly key (month*100 + day) → month number
  const entryMonth = (k: number | string) => Math.floor(Number(k) / 100);
  const monthCount = (empId: string, m: number) =>
    Object.entries(entries[empId] ?? {}).filter(([k, c]) =>
      entryMonth(k) === m && (breakCode === 'WORK' ? WORK_CODES.has(c) : c === breakCode)
    ).length;
  const yearTotal = (empId: string) =>
    Array.from({ length: 12 }, (_, i) => monthCount(empId, i + 1)).reduce((a, b) => a + b, 0);

  const showBreakdown = summaryMode === 'yearly' && yearView === 'monthly';
  const breakDef = breakCode !== 'WORK' ? CODE_MAP[breakCode] : null;
  const accentBg   = breakDef?.bg   || '#f0fdf4';
  const accentText = breakDef?.text || '#15803d';

  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden', flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
      {/* Section header */}
      <div style={{ background:'#1e3a8a', padding:'10px 20px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <BarChart2 size={16} color="#93c5fd"/>
        <div style={{ flex:1, minWidth:180 }}>
          <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>
            Work Summary — {summaryMode === 'yearly'
              ? (yearView === 'monthly' ? `Monthly Breakdown ${year}` : `Full Year ${year}`)
              : `${MONTHS[month-1]} ${year}`}
          </div>
          <div style={{ color:'#93c5fd', fontSize:11, marginTop:1 }}>
            {summaryMode === 'yearly' && yearView === 'monthly'
              ? `Showing: ${breakCode === 'WORK' ? 'Working Days' : (CODE_MAP[breakCode]?.label || breakCode)} · ${team.length} employees`
              : `Auto-computed · ${team.length} employees · ${totalDays} days${summaryMode === 'yearly' ? ' (all 12 months)' : ''}`}
          </div>
        </div>

        {/* Monthly / Yearly toggle */}
        <div style={{ display:'flex', background:'rgba(255,255,255,0.1)', borderRadius:8, padding:3, gap:2 }}>
          {(['monthly','yearly'] as const).map(m => (
            <button key={m} onClick={() => setSummaryMode(m)} style={{
              display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer',
              background: summaryMode === m ? '#fff' : 'transparent',
              color: summaryMode === m ? '#1e3a8a' : '#93c5fd',
              fontWeight:600, fontSize:11, transition:'all 0.15s',
            }}>
              {m === 'monthly' ? <Calendar size={12}/> : <CalendarRange size={12}/>}
              {m === 'monthly' ? 'Monthly' : loadingYearly ? 'Loading…' : 'Yearly'}
            </button>
          ))}
        </div>

        {/* Yearly sub-view toggle */}
        {summaryMode === 'yearly' && (
          <>
            <div style={{ width:1, background:'rgba(255,255,255,0.2)', alignSelf:'stretch' }}/>
            <div style={{ display:'flex', background:'rgba(255,255,255,0.1)', borderRadius:8, padding:3, gap:2 }}>
              {(['totals','monthly'] as const).map(v => (
                <button key={v} onClick={() => setYearView(v)} style={{
                  padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer',
                  background: yearView === v ? '#fff' : 'transparent',
                  color: yearView === v ? '#1e3a8a' : '#93c5fd',
                  fontWeight:600, fontSize:11,
                }}>
                  {v === 'totals' ? 'Code Totals' : 'Monthly Breakdown'}
                </button>
              ))}
            </div>
            {yearView === 'monthly' && (
              <select value={breakCode} onChange={e => setBreakCode(e.target.value)}
                style={{ fontSize:11, padding:'5px 8px', borderRadius:6, border:'1px solid rgba(255,255,255,0.3)', background:'rgba(0,0,0,0.35)', color:'#fff', cursor:'pointer', outline:'none' }}>
                <option value="WORK">Working Days</option>
                {SUMMARY_COLS.map(c => <option key={c} value={c}>{c} — {CODE_MAP[c]?.label || c}</option>)}
              </select>
            )}
          </>
        )}
      </div>

      {/* ── Monthly Breakdown table (yearly + breakdown mode) ── */}
      {showBreakdown ? (
        <div style={{ overflowX:'auto', overflowY:'auto', flex:1 }}>
          <table style={{ borderCollapse:'collapse', tableLayout:'fixed', width:'100%' }}>
            <colgroup>
              <col style={{ width:36 }}/>
              <col style={{ width:170 }}/>
              <col style={{ width:64 }}/>
              {MONTHS.map((_, i) => <col key={i} style={{ width:62 }}/>)}
              <col style={{ width:72 }}/>
            </colgroup>
            <thead>
              <tr>
                <th style={sumTh('#1e3a8a','#93c5fd')}>SL</th>
                <th style={{ ...sumTh('#1e3a8a','#fff'), textAlign:'left', paddingLeft:12 }}>Employee Name</th>
                <th style={sumTh('#1e3a8a','#93c5fd')}>Emp ID</th>
                {MONTHS.map(mn => <th key={mn} style={sumTh('#1e3a8a','#dbeafe')}>{mn.slice(0,3)}</th>)}
                <th style={sumTh('#065f46','#6ee7b7')}>Year Total</th>
              </tr>
            </thead>
            <tbody>
              {team.map((m, idx) => {
                const rowBg = idx % 2 === 0 ? '#f8fafc' : '#fff';
                const total = yearTotal(m.empId);
                return (
                  <tr key={m.empId}>
                    <td style={sumTd(rowBg,'#94a3b8')}>{idx+1}</td>
                    <td style={{ ...sumTd(rowBg,'#1e293b'), textAlign:'left', paddingLeft:12, fontWeight:600 }}>
                      {m.empName}
                      <div style={{ fontSize:10, color:'#94a3b8', fontWeight:400 }}>{m.role}</div>
                    </td>
                    <td style={{ ...sumTd(rowBg,'#2563eb'), fontWeight:700 }}>{m.empId}</td>
                    {Array.from({ length:12 }, (_, i) => {
                      const cnt = monthCount(m.empId, i + 1);
                      return (
                        <td key={i} style={{ ...sumTd(cnt > 0 ? accentBg : rowBg, cnt > 0 ? accentText : '#d1d5db'), fontWeight: cnt > 0 ? 800 : 400, fontSize: cnt > 0 ? 14 : 12 }}>
                          {cnt > 0 ? cnt : <span style={{ fontSize:10 }}>—</span>}
                        </td>
                      );
                    })}
                    <td style={{ ...sumTd(total > 0 ? '#f0fdf4' : rowBg, total > 0 ? '#15803d' : '#d1d5db'), fontWeight:800, fontSize:15 }}>
                      {total > 0 ? total : <span style={{ fontSize:10 }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ background:'#0f172a', color:'#94a3b8', fontWeight:600, textAlign:'center', padding:'3px 4px', fontSize:9 }}>TOTAL</td>
                {Array.from({ length:12 }, (_, i) => {
                  const t = team.reduce((s, m) => s + monthCount(m.empId, i + 1), 0);
                  return <td key={i} style={sumFoot(accentText, accentBg)}>{t > 0 ? t : <span style={{ fontSize:8, color:'#d1d5db' }}>—</span>}</td>;
                })}
                <td style={sumFoot('#065f46','#6ee7b7')}>{team.reduce((s, m) => s + yearTotal(m.empId), 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (

      /* ── Code Totals table (default) ── */
      <div style={{ overflowX:'auto', overflowY:'auto', flex:1 }}>
        <table style={{ borderCollapse:'collapse', tableLayout:'fixed', width:'100%' }}>
          <colgroup>
            <col style={{ width:42 }}/>
            <col style={{ width:180 }}/>
            <col style={{ width:72 }}/>
            <col style={{ width:72 }}/> {/* Total Days */}
            <col style={{ width:80 }}/> {/* Working Days */}
            {SUMMARY_COLS.map(c => <col key={c} style={{ width:52 }}/>)}
          </colgroup>

          <thead>
            <tr>
              <th style={sumTh('#1e3a8a', '#93c5fd')}>SL</th>
              <th style={{ ...sumTh('#1e3a8a','#fff'), textAlign:'left', paddingLeft:12 }}>Employee Name</th>
              <th style={sumTh('#1e3a8a','#93c5fd')}>Emp ID</th>
              <th style={sumTh('#0f4c81','#bae6fd')}>Total Days</th>
              <th style={sumTh('#047857','#6ee7b7')}>Working Days</th>
              {SUMMARY_COLS.map(code => {
                const c = CODE_MAP[code];
                return <th key={code} style={sumTh(c?.text || '#374151', c?.bg || '#f1f5f9')}>{code}</th>;
              })}
            </tr>
          </thead>

          <tbody>
            {team.map((m, idx) => {
              const rowBg = idx % 2 === 0 ? '#f8fafc' : '#fff';
              const wd = workingDays(m.empId);
              return (
                <tr key={m.empId}>
                  <td style={sumTd(rowBg, '#94a3b8')}>{idx+1}</td>
                  <td style={{ ...sumTd(rowBg, '#1e293b'), textAlign:'left', paddingLeft:12, fontWeight:600 }}>
                    {m.empName}
                    <div style={{ fontSize:10, color:'#94a3b8', fontWeight:400 }}>{m.role}</div>
                  </td>
                  <td style={{ ...sumTd(rowBg, '#2563eb'), fontWeight:700 }}>{m.empId}</td>

                  {/* Total Days */}
                  <td style={{ ...sumTd('#eff6ff', '#1d4ed8'), fontWeight:700, fontSize:15 }}>{totalDays}</td>

                  {/* Working Days */}
                  <td style={{ ...sumTd(wd > 0 ? '#f0fdf4' : rowBg, wd > 0 ? '#15803d' : '#cbd5e1'), fontWeight:800, fontSize:16 }}>
                    {wd > 0 ? wd : <span style={{ fontSize:10, fontWeight:400, color:'#d1d5db' }}>Nil</span>}
                  </td>

                  {/* Code counts */}
                  {SUMMARY_COLS.map(code => {
                    const count = countCode(m.empId, code);
                    const c = CODE_MAP[code];
                    return (
                      <td key={code} style={{ ...sumTd(count > 0 ? (c?.bg || rowBg) : rowBg, count > 0 ? (c?.text || '#1e293b') : '#e2e8f0'), fontWeight: count > 0 ? 800 : 400, fontSize: count > 0 ? 15 : 13 }}>
                        {count > 0 ? count : <span style={{ fontSize:10, fontWeight:400, color:'#d1d5db' }}>Nil</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          {/* Summary footer */}
          <tfoot>
            <tr>
              <td colSpan={3} style={{ background:'#0f172a', color:'#94a3b8', fontWeight:600, textAlign:'center', padding:'3px 4px', fontSize:9 }}>TOTAL</td>
              <td style={sumFoot('#1e40af', '#bfdbfe')}>{totalDays}</td>
              <td style={sumFoot('#065f46','#6ee7b7')}>
                {team.reduce((s, m) => s + workingDays(m.empId), 0)}
              </td>
              {SUMMARY_COLS.map(code => {
                const total = team.reduce((s, m) => s + countCode(m.empId, code), 0);
                const c = CODE_MAP[code];
                return <td key={code} style={sumFoot(c?.text || '#374151', c?.bg || '#f1f5f9')}>
                  {total > 0 ? total : <span style={{ fontSize:8, fontWeight:400, color:'#d1d5db' }}>Nil</span>}
                </td>;
              })}
            </tr>

            {/* Percentage row */}
            <tr>
              <td colSpan={3} style={{ background:'#1e293b', color:'#64748b', fontWeight:500, textAlign:'center', padding:'2px 4px', fontSize:8 }}>%</td>
              <td style={sumFoot('#1e40af','#dbeafe')}>100%</td>
              {(() => {
                const totalWork = team.reduce((s, m) => s + workingDays(m.empId), 0);
                const possible  = team.length * totalDays;
                return <td style={sumFoot('#065f46','#dcfce7')}>{possible ? Math.round(totalWork/possible*100) : 0}%</td>;
              })()}
              {SUMMARY_COLS.map(code => {
                const total   = team.reduce((s, m) => s + countCode(m.empId, code), 0);
                const possible = team.length * totalDays;
                const c = CODE_MAP[code];
                return <td key={code} style={sumFoot(c?.text || '#374151', c?.bg ? c.bg+'99' : '#f8fafc')}>
                  {possible && total > 0 ? `${Math.round(total/possible*100)}%` : <span style={{ fontSize:8, fontWeight:400, color:'#d1d5db' }}>Nil</span>}
                </td>;
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      )}
    </div>
  );
}

// ── Shared style helpers ──────────────────────────────────────────────────────
function thS(left: number, bg: string, color: string, zExtra = 0, isTop = false): CSSProperties {
  return {
    position: 'sticky', left, top: isTop ? 0 : undefined,
    zIndex: isTop ? 5 + zExtra : 3 + zExtra,
    background: bg, color,
    border: '1px solid rgba(255,255,255,0.15)',
    ...(left === 160 ? { borderRight:'2px solid rgba(255,255,255,0.35)', boxShadow:'4px 0 8px rgba(0,0,0,0.18)' } : {}),
    fontSize: 10, fontWeight: 700, textAlign: 'center',
    padding: '7px 4px', whiteSpace: 'nowrap',
  };
}

function tdS(left: number, bg: string): CSSProperties {
  return {
    position:'sticky', left, zIndex: 2,
    background: bg, border:'1px solid #e2e8f0',
    fontSize:12, padding:'5px 6px', whiteSpace:'nowrap',
    ...(left === 160 ? { borderRight:'2px solid #94a3b8', boxShadow:'4px 0 8px rgba(0,0,0,0.10)' } : {}),
  };
}

function sumTh(color: string, bg: string): CSSProperties {
  return {
    background: bg, color, border:'1px solid rgba(255,255,255,0.2)',
    padding:'10px 6px', textAlign:'center', fontSize:11, fontWeight:700,
    whiteSpace:'nowrap', position:'sticky', top:0, zIndex:2,
  };
}

function sumTd(bg: string, color: string): CSSProperties {
  return {
    background: bg, color,
    border:'1px solid #e2e8f0',
    textAlign:'center', padding:'6px 4px',
    fontSize:13, height:52,
  };
}

function sumFoot(color: string, bg: string): CSSProperties {
  return {
    background: bg, color,
    border:'1px solid rgba(255,255,255,0.15)',
    textAlign:'center', padding:'1px 3px',
    fontWeight:700, fontSize:13,
  };
}
