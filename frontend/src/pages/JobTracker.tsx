// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList, Bell, RefreshCw, Plus, Edit2, Trash2, CheckCircle2,
  AlertTriangle, Clock, XCircle, Search, Download, FileDown,
  LayoutDashboard, AlarmClock, Repeat, ChevronDown, Filter,
  CalendarDays, User, Wrench, Flag, MessageSquare, X,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Types ────────────────────────────────────────────────────────────────────
interface PendingJob {
  id: string; jobId: string; asset: string; description: string;
  priority: string; assignedTo: string; createdDate: string;
  dueDate: string; status: string; remarks: string;
}
interface FollowupJob {
  id: string; followupId: string; relatedJobId: string; description: string;
  nextFollowupDate: string; status: string; responsiblePerson: string; comments: string;
  updatedAt?: string;
}
interface Reminder {
  id: string; title: string; description: string; dueDate: string;
  frequency: string; priority: string; assignedUser: string; status: string;
}

// ── Config ───────────────────────────────────────────────────────────────────
const PRIORITY_CFG: Record<string, { bg: string; tc: string; dot: string }> = {
  Low:      { bg: 'rgba(34,197,94,0.15)',   tc: '#22c55e', dot: '#22c55e' },
  Medium:   { bg: 'rgba(245,158,11,0.15)',  tc: '#f59e0b', dot: '#f59e0b' },
  High:     { bg: 'rgba(239,68,68,0.15)',   tc: '#ef4444', dot: '#ef4444' },
  Critical: { bg: 'rgba(168,85,247,0.15)',  tc: '#a855f7', dot: '#a855f7' },
};
const JOB_STATUS_CFG: Record<string, { bg: string; tc: string }> = {
  'Open':        { bg: 'rgba(59,130,246,0.15)',  tc: '#3b82f6' },
  'In Progress': { bg: 'rgba(245,158,11,0.15)',  tc: '#f59e0b' },
  'On Hold':     { bg: 'rgba(100,116,139,0.15)', tc: '#94a3b8' },
  'Completed':   { bg: 'rgba(34,197,94,0.15)',   tc: '#22c55e' },
  'Cancelled':   { bg: 'rgba(239,68,68,0.15)',   tc: '#ef4444' },
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
  Daily: '#60a5fa', Weekly: '#34d399', Monthly: '#a78bfa',
  Quarterly: '#f59e0b', Yearly: '#f472b6',
};
const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'];
const JOB_STATUSES = ['Open', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];
const FLW_STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
const PRIORITIES   = ['Low', 'Medium', 'High', 'Critical'];

// ── Helpers ──────────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}
function daysPending(d: string) {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}
function daysUntil(d: string) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}
function isOverdue(dueDate: string, status: string) {
  if (!dueDate || status === 'Completed' || status === 'Cancelled') return false;
  return new Date(dueDate) < new Date(today);
}
function autoId(prefix: string, list: any[]) {
  const yr = new Date().getFullYear();
  const n  = list.length + 1;
  return `${prefix}-${yr}-${String(n).padStart(3, '0')}`;
}

async function apiFetch(path: string, opts: any = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) { const e = await res.json().catch(() => ({ message: res.statusText })); throw new Error(e.message); }
  return res.json();
}

// ── Badge ─────────────────────────────────────────────────────────────────────
const Badge = ({ label, cfg }: { label: string; cfg: { bg: string; tc: string } }) => (
  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.tc, border: `1px solid ${cfg.tc}33`, whiteSpace: 'nowrap' }}>
    {label}
  </span>
);

// ── Modal wrapper ─────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children }: any) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div className="glass-card" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
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

const Input = (props: any) => (
  <input {...props} className="input-dark" style={{ width: '100%', padding: '8px 10px', fontSize: 13, ...props.style }} />
);

