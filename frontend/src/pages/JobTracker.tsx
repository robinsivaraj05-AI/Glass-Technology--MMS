// @ts-nocheck
import { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  ClipboardList, Bell, RefreshCw, Plus, Edit2, Trash2, CheckCircle2,
  AlertTriangle, Clock, Search, Download, FileDown, Upload, FileSpreadsheet,
  LayoutDashboard, AlarmClock, Repeat, X, User, CalendarDays,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PendingJob {
  id: string; jobId: string; asset: string; description: string;
  priority: string; assignedTo: string; createdDate: string;
  dueDate: string; status: string; remarks: string;
  completedBy: string; completedDate: string;
}
interface FollowupJob {
  id: string; followupId: string; relatedJobId: string; description: string;
  nextFollowupDate: string; status: string; responsiblePerson: string; comments: string;
}
interface Reminder {
  id: string; title: string; description: string; dueDate: string;
  frequency: string; priority: string; assignedUser: string; status: string;
}
interface Employee { id: string; name: string; designation: string; empId: string; }

// ── Config ────────────────────────────────────────────────────────────────────
const PRIORITY_CFG: Record<string, { bg: string; tc: string }> = {
  Low:      { bg: 'rgba(34,197,94,0.15)',  tc: '#22c55e' },
  Medium:   { bg: 'rgba(245,158,11,0.15)', tc: '#f59e0b' },
  High:     { bg: 'rgba(239,68,68,0.15)',  tc: '#ef4444' },
  Critical: { bg: 'rgba(168,85,247,0.15)', tc: '#a855f7' },
};
const JOB_STATUS_CFG: Record<string, { bg: string; tc: string }> = {
  'Open':           { bg: 'rgba(59,130,246,0.15)',  tc: '#3b82f6' },
  'Completed':      { bg: 'rgba(34,197,94,0.15)',   tc: '#22c55e' },
  'Partially Done': { bg: 'rgba(245,158,11,0.15)',  tc: '#f59e0b' },
  'Follow Up':      { bg: 'rgba(168,85,247,0.15)',  tc: '#a855f7' },
  'In Progress':    { bg: 'rgba(245,158,11,0.15)',  tc: '#f59e0b' },
  'On Hold':        { bg: 'rgba(100,116,139,0.15)', tc: '#94a3b8' },
  'Cancelled':      { bg: 'rgba(239,68,68,0.15)',   tc: '#ef4444' },
};
const FLW_STATUS_CFG: Record<string, { bg: string; tc: string }> = {
  'Pending':     { bg: 'rgba(245,158,11,0.15)',  tc: '#f59e0b' },
  'In Progress': { bg: 'rgba(59,130,246,0.15)',  tc: '#3b82f6' },
  'Completed':   { bg: 'rgba(34,197,94,0.15)',   tc: '#22c55e' },
  'Cancelled':   { bg: 'rgba(239,68,68,0.15)',   tc: '#ef4444' },
};
const REM_STATUS_CFG: Record<string, { bg: string; tc: string }> = {
  'Pending':   { bg: 'rgba(245,158,11,0.15)',  tc: '#f59e0b' },
  'Completed': { bg: 'rgba(34,197,94,0.15)',   tc: '#22c55e' },
  'Overdue':   { bg: 'rgba(239,68,68,0.15)',   tc: '#ef4444' },
};
const FREQ_COLORS: Record<string, string> = {
  Daily: '#60a5fa', Weekly: '#34d399', Monthly: '#a78bfa', Quarterly: '#f59e0b', Yearly: '#f472b6',
};
const FREQUENCIES  = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'];
const JOB_STATUSES = ['Open', 'Completed', 'Partially Done', 'Follow Up'];
const FLW_STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
const PRIORITIES   = ['Low', 'Medium', 'High', 'Critical'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}
function daysPending(d: string) { return d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0; }
function daysUntil(d: string)   { return d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null; }
function isOverdue(dueDate: string, status: string) {
  if (!dueDate || status === 'Completed') return false;
  return new Date(dueDate) < new Date(today);
}
function autoId(prefix: string, list: any[]) {
  return `${prefix}-${new Date().getFullYear()}-${String(list.length + 1).padStart(3, '0')}`;
}
async function apiFetch(path: string, opts: any = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) { const e = await res.json().catch(() => ({ message: res.statusText })); throw new Error(e.message); }
  return res.json();
}

// ── UI primitives ─────────────────────────────────────────────────────────────
const Badge = ({ label, cfg }: any) => (
  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.tc, border: `1px solid ${cfg.tc}33`, whiteSpace: 'nowrap' }}>
    {label}
  </span>
);

// Inline status selector — styled dropdown matching badge look
const StatusSelect = ({ value, options, cfg, onChange }: any) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{ padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: cfg.bg, color: cfg.tc, border: `1px solid ${cfg.tc}55`,
      cursor: 'pointer', appearance: 'none', textAlign: 'center', minWidth: 90 }}>
    {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
  </select>
);

// Inline employee dropdown for table cells
const InlineEmpSelect = ({ value, employees, onChange }: any) => (
  <select value={value || ''} onChange={e => onChange(e.target.value)}
    style={{ padding: '4px 8px', borderRadius: 7, fontSize: 11, fontWeight: 500,
      background: '#F8FAFC', color: value ? '#1E293B' : '#9CA3AF',
      border: '1px solid #E5E7EB', cursor: 'pointer', width: '100%', minWidth: 120 }}>
    <option value="">— Select —</option>
    {employees.map((e: any) => (
      <option key={e.id} value={e.name}>{e.name}</option>
    ))}
  </select>
);

const Modal = ({ title, onClose, children }: any) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div className="glass-card" style={{ width: '100%', maxWidth: 580, maxHeight: '92vh', overflowY: 'auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>{title}</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
      </div>
      {children}
    </div>
  </div>
);
const Field = ({ label, children }: any) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);
const Input = (props: any) => <input {...props} className="input-dark" style={{ width: '100%', padding: '8px 10px', fontSize: 13, ...props.style }} />;
const Textarea = (props: any) => <textarea {...props} className="input-dark" style={{ width: '100%', padding: '8px 10px', fontSize: 13, resize: 'vertical', minHeight: 68, ...props.style }} />;

