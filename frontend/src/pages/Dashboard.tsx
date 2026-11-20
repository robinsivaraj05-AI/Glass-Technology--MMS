import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle, CheckCircle, CheckCircle2, Clock, Users, DollarSign, ShoppingCart, PackageCheck,
  ClipboardList, CalendarCheck, ChevronRight, Calendar, Bell, Repeat, FileText, Zap, RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { DEPT_NAME, COMPANY_NAME, COMPANY_LOC } from '../config/dept';
import { canSeePage } from '../config/access';
import { STATUS_FLOW, STATUS_XLS, normaliseStatus, isRejected } from '../config/purchaseStatus';
import { WORK_CODES, LEAVE_CODES, CODE_MAP } from '../config/attendanceCodes';

// Dashboard built only from the modules' real data (Job Tracker, Purchase Status,
// Attendance, Outsource, Rental, Org Chart). Nothing here is sample data.

// ─── Dates ────────────────────────────────────────────────────────────────────
const NOW = new Date();
const hour = NOW.getHours();
const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
const shiftLbl = hour < 8 ? 'Night Shift' : hour < 16 ? 'Day Shift' : 'Evening Shift';
const dateLbl = NOW.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const DAY = 86400000;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const TODAY = iso(NOW);
const parseDay = (s: string): Date | null => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
const today0 = parseDay(TODAY)!;
const weekStart = (() => { const d = new Date(today0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; })();
const weekEnd = new Date(weekStart.getTime() + 6 * DAY);
const sameMonth = (d: Date | null, y: number, m: number) => !!d && d.getFullYear() === y && d.getMonth() === m;
const fmtD = (s: string) => { const d = parseDay(s); return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Nil'; };
const aedK = (n: number) => n >= 1000 ? `AED ${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : `AED ${Math.round(n).toLocaleString()}`;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Style ────────────────────────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  background: '#FFFFFF', borderRadius: 16, border: '1px solid #F1F5F9',
  boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
};
const JOB_STATUS_COLOR: Record<string, string> = { Open: '#3B82F6', Ongoing: '#F59E0B', 'Follow Up': '#8B5CF6', 'Partially Done': '#06B6D4', 'In Progress': '#F59E0B', 'On Hold': '#94A3B8' };
const PRIO_COLOR: Record<string, string> = { Critical: '#DC2626', High: '#EA580C', Medium: '#D97706', Low: '#16A34A' };

const isEI = (j: any) => /E\s*&\s*I/i.test(j.assignedTo || '');
const isOpenJob = (j: any) => j.status !== 'Completed' && j.status !== 'Cancelled';

function Section({ icon, title, link, onLink, children, right }: { icon: React.ReactNode; title: string; link?: string; onLink?: () => void; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ ...CARD, padding: 16, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ color: '#374151', display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#1E293B' }}>{title}</span>
        {right}
        {link && onLink && (
          <span onClick={onLink} style={{ marginLeft: 'auto', fontSize: 11, color: '#3B82F6', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
            {link} <ChevronRight size={12}/>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
const Empty = ({ text }: { text: string }) => <div style={{ padding: '22px 8px', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>{text}</div>;

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const go = (path: string) => { if (canSeePage(user?.role, path)) navigate(path); };
  const canGo = (path: string) => canSeePage(user?.role, path);

  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [attMonth, setAttMonth] = useState<any[]>([]);
  const [org, setOrg] = useState<any[]>([]);
  const [outDash, setOutDash] = useState<any>({});
  const [rentalEntries, setRentalEntries] = useState<any[]>([]);
  const [accEntries, setAccEntries] = useState<any[]>([]);

  const load = () => {
    setLoading(true);
    const yr = NOW.getFullYear(), from = `${yr}-01-01`, to = `${yr}-12-31`;
    const arr = (d: any) => (Array.isArray(d) ? d : []);
    Promise.all([
      apiFetch('/api/pending-jobs').then(arr).catch(() => []),
      apiFetch('/api/followup-jobs').then(arr).catch(() => []),
      apiFetch('/api/reminders').then(arr).catch(() => []),
      apiFetch('/api/purchase-followup').then(arr).catch(() => []),
      apiFetch('/api/attendance/team').then(arr).catch(() => []),
      apiFetch(`/api/attendance?year=${yr}&month=${NOW.getMonth() + 1}`).then(arr).catch(() => []),
      apiFetch('/api/org-positions').then(arr).catch(() => []),
      apiFetch('/api/outsource/dashboard').catch(() => ({})),
      apiFetch(`/api/equipment-entries?from=${from}&to=${to}&limit=2000`).then((d: any) => d?.entries || []).catch(() => []),
      apiFetch(`/api/accessories?from=${from}&to=${to}&limit=2000`).then((d: any) => d?.entries || []).catch(() => []),
    ]).then(([j, f, r, p, t, a, o, od, re, ac]) => {
      setJobs(j); setFollowups(f); setReminders(r); setPurchases(p); setTeam(t); setAttMonth(a);
      setOrg(o); setOutDash(od || {}); setRentalEntries(re); setAccEntries(ac);
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  // ── Job Tracker (E&I) ──
  const J = useMemo(() => {
    const ei = jobs.filter(isEI);
    const open = ei.filter(isOpenJob);
    const due = (j: any) => parseDay(j.dueDate);
    const overdue = open.filter(j => { const d = due(j); return d && d < today0; });
    const thisWeek = open.filter(j => { const d = due(j); return d && d >= today0 && d <= weekEnd; });
    const noDate = open.filter(j => !due(j));
    const y = NOW.getFullYear(), m = NOW.getMonth();
    const lm = new Date(y, m - 1, 1);
    const doneThis = ei.filter(j => j.status === 'Completed' && sameMonth(parseDay(j.completedDate), y, m)).length;
    const doneLast = ei.filter(j => j.status === 'Completed' && sameMonth(parseDay(j.completedDate), lm.getFullYear(), lm.getMonth())).length;
    const byStatus = Object.entries(open.reduce((acc: Record<string, number>, j) => { acc[j.status || 'Open'] = (acc[j.status || 'Open'] || 0) + 1; return acc; }, {}))
      .map(([name, v]) => ({ name, v, c: JOB_STATUS_COLOR[name] || '#94A3B8' })).sort((a, b) => b.v - a.v);
    const byArea = Object.entries(open.reduce((acc: Record<string, number>, j) => { const k = j.asset || 'Other'; acc[k] = (acc[k] || 0) + 1; return acc; }, {}))
      .map(([name, v]) => ({ name, v })).sort((a, b) => b.v - a.v).slice(0, 7);
    const focus = [...overdue, ...thisWeek].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    return { open, overdue, thisWeek, noDate, doneThis, doneLast, byStatus, byArea, focus };
  }, [jobs]);

  // ── Purchase Status ──
  const P = useMemo(() => {
    const recs = purchases.map(r => ({ ...r, currentStatus: normaliseStatus(r.currentStatus || '') }));
    const pending = recs.filter(r => r.currentStatus !== 'Material Received' && !isRejected(r.currentStatus));
    const steps = STATUS_FLOW.slice(0, -1).map((st, i) => ({ name: `${i + 1}. ${st}`, short: st, v: pending.filter(r => r.currentStatus === st).length, c: STATUS_XLS[st] }));
    const noStatus = pending.filter(r => !r.currentStatus).length;
    const age = (r: any) => { const d = parseDay(r.requestDate); return d ? Math.round((today0.getTime() - d.getTime()) / DAY) : 0; };
    const oldest = [...pending].sort((a, b) => age(b) - age(a)).slice(0, 5).map(r => ({ ...r, age: age(r) }));
    const y = NOW.getFullYear(), m = NOW.getMonth();
    const receivedAt = (r: any) => {
      const h = (r.statusHistory || []).filter((x: any) => normaliseStatus(x.status) === 'Material Received').map((x: any) => new Date(x.at));
      return h.length ? h.sort((a: Date, b: Date) => a.getTime() - b.getTime())[0] : parseDay(r.receivedDate);
    };
    const receivedThisMonth = recs.filter(r => r.currentStatus === 'Material Received' && sameMonth(receivedAt(r), y, m)).length;
    const budgetPending = pending.reduce((s, r) => s + (r.budget || 0), 0);
    const avgAge = pending.length ? Math.round(pending.reduce((s, r) => s + age(r), 0) / pending.length) : 0;
    return { pending, steps, noStatus, oldest, receivedThisMonth, budgetPending, avgAge, totalReceived: recs.filter(r => r.currentStatus === 'Material Received').length };
  }, [purchases]);

  // ── Attendance today ──
  const A = useMemo(() => {
    const dayNo = NOW.getDate();
    const idKey = (s: string) => { const m = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^([A-Z]*)0*(\d+)$/); return m ? m[1] + m[2] : String(s); };
    const codeByEmp = new Map<string, string>();
    attMonth.forEach((r: any) => codeByEmp.set(idKey(r.empId), (r.entries || []).find((e: any) => e.day === dayNo)?.code || ''));
    const people = team.map((t: any) => ({ name: t.empName, role: t.role, code: codeByEmp.get(idKey(t.empId)) || '' }));
    const present = people.filter(p => WORK_CODES.has(p.code));
    const leave = people.filter(p => LEAVE_CODES.has(p.code));
    const off = people.filter(p => p.code === 'WO' || p.code === 'NH');
    const notMarked = people.filter(p => !p.code);
    const shifts = ['A', 'B', 'C', 'PR'].map(c => ({ c, n: present.filter(p => p.code === c).length })).filter(x => x.n);
    return { people, present, leave, off, notMarked, shifts };
  }, [team, attMonth]);

  // ── Costs (Outsource + Rental + Purchase payments) ──
  const C = useMemo(() => {
    const yr = NOW.getFullYear(), m = NOW.getMonth();
    const months = MON.map(mm => ({ m: mm, outsource: 0, rental: 0, purchase: 0 }));
    (outDash.monthlyCostTrend || []).forEach((e: any) => { if (e?._id?.year === yr && months[e._id.month - 1]) months[e._id.month - 1].outsource += e.totalCost || 0; });
    rentalEntries.forEach((e: any) => { const d = e.workDate ? new Date(e.workDate) : null; if (d && d.getFullYear() === yr) months[d.getMonth()].rental += e.totalCost || 0; });
    accEntries.forEach((e: any) => { const d = e.entryDate ? new Date(e.entryDate) : null; if (d && d.getFullYear() === yr) months[d.getMonth()].rental += e.totalCost || 0; });
    purchases.forEach((r: any) => (r.paymentHistory || []).forEach((tx: any) => { const d = tx.date ? new Date(tx.date) : null; if (d && d.getFullYear() === yr) months[d.getMonth()].purchase += tx.amount || 0; }));
    const thisM = months[m];
    const chart = months.slice(0, m + 1).map(x => ({ m: x.m, outsource: Math.round(x.outsource / 100) / 10, rental: Math.round(x.rental / 100) / 10, purchase: Math.round(x.purchase / 100) / 10 }));
    const yearTotal = months.reduce((s, x) => s + x.outsource + x.rental + x.purchase, 0);
    return { thisM, monthTotal: thisM.outsource + thisM.rental, chart, yearTotal, hasData: yearTotal > 0 };
  }, [outDash, rentalEntries, accEntries, purchases]);

  // ── Follow-ups & reminders ──
  const F = useMemo(() => followups.filter(f => f.status !== 'Completed' && f.status !== 'Cancelled')
    .sort((a, b) => (a.nextFollowupDate || '9').localeCompare(b.nextFollowupDate || '9')).slice(0, 5), [followups]);
  const R = useMemo(() => reminders.filter(r => r.status !== 'Completed').filter(r => { const d = parseDay(r.dueDate); return d && d.getTime() <= today0.getTime() + 7 * DAY; })
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).slice(0, 5), [reminders]);

  // ── Staffing (Org Chart) ──
  const getRS = (p: any) => p.recruitmentStatus || (p.personName?.trim() ? 'joined' : 'pending');
  const pct = (n: number) => (org.length ? Math.round((n / org.length) * 100) : 0);
  const STAFF = [
    { label: 'Total Positions', v: org.length, color: '#3B82F6', bg: '#EFF6FF', icon: <Users size={18}/> },
    { label: 'Joined', v: org.filter(p => getRS(p) === 'joined').length, color: '#22C55E', bg: '#F0FDF4', icon: <CheckCircle size={18}/> },
    { label: 'Ready to Join', v: org.filter(p => getRS(p) === 'ready_to_join').length, color: '#06B6D4', bg: '#ECFEFF', icon: <Clock size={18}/> },
    { label: 'HR Process', v: org.filter(p => getRS(p) === 'hr_process').length, color: '#8B5CF6', bg: '#F5F3FF', icon: <FileText size={18}/> },
    { label: 'Pending', v: org.filter(p => getRS(p) === 'pending').length, color: '#EF4444', bg: '#FEF2F2', icon: <AlertTriangle size={18}/> },
  ];

  const KPIS = [
    { label: 'Open E&I Jobs', value: J.open.length, color: '#3B82F6', icon: <ClipboardList size={20}/>, path: '/job-tracker',
      sub: <><b style={{ color: J.overdue.length ? '#DC2626' : '#16A34A' }}>{J.overdue.length} overdue</b> · {J.thisWeek.length} due this week</> },
    { label: 'Jobs Completed', value: J.doneThis, color: '#16A34A', icon: <CheckCircle2 size={20}/>, path: '/job-tracker',
      sub: <>this month · last month {J.doneLast}</> },
    { label: 'Pending Purchases', value: P.pending.length, color: '#F59E0B', icon: <ShoppingCart size={20}/>, path: '/purchase/followup',
      sub: <>avg {P.avgAge} days open · {aedK(P.budgetPending)}</> },
    { label: 'Material Received', value: P.receivedThisMonth, color: '#0D9488', icon: <PackageCheck size={20}/>, path: '/purchase/followup',
      sub: <>this month · {P.totalReceived} received in total</> },
    { label: "Today's Attendance", value: A.people.length ? `${A.present.length}/${A.people.length}` : 'Nil', color: '#6366F1', icon: <CalendarCheck size={20}/>, path: '/attendance',
      sub: <>{A.leave.length} on leave · <b style={{ color: A.notMarked.length ? '#DC2626' : '#64748B' }}>{A.notMarked.length} not marked</b></> },
    { label: 'Cost This Month', value: aedK(C.monthTotal), color: '#EC4899', icon: <DollarSign size={20}/>, path: '/contractor/report',
      sub: <>Outsource {aedK(C.thisM.outsource)} · Rental {aedK(C.thisM.rental)}</> },
  ];

  const th: React.CSSProperties = { padding: '7px 8px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '2px solid #F1F5F9', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '8px', fontSize: 12, borderBottom: '1px solid #F8FAFC', color: '#374151' };

  return (
    <div style={{ background: '#F0F4F8', margin: '-20px -24px', padding: '24px 28px', minHeight: 'calc(100vh - 60px)', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", color: '#111827' }}>

      {/* ══ HEADER ══ */}
      <div style={{ ...CARD, padding: '18px 22px', marginBottom: 14, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#3B82F6,#06B6D4)' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Zap size={22}/></div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: 1.5, textTransform: 'uppercase' }}>{DEPT_NAME} Maintenance Management System</div>
            <div style={{ fontSize: 21, fontWeight: 800, color: '#0F172A' }}>{greet}, {user?.name || 'there'} 👋</div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#64748B', marginTop: 2, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12}/>{dateLbl}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12}/>{shiftLbl}</span>
              <span>{COMPANY_NAME} · {COMPANY_LOC}</span>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {canGo('/job-tracker') && (
              <button onClick={() => go('/job-tracker')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                border: `1px solid ${J.overdue.length ? '#FECACA' : '#BBF7D0'}`, background: J.overdue.length ? '#FEF2F2' : '#F0FDF4', color: J.overdue.length ? '#DC2626' : '#16A34A' }}>
                <AlertTriangle size={14}/> {J.overdue.length} Overdue E&amp;I Job{J.overdue.length === 1 ? '' : 's'}
              </button>
            )}
            <button onClick={() => go('/purchase/followup')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700, border: '1px solid #FDE68A', background: '#FFFBEB', color: '#B45309' }}>
              <ShoppingCart size={14}/> {P.pending.length} Pending Purchase{P.pending.length === 1 ? '' : 's'}
            </button>
            <button onClick={load} title="Refresh" style={{ padding: '8px 10px', borderRadius: 10, cursor: 'pointer', border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }}/>
            </button>
          </div>
        </div>
      </div>

      {/* ══ KPI CARDS (real data) ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
        {KPIS.map(k => (
          <div key={k.label} onClick={() => go(k.path)} title={canGo(k.path) ? 'Open module' : undefined}
            style={{ ...CARD, padding: '14px 16px', borderTop: `3px solid ${k.color}`, cursor: canGo(k.path) ? 'pointer' : 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 }}>{k.label}</div>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `${k.color}18`, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.icon}</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: k.color, lineHeight: 1.1, marginTop: 2 }}>{loading ? '…' : k.value}</div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ══ E&I JOBS ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)', gap: 10, marginBottom: 14 }}>
        <Section icon={<ClipboardList size={15}/>} title="E&I Jobs — Overdue & This Week"
          right={<span style={{ fontSize: 11, color: '#9CA3AF' }}>{weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
          link={canGo('/job-tracker') ? 'Job Tracker' : undefined} onLink={() => go('/job-tracker')}>
          {J.focus.length === 0 ? <Empty text={J.open.length ? `No E&I jobs overdue or due this week. ${J.noDate.length} open job(s) have no due date.` : 'No open E&I jobs.'}/> : (
            <div style={{ overflowX: 'auto', maxHeight: 330, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Due', 'Area', 'Description', 'Priority', 'In-Charge', 'Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {J.focus.slice(0, 12).map(j => {
                    const d = parseDay(j.dueDate)!; const late = d < today0; const days = Math.round((d.getTime() - today0.getTime()) / DAY);
                    return (
                      <tr key={j._id || j.id} style={{ background: late ? '#FEF2F2' : undefined }}>
                        <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 700, color: late ? '#DC2626' : days === 0 ? '#D97706' : '#1E293B' }}>
                          {fmtD(j.dueDate)}<div style={{ fontSize: 10, fontWeight: 600 }}>{late ? `${-days}d late` : days === 0 ? 'Today' : `in ${days}d`}</div>
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{j.asset || 'Nil'}</td>
                        <td style={{ ...td, fontWeight: 500, color: '#1E293B' }}>{j.description}</td>
                        <td style={td}><span style={{ fontSize: 10, fontWeight: 700, color: PRIO_COLOR[j.priority] || '#64748B' }}>{j.priority}</span></td>
                        <td style={{ ...td, whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }} title={j.completedBy}>{j.completedBy || 'Nil'}</td>
                        <td style={td}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: `${JOB_STATUS_COLOR[j.status] || '#94A3B8'}20`, color: JOB_STATUS_COLOR[j.status] || '#64748B', whiteSpace: 'nowrap' }}>{j.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section icon={<ClipboardList size={15}/>} title="Open E&I Jobs" right={<span style={{ fontSize: 11, color: '#9CA3AF' }}>{J.open.length} total · {J.noDate.length} without due date</span>}>
          {J.open.length === 0 ? <Empty text="No open E&I jobs."/> : (
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', height: 130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={J.byStatus} dataKey="v" nameKey="name" innerRadius={42} outerRadius={60} paddingAngle={2} stroke="none">
                    {J.byStatus.map(s => <Cell key={s.name} fill={s.c}/>)}
                  </Pie><Tooltip/></PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#1E293B' }}>{J.open.length}</div><div style={{ fontSize: 9, color: '#94A3B8' }}>open</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {J.byStatus.map(s => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.c }}/>{s.name}<b style={{ marginLeft: 'auto', color: s.c }}>{s.v}</b>
                  </div>
                ))}
              </div>
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #F1F5F9', paddingTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>By area</div>
                {J.byArea.map(a => (
                  <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, fontSize: 12 }}>
                    <span style={{ width: 95, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                    <div style={{ flex: 1, height: 8, background: '#F1F5F9', borderRadius: 4 }}><div style={{ width: `${(a.v / J.byArea[0].v) * 100}%`, height: '100%', background: '#3B82F6', borderRadius: 4 }}/></div>
                    <b style={{ width: 22, textAlign: 'right', color: '#1E293B' }}>{a.v}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* ══ PURCHASE + ATTENDANCE ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 10, marginBottom: 14 }}>
        <Section icon={<ShoppingCart size={15}/>} title="Purchase Pipeline" right={<span style={{ fontSize: 11, color: '#9CA3AF' }}>{P.pending.length} pending · {aedK(P.budgetPending)}</span>}
          link="E&I Purchase Status" onLink={() => go('/purchase/followup')}>
          {P.pending.length === 0 ? <Empty text="No pending purchases."/> : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                {P.steps.map(s => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, fontSize: 12 }}>
                    <span style={{ width: 150, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.name}>{s.name}</span>
                    <div style={{ flex: 1, height: 10, background: '#F1F5F9', borderRadius: 5 }}>
                      <div style={{ width: `${(s.v / Math.max(1, ...P.steps.map(x => x.v))) * 100}%`, height: '100%', background: s.c, borderRadius: 5 }}/>
                    </div>
                    <b style={{ width: 20, textAlign: 'right' }}>{s.v}</b>
                  </div>
                ))}
                {P.noStatus > 0 && <div style={{ fontSize: 11, color: '#94A3B8' }}>{P.noStatus} item(s) without a status</div>}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Oldest pending</div>
                {P.oldest.map(r => (
                  <div key={r._id || r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #F8FAFC' }}>
                    <span style={{ minWidth: 42, fontSize: 12, fontWeight: 800, color: r.age > 90 ? '#DC2626' : r.age > 30 ? '#D97706' : '#64748B' }}>{r.age}d</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.itemDescription}>{r.itemDescription}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>{r.currentStatus || 'No status'} · {r.prNumber || 'Nil'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section icon={<CalendarCheck size={15}/>} title="Today's Attendance" right={<span style={{ fontSize: 11, color: '#9CA3AF' }}>{NOW.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
          link={canGo('/attendance') ? 'Attendance' : undefined} onLink={() => go('/attendance')}>
          {A.people.length === 0 ? <Empty text="No team in the attendance sheet."/> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}>
                {[{ l: 'Present', v: A.present.length, c: '#16A34A' }, { l: 'Leave', v: A.leave.length, c: '#F59E0B' }, { l: 'Off / Holiday', v: A.off.length, c: '#CA8A04' }, { l: 'Not marked', v: A.notMarked.length, c: A.notMarked.length ? '#DC2626' : '#94A3B8' }].map(x => (
                  <div key={x.l} style={{ background: `${x.c}12`, borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: x.c }}>{x.v}</div><div style={{ fontSize: 10, color: '#64748B' }}>{x.l}</div>
                  </div>
                ))}
              </div>
              {A.shifts.length > 0 && <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>On duty: {A.shifts.map(s => `${CODE_MAP[s.c]?.label || s.c} ${s.n}`).join(' · ')}</div>}
              {[{ t: 'On leave', list: A.leave, c: '#B45309' }, { t: 'Not marked yet', list: A.notMarked, c: '#DC2626' }].filter(g => g.list.length).map(g => (
                <div key={g.t} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: g.c, textTransform: 'uppercase' }}>{g.t}</div>
                  <div style={{ fontSize: 12, color: '#334155' }}>{g.list.map(p => p.name + (p.code ? ` (${p.code})` : '')).join(', ')}</div>
                </div>
              ))}
            </>
          )}
        </Section>
      </div>

      {/* ══ COST + FOLLOW-UPS / REMINDERS ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 10, marginBottom: 14 }}>
        <Section icon={<DollarSign size={15}/>} title={`Monthly Cost ${NOW.getFullYear()} (AED '000)`} right={<span style={{ fontSize: 11, color: '#9CA3AF' }}>Year to date {aedK(C.yearTotal)}</span>}>
          {!C.hasData ? <Empty text={loading ? 'Loading…' : 'No outsource, rental or purchase payments recorded this year.'}/> : (
            <>
              <div style={{ height: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={C.chart} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                    <XAxis dataKey="m" tick={{ fill: '#9CA3AF', fontSize: 10 }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}K`}/>
                    <Tooltip formatter={(v: any) => `AED ${v}K`}/>
                    <Bar dataKey="outsource" name="Outsource" stackId="a" fill="#3B82F6"/>
                    <Bar dataKey="rental" name="Rental" stackId="a" fill="#8B5CF6"/>
                    <Bar dataKey="purchase" name="Purchase payments" stackId="a" fill="#22C55E" radius={[4, 4, 0, 0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 10, color: '#6B7280' }}>
                {[{ c: '#3B82F6', l: 'Outsource' }, { c: '#8B5CF6', l: 'Rental (work + accessories)' }, { c: '#22C55E', l: 'Purchase payments' }].map(x => (
                  <span key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 4, borderRadius: 2, background: x.c }}/>{x.l}</span>
                ))}
              </div>
            </>
          )}
        </Section>

        <Section icon={<Repeat size={15}/>} title="Follow-ups & Reminders" link={canGo('/job-tracker') ? 'Job Tracker' : undefined} onLink={() => go('/job-tracker')}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#8B5CF6', textTransform: 'uppercase', marginBottom: 4 }}>Open follow-ups ({followups.filter(f => f.status !== 'Completed' && f.status !== 'Cancelled').length})</div>
          {F.length === 0 ? <Empty text="No open follow-ups."/> : F.map(f => (
            <div key={f._id || f.id} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid #F8FAFC', fontSize: 12 }}>
              <span style={{ minWidth: 50, fontWeight: 700, color: f.nextFollowupDate && f.nextFollowupDate < TODAY ? '#DC2626' : '#475569' }}>{fmtD(f.nextFollowupDate)}</span>
              <span style={{ color: '#1E293B', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.description}>{f.description}</span>
              <span style={{ color: '#94A3B8', whiteSpace: 'nowrap' }}>{f.responsiblePerson}</span>
            </div>
          ))}
          <div style={{ fontSize: 10, fontWeight: 800, color: '#0891B2', textTransform: 'uppercase', margin: '10px 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}><Bell size={11}/> Reminders — overdue & next 7 days</div>
          {R.length === 0 ? <Empty text="No reminders due."/> : R.map(r => (
            <div key={r._id || r.id} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid #F8FAFC', fontSize: 12 }}>
              <span style={{ minWidth: 50, fontWeight: 700, color: r.dueDate < TODAY ? '#DC2626' : r.dueDate === TODAY ? '#D97706' : '#475569' }}>{r.dueDate === TODAY ? 'Today' : fmtD(r.dueDate)}</span>
              <span style={{ color: '#1E293B', flex: 1 }}>{r.title}</span>
              <span style={{ color: '#94A3B8' }}>{r.frequency}</span>
            </div>
          ))}
        </Section>
      </div>

      {/* ══ STAFFING (Org Chart) ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 14 }}>
        {STAFF.map((s, i) => (
          <div key={s.label} onClick={() => go('/org-chart/summary')} style={{ ...CARD, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: `4px solid ${s.color}`, cursor: canGo('/org-chart/summary') ? 'pointer' : 'default' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{s.label}</div>
              {i > 0 && <div style={{ fontSize: 10, color: s.color, fontWeight: 700 }}>{pct(s.v)}%</div>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', fontSize: 11, color: '#94A3B8' }}>
        {COMPANY_NAME} · {DEPT_NAME} Maintenance Management System · All figures from live module data
      </div>
    </div>
  );
}