const Select = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) => (
  <select value={value} onChange={e => onChange(e.target.value)} className="input-dark" style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const Textarea = (props: any) => (
  <textarea {...props} className="input-dark" style={{ width: '100%', padding: '8px 10px', fontSize: 13, resize: 'vertical', minHeight: 72, ...props.style }} />
);

// ── Summary card ──────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color, icon }: any) => (
  <div style={{ padding: '16px 20px', borderRadius: 14, background: `${color}10`, border: `1.5px solid ${color}30`, display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ fontSize: 11, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ color, opacity: 0.7 }}>{icon}</div>
    </div>
    <div style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color, opacity: 0.6 }}>{sub}</div>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
export default function JobTracker() {
  const [tab, setTab] = useState<'dashboard' | 'pending' | 'followup' | 'reminders'>('dashboard');

  // Data
  const [pendingJobs,  setPendingJobs]  = useState<PendingJob[]>([]);
  const [followupJobs, setFollowupJobs] = useState<FollowupJob[]>([]);
  const [reminders,    setReminders]    = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [jpSearch, setJpSearch]     = useState('');
  const [jpStatus, setJpStatus]     = useState('All');
  const [jpPriority, setJpPriority] = useState('All');
  const [flSearch, setFlSearch]     = useState('');
  const [flStatus,  setFlStatus]    = useState('All');
  const [remFreq,   setRemFreq]     = useState('All');
  const [remStatus, setRemStatus]   = useState('All');

  // Pending job form
  const BLANK_JOB = () => ({ jobId:'', asset:'', description:'', priority:'Medium', assignedTo:'', createdDate:today, dueDate:'', status:'Open', remarks:'' });
  const [showJobForm, setShowJobForm] = useState(false);
  const [editJobId,   setEditJobId]   = useState<string|null>(null);
  const [jobForm,     setJobForm]     = useState<any>(BLANK_JOB());

  // Followup form
  const BLANK_FLW = () => ({ followupId:'', relatedJobId:'', description:'', nextFollowupDate:'', status:'Pending', responsiblePerson:'', comments:'' });
  const [showFlwForm, setShowFlwForm] = useState(false);
  const [editFlwId,   setEditFlwId]   = useState<string|null>(null);
  const [flwForm,     setFlwForm]     = useState<any>(BLANK_FLW());

  // Reminder form
  const BLANK_REM = () => ({ title:'', description:'', dueDate:'', frequency:'Monthly', priority:'Medium', assignedUser:'', status:'Pending' });
  const [showRemForm, setShowRemForm] = useState(false);
  const [editRemId,   setEditRemId]   = useState<string|null>(null);
  const [remForm,     setRemForm]     = useState<any>(BLANK_REM());

  // ── Fetch all ──
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [jobs, flws, rems] = await Promise.all([
        apiFetch('/api/pending-jobs').catch(() => []),
        apiFetch('/api/followup-jobs').catch(() => []),
        apiFetch('/api/reminders').catch(() => []),
      ]);
      setPendingJobs(Array.isArray(jobs) ? jobs : []);
      setFollowupJobs(Array.isArray(flws) ? flws : []);
      setReminders(Array.isArray(rems) ? rems : []);
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  // ── Dashboard stats ──
  const stats = useMemo(() => {
    const now = new Date(today);
    const overdue   = pendingJobs.filter(j => isOverdue(j.dueDate, j.status));
    const todayRems = reminders.filter(r => r.dueDate === today && r.status !== 'Completed');
    const upcoming  = reminders.filter(r => { const u = daysUntil(r.dueDate); return u !== null && u >= 0 && u <= 7 && r.status !== 'Completed'; });
    const completed = pendingJobs.filter(j => j.status === 'Completed');
    const needFollowup = followupJobs.filter(f => f.status === 'Pending' || f.status === 'In Progress');
    return { total: pendingJobs.length, pending: pendingJobs.filter(j => j.status === 'Open' || j.status === 'In Progress').length, overdue: overdue.length, completed: completed.length, followup: needFollowup.length, todayRems: todayRems.length, upcoming: upcoming.length, overdueList: overdue, todayList: todayRems };
  }, [pendingJobs, followupJobs, reminders]);

  // ── Filtered lists ──
  const filteredJobs = useMemo(() => pendingJobs.filter(j => {
    if (jpStatus !== 'All' && j.status !== jpStatus) return false;
    if (jpPriority !== 'All' && j.priority !== jpPriority) return false;
    if (jpSearch && !`${j.jobId} ${j.asset} ${j.description} ${j.assignedTo}`.toLowerCase().includes(jpSearch.toLowerCase())) return false;
    return true;
  }), [pendingJobs, jpSearch, jpStatus, jpPriority]);

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

  // ── CRUD — Pending Jobs ──
  const openJobForm = (j?: PendingJob) => {
    if (j) { const { id, ...rest } = j; setEditJobId(id); setJobForm(rest); }
    else { setEditJobId(null); setJobForm(BLANK_JOB()); }
    setShowJobForm(true);
  };
  const saveJob = async () => {
    if (!jobForm.description.trim()) { alert('Description is required.'); return; }
    try {
      const payload = { ...jobForm, jobId: editJobId ? jobForm.jobId : autoId('JOB', pendingJobs) };
      if (editJobId) {
        const up = await apiFetch(`/api/pending-jobs/${editJobId}`, { method: 'PUT', body: JSON.stringify(payload) });
        setPendingJobs(p => p.map(j => j.id === editJobId ? up : j));
      } else {
        const cr = await apiFetch('/api/pending-jobs', { method: 'POST', body: JSON.stringify(payload) });
        setPendingJobs(p => [cr, ...p]);
      }
      setShowJobForm(false);
    } catch (e: any) { alert(e.message); }
  };
  const deleteJob = async (id: string) => {
    if (!confirm('Delete this job?')) return;
    await apiFetch(`/api/pending-jobs/${id}`, { method: 'DELETE' });
    setPendingJobs(p => p.filter(j => j.id !== id));
  };

  // ── CRUD — Followup Jobs ──
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

  // ── PDF Report ──
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
      body: pendingJobs.filter(j => j.status !== 'Completed').map(j => [
        j.jobId, j.asset || '—', j.description, j.priority,
        j.assignedTo || '—', fmtDate(j.dueDate), j.status, daysPending(j.createdDate),
      ]),
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
    });

    const y2 = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(168, 85, 247);
    doc.text('Follow-up Jobs', 10, y2 + 5);
    autoTable(doc, {
      startY: y2 + 9, margin: { left: 10, right: 10 },
      head: [['Followup ID', 'Related Job', 'Description', 'Next Date', 'Status', 'Responsible']],
      body: followupJobs.map(f => [f.followupId, f.relatedJobId || '—', f.description, fmtDate(f.nextFollowupDate), f.status, f.responsiblePerson || '—']),
      headStyles: { fillColor: [88, 28, 135], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
    });

    doc.save(`Job_Tracker_${today}.pdf`);
  };

  // ── Excel ──
  const downloadXLS = () => {
    const td = (v: any, bg = '#fff', tc = '#000', bold = false, align = 'left') =>
      `<td style="padding:5px 7px;border:1px solid #ccc;background:${bg};color:${tc};font-weight:${bold?'bold':'normal'};text-align:${align};font-family:Arial;font-size:9pt;">${v??''}</td>`;
    let rows = `<tr><td colspan="8" style="background:#1e3a5f;color:#fff;font-weight:bold;font-size:13pt;text-align:center;padding:8px;font-family:Arial;">Pending Jobs</td></tr>
    <tr style="background:#FFFF00;">${['Job ID','Asset','Description','Priority','Assigned To','Due Date','Status','Days Pending'].map(h=>`<td style="padding:5px;border:1px solid #ccc;font-weight:bold;font-family:Arial;">${h}</td>`).join('')}</tr>`;
    pendingJobs.forEach(j => {
      const pc = PRIORITY_CFG[j.priority];
      rows += `<tr>${td(j.jobId)}${td(j.asset||'—')}${td(j.description)}${td(j.priority,pc?.bg,pc?.tc,true,'center')}${td(j.assignedTo||'—')}${td(fmtDate(j.dueDate),'','',false,'center')}${td(j.status,'','',false,'center')}${td(daysPending(j.createdDate),'','',false,'center')}</tr>`;
    });
    rows += `<tr><td colspan="8"></td></tr><tr><td colspan="8" style="background:#3b0764;color:#fff;font-weight:bold;font-size:13pt;text-align:center;padding:8px;font-family:Arial;">Follow-up Jobs</td></tr>
    <tr style="background:#FFFF00;">${['Followup ID','Related Job','Description','Next Date','Status','Responsible','Comments'].map(h=>`<td style="padding:5px;border:1px solid #ccc;font-weight:bold;font-family:Arial;">${h}</td>`).join('')}</tr>`;
    followupJobs.forEach(f => {
      rows += `<tr>${td(f.followupId)}${td(f.relatedJobId||'—')}${td(f.description)}${td(fmtDate(f.nextFollowupDate),'','',false,'center')}${td(f.status)}${td(f.responsiblePerson||'—')}${td(f.comments||'—')}</tr>`;
    });
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/></head><body><table>${rows}</table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `Job_Tracker_${today}.xls`; a.click();
  };

  // ── Tabs header ──
  const TABS = [
    { id: 'dashboard', label: 'Dashboard',      icon: <LayoutDashboard size={14} /> },
    { id: 'pending',   label: 'Pending Jobs',   icon: <ClipboardList size={14} />, badge: stats.pending },
    { id: 'followup',  label: 'Follow-up Jobs', icon: <Repeat size={14} />, badge: stats.followup },
    { id: 'reminders', label: 'Reminder Center',icon: <Bell size={14} />, badge: stats.todayRems },
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
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Maintenance Job Tracker</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Pending jobs, follow-ups &amp; reminder center — E &amp; I Dept.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={fetchAll} className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={downloadPDF} className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <FileDown size={13} /> PDF
          </button>
          <button onClick={downloadXLS} className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Download size={13} /> Excel
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 12, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            flex: 1, minWidth: 120, padding: '9px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13, fontWeight: 700,
            background: tab === t.id ? '#3b82f6' : 'transparent',
            color: tab === t.id ? '#fff' : '#64748b', transition: 'all 0.15s',
          }}>
            {t.icon} {t.label}
            {t.badge > 0 && (
              <span style={{ background: tab === t.id ? 'rgba(255,255,255,0.25)' : 'rgba(239,68,68,0.9)', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 800, padding: '1px 6px', minWidth: 18 }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <StatCard label="Total Jobs"        value={stats.total}     color="#60a5fa" icon={<ClipboardList size={20}/>} sub="All jobs recorded" />
            <StatCard label="Active / Open"     value={stats.pending}   color="#f59e0b" icon={<Clock size={20}/>}         sub="Needs attention" />
            <StatCard label="Overdue"           value={stats.overdue}   color="#ef4444" icon={<AlertTriangle size={20}/>} sub="Past due date" />
            <StatCard label="Completed"         value={stats.completed} color="#22c55e" icon={<CheckCircle2 size={20}/>}  sub="Finished jobs" />
            <StatCard label="Follow-ups Open"   value={stats.followup}  color="#a855f7" icon={<Repeat size={20}/>}        sub="Awaiting action" />
            <StatCard label="Today's Reminders" value={stats.todayRems} color="#34d399" icon={<Bell size={20}/>}          sub="Due today" />
            <StatCard label="Upcoming (7d)"     value={stats.upcoming}  color="#f472b6" icon={<CalendarDays size={20}/>}  sub="Within 7 days" />
          </div>

          {/* Overdue jobs list */}
          {stats.overdueList.length > 0 && (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} color="#ef4444" />
                <span style={{ fontWeight: 700, color: '#ef4444', fontSize: 14 }}>Overdue Jobs ({stats.overdueList.length})</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Job ID</th><th>Description</th><th>Priority</th><th>Assigned To</th><th>Due Date</th><th>Days Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.overdueList.map(j => {
                      const pc = PRIORITY_CFG[j.priority] || PRIORITY_CFG.Medium;
                      const overdueDays = daysUntil(j.dueDate) !== null ? Math.abs(daysUntil(j.dueDate)!) : '—';
                      return (
                        <tr key={j.id} style={{ background: 'rgba(239,68,68,0.04)' }}>
                          <td style={{ fontFamily: 'monospace', color: '#60a5fa', fontWeight: 700 }}>{j.jobId || '—'}</td>
                          <td style={{ fontWeight: 500, color: '#e2e8f0' }}>{j.description}</td>
                          <td><Badge label={j.priority} cfg={pc} /></td>
                          <td style={{ color: '#94a3b8' }}>{j.assignedTo || '—'}</td>
                          <td style={{ color: '#ef4444', fontWeight: 700 }}>{fmtDate(j.dueDate)}</td>
                          <td style={{ color: '#ef4444', fontWeight: 800, textAlign: 'center' }}>{overdueDays}d</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Today's reminders */}
          {stats.todayList.length > 0 && (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', background: 'rgba(52,211,153,0.08)', borderBottom: '1px solid rgba(52,211,153,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={16} color="#34d399" />
                <span style={{ fontWeight: 700, color: '#34d399', fontSize: 14 }}>Today's Reminders ({stats.todayList.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {stats.todayList.map(r => {
                  const fc = FREQ_COLORS[r.frequency] || '#60a5fa';
                  const pc = PRIORITY_CFG[r.priority] || PRIORITY_CFG.Medium;
                  return (
                    <div key={r.id} style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: fc, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>{r.title}</div>
                          {r.description && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{r.description}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        <Badge label={r.frequency} cfg={{ bg: `${fc}20`, tc: fc }} />
                        <Badge label={r.priority} cfg={pc} />
                        <button onClick={() => markRem(r, 'Completed')} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                          ✓ Done
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats.overdueList.length === 0 && stats.todayList.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#475569', fontSize: 13 }}>
              <CheckCircle2 size={36} style={{ margin: '0 auto 12px', color: '#22c55e' }} />
              All clear — no overdue jobs or reminders today.
            </div>
          )}
        </div>
      )}

      {/* ── PENDING JOBS ── */}
      {tab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input value={jpSearch} onChange={e => setJpSearch(e.target.value)} placeholder="Search jobs…" className="input-dark" style={{ paddingLeft: 30, width: '100%' }} />
            </div>
            <select value={jpStatus} onChange={e => setJpStatus(e.target.value)} className="input-dark" style={{ width: 150, fontSize: 13 }}>
              <option value="All">All Status</option>
              {JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={jpPriority} onChange={e => setJpPriority(e.target.value)} className="input-dark" style={{ width: 140, fontSize: 13 }}>
              <option value="All">All Priority</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button onClick={() => openJobForm()} className="btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Plus size={13} /> Add Job
            </button>
          </div>

          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={16} color="#60a5fa" />
              <span style={{ fontWeight: 700, color: '#60a5fa', fontSize: 14 }}>Pending Jobs</span>
              <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>{filteredJobs.length} item{filteredJobs.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>Sl.</th>
                    <th style={{ width: 120 }}>Job ID</th>
                    <th style={{ width: 140 }}>Asset / Equipment</th>
                    <th>Description</th>
                    <th style={{ width: 90, textAlign: 'center' }}>Priority</th>
                    <th style={{ width: 130 }}>Assigned To</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Due Date</th>
                    <th style={{ width: 110, textAlign: 'center' }}>Status</th>
                    <th style={{ width: 80, textAlign: 'center' }}>Pending</th>
                    <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.length === 0 && (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: '#475569', fontStyle: 'italic' }}>No jobs found. Click "+ Add Job" to create one.</td></tr>
                  )}
                  {filteredJobs.map((j, i) => {
                    const pc  = PRIORITY_CFG[j.priority] || PRIORITY_CFG.Medium;
                    const sc  = JOB_STATUS_CFG[j.status] || JOB_STATUS_CFG.Open;
                    const od  = isOverdue(j.dueDate, j.status);
                    const du  = daysUntil(j.dueDate);
                    return (
                      <tr key={j.id} style={{ background: od ? 'rgba(239,68,68,0.04)' : undefined }}>
                        <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                        <td style={{ fontFamily: 'monospace', color: '#60a5fa', fontWeight: 700, fontSize: 11 }}>{j.jobId || '—'}</td>
                        <td style={{ color: '#94a3b8' }}>{j.asset || '—'}</td>
                        <td style={{ fontWeight: 500, color: '#e2e8f0' }}>
                          {j.description}
                          {j.remarks && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{j.remarks}</div>}
                        </td>
                        <td style={{ textAlign: 'center' }}><Badge label={j.priority} cfg={pc} /></td>
                        <td style={{ color: '#94a3b8' }}>{j.assignedTo || '—'}</td>
                        <td style={{ textAlign: 'center', color: od ? '#ef4444' : '#94a3b8', fontWeight: od ? 700 : 400 }}>
                          {fmtDate(j.dueDate)}
                          {od && <div style={{ fontSize: 9, color: '#ef4444' }}>OVERDUE</div>}
                          {!od && du !== null && du <= 3 && du >= 0 && <div style={{ fontSize: 9, color: '#f59e0b' }}>in {du}d</div>}
                        </td>
                        <td style={{ textAlign: 'center' }}><Badge label={j.status} cfg={sc} /></td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#94a3b8' }}>{daysPending(j.createdDate)}d</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button onClick={() => openJobForm(j)} style={{ width: 28, height: 26, borderRadius: 5, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Edit">
                              <Edit2 size={11} />
                            </button>
                            <button onClick={() => deleteJob(j.id)} style={{ width: 28, height: 26, borderRadius: 5, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete">
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

      {/* ── FOLLOW-UP JOBS ── */}
      {tab === 'followup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input value={flSearch} onChange={e => setFlSearch(e.target.value)} placeholder="Search follow-ups…" className="input-dark" style={{ paddingLeft: 30, width: '100%' }} />
            </div>
            <select value={flStatus} onChange={e => setFlStatus(e.target.value)} className="input-dark" style={{ width: 150, fontSize: 13 }}>
              <option value="All">All Status</option>
              {FLW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => openFlwForm()} className="btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Plus size={13} /> Add Follow-up
            </button>
          </div>

          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Repeat size={16} color="#a855f7" />
              <span style={{ fontWeight: 700, color: '#a855f7', fontSize: 14 }}>Follow-up Jobs</span>
              <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>{filteredFlw.length} item{filteredFlw.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>Sl.</th>
                    <th style={{ width: 120 }}>Followup ID</th>
                    <th style={{ width: 120 }}>Related Job</th>
                    <th>Description</th>
                    <th style={{ width: 120, textAlign: 'center' }}>Next Follow-up</th>
                    <th style={{ width: 110, textAlign: 'center' }}>Status</th>
                    <th style={{ width: 140 }}>Responsible</th>
                    <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFlw.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#475569', fontStyle: 'italic' }}>No follow-up jobs found. Click "+ Add Follow-up" to create one.</td></tr>
                  )}
                  {filteredFlw.map((f, i) => {
                    const sc  = FLW_STATUS_CFG[f.status] || FLW_STATUS_CFG.Pending;
                    const du  = daysUntil(f.nextFollowupDate);
                    const overdue = f.nextFollowupDate && new Date(f.nextFollowupDate) < new Date(today) && f.status !== 'Completed';
                    return (
                      <tr key={f.id} style={{ background: overdue ? 'rgba(239,68,68,0.04)' : undefined }}>
                        <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                        <td style={{ fontFamily: 'monospace', color: '#a855f7', fontWeight: 700, fontSize: 11 }}>{f.followupId || '—'}</td>
                        <td style={{ fontFamily: 'monospace', color: '#60a5fa', fontSize: 11 }}>{f.relatedJobId || '—'}</td>
                        <td style={{ fontWeight: 500, color: '#e2e8f0' }}>
                          {f.description}
                          {f.comments && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{f.comments}</div>}
                        </td>
                        <td style={{ textAlign: 'center', color: overdue ? '#ef4444' : '#94a3b8', fontWeight: overdue ? 700 : 400 }}>
                          {fmtDate(f.nextFollowupDate)}
                          {overdue && <div style={{ fontSize: 9, color: '#ef4444' }}>OVERDUE</div>}
                          {!overdue && du !== null && du <= 3 && du >= 0 && <div style={{ fontSize: 9, color: '#f59e0b' }}>in {du}d</div>}
                        </td>
                        <td style={{ textAlign: 'center' }}><Badge label={f.status} cfg={sc} /></td>
                        <td style={{ color: '#94a3b8' }}>{f.responsiblePerson || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button onClick={() => openFlwForm(f)} style={{ width: 28, height: 26, borderRadius: 5, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Edit2 size={11} />
                            </button>
                            <button onClick={() => deleteFlw(f.id)} style={{ width: 28, height: 26, borderRadius: 5, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

      {/* ── REMINDER CENTER ── */}
      {tab === 'reminders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={remFreq} onChange={e => setRemFreq(e.target.value)} className="input-dark" style={{ width: 150, fontSize: 13 }}>
              <option value="All">All Frequencies</option>
              {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={remStatus} onChange={e => setRemStatus(e.target.value)} className="input-dark" style={{ width: 140, fontSize: 13 }}>
              <option value="All">All Status</option>
              {['Pending', 'Completed', 'Overdue'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ flex: 1 }} />
            <button onClick={() => openRemForm()} className="btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Plus size={13} /> Add Reminder
            </button>
          </div>

          {/* Frequency groups */}
          {(remFreq === 'All' ? FREQUENCIES : [remFreq]).map(freq => {
            const group = filteredRem.filter(r => r.frequency === freq);
            if (group.length === 0) return null;
            const fc = FREQ_COLORS[freq];
            return (
              <div key={freq} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8, background: `${fc}0d` }}>
                  <AlarmClock size={15} color={fc} />
                  <span style={{ fontWeight: 700, color: fc, fontSize: 14 }}>{freq} Tasks</span>
                  <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>{group.length} reminder{group.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 36, textAlign: 'center' }}>Sl.</th>
                        <th>Title</th>
                        <th style={{ width: 200 }}>Description</th>
                        <th style={{ width: 110, textAlign: 'center' }}>Due Date</th>
                        <th style={{ width: 90, textAlign: 'center' }}>Priority</th>
                        <th style={{ width: 130 }}>Assigned To</th>
                        <th style={{ width: 100, textAlign: 'center' }}>Status</th>
                        <th style={{ width: 110, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((r, i) => {
                        const sc  = REM_STATUS_CFG[r.status] || REM_STATUS_CFG.Pending;
                        const pc  = PRIORITY_CFG[r.priority] || PRIORITY_CFG.Medium;
                        const du  = daysUntil(r.dueDate);
                        const od  = r.status === 'Overdue' || (r.dueDate && new Date(r.dueDate) < new Date(today) && r.status !== 'Completed');
                        return (
                          <tr key={r.id} style={{ background: od ? 'rgba(239,68,68,0.04)' : r.dueDate === today ? 'rgba(52,211,153,0.04)' : undefined }}>
                            <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                            <td style={{ fontWeight: 600, color: '#e2e8f0' }}>
                              {r.dueDate === today && <span style={{ fontSize: 9, background: 'rgba(52,211,153,0.2)', color: '#34d399', borderRadius: 4, padding: '1px 5px', marginRight: 6 }}>TODAY</span>}
                              {od && <span style={{ fontSize: 9, background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 4, padding: '1px 5px', marginRight: 6 }}>OVERDUE</span>}
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
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                                {r.status !== 'Completed' && (
                                  <button onClick={() => markRem(r, 'Completed')} style={{ padding: '3px 8px', borderRadius: 5, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>✓</button>
                                )}
                                <button onClick={() => openRemForm(r)} style={{ width: 26, height: 24, borderRadius: 5, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Edit2 size={10} />
                                </button>
                                <button onClick={() => deleteRem(r.id)} style={{ width: 26, height: 24, borderRadius: 5, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Trash2 size={10} />
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
            );
          })}
          {filteredRem.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: '#475569', fontSize: 13 }}>
              <Bell size={36} style={{ margin: '0 auto 12px', color: '#475569' }} />
              No reminders found. Click "+ Add Reminder" to create one.
            </div>
          )}
        </div>
      )}

      {/* ── PENDING JOB FORM MODAL ── */}
      {showJobForm && (
        <Modal title={editJobId ? 'Edit Job' : 'Add Pending Job'} onClose={() => setShowJobForm(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Asset / Equipment">
              <Input value={jobForm.asset} onChange={e => setJobForm(f => ({ ...f, asset: e.target.value }))} placeholder="e.g. Furnace Motor" />
            </Field>
            <Field label="Priority">
              <Select value={jobForm.priority} onChange={v => setJobForm(f => ({ ...f, priority: v }))} options={PRIORITIES} />
            </Field>
          </div>
          <Field label="Job Description *">
            <Textarea value={jobForm.description} onChange={e => setJobForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the job…" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Assigned To">
              <Input value={jobForm.assignedTo} onChange={e => setJobForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="Name" />
            </Field>
            <Field label="Status">
              <Select value={jobForm.status} onChange={v => setJobForm(f => ({ ...f, status: v }))} options={JOB_STATUSES} />
            </Field>
            <Field label="Created Date">
              <Input type="date" value={jobForm.createdDate} onChange={e => setJobForm(f => ({ ...f, createdDate: e.target.value }))} />
            </Field>
            <Field label="Due Date">
              <Input type="date" value={jobForm.dueDate} onChange={e => setJobForm(f => ({ ...f, dueDate: e.target.value }))} />
            </Field>
          </div>
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
              {pendingJobs.map(j => <option key={j.id} value={j.jobId}>{j.jobId} — {j.description.slice(0, 40)}</option>)}
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
              <Select value={flwForm.status} onChange={v => setFlwForm(f => ({ ...f, status: v }))} options={FLW_STATUSES} />
            </Field>
          </div>
          <Field label="Responsible Person">
            <Input value={flwForm.responsiblePerson} onChange={e => setFlwForm(f => ({ ...f, responsiblePerson: e.target.value }))} placeholder="Name" />
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
            <Textarea value={remForm.description} onChange={e => setRemForm(f => ({ ...f, description: e.target.value }))} placeholder="Details about this reminder…" style={{ minHeight: 56 }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Due Date">
              <Input type="date" value={remForm.dueDate} onChange={e => setRemForm(f => ({ ...f, dueDate: e.target.value }))} />
            </Field>
            <Field label="Frequency">
              <Select value={remForm.frequency} onChange={v => setRemForm(f => ({ ...f, frequency: v }))} options={FREQUENCIES} />
            </Field>
            <Field label="Priority">
              <Select value={remForm.priority} onChange={v => setRemForm(f => ({ ...f, priority: v }))} options={PRIORITIES} />
            </Field>
            <Field label="Status">
              <Select value={remForm.status} onChange={v => setRemForm(f => ({ ...f, status: v }))} options={['Pending', 'Completed', 'Overdue']} />
            </Field>
          </div>
          <Field label="Assigned User">
            <Input value={remForm.assignedUser} onChange={e => setRemForm(f => ({ ...f, assignedUser: e.target.value }))} placeholder="Name" />
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
