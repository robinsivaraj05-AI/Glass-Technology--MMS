import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Save, X, Calendar, CalendarRange, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface TeamMember { empId: string; empName: string; role: string; sortOrder: number; }

interface OTRecord {
  _id: string; empId: string; empName: string;
  year: number; month: number; day: number;
  startTime: string; endTime: string; totalHours: number;
  reason: string; approvedBy: string;
}

interface FormState {
  empId: string; empName: string;
  dateStr: string; startTime: string; endTime: string;
  reason: string; approvedBy: string;
}

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const isEligible = (role: string) =>
  role.toLowerCase().includes('engineer') || role.toLowerCase().includes('technician');

const calcHours = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Math.round(mins / 60 * 100) / 100;
};

const fmtHrs = (h: number) => `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;

const emptyForm = (): FormState => ({ empId:'', empName:'', dateStr:'', startTime:'', endTime:'', reason:'', approvedBy:'' });

interface Approver { name: string; role: string; employeeId: string; }

// ── Main Component ────────────────────────────────────────────────────────────
interface Props {
  year: number; month: number; team: TeamMember[]; canEdit: boolean;
}

export default function OvertimeTab({ year, month, team, canEdit }: Props) {
  const { user } = useAuth();
  const eligibleTeam = team.filter(m => isEligible(m.role));

  const [mode,    setMode]    = useState<'monthly'|'yearly'>('monthly');
  const [view,    setView]    = useState<'entries'|'summary'>('entries');
  const [records, setRecords] = useState<OTRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const [showModal,  setShowModal]  = useState(false);
  const [editId,     setEditId]     = useState<string|null>(null);
  const [form,       setForm]       = useState<FormState>(emptyForm());
  const [formErr,    setFormErr]    = useState('');
  const [saving,     setSaving]     = useState(false);
  const [approvers,  setApprovers]  = useState<Approver[]>([]);

  useEffect(() => {
    // Fixed approvers for this organisation — always shown
    const DEFAULT_APPROVERS: Approver[] = [
      { name: 'Sathish Venmani', role: 'manager',        employeeId: '' },
      { name: 'Rabin Sivaraj',   role: 'deputy_manager', employeeId: 'GT020' },
    ];

    const buildList = (fromApi: Approver[]) => {
      const merged = [...DEFAULT_APPROVERS];
      // Merge API results that aren't already in the default list
      fromApi.forEach(a => {
        if (!merged.some(m => m.name === a.name)) merged.push(a);
      });
      // Add current logged-in user if manager/deputy and not already listed
      if (user?.name && (user.role === 'manager' || user.role === 'deputy_manager')) {
        if (!merged.some(m => m.name === user.name))
          merged.unshift({ name: user.name, role: user.role, employeeId: user.employeeId ?? '' });
      }
      setApprovers(merged);
    };

    fetch('/api/auth/approvers')
      .then(r => r.ok ? r.json() : [])
      .then((data: Approver[]) => buildList(data))
      .catch(() => buildList([]));
  }, [user]);

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = mode === 'yearly'
        ? `/api/overtime/yearly?year=${year}`
        : `/api/overtime?year=${year}&month=${month}`;
      const r = await fetch(url);
      setRecords(await r.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [year, month, mode]);

  useEffect(() => { load(); }, [load]);

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const openAdd = () => { setEditId(null); setForm(emptyForm()); setFormErr(''); setShowModal(true); };

  const openEdit = (rec: OTRecord) => {
    setEditId(rec._id);
    const ds = `${rec.year}-${String(rec.month).padStart(2,'0')}-${String(rec.day).padStart(2,'0')}`;
    setForm({ empId: rec.empId, empName: rec.empName, dateStr: ds, startTime: rec.startTime, endTime: rec.endTime, reason: rec.reason, approvedBy: rec.approvedBy });
    setFormErr(''); setShowModal(true);
  };

  const handleEmpChange = (empId: string) => {
    const m = eligibleTeam.find(t => t.empId === empId);
    setForm(f => ({ ...f, empId, empName: m?.empName ?? '' }));
  };

  const handleSave = async () => {
    const { empId, empName, dateStr, startTime, endTime } = form;
    if (!empId || !dateStr || !startTime || !endTime) { setFormErr('Please fill Employee, Date, Start and End time.'); return; }
    const dateObj = new Date(dateStr + 'T00:00:00');
    const day      = dateObj.getDate();
    const recMonth = mode === 'yearly' ? dateObj.getMonth() + 1 : month;
    const recYear  = dateObj.getFullYear();
    setSaving(true); setFormErr('');
    try {
      const body = { empId, empName, day, month: recMonth, year: recYear, startTime, endTime, reason: form.reason, approvedBy: form.approvedBy, totalHours: calcHours(startTime, endTime) };
      const url  = editId ? `/api/overtime/${editId}` : '/api/overtime';
      const r = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) { const err = await r.json(); setFormErr(err.error || 'Failed'); return; }
      setShowModal(false); load();
    } catch (e) { setFormErr(String(e)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete OT record for ${name}?`)) return;
    await fetch(`/api/overtime/${id}`, { method:'DELETE' });
    load();
  };

  // ── Summary calculation ────────────────────────────────────────────────────
  const summaryData = eligibleTeam.map(m => {
    const recs = records.filter(r => r.empId === m.empId);
    const totalHours = recs.reduce((s, r) => s + r.totalHours, 0);
    const byMonth = mode === 'yearly'
      ? SHORT_MONTHS.map((_, i) => recs.filter(r => r.month === i+1).reduce((s,r) => s + r.totalHours, 0))
      : null;
    return { ...m, otDays: recs.length, totalHours, recs, byMonth };
  });

  const previewHrs = calcHours(form.startTime, form.endTime);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8, minHeight:0 }}>

      {/* ── Sub-controls ── */}
      <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e2e8f0', padding:'8px 16px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        {/* Entries / Summary toggle */}
        <div style={{ display:'flex', background:'#f1f5f9', borderRadius:8, padding:3, gap:2 }}>
          {(['entries','summary'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
              background: view === v ? '#fff' : 'transparent',
              color: view === v ? '#1e293b' : '#94a3b8',
              boxShadow: view === v ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>{v === 'entries' ? 'OT Entries' : 'Summary'}</button>
          ))}
        </div>

        {/* Monthly / Yearly toggle */}
        <div style={{ display:'flex', background:'#f1f5f9', borderRadius:8, padding:3, gap:2 }}>
          {(['monthly','yearly'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              display:'flex', alignItems:'center', gap:4, padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
              background: mode === m ? '#fff' : 'transparent',
              color: mode === m ? '#1e293b' : '#94a3b8',
              boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
              {m === 'monthly' ? <Calendar size={11}/> : <CalendarRange size={11}/>}
              {m === 'monthly' ? 'Monthly' : 'Yearly'}
            </button>
          ))}
        </div>

        <div style={{ fontSize:12, color:'#64748b', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'5px 12px' }}>
          {mode === 'monthly' ? `${MONTHS[month-1]} ${year}` : `Full Year ${year}`}
        </div>

        <div style={{ flex:1 }}/>

        {/* Stats chips */}
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'4px 12px', fontSize:11, fontWeight:600, color:'#1d4ed8' }}>
            <Clock size={10} style={{ marginRight:4, verticalAlign:'middle' }}/>
            {records.reduce((s,r) => s+r.totalHours,0).toFixed(1)} hrs total
          </div>
          <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8, padding:'4px 12px', fontSize:11, fontWeight:600, color:'#15803d' }}>
            {records.length} entries
          </div>
        </div>

        {canEdit && view === 'entries' && (
          <button onClick={openAdd} style={{ display:'flex', alignItems:'center', gap:6, background:'#1d4ed8', color:'#fff', border:'none', borderRadius:8, padding:'7px 16px', cursor:'pointer', fontSize:12, fontWeight:700 }}>
            <Plus size={13}/> Add Overtime
          </button>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{ flex:1, background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden', display:'flex', flexDirection:'column', minHeight:0 }}>
        {loading ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', fontSize:13 }}>Loading…</div>
        ) : view === 'entries' ? (
          <EntriesView records={records} mode={mode} canEdit={canEdit} onEdit={openEdit} onDelete={handleDelete}/>
        ) : (
          <SummaryView summaryData={summaryData} mode={mode} year={year} month={month}/>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:16, padding:'28px 32px', width:480, boxShadow:'0 20px 60px rgba(0,0,0,0.25)', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Clock size={18} color="#1d4ed8"/>
                <span style={{ fontSize:16, fontWeight:700, color:'#1e293b' }}>{editId ? 'Edit' : 'Add'} Overtime Entry</span>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}><X size={16}/></button>
            </div>

            {/* Employee */}
            <label style={labelS}>Employee</label>
            <select value={form.empId} onChange={e => handleEmpChange(e.target.value)} disabled={!!editId} style={inputS}>
              <option value="">— Select Employee —</option>
              {eligibleTeam.map(m => <option key={m.empId} value={m.empId}>{m.empName} ({m.empId}) — {m.role}</option>)}
            </select>

            {/* Date */}
            <label style={labelS}>Date</label>
            <input
              type="date"
              value={form.dateStr}
              min={mode === 'monthly' ? `${year}-${String(month).padStart(2,'0')}-01` : `${year}-01-01`}
              max={mode === 'monthly'
                ? `${year}-${String(month).padStart(2,'0')}-${String(new Date(year, month, 0).getDate()).padStart(2,'0')}`
                : `${year}-12-31`}
              onChange={e => setForm(f => ({...f, dateStr: e.target.value}))}
              style={inputS}
            />

            {/* Times */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              <div>
                <label style={labelS}>Starting Time</label>
                <input type="time" value={form.startTime} onChange={e => setForm(f => ({...f, startTime: e.target.value}))} style={{ ...inputS, marginBottom:0 }}/>
              </div>
              <div>
                <label style={labelS}>Ending Time</label>
                <input type="time" value={form.endTime} onChange={e => setForm(f => ({...f, endTime: e.target.value}))} style={{ ...inputS, marginBottom:0 }}/>
              </div>
            </div>

            {/* Total OT preview */}
            {form.startTime && form.endTime && (
              <div style={{ background: previewHrs > 0 ? '#eff6ff' : '#fef2f2', border:`1px solid ${previewHrs > 0 ? '#bfdbfe' : '#fecaca'}`, borderRadius:8, padding:'8px 14px', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                {previewHrs > 0 ? <CheckCircle2 size={14} color="#1d4ed8"/> : <AlertCircle size={14} color="#dc2626"/>}
                <span style={{ fontSize:13, fontWeight:700, color: previewHrs > 0 ? '#1d4ed8' : '#dc2626' }}>
                  Total Overtime: {previewHrs > 0 ? fmtHrs(previewHrs) : 'Invalid time range'}
                </span>
              </div>
            )}

            {/* Reason */}
            <label style={labelS}>Reason for Overtime</label>
            <textarea value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} placeholder="e.g. Emergency breakdown, Plant shutdown, Urgent PM activity…" rows={2} style={{ ...inputS, resize:'vertical', fontFamily:'inherit' }}/>

            {/* Approved By */}
            <label style={labelS}>Approved By</label>
            <select value={form.approvedBy} onChange={e => setForm(f => ({...f, approvedBy: e.target.value}))} style={inputS}>
              <option value="">— Select Approver —</option>
              {approvers.map(a => (
                <option key={a.employeeId} value={a.name}>
                  {a.name} ({a.role === 'manager' ? 'Manager' : 'Deputy Manager'})
                </option>
              ))}
            </select>

            {formErr && <div style={{ color:'#dc2626', fontSize:12, marginBottom:12, background:'#fef2f2', padding:'6px 10px', borderRadius:6 }}>{formErr}</div>}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowModal(false)} style={{ flex:1, padding:'9px', border:'1px solid #e2e8f0', borderRadius:8, cursor:'pointer', fontSize:13, color:'#64748b', background:'#f8fafc' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:'9px', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700, color:'#fff', background:'#1d4ed8', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <Save size={13}/> {saving ? 'Saving…' : editId ? 'Update' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Entries Table ─────────────────────────────────────────────────────────────
function EntriesView({ records, mode, canEdit, onEdit, onDelete }: {
  records: OTRecord[]; mode: string; canEdit: boolean;
  onEdit: (r: OTRecord) => void; onDelete: (id: string, name: string) => void;
}) {
  if (records.length === 0)
    return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'#94a3b8' }}>
      <Clock size={40} style={{ opacity:0.2 }}/>
      <div style={{ fontSize:13 }}>No overtime entries for this period</div>
    </div>;

  return (
    <div style={{ overflowX:'auto', overflowY:'auto', flex:1 }}>
      <table style={{ borderCollapse:'collapse', width:'100%', tableLayout:'fixed' }}>
        <colgroup>
          <col style={{ width:36 }}/><col style={{ width:160 }}/><col style={{ width:64 }}/>
          {mode === 'yearly' && <col style={{ width:52 }}/>}
          <col style={{ width:44 }}/><col style={{ width:44 }}/><col style={{ width:44 }}/>
          <col style={{ width:64 }}/><col style={{ width:160 }}/><col style={{ width:140 }}/>
          {canEdit && <col style={{ width:68 }}/>}
        </colgroup>
        <thead>
          <tr style={{ background:'#1e3a8a', position:'sticky', top:0, zIndex:2 }}>
            {['SL','Employee Name','Emp ID', ...(mode==='yearly'?['Month']:[]), 'Day','Start','End','OT Hrs','Reason','Approved By',...(canEdit?['Actions']:[])].map(h => (
              <th key={h} style={{ color:'#93c5fd', fontWeight:700, fontSize:10, padding:'8px 6px', textAlign: h==='Employee Name'||h==='Reason'||h==='Approved By' ? 'left' : 'center', border:'1px solid rgba(255,255,255,0.1)', whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((rec, idx) => {
            const rowBg = idx % 2 === 0 ? '#f8fafc' : '#fff';
            return (
              <tr key={rec._id}>
                <td style={td(rowBg, 'center')}>{idx+1}</td>
                <td style={{ ...td(rowBg,'left'), paddingLeft:10, fontWeight:600 }}>
                  {rec.empName}
                </td>
                <td style={{ ...td(rowBg,'center'), color:'#2563eb', fontWeight:700, fontSize:11 }}>{rec.empId}</td>
                {mode === 'yearly' && <td style={{ ...td(rowBg,'center'), fontSize:11 }}>{SHORT_MONTHS[rec.month-1]}</td>}
                <td style={td(rowBg,'center')}>{rec.day}</td>
                <td style={{ ...td(rowBg,'center'), fontFamily:'monospace', fontSize:12 }}>{rec.startTime}</td>
                <td style={{ ...td(rowBg,'center'), fontFamily:'monospace', fontSize:12 }}>{rec.endTime}</td>
                <td style={{ ...td('#eff6ff','center'), color:'#1d4ed8', fontWeight:800, fontSize:13 }}>{fmtHrs(rec.totalHours)}</td>
                <td style={{ ...td(rowBg,'left'), paddingLeft:8, fontSize:11, color:'#475569' }}>{rec.reason || <span style={{ color:'#cbd5e1' }}>—</span>}</td>
                <td style={{ ...td(rowBg,'left'), paddingLeft:8, fontSize:11, color:'#15803d', fontWeight:600 }}>{rec.approvedBy || <span style={{ color:'#cbd5e1' }}>Pending</span>}</td>
                {canEdit && (
                  <td style={td(rowBg,'center')}>
                    <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                      <button onClick={() => onEdit(rec)} style={actionBtn('#eff6ff','#1d4ed8')}><Pencil size={11}/></button>
                      <button onClick={() => onDelete(rec._id, rec.empName)} style={actionBtn('#fef2f2','#dc2626')}><Trash2 size={11}/></button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background:'#0f172a' }}>
            <td colSpan={mode==='yearly'?3:3} style={{ color:'#94a3b8', fontWeight:600, fontSize:10, padding:'5px 6px', textAlign:'center' }}>TOTAL</td>
            {mode === 'yearly' && <td style={{ background:'#1e293b', padding:'5px 6px' }}/>}
            <td colSpan={3} style={{ background:'#1e293b', padding:'5px 6px' }}/>
            <td style={{ background:'#1e40af', color:'#bfdbfe', fontWeight:800, fontSize:12, textAlign:'center', padding:'5px 6px' }}>
              {fmtHrs(records.reduce((s,r)=>s+r.totalHours,0))}
            </td>
            <td colSpan={canEdit?3:2} style={{ background:'#1e293b', padding:'5px 6px' }}/>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Summary Table ─────────────────────────────────────────────────────────────
function SummaryView({ summaryData, mode, year, month }: {
  summaryData: ReturnType<typeof Array.prototype.map>;
  mode: string; year: number; month: number;
}) {
  const rows = summaryData as Array<{ empId:string; empName:string; role:string; otDays:number; totalHours:number; byMonth:number[]|null }>;
  const grandTotal = rows.reduce((s,r) => s + r.totalHours, 0);

  return (
    <div style={{ overflowX:'auto', overflowY:'auto', flex:1 }}>
      <table style={{ borderCollapse:'collapse', width:'100%' }}>
        <thead>
          <tr style={{ background:'#1e3a8a', position:'sticky', top:0, zIndex:2 }}>
            {['SL','Employee Name','Emp ID','Role','OT Days','Total OT Hrs','Avg per OT Day',
              ...(mode==='yearly' ? SHORT_MONTHS : [])
            ].map(h => (
              <th key={h} style={{ color:'#93c5fd', fontWeight:700, fontSize:10, padding:'8px 6px', textAlign: h==='Employee Name'||h==='Role' ? 'left' : 'center', border:'1px solid rgba(255,255,255,0.1)', whiteSpace:'nowrap', minWidth: h==='Employee Name'?140:h==='Role'?120:50 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const rowBg = idx % 2 === 0 ? '#f8fafc' : '#fff';
            const avg = r.otDays > 0 ? r.totalHours / r.otDays : 0;
            return (
              <tr key={r.empId}>
                <td style={td(rowBg,'center')}>{idx+1}</td>
                <td style={{ ...td(rowBg,'left'), paddingLeft:10, fontWeight:600 }}>{r.empName}</td>
                <td style={{ ...td(rowBg,'center'), color:'#2563eb', fontWeight:700, fontSize:11 }}>{r.empId}</td>
                <td style={{ ...td(rowBg,'left'), paddingLeft:8, fontSize:11, color:'#64748b' }}>{r.role}</td>
                <td style={{ ...td(r.otDays>0?'#f0fdf4':rowBg,'center'), color:r.otDays>0?'#15803d':'#cbd5e1', fontWeight:r.otDays>0?800:400, fontSize:r.otDays>0?14:12 }}>
                  {r.otDays > 0 ? r.otDays : <span style={{ color:'#d1d5db', fontSize:10 }}>Nil</span>}
                </td>
                <td style={{ ...td(r.totalHours>0?'#eff6ff':rowBg,'center'), color:r.totalHours>0?'#1d4ed8':'#cbd5e1', fontWeight:800, fontSize:r.totalHours>0?13:12 }}>
                  {r.totalHours > 0 ? fmtHrs(r.totalHours) : <span style={{ color:'#d1d5db', fontSize:10 }}>Nil</span>}
                </td>
                <td style={{ ...td(rowBg,'center'), fontSize:11, color:'#64748b' }}>
                  {avg > 0 ? fmtHrs(avg) : <span style={{ color:'#d1d5db', fontSize:10 }}>—</span>}
                </td>
                {mode === 'yearly' && r.byMonth?.map((hrs, i) => (
                  <td key={i} style={{ ...td(hrs>0?'#eff6ff':rowBg,'center'), color:hrs>0?'#1d4ed8':'#e2e8f0', fontWeight:hrs>0?700:400, fontSize:hrs>0?11:10 }}>
                    {hrs > 0 ? `${hrs.toFixed(1)}h` : <span style={{ color:'#d1d5db', fontSize:9 }}>—</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} style={{ background:'#0f172a', color:'#94a3b8', fontWeight:600, fontSize:10, padding:'4px 6px', textAlign:'center' }}>GRAND TOTAL</td>
            <td style={{ background:'#064e3b', color:'#6ee7b7', fontWeight:800, fontSize:12, textAlign:'center', padding:'4px 6px' }}>
              {rows.reduce((s,r)=>s+r.otDays,0)}
            </td>
            <td style={{ background:'#1e40af', color:'#bfdbfe', fontWeight:800, fontSize:12, textAlign:'center', padding:'4px 6px' }}>
              {fmtHrs(grandTotal)}
            </td>
            <td style={{ background:'#1e293b', padding:'4px 6px' }}/>
            {mode === 'yearly' && SHORT_MONTHS.map((_,i) => {
              const t = rows.reduce((s,r) => s + (r.byMonth?.[i] ?? 0), 0);
              return <td key={i} style={{ background: t>0?'#1e3a8a':'#0f172a', color:t>0?'#93c5fd':'#334155', fontWeight:700, fontSize:10, textAlign:'center', padding:'4px 4px' }}>{t>0?`${t.toFixed(1)}h`:'—'}</td>;
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────
const labelS: React.CSSProperties = { fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:4, userSelect:'none' };
const inputS: React.CSSProperties = { width:'100%', padding:'8px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box', marginBottom:14, color:'#1e293b', background:'#fff' };
const td = (bg: string, align: 'center'|'left'|'right'): React.CSSProperties => ({
  background: bg, color:'#1e293b', border:'1px solid #e2e8f0', textAlign: align, padding:'6px 6px', fontSize:12, height:44,
});
const actionBtn = (bg: string, color: string): React.CSSProperties => ({
  background: bg, color, border:`1px solid ${color}30`, borderRadius:6, padding:'4px 6px', cursor:'pointer', display:'flex', alignItems:'center',
});