// Employee dropdown — shows name + designation
const EmpSelect = ({ value, onChange, employees, placeholder = 'Select employee' }: any) => (
  <select value={value} onChange={e => onChange(e.target.value)} className="input-dark" style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}>
    <option value="">{placeholder}</option>
    {employees.map((e: Employee) => (
      <option key={e.id} value={e.name}>{e.name}{e.designation ? ` — ${e.designation}` : ''}</option>
    ))}
  </select>
);

const StatCard = ({ label, value, sub, color, icon }: any) => (
  <div style={{ padding: '16px 18px', borderRadius: 14, background: `${color}10`, border: `1.5px solid ${color}30` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
      <div style={{ fontSize: 11, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ color, opacity: 0.7 }}>{icon}</div>
    </div>
    <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color, opacity: 0.6, marginTop: 4 }}>{sub}</div>}
  </div>
);

// ── XLSX helpers ──────────────────────────────────────────────────────────────
function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Created Date', 'Area / Location', 'Description', 'Priority', 'Responsible', 'Status', 'Doing / Completed By', 'Remarks'],
    [today, 'Furnace Motor', 'Replace bearing on main drive motor', 'High', '', 'Open', 'Ahmed Ali', ''],
    [today, 'Lehr Belt', 'Inspect and tension lehr conveyor belt', 'Medium', '', 'Open', 'Mohammed', 'Check every joint'],
  ]);
  ws['!cols'] = [14, 22, 42, 12, 18, 16, 22, 28].map(w => ({ wch: w }));
  // Style header row
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Jobs');
  // Add status options sheet as reference
  const wsRef = XLSX.utils.aoa_to_sheet([
    ['Status Options', 'Priority Options'],
    ['Open',           'Low'],
    ['Completed',      'Medium'],
    ['Partially Done', 'High'],
    ['Follow Up',      'Critical'],
  ]);
  XLSX.utils.book_append_sheet(wb, wsRef, 'Reference');
  XLSX.writeFile(wb, 'JobTracker_Template.xlsx');
}

