import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Trash2, GraduationCap, Users, Award, CheckCircle,
  ExternalLink, Download, AlertTriangle, ChevronDown, ChevronRight,
  Clock, Printer, ArrowUpDown, ArrowUp, ArrowDown, X, RefreshCw,
  UserCheck, UserX, BarChart2, FileSpreadsheet, BookOpen, Target, Pencil,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { useEmployees } from '../context/EmployeeContext';
import type { TrainingRecord, FullEmployee } from '../data/employeeData';

// ─── Enterprise colour palette ───────────────────────────────────────────────
const C = {
  primary:   '#1E3A8A', secondary: '#2563EB', bg:     '#F8FAFC',
  card:      '#FFFFFF',  border:    '#E2E8F0', rowAlt: '#F8FAFC',
  rowHover:  '#EFF6FF',  textDark:  '#0F172A', textMed:'#334155',
  textMuted: '#64748B',  success:   '#16A34A', successBg:'#DCFCE7',
  warning:   '#D97706',  warningBg: '#FEF3C7', danger: '#DC2626',
  dangerBg:  '#FEE2E2',  info:      '#0891B2', infoBg: '#CFFAFE',
  purple:    '#7C3AED',  purpleBg:  '#EDE9FE',
  shadow:    '0 1px 3px rgba(0,0,0,0.10),0 1px 2px rgba(0,0,0,0.06)',
  shadowMd:  '0 4px 6px rgba(0,0,0,0.07),0 2px 4px rgba(0,0,0,0.06)',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type FlatRecord = TrainingRecord & { emp: FullEmployee };
type TabType    = 'overview' | 'records' | 'by-training' | 'by-employee' | 'pending';
type SortKey    = 'empName'|'designation'|'dept'|'name'|'type'|'mode'|'trainer'|'date'|'duration'|'result';
type Status     = 'completed'|'inprogress'|'notattended';

const MONTHS_FULL = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const BLANK_FORM = {
  empId:'', name:'', type:'Technical', mode:'Internal' as 'Internal'|'External',
  trainer:'', date:'', duration:'', result:'', remarks:'',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function classify(result?: string): Status {
  const v = (result || '').toLowerCase();
  if (['pass','attended','completed'].some(k => v.includes(k))) return 'completed';
  if (v.includes('progress')) return 'inprogress';
  return 'notattended';
}
function fmtDate(d?: string) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
  catch { return d; }
}
function empDept(e: FullEmployee): string { return (e as any).department || '—'; }

// ─── Print CSS ────────────────────────────────────────────────────────────────
const PRINT_CSS = `
@media print {
  .no-print { display:none !important; }
  body { background:#fff !important; color:#000 !important; font-size:11px; }
  .print-card { box-shadow:none !important; border:1px solid #ccc !important; }
  .page-break { page-break-before:always; }
  @page { size:A4 landscape; margin:12mm; }
}`;

// ─────────────────────────────────────────────────────────────────────────────
export default function Training() {
  const navigate = useNavigate();
  const { employees, updateEmployee } = useEmployees();
  const activeEmployees = employees.filter(e => e.status !== 'resigned');

  // ── Tabs & UI state ────────────────────────────────────────────────────────
  const [tab,          setTab]        = useState<TabType>('overview');
  const [expandedSet,  setExpandedSet]= useState<Set<string>>(new Set());

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [fYear,       setFYear]       = useState('all');
  const [fMonth,      setFMonth]      = useState('all');
  const [fDept,       setFDept]       = useState('all');
  const [fType,       setFType]       = useState('all');
  const [fTrainer,    setFTrainer]    = useState('all');
  const [fResult,     setFResult]     = useState('all');

  // ── Sort ───────────────────────────────────────────────────────────────────
  const [sortKey,  setSortKey]  = useState<SortKey>('date');
  const [sortDir,  setSortDir]  = useState<'asc'|'desc'>('desc');

  // ── Pagination ─────────────────────────────────────────────────────────────
  const [page,     setPage]     = useState(1);
  const PAGE_SIZE = 25;

  // ── Forms ──────────────────────────────────────────────────────────────────
  const [showAdd,      setShowAdd]      = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FlatRecord|null>(null);
  const [editTarget,   setEditTarget]   = useState<FlatRecord|null>(null);
  const [form,         setForm]         = useState({ ...BLANK_FORM });
  const [editForm,     setEditForm]     = useState({ ...BLANK_FORM });
  const setF  = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const setEF = (k: string, v: string) => setEditForm(p => ({ ...p, [k]: v }));

  // ─── Data derivation ───────────────────────────────────────────────────────
  const allRecords = useMemo<FlatRecord[]>(() => {
    const rows: FlatRecord[] = [];
    employees.forEach(e => (e.training ?? []).forEach(t => rows.push({ ...t, emp: e })));
    return rows.sort((a,b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }, [employees]);

  const years     = useMemo(() => [...new Set(allRecords.map(r => r.date?.slice(0,4)).filter(Boolean) as string[])].sort().reverse(), [allRecords]);
  const types     = useMemo(() => [...new Set(allRecords.map(r => r.type).filter(Boolean))],  [allRecords]);
  const trainers  = useMemo(() => [...new Set(allRecords.map(r => r.trainer).filter(Boolean) as string[])].sort(), [allRecords]);
  const depts     = useMemo(() => [...new Set(activeEmployees.map(e => empDept(e)).filter(d => d !== '—'))].sort(), [activeEmployees]);
  const resultOpts = useMemo(() => [...new Set(allRecords.map(r => r.result).filter(Boolean) as string[])].sort(), [allRecords]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return allRecords.filter(r => {
      if (s && !r.name.toLowerCase().includes(s) && !r.emp.name.toLowerCase().includes(s) && !r.trainer?.toLowerCase().includes(s)) return false;
      if (fYear    !== 'all' && r.date?.slice(0,4)  !== fYear)    return false;
      if (fMonth   !== 'all') { const m = parseInt(r.date?.slice(5,7) ?? '0',10); if (m !== parseInt(fMonth,10)) return false; }
      if (fDept    !== 'all' && empDept(r.emp)       !== fDept)    return false;
      if (fType    !== 'all' && r.type               !== fType)    return false;
      if (fTrainer !== 'all' && r.trainer            !== fTrainer) return false;
      if (fResult  !== 'all' && r.result             !== fResult)  return false;
      return true;
    });
  }, [allRecords, search, fYear, fMonth, fDept, fType, fTrainer, fResult]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a,b) => {
      let av = '', bv = '';
      if (sortKey === 'empName')    { av = a.emp.name; bv = b.emp.name; }
      else if (sortKey === 'designation') { av = a.emp.designation; bv = b.emp.designation; }
      else if (sortKey === 'dept')  { av = empDept(a.emp); bv = empDept(b.emp); }
      else if (sortKey === 'name')  { av = a.name; bv = b.name; }
      else if (sortKey === 'type')  { av = a.type||''; bv = b.type||''; }
      else if (sortKey === 'mode')  { av = a.mode||''; bv = b.mode||''; }
      else if (sortKey === 'trainer'){ av = a.trainer||''; bv = b.trainer||''; }
      else if (sortKey === 'date')  { av = a.date||''; bv = b.date||''; }
      else if (sortKey === 'duration'){ av = a.duration||''; bv = b.duration||''; }
      else if (sortKey === 'result') { av = a.result||''; bv = b.result||''; }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated  = sorted.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  // ── KPI stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const completed    = filtered.filter(r => classify(r.result) === 'completed').length;
    const inProgress   = filtered.filter(r => classify(r.result) === 'inprogress').length;
    const notAttended  = filtered.filter(r => classify(r.result) === 'notattended').length;
    const passRate     = filtered.length ? Math.round(completed / filtered.length * 100) : 0;
    const uniqueEmps   = new Set(filtered.map(r => r.emp.id)).size;
    return {
      total: filtered.length,
      internal: filtered.filter(r => r.mode === 'Internal').length,
      external: filtered.filter(r => r.mode === 'External').length,
      completed, inProgress, notAttended, passRate, uniqueEmps,
    };
  }, [filtered]);

  // ── Chart data ─────────────────────────────────────────────────────────────
  const pieData = useMemo(() => [
    { name: 'Completed',    value: stats.completed,   color: C.success },
    { name: 'In Progress',  value: stats.inProgress,  color: C.warning },
    { name: 'Not Attended', value: stats.notAttended, color: C.danger  },
  ].filter(d => d.value > 0), [stats]);

  const typeBarData = useMemo(() => {
    const counts: Record<string,{internal:number;external:number}> = {};
    filtered.forEach(r => {
      if (!r.type) return;
      counts[r.type] = counts[r.type] || { internal:0, external:0 };
      if (r.mode === 'Internal') counts[r.type].internal++;
      else counts[r.type].external++;
    });
    return Object.entries(counts).map(([name,v]) => ({ name, ...v }));
  }, [filtered]);

  const monthlyData = useMemo(() => {
    const year = fYear !== 'all' ? fYear : String(new Date().getFullYear());
    const cnts = Array(12).fill(0);
    allRecords.forEach(r => {
      if (r.date?.startsWith(year)) {
        const m = parseInt(r.date.slice(5,7),10) - 1;
        if (m >= 0 && m < 12) cnts[m]++;
      }
    });
    return MONTHS_SHORT.map((m,i) => ({ month:m, sessions:cnts[i] }));
  }, [allRecords, fYear]);

  const deptData = useMemo(() => {
    const d: Record<string,{completed:number;total:number}> = {};
    filtered.forEach(r => {
      const dep = empDept(r.emp);
      d[dep] = d[dep] || { completed:0, total:0 };
      d[dep].total++;
      if (classify(r.result) === 'completed') d[dep].completed++;
    });
    return Object.entries(d).map(([name,v]) => ({
      name, pct: v.total ? Math.round(v.completed/v.total*100) : 0, total: v.total,
    })).sort((a,b) => b.pct - a.pct);
  }, [filtered]);

  // ── Training-wise grouped ─────────────────────────────────────────────────
  const byTraining = useMemo(() => {
    const map = new Map<string, { name:string; type:string; trainer:string; date:string; duration:string; records:FlatRecord[] }>();
    filtered.forEach(r => {
      const key = r.name;
      if (!map.has(key)) map.set(key, { name:r.name, type:r.type||'', trainer:r.trainer||'', date:r.date||'', duration:r.duration||'', records:[] });
      map.get(key)!.records.push(r);
    });
    return [...map.values()].sort((a,b) => b.records.length - a.records.length);
  }, [filtered]);

  // ── Employee history ───────────────────────────────────────────────────────
  const byEmployee = useMemo(() => {
    return activeEmployees.map(e => {
      const recs     = filtered.filter(r => r.emp.id === e.id);
      const completed  = recs.filter(r => classify(r.result) === 'completed').length;
      const inProg     = recs.filter(r => classify(r.result) === 'inprogress').length;
      const notAtt     = recs.filter(r => classify(r.result) === 'notattended').length;
      const attPct     = recs.length ? Math.round(completed/recs.length*100) : 0;
      const lastDate   = recs.map(r => r.date||'').sort().reverse()[0] || '';
      return { emp:e, total:recs.length, completed, inProg, notAtt, attPct, lastDate };
    }).filter(d => d.total > 0).sort((a,b) => b.total - a.total);
  }, [activeEmployees, filtered]);

  // ── Pending training ──────────────────────────────────────────────────────
  const pendingRecords = filtered.filter(r => classify(r.result) === 'inprogress');
  const noTrainingEmps = activeEmployees.filter(e => !(e.training?.length));

  // ─── Actions ──────────────────────────────────────────────────────────────
  const handleAdd = () => {
    if (!form.empId || !form.name.trim()) return;
    const target = employees.find(e => e.id === form.empId);
    if (!target) return;
    const rec: TrainingRecord = {
      id: String(Date.now()), name:form.name.trim(), type:form.type, mode:form.mode,
      trainer:form.trainer, date:form.date, duration:form.duration, result:form.result, remarks:form.remarks,
    };
    updateEmployee(target.id, { training:[...(target.training??[]), rec] });
    setShowAdd(false); setForm({ ...BLANK_FORM });
  };
  const confirmDelete = () => {
    if (!deleteTarget) return;
    const emp = employees.find(e => e.id === deleteTarget.emp.id);
    if (!emp) return;
    updateEmployee(emp.id, { training: emp.training.filter(t => t.id !== deleteTarget.id) });
    setDeleteTarget(null);
  };
  const openEdit = (r: FlatRecord) => {
    setEditTarget(r);
    setEditForm({
      empId: r.emp.id, name: r.name, type: r.type || 'Technical',
      mode: (r.mode as 'Internal'|'External') || 'Internal',
      trainer: r.trainer || '', date: r.date || '',
      duration: r.duration || '', result: r.result || '', remarks: r.remarks || '',
    });
  };
  const handleUpdate = () => {
    if (!editTarget || !editForm.name.trim()) return;
    const emp = employees.find(e => e.id === editTarget.emp.id);
    if (!emp) return;
    const updated = emp.training.map(t =>
      t.id === editTarget.id
        ? { ...t, name:editForm.name.trim(), type:editForm.type, mode:editForm.mode,
            trainer:editForm.trainer, date:editForm.date, duration:editForm.duration,
            result:editForm.result, remarks:editForm.remarks }
        : t
    );
    updateEmployee(emp.id, { training: updated });
    setEditTarget(null);
  };
  const markComplete = (r: FlatRecord, result: string) => {
    const emp = employees.find(e => e.id === r.emp.id);
    if (!emp) return;
    updateEmployee(emp.id, { training: emp.training.map(t => t.id === r.id ? { ...t, result } : t) });
  };
  const toggleExpand = (k: string) => setExpandedSet(prev => {
    const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n;
  });
  const resetFilters = () => {
    setSearch(''); setFYear('all'); setFMonth('all'); setFDept('all');
    setFType('all'); setFTrainer('all'); setFResult('all'); setPage(1);
  };
  const sortToggle = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d==='asc'?'desc':'asc');
    else { setSortKey(k); setSortDir('asc'); }
    setPage(1);
  };

  // ─── Exports ──────────────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const hdr = ['Employee','Designation','Department','Training Name','Type','Mode','Trainer','Date','Duration','Result','Remarks'];
    const rows = sorted.map(r => [r.emp.name, r.emp.designation, empDept(r.emp), r.name, r.type||'', r.mode||'', r.trainer||'', r.date||'', r.duration||'', r.result||'', r.remarks||'']);
    const ws1 = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
    ws1['!cols'] = [22,20,16,30,14,12,22,14,12,16,24].map(w => ({ wch:w }));
    XLSX.utils.book_append_sheet(wb, ws1, 'All Records');

    const hdr2 = ['Training Name','Type','Trainer','Date','Duration','Total','Completed','In Progress','Not Attended','Attendance %'];
    const rows2 = byTraining.map(g => {
      const c = g.records.filter(r => classify(r.result)==='completed').length;
      const ip= g.records.filter(r => classify(r.result)==='inprogress').length;
      const na= g.records.filter(r => classify(r.result)==='notattended').length;
      return [g.name,g.type,g.trainer,g.date,g.duration,g.records.length,c,ip,na, g.records.length?Math.round(c/g.records.length*100)+'%':'0%'];
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([hdr2,...rows2]), 'Training Summary');

    const hdr3 = ['Employee','Department','Designation','Total','Completed','In Progress','Not Attended','Attendance %','Last Training'];
    const rows3 = byEmployee.map(d => [d.emp.name, empDept(d.emp), d.emp.designation, d.total, d.completed, d.inProg, d.notAtt, d.attPct+'%', fmtDate(d.lastDate)]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([hdr3,...rows3]), 'Employee Summary');

    const xlsMonthLabel = fMonth !== 'all' ? MONTHS_FULL[parseInt(fMonth,10)-1] : '';
    const xlsYearLabel  = fYear  !== 'all' ? fYear : String(new Date().getFullYear());
    const xlsPeriod     = xlsMonthLabel ? `${xlsMonthLabel}-${xlsYearLabel}` : xlsYearLabel;
    XLSX.writeFile(wb, `GT-E&I-Training-Report-${xlsPeriod}.xlsx`);
  };

  const exportPDF = () => {
    // ── Title & period strings ─────────────────────────────────────────────
    const monthLabel  = fMonth !== 'all' ? MONTHS_FULL[parseInt(fMonth,10)-1] : '';
    const yearLabel   = fYear  !== 'all' ? fYear  : String(new Date().getFullYear());
    const periodLabel = monthLabel ? `${monthLabel} ${yearLabel}` : yearLabel;
    const todayStr    = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    const reportTitle = `GT-E&I-Training Report - ${periodLabel} - ${todayStr}`;
    const fileName    = `GT-E&I-Training-Report-${yearLabel}${fMonth!=='all'?'-'+String(fMonth).padStart(2,'0'):''}.pdf`;

    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    const pw  = doc.internal.pageSize.getWidth();
    const ph  = doc.internal.pageSize.getHeight();

    // ── Shared helpers ─────────────────────────────────────────────────────
    const sectionHeader = (title: string, y: number) => {
      doc.setFillColor(30,58,138); doc.rect(0,y,pw,9,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
      doc.text(title, 14, y+6.2);
    };
    const tblStyles = {
      styles:             { fontSize:7, cellPadding:2.5, textColor:[30,41,59] as [number,number,number], fillColor:[255,255,255] as [number,number,number], lineColor:[226,232,240] as [number,number,number], lineWidth:0.2 },
      headStyles:         { fillColor:[30,58,138] as [number,number,number], textColor:[219,234,254] as [number,number,number], fontStyle:'bold' as const, fontSize:7 },
      alternateRowStyles: { fillColor:[248,250,252] as [number,number,number] },
    };
    const resultColor = (v: string) => {
      const l = v.toLowerCase();
      if (l==='pass'||l==='attended'||l==='completed') return [22,163,74]  as [number,number,number];
      if (l.includes('progress'))                       return [217,119,6]  as [number,number,number];
      if (l==='fail'||l==='not attended')               return [220,38,38]  as [number,number,number];
      return [100,116,139] as [number,number,number];
    };

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 1 — Cover + KPI Overview
    // ══════════════════════════════════════════════════════════════════════
    doc.setFillColor(30,58,138); doc.rect(0,0,pw,26,'F');
    // Company logo placeholder
    doc.setFillColor(255,255,255); doc.roundedRect(10,4,18,18,2,2,'F');
    doc.setTextColor(30,58,138); doc.setFontSize(7); doc.setFont('helvetica','bold');
    doc.text('GT-E&I', 19, 14, { align:'center' });
    // Title
    doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text(reportTitle, 32, 12);
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(180,210,255);
    const periodLine = `Period: ${periodLabel}   |   Generated: ${todayStr}   |   Total Records: ${sorted.length}   |   Pass Rate: ${stats.passRate}%`;
    doc.text(periodLine, 32, 20);

    // KPI summary boxes
    let kpiY = 32;
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(30,41,59);
    doc.text('KEY PERFORMANCE INDICATORS', 14, kpiY + 5);
    const kpis = [
      { label:'Total Sessions',    value:String(stats.total),       color:[37,99,235]   as [number,number,number] },
      { label:'Internal',          value:String(stats.internal),    color:[8,145,178]   as [number,number,number] },
      { label:'External',          value:String(stats.external),    color:[124,58,237]  as [number,number,number] },
      { label:'Completed',         value:String(stats.completed),   color:[22,163,74]   as [number,number,number] },
      { label:'In Progress',       value:String(stats.inProgress),  color:[217,119,6]   as [number,number,number] },
      { label:'Not Attended',      value:String(stats.notAttended), color:[220,38,38]   as [number,number,number] },
      { label:'Pass Rate',         value:`${stats.passRate}%`,      color:[15,118,110]  as [number,number,number] },
      { label:'Employees Trained', value:String(stats.uniqueEmps),  color:[124,58,237]  as [number,number,number] },
    ];
    const boxW = (pw - 28) / 8;
    kpis.forEach((k,i) => {
      const bx = 14 + i * boxW;
      const by = kpiY + 9;
      doc.setFillColor(248,250,252); doc.setDrawColor(k.color[0],k.color[1],k.color[2]);
      doc.setLineWidth(0.5); doc.roundedRect(bx, by, boxW-2, 20, 1.5, 1.5, 'FD');
      doc.setTextColor(k.color[0],k.color[1],k.color[2]);
      doc.setFontSize(14); doc.setFont('helvetica','bold');
      doc.text(k.value, bx + (boxW-2)/2, by+12, { align:'center' });
      doc.setFontSize(5.5); doc.setFont('helvetica','normal');
      doc.text(k.label, bx + (boxW-2)/2, by+17.5, { align:'center' });
    });

    // Training status summary table (compact)
    const summaryY = kpiY + 34;
    sectionHeader('TRAINING SUMMARY BY STATUS', summaryY);
    autoTable(doc, {
      startY: summaryY + 10,
      head:[['Status','Count','Percentage','Description']],
      body:[
        ['Completed / Pass / Attended', stats.completed,   `${stats.passRate}%`,                                        'Employees who completed the training'],
        ['In Progress',                  stats.inProgress,  `${sorted.length?Math.round(stats.inProgress/sorted.length*100):0}%`, 'Trainings currently ongoing'],
        ['Not Attended / Fail',          stats.notAttended, `${sorted.length?Math.round(stats.notAttended/sorted.length*100):0}%`,'Employees who did not attend'],
        ['TOTAL',                        sorted.length,     '100%',                                                      `Internal: ${stats.internal}  |  External: ${stats.external}`],
      ],
      columnStyles: { 0:{ cellWidth:70 }, 1:{ cellWidth:25, halign:'center' }, 2:{ cellWidth:25, halign:'center' }, 3:{ cellWidth:'auto' as any } },
      ...tblStyles,
      didParseCell(d) {
        if (d.section==='body' && d.row.index===3) { d.cell.styles.fontStyle='bold'; d.cell.styles.fillColor=[239,246,255]; }
        if (d.section==='body' && d.column.index===0 && d.row.index<3) d.cell.styles.textColor=resultColor(d.cell.raw as string);
      },
    });

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 2 — All Training Records
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    doc.setFillColor(30,58,138); doc.rect(0,0,pw,14,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(reportTitle, 14, 10);
    sectionHeader('ALL TRAINING RECORDS', 16);

    autoTable(doc, {
      startY: 27,
      head:[['#','Employee','Designation','Department','Training Name','Type','Mode','Trainer','Date','Duration','Result']],
      body: sorted.map((r,i) => [
        i+1, r.emp.name, r.emp.designation, empDept(r.emp),
        r.name, r.type||'—', r.mode||'—', r.trainer||'—',
        fmtDate(r.date), r.duration||'—', r.result||'—',
      ]),
      columnStyles:{
        0:{cellWidth:8,  halign:'center'},
        1:{cellWidth:32}, 2:{cellWidth:28}, 3:{cellWidth:24},
        4:{cellWidth:40}, 5:{cellWidth:20}, 6:{cellWidth:18},
        7:{cellWidth:28}, 8:{cellWidth:22}, 9:{cellWidth:18},
        10:{cellWidth:22},
      },
      ...tblStyles,
      didParseCell(d) {
        if (d.section==='body' && d.column.index===10)
          d.cell.styles.textColor = resultColor(d.cell.raw as string);
      },
    });

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 3 — Training-wise Consolidated
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    doc.setFillColor(30,58,138); doc.rect(0,0,pw,14,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(reportTitle, 14, 10);
    sectionHeader('TRAINING-WISE CONSOLIDATED ATTENDANCE', 16);

    autoTable(doc, {
      startY: 27,
      head:[['#','Training Name','Type','Trainer','Date','Duration','Total Emp.','Completed','In Progress','Not Attended','Attendance %']],
      body: byTraining.map((g,i) => {
        const c  = g.records.filter(r=>classify(r.result)==='completed').length;
        const ip = g.records.filter(r=>classify(r.result)==='inprogress').length;
        const na = g.records.filter(r=>classify(r.result)==='notattended').length;
        const pct= g.records.length?Math.round(c/g.records.length*100):0;
        return [i+1, g.name, g.type||'—', g.trainer||'—', fmtDate(g.date), g.duration||'—', g.records.length, c, ip, na, `${pct}%`];
      }),
      columnStyles:{
        0:{cellWidth:8,  halign:'center'},
        1:{cellWidth:50},2:{cellWidth:22},3:{cellWidth:30},
        4:{cellWidth:22},5:{cellWidth:18},6:{cellWidth:18,halign:'center'},
        7:{cellWidth:18,halign:'center'},8:{cellWidth:18,halign:'center'},
        9:{cellWidth:22,halign:'center'},10:{cellWidth:20,halign:'center'},
      },
      ...tblStyles,
      didParseCell(d) {
        if (d.section==='body' && d.column.index===10) {
          const pct=parseInt((d.cell.raw as string)||'0');
          d.cell.styles.textColor = pct>=80?[22,163,74]:pct>=50?[217,119,6]:[220,38,38];
          d.cell.styles.fontStyle='bold';
        }
        if (d.section==='body' && d.column.index===7) d.cell.styles.textColor=[22,163,74];
        if (d.section==='body' && d.column.index===8) d.cell.styles.textColor=[217,119,6];
        if (d.section==='body' && d.column.index===9) d.cell.styles.textColor=[220,38,38];
      },
    });

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 4 — Employee Training History
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    doc.setFillColor(30,58,138); doc.rect(0,0,pw,14,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(reportTitle, 14, 10);
    sectionHeader('EMPLOYEE TRAINING HISTORY SUMMARY', 16);

    autoTable(doc, {
      startY: 27,
      head:[['#','Employee Name','Department','Designation','Total','Completed','In Progress','Not Attended','Attendance %','Last Training','Status']],
      body: byEmployee.map((d,i) => [
        i+1, d.emp.name, empDept(d.emp), d.emp.designation,
        d.total, d.completed, d.inProg, d.notAtt,
        `${d.attPct}%`, fmtDate(d.lastDate)||'—',
        d.attPct>=80?'On Track':d.attPct>=50?'Needs Attention':'Low Completion',
      ]),
      columnStyles:{
        0:{cellWidth:8,halign:'center'},
        1:{cellWidth:36},2:{cellWidth:28},3:{cellWidth:30},
        4:{cellWidth:14,halign:'center'},5:{cellWidth:18,halign:'center'},
        6:{cellWidth:18,halign:'center'},7:{cellWidth:22,halign:'center'},
        8:{cellWidth:20,halign:'center'},9:{cellWidth:24},10:{cellWidth:26},
      },
      ...tblStyles,
      didParseCell(d) {
        if (d.section==='body' && d.column.index===8) {
          const pct=parseInt((d.cell.raw as string)||'0');
          d.cell.styles.textColor=pct>=80?[22,163,74]:pct>=50?[217,119,6]:[220,38,38];
          d.cell.styles.fontStyle='bold';
        }
        if (d.section==='body' && d.column.index===10) {
          const v=d.cell.raw as string;
          d.cell.styles.textColor=v==='On Track'?[22,163,74]:v==='Needs Attention'?[217,119,6]:[220,38,38];
          d.cell.styles.fontStyle='bold';
        }
        if (d.section==='body' && d.column.index===5) d.cell.styles.textColor=[22,163,74];
        if (d.section==='body' && d.column.index===6) d.cell.styles.textColor=[217,119,6];
        if (d.section==='body' && d.column.index===7) d.cell.styles.textColor=[220,38,38];
      },
    });

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 5 — Pending Training
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    doc.setFillColor(30,58,138); doc.rect(0,0,pw,14,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(reportTitle, 14, 10);
    sectionHeader('IN-PROGRESS TRAININGS', 16);

    if (pendingRecords.length > 0) {
      autoTable(doc, {
        startY: 27,
        head:[['#','Employee','Department','Designation','Training Name','Type','Trainer','Date Started','Duration']],
        body: pendingRecords.map((r,i)=>[
          i+1, r.emp.name, empDept(r.emp), r.emp.designation,
          r.name, r.type||'—', r.trainer||'—', fmtDate(r.date), r.duration||'—',
        ]),
        columnStyles:{
          0:{cellWidth:8,halign:'center'},1:{cellWidth:34},2:{cellWidth:26},
          3:{cellWidth:28},4:{cellWidth:44},5:{cellWidth:20},
          6:{cellWidth:28},7:{cellWidth:22},8:{cellWidth:18},
        },
        ...tblStyles,
      });
    } else {
      (doc as any).setFontSize(9); doc.setTextColor(22,163,74);
      doc.text('✓  No in-progress trainings — all trainings are completed or scheduled.', 14, 34);
    }

    // Employees with no training
    const noTrainY = (doc as any).lastAutoTable?.finalY ?? 34;
    sectionHeader('EMPLOYEES WITH NO TRAINING RECORDS', noTrainY + 10);
    if (noTrainingEmps.length > 0) {
      autoTable(doc, {
        startY: noTrainY + 21,
        head:[['#','Employee Name','Department','Designation','Employee ID','Status']],
        body: noTrainingEmps.map((e,i)=>[i+1, e.name, empDept(e), e.designation, e.id, 'No Training Assigned']),
        columnStyles:{
          0:{cellWidth:10,halign:'center'},1:{cellWidth:50},2:{cellWidth:38},
          3:{cellWidth:40},4:{cellWidth:30},5:{cellWidth:50},
        },
        ...tblStyles,
        didParseCell(d) {
          if (d.section==='body' && d.column.index===5)
            d.cell.styles.textColor=[220,38,38];
        },
      });
    } else {
      const ny2 = noTrainY + 20;
      doc.setFontSize(9); doc.setTextColor(22,163,74);
      doc.text('✓  All active employees have at least one training record.', 14, ny2 + 8);
    }

    // ── Footer on every page ───────────────────────────────────────────────
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let i=1; i<=totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(245,248,252); doc.rect(0,ph-8,pw,8,'F');
      doc.setDrawColor(226,232,240); doc.setLineWidth(0.3); doc.line(0,ph-8,pw,ph-8);
      doc.setTextColor(100,116,139); doc.setFontSize(6.5); doc.setFont('helvetica','normal');
      doc.text(`GT-E&I Maintenance Management System  |  ${reportTitle}`, 14, ph-3);
      doc.text(`Page ${i} of ${totalPages}`, pw-14, ph-3, { align:'right' });
    }

    doc.save(fileName);
  };

  // ─── Sub-components ───────────────────────────────────────────────────────
  const SortTh = ({ col, label, width }: { col:SortKey; label:string; width:number }) => (
    <th onClick={() => sortToggle(col)} style={{
      padding:'10px 10px', background:C.primary, color:'#fff', fontSize:10, fontWeight:700,
      textTransform:'uppercase', letterSpacing:0.5, whiteSpace:'nowrap', cursor:'pointer',
      userSelect:'none', width:width, borderRight:'1px solid rgba(255,255,255,0.08)',
      position:'sticky', top:0, zIndex:2, overflow:'hidden',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        {label}
        {sortKey===col ? (sortDir==='asc'?<ArrowUp size={11}/>:<ArrowDown size={11}/>) : <ArrowUpDown size={11} style={{ opacity:0.35 }}/>}
      </div>
    </th>
  );

  const ResultBadge = ({ val }: { val?: string }) => {
    const st = classify(val);
    const cfg =
      st==='completed'   ? { bg:C.successBg, color:C.success, label:val||'—'  }:
      st==='inprogress'  ? { bg:C.warningBg, color:C.warning, label:val||'—'  }:
      { bg:C.dangerBg,   color:C.danger,  label:val||'Not Attended' };
    return (
      <span style={{ fontSize:11, fontWeight:700, background:cfg.bg, color:cfg.color,
        border:`1px solid ${cfg.color}30`, padding:'2px 9px', borderRadius:20, whiteSpace:'nowrap' }}>
        {cfg.label}
      </span>
    );
  };

  const Avatar = ({ name, size=28 }: { name:string; size?:number }) => (
    <div style={{ width:size, height:size, borderRadius:'50%', background:`linear-gradient(135deg,${C.secondary},${C.primary})`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size*0.35, fontWeight:700, color:'#fff', flexShrink:0 }}>
      {name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
    </div>
  );

  const ProgressBar = ({ pct, color=C.secondary }: { pct:number; color?:string }) => (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:6, background:'#E2E8F0', borderRadius:3, overflow:'hidden', minWidth:60 }}>
        <div style={{ width:`${pct}%`, height:'100%', background: pct>=80?C.success:pct>=50?C.warning:C.danger, borderRadius:3, transition:'width 0.5s' }}/>
      </div>
      <span style={{ fontSize:12, fontWeight:700, minWidth:36, color:pct>=80?C.success:pct>=50?C.warning:C.danger }}>{pct}%</span>
    </div>
  );

  // ─── Tab button ───────────────────────────────────────────────────────────
  const TabBtn = ({ id, label, badge }: { id:TabType; label:string; badge?:number }) => (
    <button onClick={() => setTab(id)} style={{
      display:'flex', alignItems:'center', gap:6, padding:'9px 20px',
      borderRadius:0, border:'none', borderBottom:`3px solid ${tab===id?C.secondary:'transparent'}`,
      background:'transparent', color:tab===id?C.secondary:C.textMuted,
      fontSize:13, fontWeight:tab===id?700:500, cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.2s',
    }}>
      {label}
      {badge !== undefined && (
        <span style={{ background:tab===id?C.secondary:'#E2E8F0', color:tab===id?'#fff':C.textMuted,
          fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:20, minWidth:22, textAlign:'center' }}>
          {badge}
        </span>
      )}
    </button>
  );

  // ─── Filter select ────────────────────────────────────────────────────────
  const FSelect = ({ val, set, opts, w=130 }: { val:string; set:(v:string)=>void; opts:[string,string][]; w?:number }) => (
    <select value={val} onChange={e=>{set(e.target.value);setPage(1);}} style={{
      height:34, padding:'0 10px', border:`1.5px solid ${C.border}`, borderRadius:6,
      fontSize:13, color:C.textMed, background:'#fff', outline:'none', cursor:'pointer', width:w,
    }}>
      {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  const inp: React.CSSProperties = {
    width:'100%', boxSizing:'border-box', height:34, padding:'0 10px',
    border:`1.5px solid ${C.border}`, borderRadius:6, fontSize:13,
    color:C.textMed, background:'#fff', outline:'none',
  };
  const lbl: React.CSSProperties = {
    fontSize:11, fontWeight:700, color:C.textMuted, display:'block',
    marginBottom:4, textTransform:'uppercase', letterSpacing:0.5,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ background:C.bg, minHeight:'calc(100vh - 60px)', margin:'-20px -24px', padding:'0 0 40px' }}>
      <style>{PRINT_CSS}</style>

      {/* ── Page Header ── */}
      <div className="no-print" style={{
        background:`linear-gradient(135deg,${C.primary},${C.secondary})`,
        padding:'20px 5vw', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:46, height:46, borderRadius:12, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <GraduationCap size={24} color="#fff"/>
          </div>
          <div>
            <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:'#fff', letterSpacing:-0.3 }}>Training Management</h2>
            <p style={{ margin:0, fontSize:12, color:'rgba(255,255,255,0.75)' }}>HR Training Records &amp; Analytics Dashboard</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={exportExcel} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:6, border:'1.5px solid rgba(255,255,255,0.35)', background:'rgba(255,255,255,0.12)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            <FileSpreadsheet size={14}/> Excel
          </button>
          <button onClick={exportPDF} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:6, border:'1.5px solid rgba(255,255,255,0.35)', background:'rgba(255,255,255,0.12)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            <Download size={14}/> PDF
          </button>
          <button onClick={() => window.print()} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:6, border:'1.5px solid rgba(255,255,255,0.35)', background:'rgba(255,255,255,0.12)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            <Printer size={14}/> Print
          </button>
          <button onClick={() => setShowAdd(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:6, border:'none', background:'#fff', color:C.primary, fontSize:13, fontWeight:700, cursor:'pointer' }}>
            <Plus size={14}/> Add Training
          </button>
        </div>
      </div>

      <div style={{ padding:'20px 5vw' }}>

        {/* ── KPI Cards ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:14, marginBottom:20 }}>
          {[
            { label:'Total Sessions',       value:stats.total,       icon:<GraduationCap size={18}/>, color:C.secondary,  bg:'#EFF6FF', border:'#BFDBFE' },
            { label:'Internal',             value:stats.internal,    icon:<BookOpen size={18}/>,      color:'#0891B2',    bg:C.infoBg,  border:'#A5F3FC' },
            { label:'External',             value:stats.external,    icon:<Award size={18}/>,         color:C.purple,     bg:C.purpleBg,border:'#C4B5FD' },
            { label:'Completed',            value:stats.completed,   icon:<CheckCircle size={18}/>,   color:C.success,    bg:C.successBg,border:'#86EFAC' },
            { label:'In Progress',          value:stats.inProgress,  icon:<Clock size={18}/>,         color:C.warning,    bg:C.warningBg,border:'#FCD34D' },
            { label:'Not Attended',         value:stats.notAttended, icon:<UserX size={18}/>,         color:C.danger,     bg:C.dangerBg, border:'#FCA5A5' },
            { label:'Pass Rate',            value:`${stats.passRate}%`,icon:<Target size={18}/>,      color:'#0F766E',    bg:'#CCFBF1',  border:'#5EEAD4' },
            { label:'Employees Trained',    value:stats.uniqueEmps,  icon:<Users size={18}/>,         color:'#7C3AED',    bg:C.purpleBg, border:'#C4B5FD' },
          ].map(c => (
            <div key={c.label} className="print-card" style={{
              background:c.bg, border:`1.5px solid ${c.border}`, borderRadius:10,
              padding:'14px 16px', boxShadow:C.shadow,
              transition:'transform 0.2s,box-shadow 0.2s', cursor:'default',
            }}
            onMouseEnter={e=>{(e.currentTarget as any).style.transform='translateY(-2px)';(e.currentTarget as any).style.boxShadow=C.shadowMd;}}
            onMouseLeave={e=>{(e.currentTarget as any).style.transform='none';(e.currentTarget as any).style.boxShadow=C.shadow;}}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ color:c.color, opacity:0.85 }}>{c.icon}</div>
                <div style={{ fontSize:11, fontWeight:600, color:c.color }}>&nbsp;</div>
              </div>
              <div style={{ fontSize:28, fontWeight:800, color:c.color, lineHeight:1 }}>{c.value}</div>
              <div style={{ fontSize:11, fontWeight:600, color:c.color, marginTop:4, opacity:0.85 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="no-print" style={{ background:'#fff', borderRadius:10, border:`1px solid ${C.border}`, padding:'14px 18px', marginBottom:16, boxShadow:C.shadow }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <div style={{ position:'relative', flex:'1 1 200px' }}>
              <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:C.textMuted }}/>
              <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
                placeholder="Search employee, training, trainer…"
                style={{ ...inp, paddingLeft:32 }} />
            </div>
            <FSelect val={fYear}    set={v=>{setFYear(v);setFMonth('all');}}
              opts={[['all','All Years'],...years.map(y=>[y,y] as [string,string])]} w={115} />
            <FSelect val={fMonth}   set={setFMonth}
              opts={[['all','All Months'],...MONTHS_FULL.map((m,i)=>[String(i+1),m] as [string,string])]}
              w={130} />
            <FSelect val={fDept}    set={setFDept}
              opts={[['all','All Depts'],...depts.map(d=>[d,d] as [string,string])]} w={130} />
            <FSelect val={fType}    set={setFType}
              opts={[['all','All Types'],...types.map(t=>[t,t] as [string,string])]} w={125} />
            <FSelect val={fTrainer} set={setFTrainer}
              opts={[['all','All Trainers'],...trainers.map(t=>[t,t] as [string,string])]} w={145} />
            <FSelect val={fResult}  set={setFResult}
              opts={[['all','All Results'],...resultOpts.map(r=>[r,r] as [string,string])]} w={130} />
            <button onClick={resetFilters} style={{ display:'flex', alignItems:'center', gap:5, height:34, padding:'0 12px', border:`1.5px solid ${C.border}`, borderRadius:6, background:'#fff', color:C.textMuted, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              <RefreshCw size={13}/> Reset
            </button>
          </div>
          <div style={{ fontSize:12, color:C.textMuted, marginTop:8 }}>
            Showing <strong style={{ color:C.primary }}>{filtered.length}</strong> of {allRecords.length} records
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="no-print" style={{ background:'#fff', borderRadius:'10px 10px 0 0', border:`1px solid ${C.border}`, borderBottom:'none', display:'flex', overflowX:'auto', boxShadow:C.shadow }}>
          <TabBtn id="overview"    label="Overview"           />
          <TabBtn id="records"     label="All Records"        badge={filtered.length} />
          <TabBtn id="by-training" label="Training-wise"      badge={byTraining.length} />
          <TabBtn id="by-employee" label="Employee History"   badge={byEmployee.length} />
          <TabBtn id="pending"     label="Pending Training"   badge={pendingRecords.length + noTrainingEmps.length} />
        </div>

        <div style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:'0 0 10px 10px', boxShadow:C.shadow, overflow:'hidden' }}>

          {/* ══ OVERVIEW TAB ══════════════════════════════════════════════════ */}
          {tab === 'overview' && (
            <div style={{ padding:24 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>

                {/* Status Pie */}
                <div style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:20 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.textDark, marginBottom:16 }}>Training Status Distribution</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="45%" innerRadius={56} outerRadius={88} dataKey="value" nameKey="name" paddingAngle={3}>
                        {pieData.map(e => <Cell key={e.name} fill={e.color}/>)}
                      </Pie>
                      <Tooltip contentStyle={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:8, fontSize:12 }}/>
                      <Legend iconType="circle" iconSize={10} formatter={v=><span style={{ color:C.textMed, fontSize:12 }}>{v}</span>}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Training Type Bar */}
                <div style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:20 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.textDark, marginBottom:16 }}>Training Type Breakdown</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={typeBarData} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                      <XAxis dataKey="name" tick={{ fontSize:11, fill:C.textMuted }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fontSize:11, fill:C.textMuted }} axisLine={false} tickLine={false} allowDecimals={false}/>
                      <Tooltip contentStyle={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:8, fontSize:12 }}/>
                      <Bar dataKey="internal" name="Internal" fill={C.secondary} radius={[3,3,0,0]}/>
                      <Bar dataKey="external" name="External" fill={C.purple}    radius={[3,3,0,0]}/>
                      <Legend iconType="circle" iconSize={10}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Monthly Trend */}
                <div style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:20 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.textDark, marginBottom:16 }}>
                    Monthly Training Trend — {fYear !== 'all' ? fYear : new Date().getFullYear()}
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                      <XAxis dataKey="month" tick={{ fontSize:11, fill:C.textMuted }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fontSize:11, fill:C.textMuted }} axisLine={false} tickLine={false} allowDecimals={false}/>
                      <Tooltip contentStyle={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:8, fontSize:12 }}/>
                      <Line type="monotone" dataKey="sessions" name="Sessions" stroke={C.secondary} strokeWidth={2.5} dot={{ fill:C.secondary, r:4 }}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Department-wise */}
                <div style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:20 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.textDark, marginBottom:16 }}>Department-wise Completion %</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={deptData} layout="vertical" barSize={16}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false}/>
                      <XAxis type="number" domain={[0,100]} tick={{ fontSize:11, fill:C.textMuted }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                      <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:C.textMuted }} axisLine={false} tickLine={false} width={90}/>
                      <Tooltip formatter={(v:any) => `${v}%`} contentStyle={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:8, fontSize:12 }}/>
                      <Bar dataKey="pct" name="Completion %" fill={C.success} radius={[0,3,3,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ══ RECORDS TAB ═══════════════════════════════════════════════════ */}
          {tab === 'records' && (
            <div>
              <div style={{ overflowX:'auto', width:'100%' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1100, tableLayout:'fixed' }}>
                  <colgroup>
                    <col style={{ width:190 }}/>
                    <col style={{ width:150 }}/>
                    <col style={{ width:200 }}/>
                    <col style={{ width:105 }}/>
                    <col style={{ width:95 }}/>
                    <col style={{ width:160 }}/>
                    <col style={{ width:115 }}/>
                    <col style={{ width:90 }}/>
                    <col style={{ width:120 }}/>
                    <col style={{ width:80 }}/>
                  </colgroup>
                  <thead>
                    <tr>
                      <SortTh col="empName"    label="Employee"       width={190}/>
                      <SortTh col="designation"label="Designation"    width={150}/>
                      <SortTh col="name"       label="Training Name"  width={200}/>
                      <SortTh col="type"       label="Type"           width={105}/>
                      <SortTh col="mode"       label="Mode"           width={95}/>
                      <SortTh col="trainer"    label="Trainer"        width={160}/>
                      <SortTh col="date"       label="Date"           width={115}/>
                      <SortTh col="duration"   label="Duration"       width={90}/>
                      <SortTh col="result"     label="Result"         width={120}/>
                      <th style={{ padding:'11px 10px', background:C.primary, color:'#fff', fontSize:11, fontWeight:700, whiteSpace:'nowrap', position:'sticky', top:0, zIndex:2, width:80, textAlign:'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((r,i) => (
                      <tr key={`${r.emp.id}-${r.id}-${i}`}
                        style={{ background:i%2===0?'#fff':C.rowAlt, borderBottom:`1px solid ${C.border}40` }}
                        onMouseEnter={e=>(e.currentTarget.style.background=C.rowHover)}
                        onMouseLeave={e=>(e.currentTarget.style.background=i%2===0?'#fff':C.rowAlt)}>
                        <td style={{ padding:'10px 10px', overflow:'hidden' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                            <Avatar name={r.emp.name}/>
                            <div style={{ minWidth:0, flex:1 }}>
                              <div style={{ fontSize:12, fontWeight:600, color:C.textDark, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.emp.name}>{r.emp.name}</div>
                              <div style={{ fontSize:10, color:C.textMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{empDept(r.emp)}</div>
                            </div>
                            <button onClick={() => navigate(`/employees/${r.emp.id}`)} title="Open profile"
                              style={{ background:'none', border:'none', color:C.textMuted, cursor:'pointer', padding:2, flexShrink:0 }}>
                              <ExternalLink size={10}/>
                            </button>
                          </div>
                        </td>
                        <Td w={150}>{r.emp.designation}</Td>
                        <Td w={200} bold title={r.name}>{r.name}</Td>
                        <td style={{ padding:'10px 10px', overflow:'hidden', whiteSpace:'nowrap' }}>
                          <span style={{ fontSize:10, fontWeight:700, color:'#fff', background:typeColorMap(r.type),
                            padding:'2px 7px', borderRadius:20 }}>{r.type||'—'}</span>
                        </td>
                        <td style={{ padding:'10px 10px', overflow:'hidden', whiteSpace:'nowrap' }}>
                          <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20,
                            background:r.mode==='Internal'?'#DBEAFE':'#F3E8FF',
                            color:r.mode==='Internal'?'#1D4ED8':'#6D28D9' }}>{r.mode||'—'}</span>
                        </td>
                        <Td w={160}>{r.trainer||'—'}</Td>
                        <Td w={115} mono>{fmtDate(r.date)}</Td>
                        <Td w={90}>{r.duration||'—'}</Td>
                        <td style={{ padding:'10px 10px', overflow:'hidden', whiteSpace:'nowrap' }}>
                          <ResultBadge val={r.result}/>
                        </td>
                        <td style={{ padding:'8px 6px', textAlign:'center' }}>
                          <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                            <button onClick={() => openEdit(r)} title="Edit"
                              style={{ background:'none', border:`1px solid ${C.secondary}40`, borderRadius:5,
                                color:C.secondary, cursor:'pointer', padding:'3px 5px', display:'flex', alignItems:'center' }}>
                              <Pencil size={11}/>
                            </button>
                            <button onClick={() => setDeleteTarget(r)} title="Delete"
                              style={{ background:'none', border:`1px solid ${C.danger}40`, borderRadius:5,
                                color:C.danger, cursor:'pointer', padding:'3px 5px', display:'flex', alignItems:'center' }}>
                              <Trash2 size={11}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {paginated.length > 0 && (
                    <tfoot>
                      <tr style={{ background:'#EFF6FF', borderTop:`2px solid ${C.secondary}` }}>
                        <td colSpan={2} style={{ padding:'10px 14px', fontWeight:700, color:C.primary, fontSize:12 }}>
                          TOTAL — {sorted.length} records
                        </td>
                        <td colSpan={4} style={{ padding:'10px 14px', fontSize:12, color:C.textMuted }}>
                          {stats.internal} Internal · {stats.external} External
                        </td>
                        <td colSpan={3} style={{ padding:'10px 14px', textAlign:'right', fontWeight:700, color:C.secondary, fontSize:13 }}>
                          Pass Rate: {stats.passRate}%
                        </td>
                        <td/>
                      </tr>
                    </tfoot>
                  )}
                </table>
                {sorted.length === 0 && (
                  <div style={{ textAlign:'center', padding:'50px 20px', color:C.textMuted }}>
                    <GraduationCap size={40} style={{ marginBottom:12, opacity:0.2 }}/>
                    <div style={{ fontSize:14, fontWeight:600 }}>No records found</div>
                    <div style={{ fontSize:12, marginTop:4 }}>{allRecords.length === 0 ? 'Add your first training record' : 'Try adjusting the filters'}</div>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="no-print" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', borderTop:`1px solid ${C.border}`, background:'#FAFCFF' }}>
                  <span style={{ fontSize:12, color:C.textMuted }}>
                    Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, sorted.length)} of {sorted.length}
                  </span>
                  <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                    <PgBtn disabled={page===1} onClick={()=>setPage(1)}>«</PgBtn>
                    <PgBtn disabled={page===1} onClick={()=>setPage(p=>p-1)}>‹ Prev</PgBtn>
                    {Array.from({length:Math.min(totalPages,7)},(_,i)=>{
                      let p=i+1;
                      if(totalPages>7){
                        if(page<=4) p=i+1;
                        else if(page>=totalPages-3) p=totalPages-6+i;
                        else p=page-3+i;
                      }
                      return (
                        <PgBtn key={p} active={page===p} onClick={()=>setPage(p)}>{p}</PgBtn>
                      );
                    })}
                    <PgBtn disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>Next ›</PgBtn>
                    <PgBtn disabled={page===totalPages} onClick={()=>setPage(totalPages)}>»</PgBtn>
                  </div>
                  <span style={{ fontSize:12, color:C.textMuted }}>Page {page} of {totalPages}</span>
                </div>
              )}
            </div>
          )}

          {/* ══ BY-TRAINING TAB ═══════════════════════════════════════════════ */}
          {tab === 'by-training' && (
            <div style={{ padding:24 }}>
              <div style={{ fontSize:16, fontWeight:700, color:C.textDark, marginBottom:18, borderBottom:`2px solid ${C.secondary}`, paddingBottom:10 }}>
                Training-wise Consolidated Attendance
              </div>
              {byTraining.length === 0 && (
                <div style={{ textAlign:'center', padding:'40px 0', color:C.textMuted }}>
                  <GraduationCap size={40} style={{ opacity:0.2, marginBottom:10 }}/>
                  <div style={{ fontSize:14 }}>No records match current filters</div>
                </div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {byTraining.map(g => {
                  const completed  = g.records.filter(r => classify(r.result)==='completed');
                  const inProg     = g.records.filter(r => classify(r.result)==='inprogress');
                  const notAtt     = g.records.filter(r => classify(r.result)==='notattended');
                  const attPct     = g.records.length ? Math.round(completed.length/g.records.length*100) : 0;
                  const isOpen     = expandedSet.has(g.name);
                  return (
                    <div key={g.name} style={{ border:`1.5px solid ${C.border}`, borderRadius:10, overflow:'hidden', boxShadow:C.shadow }}>
                      {/* Card header */}
                      <div onClick={() => toggleExpand(g.name)}
                        style={{ padding:'14px 18px', cursor:'pointer', background: isOpen?'#EFF6FF':'#fff',
                          borderBottom: isOpen?`1px solid ${C.border}`:'none', display:'flex', alignItems:'flex-start', gap:14, transition:'background 0.2s' }}>
                        <div style={{ color:C.secondary, flexShrink:0, marginTop:2 }}>
                          {isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
                            <span style={{ fontSize:15, fontWeight:700, color:C.textDark }}>{g.name}</span>
                            <span style={{ fontSize:11, fontWeight:700, color:'#fff', background:typeColorMap(g.type), padding:'2px 9px', borderRadius:20 }}>{g.type||'—'}</span>
                          </div>
                          <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:12, color:C.textMuted }}>
                            {g.trainer && <span>👤 Trainer: <strong style={{ color:C.textMed }}>{g.trainer}</strong></span>}
                            {g.date && <span>📅 Date: <strong style={{ color:C.textMed }}>{fmtDate(g.date)}</strong></span>}
                            {g.duration && <span>⏱ Duration: <strong style={{ color:C.textMed }}>{g.duration}</strong></span>}
                          </div>
                        </div>
                        {/* Stats pills */}
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', flexShrink:0 }}>
                          <StatPill label="Total"       val={g.records.length}  color={C.textMed}   bg='#F1F5F9' />
                          <StatPill label="Attended"    val={completed.length}  color={C.success}   bg={C.successBg} />
                          <StatPill label="In Progress" val={inProg.length}     color={C.warning}   bg={C.warningBg} />
                          <StatPill label="Not Attended"val={notAtt.length}     color={C.danger}    bg={C.dangerBg} />
                        </div>
                        {/* Progress */}
                        <div style={{ width:110, flexShrink:0 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:11 }}>
                            <span style={{ color:C.textMuted }}>Attendance</span>
                            <span style={{ fontWeight:700, color:attPct>=80?C.success:attPct>=50?C.warning:C.danger }}>{attPct}%</span>
                          </div>
                          <div style={{ height:6, background:'#E2E8F0', borderRadius:3, overflow:'hidden' }}>
                            <div style={{ width:`${attPct}%`, height:'100%', background:attPct>=80?C.success:attPct>=50?C.warning:C.danger, borderRadius:3 }}/>
                          </div>
                        </div>
                      </div>

                      {/* Expanded employee lists */}
                      {isOpen && (
                        <div style={{ padding:'16px 20px', background:'#FAFCFF', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16 }}>
                          {completed.length > 0 && (
                            <EmpList title="✓ Employees Attended" color={C.success} bg={C.successBg} employees={completed.map(r=>r.emp)} onNavigate={id=>navigate(`/employees/${id}`)}/>
                          )}
                          {inProg.length > 0 && (
                            <EmpList title="⏳ In Progress" color={C.warning} bg={C.warningBg} employees={inProg.map(r=>r.emp)} onNavigate={id=>navigate(`/employees/${id}`)}/>
                          )}
                          {notAtt.length > 0 && (
                            <EmpList title="✗ Not Attended" color={C.danger} bg={C.dangerBg} employees={notAtt.map(r=>r.emp)} onNavigate={id=>navigate(`/employees/${id}`)}/>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ BY-EMPLOYEE TAB ═══════════════════════════════════════════════ */}
          {tab === 'by-employee' && (
            <div>
              <div style={{ padding:'18px 20px', borderBottom:`1px solid ${C.border}`, fontSize:16, fontWeight:700, color:C.textDark }}>
                Employee Training History
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
                  <thead>
                    <tr style={{ background:C.primary }}>
                      {['Employee','Department','Designation','Total','Completed','In Progress','Not Attended','Attendance %','Last Training','Status'].map(h => (
                        <th key={h} style={{ padding:'11px 14px', color:'#fff', fontSize:11, fontWeight:700,
                          textTransform:'uppercase', letterSpacing:0.7, whiteSpace:'nowrap', textAlign:'left',
                          borderRight:'1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {byEmployee.map((d,i) => (
                      <tr key={d.emp.id} style={{ background:i%2===0?'#fff':C.rowAlt, borderBottom:`1px solid ${C.border}40` }}
                        onMouseEnter={e=>(e.currentTarget.style.background=C.rowHover)}
                        onMouseLeave={e=>(e.currentTarget.style.background=i%2===0?'#fff':C.rowAlt)}>
                        <td style={{ padding:'12px 14px', minWidth:180 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <Avatar name={d.emp.name}/>
                            <span style={{ fontSize:13, fontWeight:600, color:C.textDark }}>{d.emp.name}</span>
                            <button onClick={()=>navigate(`/employees/${d.emp.id}`)}
                              style={{ background:'none', border:'none', color:C.textMuted, cursor:'pointer', padding:2 }}>
                              <ExternalLink size={11}/>
                            </button>
                          </div>
                        </td>
                        <td style={{ padding:'12px 14px', fontSize:12, color:C.textMuted, whiteSpace:'nowrap' }}>{empDept(d.emp)}</td>
                        <td style={{ padding:'12px 14px', fontSize:12, color:C.textMuted, whiteSpace:'nowrap' }}>{d.emp.designation}</td>
                        <td style={{ padding:'12px 14px', fontSize:16, fontWeight:800, color:C.textDark, textAlign:'center' }}>{d.total}</td>
                        <td style={{ padding:'12px 14px', fontSize:14, fontWeight:700, color:C.success, textAlign:'center' }}>{d.completed}</td>
                        <td style={{ padding:'12px 14px', fontSize:14, fontWeight:700, color:C.warning, textAlign:'center' }}>{d.inProg}</td>
                        <td style={{ padding:'12px 14px', fontSize:14, fontWeight:700, color:C.danger,  textAlign:'center' }}>{d.notAtt}</td>
                        <td style={{ padding:'12px 14px', minWidth:160 }}>
                          <ProgressBar pct={d.attPct}/>
                        </td>
                        <td style={{ padding:'12px 14px', fontSize:12, color:C.textMuted, whiteSpace:'nowrap' }}>{fmtDate(d.lastDate)||'—'}</td>
                        <td style={{ padding:'12px 14px', whiteSpace:'nowrap' }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20,
                            background:d.attPct>=80?C.successBg:d.attPct>=50?C.warningBg:C.dangerBg,
                            color:d.attPct>=80?C.success:d.attPct>=50?C.warning:C.danger }}>
                            {d.attPct>=80?'On Track':d.attPct>=50?'Needs Attention':'Low Completion'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {byEmployee.length === 0 && (
                  <div style={{ textAlign:'center', padding:'40px 0', color:C.textMuted }}>
                    <Users size={40} style={{ opacity:0.2, marginBottom:10 }}/>
                    <div style={{ fontSize:14 }}>No employee training data found</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ PENDING TAB ═══════════════════════════════════════════════════ */}
          {tab === 'pending' && (
            <div style={{ padding:24 }}>

              {/* In-Progress records */}
              <div style={{ marginBottom:28 }}>
                <div style={{ fontSize:15, fontWeight:700, color:C.textDark, marginBottom:14, display:'flex', alignItems:'center', gap:10 }}>
                  <Clock size={18} color={C.warning}/>
                  In-Progress Trainings
                  <span style={{ background:C.warningBg, color:C.warning, fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:20 }}>{pendingRecords.length}</span>
                </div>
                {pendingRecords.length > 0 ? (
                  <div style={{ overflowX:'auto', borderRadius:10, border:`1px solid ${C.border}` }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
                      <thead>
                        <tr style={{ background:'#FEF3C7' }}>
                          {['Employee','Designation','Training Name','Type','Trainer','Date Started','Duration','Actions'].map(h => (
                            <th key={h} style={{ padding:'10px 14px', fontSize:11, fontWeight:700, color:'#92400E',
                              textTransform:'uppercase', letterSpacing:0.6, textAlign: h==='Actions'?'center':'left', borderBottom:`1px solid #FCD34D` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pendingRecords.map((r,i) => (
                          <tr key={`${r.emp.id}-${r.id}`} style={{ background:i%2===0?'#fff':'#FFFBEB', borderBottom:`1px solid ${C.border}30` }}
                            onMouseEnter={e=>(e.currentTarget.style.background='#FEF9C3')}
                            onMouseLeave={e=>(e.currentTarget.style.background=i%2===0?'#fff':'#FFFBEB')}>
                            <td style={{ padding:'11px 14px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <Avatar name={r.emp.name}/>
                                <div>
                                  <div style={{ fontSize:13, fontWeight:600, color:C.textDark }}>{r.emp.name}</div>
                                  <div style={{ fontSize:11, color:C.textMuted }}>{empDept(r.emp)}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding:'11px 14px', fontSize:12, color:C.textMuted, whiteSpace:'nowrap' }}>{r.emp.designation}</td>
                            <td style={{ padding:'11px 14px', fontSize:13, fontWeight:600, color:C.textDark }}>{r.name}</td>
                            <td style={{ padding:'11px 14px', whiteSpace:'nowrap' }}>
                              <span style={{ fontSize:11, fontWeight:700, color:'#fff', background:typeColorMap(r.type), padding:'2px 9px', borderRadius:20 }}>{r.type||'—'}</span>
                            </td>
                            <td style={{ padding:'11px 14px', fontSize:12, color:C.textMuted }}>{r.trainer||'—'}</td>
                            <td style={{ padding:'11px 14px', fontSize:12, color:C.textMuted, whiteSpace:'nowrap' }}>{fmtDate(r.date)}</td>
                            <td style={{ padding:'11px 14px', fontSize:12, color:C.textMuted }}>{r.duration||'—'}</td>
                            <td style={{ padding:'8px 12px', textAlign:'center', whiteSpace:'nowrap' }}>
                              <div style={{ display:'flex', gap:5, justifyContent:'center', alignItems:'center' }}>
                                {/* Mark complete dropdown */}
                                <div style={{ position:'relative', display:'inline-block' }}>
                                  <select
                                    onChange={e => { if(e.target.value) markComplete(r, e.target.value); e.target.value=''; }}
                                    defaultValue=""
                                    style={{ height:28, padding:'0 6px', border:`1.5px solid ${C.success}`, borderRadius:6,
                                      background:C.successBg, color:C.success, fontSize:11, fontWeight:700, cursor:'pointer', outline:'none' }}>
                                    <option value="" disabled>✓ Mark As…</option>
                                    <option value="Pass">Pass</option>
                                    <option value="Attended">Attended</option>
                                    <option value="Fail">Fail</option>
                                    <option value="Not Attended">Not Attended</option>
                                  </select>
                                </div>
                                <button onClick={() => openEdit(r)} title="Edit"
                                  style={{ background:'none', border:`1px solid ${C.secondary}40`, borderRadius:6,
                                    color:C.secondary, cursor:'pointer', padding:'4px 6px', display:'flex', alignItems:'center' }}>
                                  <Pencil size={12}/>
                                </button>
                                <button onClick={() => setDeleteTarget(r)} title="Delete"
                                  style={{ background:'none', border:`1px solid ${C.danger}40`, borderRadius:6,
                                    color:C.danger, cursor:'pointer', padding:'4px 6px', display:'flex', alignItems:'center' }}>
                                  <Trash2 size={12}/>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ background:C.successBg, border:`1px solid #86EFAC`, borderRadius:10, padding:'18px 20px', display:'flex', alignItems:'center', gap:10 }}>
                    <CheckCircle size={20} color={C.success}/>
                    <span style={{ fontSize:14, fontWeight:600, color:C.success }}>No in-progress trainings — all up to date!</span>
                  </div>
                )}
              </div>

              {/* No training assigned */}
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:C.textDark, marginBottom:14, display:'flex', alignItems:'center', gap:10 }}>
                  <UserX size={18} color={C.danger}/>
                  Employees with No Training Records
                  <span style={{ background:C.dangerBg, color:C.danger, fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:20 }}>{noTrainingEmps.length}</span>
                </div>
                {noTrainingEmps.length > 0 ? (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
                    {noTrainingEmps.map(e => (
                      <div key={e.id} style={{ background:'#fff', border:`1.5px solid ${C.dangerBg}`, borderRadius:10, padding:'12px 16px', boxShadow:C.shadow, display:'flex', alignItems:'center', gap:12 }}>
                        <Avatar name={e.name} size={34}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:C.textDark, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.name}</div>
                          <div style={{ fontSize:11, color:C.textMuted }}>{e.designation}</div>
                          <div style={{ fontSize:11, color:C.textMuted }}>{empDept(e)}</div>
                        </div>
                        <span style={{ fontSize:10, fontWeight:700, background:C.dangerBg, color:C.danger, padding:'2px 8px', borderRadius:10, flexShrink:0 }}>No Training</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ background:C.successBg, border:`1px solid #86EFAC`, borderRadius:10, padding:'18px 20px', display:'flex', alignItems:'center', gap:10 }}>
                    <UserCheck size={20} color={C.success}/>
                    <span style={{ fontSize:14, fontWeight:600, color:C.success }}>All active employees have at least one training record!</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Edit Modal ───────────────────────────────────────────────────── */}
      {editTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(4px)', zIndex:50,
          display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={()=>setEditTarget(null)}>
          <div style={{ background:'#fff', borderRadius:14, border:`1px solid ${C.border}`, maxWidth:620, width:'100%',
            maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'16px 22px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', background:`linear-gradient(135deg,#0F766E,#0891B2)`, borderRadius:'14px 14px 0 0' }}>
              <div style={{ fontSize:16, fontWeight:700, color:'#fff', display:'flex', alignItems:'center', gap:8 }}>
                <Pencil size={16} color="rgba(255,255,255,0.8)"/> Edit Training Record
              </div>
              <button onClick={()=>setEditTarget(null)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            {/* Employee (read-only) */}
            <div style={{ padding:'14px 22px 0', background:'#F0FDF4', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:12 }}>
              <Avatar name={editTarget.emp.name}/>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:C.textDark }}>{editTarget.emp.name}</div>
                <div style={{ fontSize:12, color:C.textMuted }}>{editTarget.emp.designation} · {empDept(editTarget.emp)}</div>
              </div>
              <span style={{ marginLeft:'auto', fontSize:11, fontWeight:600, background:'#CCFBF1', color:'#0F766E', padding:'3px 10px', borderRadius:20 }}>Editing record</span>
            </div>
            <div style={{ padding:22, display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={lbl}>Training Name *</label>
                <input type="text" style={inp} value={editForm.name} onChange={e=>setEF('name',e.target.value)}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Type</label>
                  <select style={inp} value={editForm.type} onChange={e=>setEF('type',e.target.value)}>
                    {['Safety','Technical','Compliance','Leadership','HSE','Quality','IT'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Mode</label>
                  <select style={inp} value={editForm.mode} onChange={e=>setEF('mode',e.target.value)}>
                    <option>Internal</option><option>External</option>
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Trainer</label>
                  <input type="text" style={inp} value={editForm.trainer} onChange={e=>setEF('trainer',e.target.value)}/>
                </div>
                <div>
                  <label style={lbl}>Date</label>
                  <input type="date" style={inp} value={editForm.date} onChange={e=>setEF('date',e.target.value)}/>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Duration</label>
                  <input type="text" style={inp} value={editForm.duration} onChange={e=>setEF('duration',e.target.value)}/>
                </div>
                <div>
                  <label style={lbl}>Result</label>
                  <select style={inp} value={editForm.result} onChange={e=>setEF('result',e.target.value)}>
                    <option value="">— Select —</option>
                    <option>Pass</option><option>Fail</option><option>Attended</option><option>In Progress</option><option>Not Attended</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Remarks</label>
                <textarea style={{ ...inp, height:60, resize:'vertical', paddingTop:8 } as React.CSSProperties} value={editForm.remarks} onChange={e=>setEF('remarks',e.target.value)}/>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={handleUpdate} style={{ flex:1, padding:'10px 0', background:editForm.name.trim()?'#0F766E':'#CBD5E1', border:'none', borderRadius:8, color:'#fff', fontSize:14, fontWeight:600, cursor:editForm.name.trim()?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <CheckCircle size={14}/> Save Changes
                </button>
                <button onClick={()=>setEditTarget(null)} style={{ padding:'10px 20px', background:'#F1F5F9', border:`1px solid ${C.border}`, borderRadius:8, color:C.textMed, fontSize:13, fontWeight:500, cursor:'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Modal ──────────────────────────────────────────────────── */}
      {deleteTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(4px)', zIndex:50,
          display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={()=>setDeleteTarget(null)}>
          <div style={{ background:'#fff', borderRadius:14, border:`1px solid ${C.border}`, maxWidth:420, width:'100%',
            boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:10, background:C.dangerBg, borderRadius:'14px 14px 0 0' }}>
              <AlertTriangle size={16} color={C.danger}/>
              <span style={{ fontSize:14, fontWeight:700, color:C.danger }}>Delete Training Record</span>
            </div>
            <div style={{ padding:'18px 20px' }}>
              <p style={{ fontSize:13, color:C.textMuted, margin:'0 0 6px' }}>Delete this record for <strong style={{ color:C.textDark }}>{deleteTarget.emp.name}</strong>?</p>
              <p style={{ fontSize:14, fontWeight:700, color:C.textDark, margin:'0 0 4px' }}>{deleteTarget.name}</p>
              <p style={{ fontSize:11, color:C.textMuted, margin:'0 0 20px' }}>{fmtDate(deleteTarget.date)} · {deleteTarget.type} · {deleteTarget.mode}</p>
              <p style={{ fontSize:12, color:C.danger, margin:'0 0 20px' }}>This action cannot be undone.</p>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={confirmDelete} style={{ flex:1, padding:'9px 0', background:C.danger, border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <Trash2 size={13}/> Yes, Delete
                </button>
                <button onClick={()=>setDeleteTarget(null)} style={{ flex:1, padding:'9px 0', background:'#F1F5F9', border:`1px solid ${C.border}`, borderRadius:8, color:C.textMed, fontSize:13, fontWeight:500, cursor:'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Training Modal ────────────────────────────────────────────── */}
      {showAdd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(4px)', zIndex:50,
          display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={()=>{setShowAdd(false);setForm({...BLANK_FORM});}}>
          <div style={{ background:'#fff', borderRadius:14, border:`1px solid ${C.border}`, maxWidth:620, width:'100%',
            maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'16px 22px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', background:`linear-gradient(135deg,${C.primary},${C.secondary})`, borderRadius:'14px 14px 0 0' }}>
              <div style={{ fontSize:16, fontWeight:700, color:'#fff', display:'flex', alignItems:'center', gap:8 }}>
                <GraduationCap size={18} color="rgba(255,255,255,0.8)"/> Add Training Record
              </div>
              <button onClick={()=>{setShowAdd(false);setForm({...BLANK_FORM});}} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:22 }}>×</button>
            </div>
            <div style={{ padding:22, display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={lbl}>Employee *</label>
                <select style={inp} value={form.empId} onChange={e=>setF('empId',e.target.value)}>
                  <option value="">— Select Employee —</option>
                  {activeEmployees.map(e=><option key={e.id} value={e.id}>{e.name} — {e.designation}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Training Name *</label>
                <input type="text" style={inp} placeholder="e.g. LOTO Procedure Training" value={form.name} onChange={e=>setF('name',e.target.value)}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Type</label>
                  <select style={inp} value={form.type} onChange={e=>setF('type',e.target.value)}>
                    {['Safety','Technical','Compliance','Leadership','HSE','Quality','IT'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Mode</label>
                  <select style={inp} value={form.mode} onChange={e=>setF('mode',e.target.value)}>
                    <option>Internal</option><option>External</option>
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Trainer</label>
                  <input type="text" style={inp} placeholder="Trainer name" value={form.trainer} onChange={e=>setF('trainer',e.target.value)}/>
                </div>
                <div>
                  <label style={lbl}>Date</label>
                  <input type="date" style={inp} value={form.date} onChange={e=>setF('date',e.target.value)}/>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Duration</label>
                  <input type="text" style={inp} placeholder="e.g. 4 hours / 2 days" value={form.duration} onChange={e=>setF('duration',e.target.value)}/>
                </div>
                <div>
                  <label style={lbl}>Result</label>
                  <select style={inp} value={form.result} onChange={e=>setF('result',e.target.value)}>
                    <option value="">— Select —</option>
                    <option>Pass</option><option>Fail</option><option>Attended</option><option>In Progress</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Remarks</label>
                <textarea style={{ ...inp, height:60, resize:'vertical', paddingTop:8 } as React.CSSProperties} placeholder="Optional notes…" value={form.remarks} onChange={e=>setF('remarks',e.target.value)}/>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={handleAdd} style={{ flex:1, padding:'10px 0', background: form.empId&&form.name.trim()?C.secondary:'#CBD5E1', border:'none', borderRadius:8, color:'#fff', fontSize:14, fontWeight:600, cursor:form.empId&&form.name.trim()?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'background 0.2s' }}>
                  <Plus size={14}/> Save Training Record
                </button>
                <button onClick={()=>{setShowAdd(false);setForm({...BLANK_FORM});}} style={{ padding:'10px 20px', background:'#F1F5F9', border:`1px solid ${C.border}`, borderRadius:8, color:C.textMed, fontSize:13, fontWeight:500, cursor:'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Training type → colour map ───────────────────────────────────────────────
function typeColorMap(t?: string): string {
  const m: Record<string,string> = {
    Safety:'#EF4444', Technical:'#3B82F6', Compliance:'#F59E0B',
    Leadership:'#8B5CF6', HSE:'#16A34A', Quality:'#0891B2', IT:'#F97316',
  };
  return m[t||''] ?? '#64748B';
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
function Td({ children, w, bold, mono, title }: { children:React.ReactNode; w:number; bold?:boolean; mono?:boolean; title?:string }) {
  return (
    <td style={{ padding:'10px 10px', overflow:'hidden', textOverflow:'ellipsis',
      whiteSpace:'nowrap', fontSize:12, fontWeight:bold?600:400, color:'#334155', fontFamily:mono?'monospace':'inherit' }}
      title={title}>
      {children}
    </td>
  );
}

function PgBtn({ children, onClick, disabled, active }: { children:React.ReactNode; onClick?:()=>void; disabled?:boolean; active?:boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:'4px 10px', border:'1.5px solid #E2E8F0', borderRadius:6, fontSize:12, fontWeight:active?700:500,
      background: active?'#1E3A8A':disabled?'#F8FAFC':'#fff',
      color: active?'#fff':disabled?'#CBD5E1':'#334155',
      cursor:disabled?'default':'pointer', transition:'all 0.15s',
    }}>{children}</button>
  );
}

function StatPill({ label, val, color, bg }: { label:string; val:number; color:string; bg:string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', background:bg,
      border:`1px solid ${color}30`, borderRadius:8, padding:'3px 10px', minWidth:58 }}>
      <span style={{ fontSize:15, fontWeight:800, color }}>{val}</span>
      <span style={{ fontSize:9, color, opacity:0.85, whiteSpace:'nowrap' }}>{label}</span>
    </div>
  );
}

function EmpList({ title, color, bg, employees, onNavigate }:{
  title:string; color:string; bg:string;
  employees:FullEmployee[]; onNavigate:(id:string)=>void;
}) {
  return (
    <div style={{ background:bg, border:`1.5px solid ${color}30`, borderRadius:10, padding:'12px 14px' }}>
      <div style={{ fontSize:12, fontWeight:700, color, marginBottom:8 }}>{title}</div>
      {employees.map(e => (
        <div key={e.id} onClick={() => onNavigate(e.id)}
          style={{ display:'flex', alignItems:'center', gap:7, padding:'4px 0', cursor:'pointer', borderBottom:`1px solid ${color}15` }}>
          <div style={{ width:22, height:22, borderRadius:'50%', background:`${color}25`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color, flexShrink:0 }}>
            {e.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
          </div>
          <span style={{ fontSize:12, fontWeight:600, color:'#334155' }}>{e.name}</span>
          <ExternalLink size={10} color={color} style={{ marginLeft:'auto', opacity:0.5 }}/>
        </div>
      ))}
    </div>
  );
}