function parseUploadedFile(file: File, employees: Employee[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const parsed = rows.map((r, i) => ({
          jobId:       '',
          asset:       String(r['Area / Location'] || r['Asset/Equipment'] || r['asset'] || ''),
          description: String(r['Description'] || r['description'] || ''),
          priority:    PRIORITIES.includes(r['Priority']) ? r['Priority'] : 'Medium',
          assignedTo:  String(r['Responsible'] || r['Assigned To'] || r['assignedTo'] || ''),
          createdDate: r['Created Date'] || today,
          dueDate:     r['Due Date'] || '',
          status:      JOB_STATUSES.includes(r['Status']) ? r['Status'] : 'Open',
          remarks:     String(r['Remarks'] || r['remarks'] || ''),
          completedBy: String(r['Doing / Completed By'] || r['Assigned To'] || ''),
          completedDate: '',
        })).filter(r => r.description.trim());
        resolve(parsed);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
export default function JobTracker() {
  const [tab, setTab] = useState<'dashboard'|'pending'|'followup'|'reminders'|'completed'>('dashboard');

  const [pendingJobs,  setPendingJobs]  = useState<PendingJob[]>([]);
  const [followupJobs, setFollowupJobs] = useState<FollowupJob[]>([]);
  const [reminders,    setReminders]    = useState<Reminder[]>([]);
  const [employees,    setEmployees]    = useState<Employee[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [uploading,    setUploading]    = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  // Filters
  const [jpSearch,   setJpSearch]   = useState('');
  const [jpStatus,   setJpStatus]   = useState('All');
  const [jpPriority, setJpPriority] = useState('All');
  const [flSearch,   setFlSearch]   = useState('');
  const [flStatus,   setFlStatus]   = useState('All');
  const [remFreq,    setRemFreq]    = useState('All');
  const [remStatus,  setRemStatus]  = useState('All');
  const [cpSearch,   setCpSearch]   = useState('');

  // Forms
  const BLANK_JOB = () => ({ jobId:'', asset:'', description:'', priority:'Medium', assignedTo:'', createdDate:today, dueDate:'', status:'Open', remarks:'', completedBy:'', completedDate:'' });
  const BLANK_FLW = () => ({ followupId:'', relatedJobId:'', description:'', nextFollowupDate:'', status:'Pending', responsiblePerson:'', comments:'' });
  const BLANK_REM = () => ({ title:'', description:'', dueDate:'', frequency:'Monthly', priority:'Medium', assignedUser:'', status:'Pending' });

  const [showJobForm, setShowJobForm] = useState(false);
  const [editJobId,   setEditJobId]   = useState<string|null>(null);
  const [jobForm,     setJobForm]     = useState<any>(BLANK_JOB());

  const [showFlwForm, setShowFlwForm] = useState(false);
  const [editFlwId,   setEditFlwId]   = useState<string|null>(null);
  const [flwForm,     setFlwForm]     = useState<any>(BLANK_FLW());

  const [showRemForm, setShowRemForm] = useState(false);
  const [editRemId,   setEditRemId]   = useState<string|null>(null);
  const [remForm,     setRemForm]     = useState<any>(BLANK_REM());

  // ── Fetch ──
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [jobs, flws, rems, emps] = await Promise.all([
        apiFetch('/api/pending-jobs').catch(() => []),
        apiFetch('/api/followup-jobs').catch(() => []),
        apiFetch('/api/reminders').catch(() => []),
        apiFetch('/api/employees').catch(() => []),
      ]);
      setPendingJobs(Array.isArray(jobs) ? jobs : []);
      setFollowupJobs(Array.isArray(flws) ? flws : []);
      setReminders(Array.isArray(rems) ? rems : []);
      setEmployees(Array.isArray(emps) ? emps.map((e: any) => ({ ...e, id: e._id || e.id })) : []);
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  // ── Stats ──
  const stats = useMemo(() => {
    const overdue    = pendingJobs.filter(j => isOverdue(j.dueDate, j.status));
    const todayRems  = reminders.filter(r => r.dueDate === today && r.status !== 'Completed');
    const upcoming   = reminders.filter(r => { const u = daysUntil(r.dueDate); return u !== null && u >= 0 && u <= 7 && r.status !== 'Completed'; });
    const completed  = pendingJobs.filter(j => j.status === 'Completed');
    const active     = pendingJobs.filter(j => j.status === 'Open' || j.status === 'In Progress');
    const needFollow = followupJobs.filter(f => f.status === 'Pending' || f.status === 'In Progress');
    return { total: pendingJobs.length, active: active.length, overdue: overdue.length, completed: completed.length, followup: needFollow.length, todayRems: todayRems.length, upcoming: upcoming.length, overdueList: overdue, todayList: todayRems };
  }, [pendingJobs, followupJobs, reminders]);

  // ── Filtered ──
  const activeJobs    = useMemo(() => pendingJobs.filter(j => j.status !== 'Completed'), [pendingJobs]);
  const completedJobs = useMemo(() => pendingJobs.filter(j => j.status === 'Completed'), [pendingJobs]);

  const filteredJobs = useMemo(() => activeJobs.filter(j => {
    if (jpStatus !== 'All' && j.status !== jpStatus) return false;
    if (jpPriority !== 'All' && j.priority !== jpPriority) return false;
    if (jpSearch && !`${j.jobId} ${j.asset} ${j.description} ${j.assignedTo}`.toLowerCase().includes(jpSearch.toLowerCase())) return false;
    return true;
  }), [activeJobs, jpSearch, jpStatus, jpPriority]);

  const filteredFlw = useMemo(() => followupJobs.filter(f => {
    if (flStatus !== 'All' && f.status !== flStatus) return false;
    if (flSearch && !`${f.followupId} ${f.relatedJobId} ${f.description} ${f.responsiblePerson}`.toLowerCase().includes(flSearch.toLowerCase())) return false;
    return true;
  }), [followupJobs, flSearch, flStatus]);

  const filteredRem = useMemo(() => reminders.filter(r => {
    if (remFreq !== 'All' && r.frequency !== remFreq) return false;
    if (remStatus !== 'All' && r.status !== remStatus) return false;
    return true;
  }), [reminders, remFreq, remStatus]);

  const filteredCompleted = useMemo(() => completedJobs.filter(j => {
    if (!cpSearch) return true;
    return `${j.jobId} ${j.asset} ${j.description} ${j.assignedTo} ${j.completedBy}`.toLowerCase().includes(cpSearch.toLowerCase());
  }), [completedJobs, cpSearch]);

  // ── Inline status update ──
  const updateStatus = async (j: PendingJob, newStatus: string) => {
    const patch: any = { status: newStatus };
    if (newStatus === 'Completed' || newStatus === 'Partially Done') {
      patch.completedDate = today;
      if (!j.completedBy) patch.completedBy = j.assignedTo || '';
    }
    try {
      const up = await apiFetch(`/api/pending-jobs/${j.id}`, { method: 'PUT', body: JSON.stringify(patch) });
      setPendingJobs(p => p.map(x => x.id === j.id ? up : x));
      if (newStatus === 'Follow Up') {
        const flwPayload = {
          followupId:       autoId('FLW', followupJobs),
          relatedJobId:     j.jobId,
          description:      j.description,
          nextFollowupDate: '',
          status:           'Pending',
          responsiblePerson: j.assignedTo || '',
          comments:         '',
        };
        const newFlw = await apiFetch('/api/followup-jobs', { method: 'POST', body: JSON.stringify(flwPayload) });
        setFollowupJobs(p => [newFlw, ...p]);
        setTab('followup');
      } else if (newStatus === 'Completed') {
        setTab('completed');
      }
    } catch (e: any) { alert(e.message); }
  };

  // ── Inline "Doing / Completed By" update ──
  const updateDoingBy = async (j: PendingJob, empName: string) => {
    try {
      const up = await apiFetch(`/api/pending-jobs/${j.id}`, { method: 'PUT', body: JSON.stringify({ completedBy: empName }) });
      setPendingJobs(p => p.map(x => x.id === j.id ? up : x));
    } catch (e: any) { alert(e.message); }
  };

  // ── CRUD — Jobs ──
  const openJobForm = (j?: PendingJob) => {
    if (j) { const { id, ...rest } = j; setEditJobId(id); setJobForm(rest); }
    else { setEditJobId(null); setJobForm(BLANK_JOB()); }
    setShowJobForm(true);
  };
  const saveJob = async () => {
    if (!jobForm.description.trim()) { alert('Description is required.'); return; }
    try {
      const payload = { ...jobForm, jobId: editJobId ? jobForm.jobId : autoId('JOB', pendingJobs) };
      if ((payload.status === 'Completed' || payload.status === 'Partially Done') && !payload.completedDate) payload.completedDate = today;
      if (editJobId) {
        const up = await apiFetch(`/api/pending-jobs/${editJobId}`, { method: 'PUT', body: JSON.stringify(payload) });
        setPendingJobs(p => p.map(x => x.id === editJobId ? up : x));
      } else {
        const cr = await apiFetch('/api/pending-jobs', { method: 'POST', body: JSON.stringify(payload) });
        setPendingJobs(p => [cr, ...p]);
        if (payload.status === 'Follow Up') {
          const flwPayload = { followupId: autoId('FLW', followupJobs), relatedJobId: payload.jobId, description: payload.description, nextFollowupDate: '', status: 'Pending', responsiblePerson: payload.assignedTo || '', comments: '' };
          const newFlw = await apiFetch('/api/followup-jobs', { method: 'POST', body: JSON.stringify(flwPayload) });
          setFollowupJobs(p => [newFlw, ...p]);
        }
      }
      setShowJobForm(false);
      if (payload.status === 'Completed') setTab('completed');
      else if (payload.status === 'Follow Up') setTab('followup');
    } catch (e: any) { alert(e.message); }
  };
  const deleteJob = async (id: string) => {
    if (!confirm('Delete this job?')) return;
    await apiFetch(`/api/pending-jobs/${id}`, { method: 'DELETE' });
    setPendingJobs(p => p.filter(x => x.id !== id));
  };

  // ── Excel upload ──
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const rows = await parseUploadedFile(file, employees);
      if (rows.length === 0) { alert('No valid rows found. Make sure "Description" column is filled.'); return; }
      let added = 0;
      const snapshot = [...pendingJobs];
      for (const row of rows) {
        const existing = snapshot.find(j => j.description.trim().toLowerCase() === row.description.trim().toLowerCase());
        if (existing) continue;
        row.jobId = autoId('JOB', [...snapshot, ...Array(added).fill(null)]);
        const cr = await apiFetch('/api/pending-jobs', { method: 'POST', body: JSON.stringify(row) });
        setPendingJobs(p => [cr, ...p]);
        added++;
      }
      alert(`Upload complete: ${added} job${added !== 1 ? 's' : ''} added${rows.length - added > 0 ? `, ${rows.length - added} skipped (duplicate descriptions)` : ''}.`);
    } catch (err: any) { alert('Failed to parse file: ' + err.message); }
    finally { setUploading(false); if (uploadRef.current) uploadRef.current.value = ''; }
  };

  // ── CRUD — Followup ──
  const openFlwForm = (f?: FollowupJob) => {
    if (f) { const { id, ...rest } = f; setEditFlwId(id); setFlwForm(rest); }
    else { setEditFlwId(null); setFlwForm(BLANK_FLW()); }
    setShowFlwForm(true);
  };
  const saveFlw = async () => {
    if (!flwForm.description.trim()) { alert('Description is required.'); return; }
    try {
      const payload = { ...flwForm, followupId: editFlwId ? flwForm.followupId : autoId('FLW', followupJobs) };
      if (editFlwId) {
        const up = await apiFetch(`/api/followup-jobs/${editFlwId}`, { method: 'PUT', body: JSON.stringify(payload) });
        setFollowupJobs(p => p.map(f => f.id === editFlwId ? up : f));
      } else {
        const cr = await apiFetch('/api/followup-jobs', { method: 'POST', body: JSON.stringify(payload) });
        setFollowupJobs(p => [cr, ...p]);
      }
      setShowFlwForm(false);
    } catch (e: any) { alert(e.message); }
  };
  const deleteFlw = async (id: string) => {
    if (!confirm('Delete this follow-up?')) return;
    await apiFetch(`/api/followup-jobs/${id}`, { method: 'DELETE' });
    setFollowupJobs(p => p.filter(f => f.id !== id));
  };

  // ── CRUD — Reminders ──
  const openRemForm = (r?: Reminder) => {
    if (r) { const { id, ...rest } = r; setEditRemId(id); setRemForm(rest); }
    else { setEditRemId(null); setRemForm(BLANK_REM()); }
    setShowRemForm(true);
  };
  const saveRem = async () => {
    if (!remForm.title.trim()) { alert('Title is required.'); return; }
    try {
      if (editRemId) {
        const up = await apiFetch(`/api/reminders/${editRemId}`, { method: 'PUT', body: JSON.stringify(remForm) });
        setReminders(p => p.map(r => r.id === editRemId ? up : r));
      } else {
        const cr = await apiFetch('/api/reminders', { method: 'POST', body: JSON.stringify(remForm) });
        setReminders(p => [...p, cr]);
      }
      setShowRemForm(false);
    } catch (e: any) { alert(e.message); }
  };
  const deleteRem = async (id: string) => {
    if (!confirm('Delete this reminder?')) return;
    await apiFetch(`/api/reminders/${id}`, { method: 'DELETE' });
    setReminders(p => p.filter(r => r.id !== id));
  };
  const markRem = async (r: Reminder, status: string) => {
    const up = await apiFetch(`/api/reminders/${r.id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    setReminders(p => p.map(x => x.id === r.id ? up : x));
  };

  // ── PDF export ──
  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, pw, 28, 'F');
    doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.setTextColor(241, 245, 249);
    doc.text('Maintenance Job Tracker Report', pw / 2, 11, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${fmtDate(today)}   ·   E & I Maintenance Dept.`, pw / 2, 20, { align: 'center' });
    autoTable(doc, {
      startY: 32, margin: { left: 10, right: 10 },
      head: [['Job ID', 'Asset', 'Description', 'Priority', 'Assigned To', 'Due Date', 'Status', 'Days Pending']],
      body: activeJobs.map(j => [j.jobId, j.asset||'—', j.description, j.priority, j.assignedTo||'—', fmtDate(j.dueDate), j.status, daysPending(j.createdDate)]),
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
    });
    if (completedJobs.length > 0) {
      const y2 = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(34, 197, 94);
      doc.text('Completed Jobs', 10, y2 + 5);
      autoTable(doc, {
        startY: y2 + 9, margin: { left: 10, right: 10 },
        head: [['Job ID', 'Asset', 'Description', 'Assigned To', 'Completed By', 'Completed Date']],
        body: completedJobs.map(j => [j.jobId, j.asset||'—', j.description, j.assignedTo||'—', j.completedBy||'—', fmtDate(j.completedDate)]),
        headStyles: { fillColor: [20, 83, 45], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
      });
    }
    doc.save(`Job_Tracker_${today}.pdf`);
  };

  // ── Excel export ──
  const downloadXLS = () => {
    const wb = XLSX.utils.book_new();
    const activeSheet = XLSX.utils.json_to_sheet(activeJobs.map(j => ({
      'Job ID': j.jobId, 'Asset': j.asset, 'Description': j.description,
      'Priority': j.priority, 'Assigned To': j.assignedTo, 'Created Date': j.createdDate,
      'Due Date': j.dueDate, 'Status': j.status, 'Days Pending': daysPending(j.createdDate), 'Remarks': j.remarks,
    })));
    XLSX.utils.book_append_sheet(wb, activeSheet, 'Pending Jobs');
    const completedSheet = XLSX.utils.json_to_sheet(completedJobs.map(j => ({
      'Job ID': j.jobId, 'Asset': j.asset, 'Description': j.description,
      'Assigned To': j.assignedTo, 'Completed By': j.completedBy, 'Completed Date': j.completedDate,
    })));
    XLSX.utils.book_append_sheet(wb, completedSheet, 'Completed Jobs');
    const flwSheet = XLSX.utils.json_to_sheet(followupJobs.map(f => ({
      'Followup ID': f.followupId, 'Related Job': f.relatedJobId, 'Description': f.description,
      'Next Date': f.nextFollowupDate, 'Status': f.status, 'Responsible': f.responsiblePerson, 'Comments': f.comments,
    })));
    XLSX.utils.book_append_sheet(wb, flwSheet, 'Follow-up Jobs');
    XLSX.writeFile(wb, `Job_Tracker_${today}.xlsx`);
  };

  // ── Tabs config ──
  const TABS = [
    { id: 'dashboard', label: 'Dashboard',       icon: <LayoutDashboard size={13} /> },
    { id: 'pending',   label: 'Pending Jobs',    icon: <ClipboardList size={13} />,  badge: stats.active },
    { id: 'completed', label: 'Completed',        icon: <CheckCircle2 size={13} />,   badge: stats.completed },
    { id: 'followup',  label: 'Follow-up',        icon: <Repeat size={13} />,         badge: stats.followup },
    { id: 'reminders', label: 'Reminders',        icon: <Bell size={13} />,           badge: stats.todayRems },
  ];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(59,130,246,0.3)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ color: '#64748b', fontSize: 14 }}>Loading job tracker…</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Maintenance Job Tracker</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Pending jobs, follow-ups &amp; reminder center — E &amp; I Dept.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={fetchAll} className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={downloadPDF} className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <FileDown size={13} /> PDF
          </button>
          <button onClick={downloadXLS} className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Download size={13} /> Export Excel
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 12 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            flex: 1, padding: '8px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 700,
            background: tab === t.id ? (t.id === 'completed' ? '#22c55e' : '#3b82f6') : 'transparent',
            color: tab === t.id ? '#fff' : '#64748b', transition: 'all 0.15s',
          }}>
            {t.icon} {t.label}
            {t.badge > 0 && (
              <span style={{ background: tab === t.id ? 'rgba(255,255,255,0.25)' : 'rgba(239,68,68,0.85)', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <StatCard label="Total Jobs"       value={stats.total}     color="#60a5fa" icon={<ClipboardList size={20}/>} sub="All recorded" />
            <StatCard label="Active / Open"    value={stats.active}    color="#f59e0b" icon={<Clock size={20}/>}         sub="Needs attention" />
            <StatCard label="Overdue"          value={stats.overdue}   color="#ef4444" icon={<AlertTriangle size={20}/>} sub="Past due date" />
            <StatCard label="Completed"        value={stats.completed} color="#22c55e" icon={<CheckCircle2 size={20}/>}  sub="Finished" />
            <StatCard label="Follow-ups Open"  value={stats.followup}  color="#a855f7" icon={<Repeat size={20}/>}        sub="Awaiting action" />
            <StatCard label="Today Reminders"  value={stats.todayRems} color="#34d399" icon={<Bell size={20}/>}          sub="Due today" />
            <StatCard label="Upcoming (7d)"    value={stats.upcoming}  color="#f472b6" icon={<CalendarDays size={20}/>}  sub="Within 7 days" />
          </div>
          {stats.overdueList.length > 0 && (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={15} color="#ef4444" />
                <span style={{ fontWeight: 700, color: '#ef4444', fontSize: 14 }}>Overdue Jobs ({stats.overdueList.length})</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead><tr><th>Job ID</th><th>Description</th><th>Priority</th><th>Assigned To</th><th>Due Date</th><th style={{ textAlign: 'center' }}>Days Overdue</th><th style={{ textAlign: 'center' }}>Update Status</th></tr></thead>
                  <tbody>
                    {stats.overdueList.map(j => {
                      const pc = PRIORITY_CFG[j.priority] || PRIORITY_CFG.Medium;
                      const sc = JOB_STATUS_CFG[j.status] || JOB_STATUS_CFG.Open;
                      return (
                        <tr key={j.id} style={{ background: 'rgba(239,68,68,0.04)' }}>
                          <td style={{ fontFamily: 'monospace', color: '#60a5fa', fontWeight: 700 }}>{j.jobId || '—'}</td>
                          <td style={{ fontWeight: 500, color: '#e2e8f0' }}>{j.description}</td>
                          <td><Badge label={j.priority} cfg={pc} /></td>
                          <td style={{ color: '#94a3b8' }}>{j.assignedTo || '—'}</td>
                          <td style={{ color: '#ef4444', fontWeight: 700 }}>{fmtDate(j.dueDate)}</td>
                          <td style={{ textAlign: 'center', color: '#ef4444', fontWeight: 800 }}>{Math.abs(daysUntil(j.dueDate) ?? 0)}d</td>
                          <td style={{ textAlign: 'center' }}>
                            <StatusSelect value={j.status} options={JOB_STATUSES} cfg={sc} onChange={v => updateStatus(j, v)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {stats.todayList.length > 0 && (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', background: 'rgba(52,211,153,0.08)', borderBottom: '1px solid rgba(52,211,153,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={15} color="#34d399" />
                <span style={{ fontWeight: 700, color: '#34d399', fontSize: 14 }}>Today's Reminders ({stats.todayList.length})</span>
              </div>
              {stats.todayList.map(r => {
                const fc = FREQ_COLORS[r.frequency] || '#60a5fa';
                const pc = PRIORITY_CFG[r.priority] || PRIORITY_CFG.Medium;
                return (
                  <div key={r.id} style={{ padding: '11px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: fc, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>{r.title}</div>
                        {r.description && <div style={{ fontSize: 11, color: '#64748b' }}>{r.description}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
                      <Badge label={r.frequency} cfg={{ bg: `${fc}20`, tc: fc }} />
                      <Badge label={r.priority} cfg={pc} />
                      <button onClick={() => markRem(r, 'Completed')} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✓ Done</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {stats.overdueList.length === 0 && stats.todayList.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: '#475569' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto 12px', color: '#22c55e' }} />
              All clear — no overdue jobs or reminders today.
            </div>
          )}
        </div>
      )}

      {/* ── PENDING JOBS ── */}
      {tab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Hidden file input for upload */}
          <input ref={uploadRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleUpload} />

          {/* Upload banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.25)' }}>
            <FileSpreadsheet size={16} color="#34d399" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>Bulk Import via Excel</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>Download the template, fill in jobs, then upload to add them all at once.</div>
            </div>
            <button onClick={downloadTemplate} className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <FileSpreadsheet size={13} /> Download Template
            </button>
            <button onClick={() => uploadRef.current?.click()} disabled={uploading} style={{
              fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              borderRadius: 8, border: '1px solid rgba(52,211,153,0.5)', cursor: uploading ? 'not-allowed' : 'pointer',
              background: uploading ? 'rgba(52,211,153,0.05)' : 'rgba(52,211,153,0.15)', color: uploading ? '#475569' : '#34d399',
              fontWeight: 700, flexShrink: 0,
            }}>
              <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload & Import'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input value={jpSearch} onChange={e => setJpSearch(e.target.value)} placeholder="Search jobs…" className="input-dark" style={{ paddingLeft: 30, width: '100%' }} />
            </div>
            <select value={jpStatus} onChange={e => setJpStatus(e.target.value)} className="input-dark" style={{ width: 150, fontSize: 13 }}>
              <option value="All">All Status</option>
              {JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={jpPriority} onChange={e => setJpPriority(e.target.value)} className="input-dark" style={{ width: 130, fontSize: 13 }}>
              <option value="All">All Priority</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button onClick={() => openJobForm()} className="btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Plus size={13} /> Add Job
            </button>
          </div>
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <ClipboardList size={15} color="#60a5fa" />
              <span style={{ fontWeight: 700, color: '#60a5fa', fontSize: 14 }}>Active Pending Jobs</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>{filteredJobs.length} items</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>Sl.</th>
                    <th style={{ width: 100 }}>Job ID</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Created Date</th>
                    <th style={{ width: 130 }}>Area / Location</th>
                    <th>Description</th>
                    <th style={{ width: 88, textAlign: 'center' }}>Priority</th>
                    <th style={{ width: 130 }}>Responsible</th>
                    <th style={{ width: 130, textAlign: 'center' }}>Status</th>
                    <th style={{ width: 140 }}>Doing / Completed By</th>
                    <th style={{ width: 140 }}>Remarks</th>
                    <th style={{ width: 72, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.length === 0 && (
                    <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, color: '#475569', fontStyle: 'italic' }}>No active jobs. Add one or upload an Excel file.</td></tr>
                  )}
                  {filteredJobs.map((j, i) => {
                    const pc = PRIORITY_CFG[j.priority] || PRIORITY_CFG.Medium;
                    const sc = JOB_STATUS_CFG[j.status] || JOB_STATUS_CFG.Open;
                    return (
                      <tr key={j.id}>
                        <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                        <td style={{ fontFamily: 'monospace', color: '#60a5fa', fontWeight: 700, fontSize: 11 }}>{j.jobId || '—'}</td>
                        <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>{fmtDate(j.createdDate)}</td>
                        <td style={{ color: '#374151', fontSize: 12 }}>{j.asset || '—'}</td>
                        <td style={{ fontWeight: 500, color: '#1e293b' }}>{j.description}</td>
                        <td style={{ textAlign: 'center' }}><Badge label={j.priority} cfg={pc} /></td>
                        <td style={{ color: '#374151' }}>
                          {j.assignedTo ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><User size={11} />{j.assignedTo}</span> : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <StatusSelect value={j.status} options={JOB_STATUSES} cfg={sc} onChange={v => updateStatus(j, v)} />
                        </td>
                        <td>
                          <InlineEmpSelect value={j.completedBy} employees={employees} onChange={(v: string) => updateDoingBy(j, v)} />
                        </td>
                        <td style={{ color: '#6b7280', fontSize: 11 }}>{j.remarks || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                            <button onClick={() => openJobForm(j)} style={{ width: 27, height: 25, borderRadius: 5, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Edit2 size={11} />
                            </button>
                            <button onClick={() => deleteJob(j.id)} style={{ width: 27, height: 25, borderRadius: 5, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── COMPLETED JOBS ── */}
      {tab === 'completed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input value={cpSearch} onChange={e => setCpSearch(e.target.value)} placeholder="Search completed jobs…" className="input-dark" style={{ paddingLeft: 30, width: '100%' }} />
            </div>
          </div>
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(34,197,94,0.06)' }}>
              <CheckCircle2 size={15} color="#22c55e" />
              <span style={{ fontWeight: 700, color: '#22c55e', fontSize: 14 }}>Completed Jobs</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>{filteredCompleted.length} items</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>Sl.</th>
                    <th style={{ width: 100 }}>Job ID</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Created Date</th>
                    <th style={{ width: 130 }}>Area / Location</th>
                    <th>Description</th>
                    <th style={{ width: 88, textAlign: 'center' }}>Priority</th>
                    <th style={{ width: 130 }}>Responsible</th>
                    <th style={{ width: 120, textAlign: 'center' }}>Status</th>
                    <th style={{ width: 140 }}>Doing / Completed By</th>
                    <th style={{ width: 140 }}>Remarks</th>
                    <th style={{ width: 60, textAlign: 'center' }}>Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompleted.length === 0 && (
                    <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, color: '#475569', fontStyle: 'italic' }}>No completed jobs yet.</td></tr>
                  )}
                  {filteredCompleted.map((j, i) => {
                    const pc = PRIORITY_CFG[j.priority] || PRIORITY_CFG.Medium;
                    const sc = JOB_STATUS_CFG[j.status] || JOB_STATUS_CFG.Completed;
                    return (
                      <tr key={j.id}>
                        <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                        <td style={{ fontFamily: 'monospace', color: '#60a5fa', fontWeight: 700, fontSize: 11 }}>{j.jobId || '—'}</td>
                        <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>{fmtDate(j.createdDate)}</td>
                        <td style={{ color: '#374151', fontSize: 12 }}>{j.asset || '—'}</td>
                        <td style={{ fontWeight: 500, color: '#1e293b' }}>{j.description}</td>
                        <td style={{ textAlign: 'center' }}><Badge label={j.priority} cfg={pc} /></td>
                        <td style={{ color: '#374151' }}>
                          {j.assignedTo ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><User size={11} />{j.assignedTo}</span> : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}><Badge label={j.status} cfg={sc} /></td>
                        <td>
                          <InlineEmpSelect value={j.completedBy} employees={employees} onChange={(v: string) => updateDoingBy(j, v)} />
                        </td>
                        <td style={{ color: '#6b7280', fontSize: 11 }}>{j.remarks || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button onClick={() => openJobForm(j)} style={{ width: 27, height: 25, borderRadius: 5, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto' }}>
                            <Edit2 size={11} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── FOLLOW-UP JOBS ── */}
      {tab === 'followup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input value={flSearch} onChange={e => setFlSearch(e.target.value)} placeholder="Search follow-ups…" className="input-dark" style={{ paddingLeft: 30, width: '100%' }} />
            </div>
            <select value={flStatus} onChange={e => setFlStatus(e.target.value)} className="input-dark" style={{ width: 140, fontSize: 13 }}>
              <option value="All">All Status</option>
              {FLW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => openFlwForm()} className="btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Plus size={13} /> Add Follow-up
            </button>
          </div>
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Repeat size={15} color="#a855f7" />
              <span style={{ fontWeight: 700, color: '#a855f7', fontSize: 14 }}>Follow-up Jobs</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>{filteredFlw.length} items</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>Sl.</th>
                    <th style={{ width: 100 }}>Followup ID</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Next Date</th>
                    <th style={{ width: 110 }}>Related Job</th>
                    <th>Description</th>
                    <th style={{ width: 120, textAlign: 'center' }}>Status</th>
                    <th style={{ width: 140 }}>Responsible</th>
                    <th style={{ width: 140 }}>Doing / Completed By</th>
                    <th style={{ width: 140 }}>Remarks / Comments</th>
                    <th style={{ width: 72, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFlw.length === 0 && (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: '#475569', fontStyle: 'italic' }}>No follow-up jobs. Click "+ Add Follow-up" to create one.</td></tr>
                  )}
                  {filteredFlw.map((f, i) => {
                    const sc  = FLW_STATUS_CFG[f.status] || FLW_STATUS_CFG.Pending;
                    const du  = daysUntil(f.nextFollowupDate);
                    const od  = f.nextFollowupDate && new Date(f.nextFollowupDate) < new Date(today) && f.status !== 'Completed';
                    return (
                      <tr key={f.id} style={{ background: od ? 'rgba(239,68,68,0.04)' : undefined }}>
                        <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                        <td style={{ fontFamily: 'monospace', color: '#a855f7', fontWeight: 700, fontSize: 11 }}>{f.followupId || '—'}</td>
                        <td style={{ textAlign: 'center', color: od ? '#ef4444' : '#94a3b8', fontWeight: od ? 700 : 400 }}>
                          {fmtDate(f.nextFollowupDate)}
                          {od && <div style={{ fontSize: 9, color: '#ef4444' }}>OVERDUE</div>}
                          {!od && du !== null && du <= 3 && du >= 0 && <div style={{ fontSize: 9, color: '#f59e0b' }}>in {du}d</div>}
                        </td>
                        <td style={{ fontFamily: 'monospace', color: '#60a5fa', fontSize: 11 }}>{f.relatedJobId || '—'}</td>
                        <td style={{ fontWeight: 500, color: '#1e293b' }}>{f.description}</td>
                        <td style={{ textAlign: 'center' }}>
                          <StatusSelect value={f.status} options={FLW_STATUSES} cfg={sc} onChange={async v => {
                            try {
                              const up = await apiFetch(`/api/followup-jobs/${f.id}`, { method: 'PUT', body: JSON.stringify({ status: v }) });
                              setFollowupJobs(p => p.map(x => x.id === f.id ? up : x));
                            } catch {}
                          }} />
                        </td>
                        <td style={{ color: '#374151' }}>
                          {f.responsiblePerson ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><User size={11} />{f.responsiblePerson}</span> : '—'}
                        </td>
                        <td>
                          <InlineEmpSelect value={f.responsiblePerson} employees={employees} onChange={async (v: string) => {
                            try {
                              const up = await apiFetch(`/api/followup-jobs/${f.id}`, { method: 'PUT', body: JSON.stringify({ responsiblePerson: v }) });
                              setFollowupJobs(p => p.map(x => x.id === f.id ? up : x));
                            } catch {}
                          }} />
                        </td>
                        <td style={{ color: '#6b7280', fontSize: 11 }}>{f.comments || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                            <button onClick={() => openFlwForm(f)} style={{ width: 27, height: 25, borderRadius: 5, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit2 size={11} /></button>
                            <button onClick={() => deleteFlw(f.id)} style={{ width: 27, height: 25, borderRadius: 5, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={11} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── REMINDERS ── */}
      {tab === 'reminders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={remFreq} onChange={e => setRemFreq(e.target.value)} className="input-dark" style={{ width: 150, fontSize: 13 }}>
              <option value="All">All Frequencies</option>
              {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={remStatus} onChange={e => setRemStatus(e.target.value)} className="input-dark" style={{ width: 130, fontSize: 13 }}>
              <option value="All">All Status</option>
              {['Pending','Completed','Overdue'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ flex: 1 }} />
            <button onClick={() => openRemForm()} className="btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Plus size={13} /> Add Reminder
            </button>
          </div>
          {(remFreq === 'All' ? FREQUENCIES : [remFreq]).map(freq => {
            const group = filteredRem.filter(r => r.frequency === freq);
            if (group.length === 0) return null;
            const fc = FREQ_COLORS[freq];
            return (
              <div key={freq} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '11px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, alignItems: 'center', background: `${fc}0d` }}>
                  <AlarmClock size={14} color={fc} />
                  <span style={{ fontWeight: 700, color: fc, fontSize: 14 }}>{freq} Tasks</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{group.length} reminder{group.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 36, textAlign: 'center' }}>Sl.</th>
                        <th>Title</th>
                        <th style={{ width: 180 }}>Description</th>
                        <th style={{ width: 110, textAlign: 'center' }}>Due Date</th>
                        <th style={{ width: 90, textAlign: 'center' }}>Priority</th>
                        <th style={{ width: 130 }}>Assigned To</th>
                        <th style={{ width: 100, textAlign: 'center' }}>Status</th>
                        <th style={{ width: 110, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((r, i) => {
                        const sc = REM_STATUS_CFG[r.status] || REM_STATUS_CFG.Pending;
                        const pc = PRIORITY_CFG[r.priority] || PRIORITY_CFG.Medium;
                        const du = daysUntil(r.dueDate);
                        const od = r.dueDate && new Date(r.dueDate) < new Date(today) && r.status !== 'Completed';
                        return (
                          <tr key={r.id} style={{ background: od ? 'rgba(239,68,68,0.04)' : r.dueDate === today ? 'rgba(52,211,153,0.04)' : undefined }}>
                            <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                            <td style={{ fontWeight: 600, color: '#e2e8f0' }}>
                              {r.dueDate === today && <span style={{ fontSize: 9, background: 'rgba(52,211,153,0.2)', color: '#34d399', borderRadius: 4, padding: '1px 5px', marginRight: 5 }}>TODAY</span>}
                              {od && <span style={{ fontSize: 9, background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 4, padding: '1px 5px', marginRight: 5 }}>OVERDUE</span>}
                              {r.title}
                            </td>
                            <td style={{ color: '#64748b', fontSize: 11 }}>{r.description || '—'}</td>
                            <td style={{ textAlign: 'center', color: od ? '#ef4444' : '#94a3b8', fontWeight: od ? 700 : 400 }}>
                              {fmtDate(r.dueDate)}
                              {!od && du !== null && du <= 3 && du >= 0 && <div style={{ fontSize: 9, color: '#f59e0b' }}>in {du}d</div>}
                            </td>
                            <td style={{ textAlign: 'center' }}><Badge label={r.priority} cfg={pc} /></td>
                            <td style={{ color: '#94a3b8' }}>{r.assignedUser || '—'}</td>
                            <td style={{ textAlign: 'center' }}><Badge label={r.status} cfg={sc} /></td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                {r.status !== 'Completed' && (
                                  <button onClick={() => markRem(r, 'Completed')} style={{ padding: '3px 8px', borderRadius: 5, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>✓</button>
                                )}
                                <button onClick={() => openRemForm(r)} style={{ width: 26, height: 24, borderRadius: 5, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit2 size={10} /></button>
                                <button onClick={() => deleteRem(r.id)} style={{ width: 26, height: 24, borderRadius: 5, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={10} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {filteredRem.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: '#475569' }}>
              <Bell size={36} style={{ margin: '0 auto 12px', color: '#475569' }} />
              No reminders. Click "+ Add Reminder" to create one.
            </div>
          )}
        </div>
      )}

      {/* ── JOB FORM MODAL ── */}
      {showJobForm && (
        <Modal title={editJobId ? 'Edit Job' : 'Add Pending Job'} onClose={() => setShowJobForm(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Area / Location">
              <Input value={jobForm.asset} onChange={e => setJobForm(f => ({ ...f, asset: e.target.value }))} placeholder="e.g. Furnace Motor" />
            </Field>
            <Field label="Priority">
              <select value={jobForm.priority} onChange={e => setJobForm(f => ({ ...f, priority: e.target.value }))} className="input-dark" style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Job Description *">
            <Textarea value={jobForm.description} onChange={e => setJobForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the job in detail…" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Responsible">
              <EmpSelect value={jobForm.assignedTo} onChange={v => setJobForm(f => ({ ...f, assignedTo: v }))} employees={employees} placeholder="Select employee" />
            </Field>
            <Field label="Status">
              <select value={jobForm.status} onChange={e => setJobForm(f => ({ ...f, status: e.target.value }))} className="input-dark" style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}>
                {JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Created Date">
              <Input type="date" value={jobForm.createdDate} onChange={e => setJobForm(f => ({ ...f, createdDate: e.target.value }))} />
            </Field>
            <Field label="Due Date">
              <Input type="date" value={jobForm.dueDate} onChange={e => setJobForm(f => ({ ...f, dueDate: e.target.value }))} />
            </Field>
          </div>
          {/* Show Doing / Completed By for Completed and Partially Done */}
          {(jobForm.status === 'Completed' || jobForm.status === 'Partially Done') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '12px 14px', background: jobForm.status === 'Completed' ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', borderRadius: 10, border: `1px solid ${jobForm.status === 'Completed' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`, marginBottom: 14 }}>
              <Field label="Doing / Completed By">
                <EmpSelect value={jobForm.completedBy} onChange={v => setJobForm(f => ({ ...f, completedBy: v }))} employees={employees} placeholder="Select employee" />
              </Field>
              <Field label={jobForm.status === 'Completed' ? 'Completed Date' : 'Date'}>
                <Input type="date" value={jobForm.completedDate || today} onChange={e => setJobForm(f => ({ ...f, completedDate: e.target.value }))} />
              </Field>
            </div>
          )}
          <Field label="Remarks">
            <Input value={jobForm.remarks} onChange={e => setJobForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Optional remarks" />
          </Field>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button onClick={saveJob} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Save Job</button>
            <button onClick={() => setShowJobForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}

      {/* ── FOLLOWUP FORM MODAL ── */}
      {showFlwForm && (
        <Modal title={editFlwId ? 'Edit Follow-up' : 'Add Follow-up Job'} onClose={() => setShowFlwForm(false)}>
          <Field label="Related Job ID">
            <select value={flwForm.relatedJobId} onChange={e => setFlwForm(f => ({ ...f, relatedJobId: e.target.value }))} className="input-dark" style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}>
              <option value="">— None —</option>
              {pendingJobs.map(j => <option key={j.id} value={j.jobId}>{j.jobId} — {j.description.slice(0, 45)}</option>)}
            </select>
          </Field>
          <Field label="Follow-up Description *">
            <Textarea value={flwForm.description} onChange={e => setFlwForm(f => ({ ...f, description: e.target.value }))} placeholder="What needs to be followed up…" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Next Follow-up Date">
              <Input type="date" value={flwForm.nextFollowupDate} onChange={e => setFlwForm(f => ({ ...f, nextFollowupDate: e.target.value }))} />
            </Field>
            <Field label="Status">
              <select value={flwForm.status} onChange={e => setFlwForm(f => ({ ...f, status: e.target.value }))} className="input-dark" style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}>
                {FLW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Responsible Person">
            <EmpSelect value={flwForm.responsiblePerson} onChange={v => setFlwForm(f => ({ ...f, responsiblePerson: v }))} employees={employees} placeholder="Select employee" />
          </Field>
          <Field label="Comments">
            <Textarea value={flwForm.comments} onChange={e => setFlwForm(f => ({ ...f, comments: e.target.value }))} placeholder="Additional comments…" style={{ minHeight: 56 }} />
          </Field>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button onClick={saveFlw} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Save Follow-up</button>
            <button onClick={() => setShowFlwForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}

      {/* ── REMINDER FORM MODAL ── */}
      {showRemForm && (
        <Modal title={editRemId ? 'Edit Reminder' : 'Add Reminder'} onClose={() => setShowRemForm(false)}>
          <Field label="Reminder Title *">
            <Input value={remForm.title} onChange={e => setRemForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Monthly PM Inspection" />
          </Field>
          <Field label="Description">
            <Textarea value={remForm.description} onChange={e => setRemForm(f => ({ ...f, description: e.target.value }))} placeholder="Details…" style={{ minHeight: 56 }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Due Date">
              <Input type="date" value={remForm.dueDate} onChange={e => setRemForm(f => ({ ...f, dueDate: e.target.value }))} />
            </Field>
            <Field label="Frequency">
              <select value={remForm.frequency} onChange={e => setRemForm(f => ({ ...f, frequency: e.target.value }))} className="input-dark" style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}>
                {FREQUENCIES.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select value={remForm.priority} onChange={e => setRemForm(f => ({ ...f, priority: e.target.value }))} className="input-dark" style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={remForm.status} onChange={e => setRemForm(f => ({ ...f, status: e.target.value }))} className="input-dark" style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}>
                {['Pending','Completed','Overdue'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Assigned User">
            <EmpSelect value={remForm.assignedUser} onChange={v => setRemForm(f => ({ ...f, assignedUser: v }))} employees={employees} placeholder="Select employee" />
          </Field>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button onClick={saveRem} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Save Reminder</button>
            <button onClick={() => setShowRemForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}

    </div>
  );
}
