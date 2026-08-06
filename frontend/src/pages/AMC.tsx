import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Pencil, Trash2, Search, Download, FileSpreadsheet,
  X, CheckCircle, AlertTriangle, Clock, DollarSign, FileText,
  RefreshCw, ChevronLeft, ChevronRight, BarChart2, TrendingUp,
  Calendar, Building, Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AMCDocument {
  name: string;
  type: string;
  dataUrl: string;
  uploadDate: string;
}

interface AMCRecord {
  _id?: string;
  amcNumber: string;
  department: string;
  area: string;
  equipmentCategory: string;
  equipmentName: string;
  equipmentCode: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  assetId: string;
  amcType: string;
  frequency: string;
  customIntervalDays: number;
  visitsPerYear: number;
  startDate: string;
  endDate: string;
  autoRenewal: boolean;
  gracePeriodDays: number;
  criticality: string;
  status: string;
  contractorCompany: string;
  contactPerson: string;
  mobile: string;
  email: string;
  address: string;
  tradeLicense: string;
  trnNumber: string;
  contractNumber: string;
  poNumber: string;
  agreementNumber: string;
  invoiceNumber: string;
  currency: string;
  contractValue: number;
  vatPercent: number;
  vatAmount: number;
  totalContractValue: number;
  paymentTerms: string;
  remarks: string;
  documents: AMCDocument[];
  completedVisits: number;
  lastServiceDate?: string;
  nextDueDate?: string;
}

interface AMCScheduleRecord {
  _id?: string;
  amcId: string;
  amcNumber: string;
  equipmentName: string;
  department: string;
  contractorCompany: string;
  visitNumber: number;
  scheduledDate: string;
  status: string;
  completionDate?: string;
  engineerName: string;
  workDone: string;
  observations: string;
  partsReplaced: string;
  recommendations: string;
}

interface AMCBudgetRecord {
  _id?: string;
  budgetYear: number;
  department: string;
  category: string;
  allocatedBudget: number;
  actualSpent: number;
}

interface AMCPaymentRecord {
  _id?: string;
  amcId: string;
  amcNumber: string;
  equipmentName: string;
  contractorCompany: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: number;
  paidAmount: number;
  balance: number;
  paymentDate?: string;
  paymentStatus: string;
  remarks: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const API = '/api/amc';

const BLANK: AMCRecord = {
  amcNumber: '', department: '', area: '', equipmentCategory: '',
  equipmentName: '', equipmentCode: '', manufacturer: '', modelNumber: '',
  serialNumber: '', assetId: '', amcType: 'Service Contract',
  frequency: 'Yearly', customIntervalDays: 0, visitsPerYear: 1,
  startDate: '', endDate: '', autoRenewal: false, gracePeriodDays: 30,
  criticality: 'Medium', status: 'Active', contractorCompany: '',
  contactPerson: '', mobile: '', email: '', address: '',
  tradeLicense: '', trnNumber: '', contractNumber: '', poNumber: '',
  agreementNumber: '', invoiceNumber: '', currency: 'AED',
  contractValue: 0, vatPercent: 5, vatAmount: 0, totalContractValue: 0,
  paymentTerms: 'Yearly', remarks: '', documents: [],
  completedVisits: 0,
};

const BLANK_SCHEDULE: Omit<AMCScheduleRecord, '_id'> = {
  amcId: '', amcNumber: '', equipmentName: '', department: '',
  contractorCompany: '', visitNumber: 1, scheduledDate: '',
  status: 'Scheduled', engineerName: '', workDone: '',
  observations: '', partsReplaced: '', recommendations: '',
};

const BLANK_BUDGET: Omit<AMCBudgetRecord, '_id'> = {
  budgetYear: new Date().getFullYear(), department: '',
  category: '', allocatedBudget: 0, actualSpent: 0,
};

const BLANK_PAYMENT: Omit<AMCPaymentRecord, '_id'> = {
  amcId: '', amcNumber: '', equipmentName: '', contractorCompany: '',
  invoiceNumber: '', invoiceDate: '', invoiceAmount: 0,
  paidAmount: 0, balance: 0, paymentStatus: 'Overdue', remarks: '',
};

const FREQ_OPTIONS = ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly', 'Custom'];
const STATUS_OPTIONS = ['Active', 'Expired', 'Pending Renewal', 'Cancelled'];
const CRITICALITY_OPTIONS = ['High', 'Medium', 'Low'];
const AMC_TYPES = ['Service Contract', 'Comprehensive AMC', 'Non-Comprehensive AMC', 'Preventive Maintenance', 'Warranty Extended'];
const PAYMENT_STATUS_OPTIONS = ['Advance', 'Partially Paid', 'Paid', 'Overdue'];

const CHART_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#84CC16'];

// ── Helpers ────────────────────────────────────────────────────────────────────

// Safely convert any ISO / partial date string to YYYY-MM-DD for <input type="date">.
// Returns '' if the date is invalid or epoch (1970), preventing "01/01/1970" display.
function toDateInput(val?: string | null): string {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return '';
  return d.toISOString().split('T')[0];
}

function fmtDate(d?: string): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function fmtCurrency(n: number): string {
  return n.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - now.getTime()) / 86400000);
}

function getVisitsPerYear(freq: string, customDays: number): number {
  if (freq === 'Monthly') return 12;
  if (freq === 'Quarterly') return 4;
  if (freq === 'Half-Yearly') return 2;
  if (freq === 'Yearly') return 1;
  if (freq === 'Custom' && customDays > 0) return Math.max(1, Math.floor(365 / customDays));
  return 1;
}

function generateSchedules(amc: AMCRecord): Omit<AMCScheduleRecord, '_id'>[] {
  const schedules: Omit<AMCScheduleRecord, '_id'>[] = [];
  const start = new Date(amc.startDate);
  const end = new Date(amc.endDate);
  const visits = amc.visitsPerYear;
  let intervalDays: number;
  if (amc.frequency === 'Monthly') intervalDays = 30;
  else if (amc.frequency === 'Quarterly') intervalDays = 91;
  else if (amc.frequency === 'Half-Yearly') intervalDays = 182;
  else if (amc.frequency === 'Yearly') intervalDays = 365;
  else intervalDays = amc.customIntervalDays || 365;

  let visitDate = new Date(start);
  let visitNum = 1;
  while (visitDate <= end && visitNum <= visits * 2) {
    schedules.push({
      amcId: amc._id || '',
      amcNumber: amc.amcNumber,
      equipmentName: amc.equipmentName,
      department: amc.department,
      contractorCompany: amc.contractorCompany,
      visitNumber: visitNum,
      scheduledDate: visitDate.toISOString().split('T')[0],
      status: 'Scheduled',
      engineerName: '', workDone: '', observations: '',
      partsReplaced: '', recommendations: '',
    });
    visitDate = new Date(visitDate.getTime() + intervalDays * 86400000);
    visitNum++;
  }
  return schedules;
}

// ── Status/Criticality badges ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'Active':          { bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
    'Expired':         { bg: 'rgba(239,68,68,0.15)',  color: '#EF4444' },
    'Pending Renewal': { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
    'Cancelled':       { bg: 'rgba(107,114,128,0.15)',color: '#6B7280' },
  };
  const s = map[status] || { bg: 'rgba(107,114,128,0.15)', color: '#6B7280' };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

function CriticalityBadge({ criticality }: { criticality: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'High':   { bg: 'rgba(239,68,68,0.15)',  color: '#EF4444' },
    'Medium': { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
    'Low':    { bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
  };
  const s = map[criticality] || { bg: 'rgba(107,114,128,0.15)', color: '#6B7280' };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
      {criticality}
    </span>
  );
}

function ScheduleStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'Scheduled':  { bg: 'rgba(37,99,235,0.15)',  color: '#60A5FA' },
    'Completed':  { bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
    'Overdue':    { bg: 'rgba(239,68,68,0.15)',  color: '#EF4444' },
    'Cancelled':  { bg: 'rgba(107,114,128,0.15)',color: '#6B7280' },
  };
  const s = map[status] || { bg: 'rgba(107,114,128,0.15)', color: '#6B7280' };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'Paid':           { bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
    'Partially Paid': { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
    'Advance':        { bg: 'rgba(37,99,235,0.15)',  color: '#60A5FA' },
    'Overdue':        { bg: 'rgba(239,68,68,0.15)',  color: '#EF4444' },
  };
  const s = map[status] || { bg: 'rgba(107,114,128,0.15)', color: '#6B7280' };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const S = {
  page:       { background: '#0f172a', minHeight: '100vh', padding: '24px', color: '#e2e8f0' } as React.CSSProperties,
  card:       { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '16px 20px' } as React.CSSProperties,
  input:      { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#e2e8f0', padding: '8px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const },
  select:     { background: 'rgba(30,30,50,0.9)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#e2e8f0', padding: '8px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const },
  label:      { display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  btn:        { borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties,
  btnPrimary: { background: 'linear-gradient(135deg,#1E3A8A,#2563EB)', color: '#fff' } as React.CSSProperties,
  btnDanger:  { background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' } as React.CSSProperties,
  btnGhost:   { background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' } as React.CSSProperties,
  th:         { padding: '10px 12px', textAlign: 'left' as const, fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', whiteSpace: 'nowrap' as const },
  td:         { padding: '10px 12px', fontSize: 12, color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.04)' },
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, color, sub }: { label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string }) {
  return (
    <div style={{ ...S.card, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ background: `${color}22`, borderRadius: 8, padding: 10, color, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Date picker input with calendar icon button ───────────────────────────────

function DateInput({ value, onChange, style }: { value: string; onChange: (v: string) => void; style?: React.CSSProperties }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...S.input, paddingRight: 38, cursor: 'pointer', ...style }}
      />
      <button
        type="button"
        onClick={() => { ref.current?.showPicker?.(); ref.current?.focus(); }}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 34, background: 'rgba(37,99,235,0.18)', border: 'none', borderRadius: '0 6px 6px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}
        tabIndex={-1}
      >
        <Calendar size={14} />
      </button>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ title, color = '#2563EB' }: { title: string; color?: string }) {
  return (
    <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 10, marginBottom: 14, marginTop: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
    </div>
  );
}

// ── Form field ────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

type TabType = 'dashboard' | 'master' | 'schedules' | 'finance' | 'reports';
type FinanceSubTab = 'budget' | 'payments';

export default function AMC() {
  const [tab, setTab] = useState<TabType>('dashboard');
  const [financeTab, setFinanceTab] = useState<FinanceSubTab>('budget');

  // ── AMC Master state ───────────────────────────────────────────────────────
  const [amcList, setAmcList] = useState<AMCRecord[]>([]);
  const [loadingAmc, setLoadingAmc] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState<AMCRecord | null>(null);
  const [form, setForm] = useState<AMCRecord>(BLANK);
  const [deleteTarget, setDeleteTarget] = useState<AMCRecord | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('All');
  const [fCriticality, setFCriticality] = useState('All');
  const [fFrequency, setFFrequency] = useState('All');
  const [fDepartment, setFDepartment] = useState('All');
  const [sortKey, setSortKey] = useState<keyof AMCRecord>('amcNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // ── Schedules ──────────────────────────────────────────────────────────────
  const [schedules, setSchedules] = useState<AMCScheduleRecord[]>([]);
  const [loadingSch, setLoadingSch] = useState(false);
  const [schedFilter, setSchedFilter] = useState('All');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingSchedule, setCompletingSchedule] = useState<AMCScheduleRecord | null>(null);
  const [completeForm, setCompleteForm] = useState({
    engineerName: '', workDone: '', observations: '', partsReplaced: '', recommendations: '',
  });

  // ── Budget ─────────────────────────────────────────────────────────────────
  const [budgets, setBudgets] = useState<AMCBudgetRecord[]>([]);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editBudget, setEditBudget] = useState<AMCBudgetRecord | null>(null);
  const [budgetForm, setBudgetForm] = useState<Omit<AMCBudgetRecord, '_id'>>(BLANK_BUDGET);
  const [budgetYear, setBudgetYear] = useState(String(new Date().getFullYear()));

  // ── Payments ───────────────────────────────────────────────────────────────
  const [payments, setPayments] = useState<AMCPaymentRecord[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editPayment, setEditPayment] = useState<AMCPaymentRecord | null>(null);
  const [paymentForm, setPaymentForm] = useState<Omit<AMCPaymentRecord, '_id'>>(BLANK_PAYMENT);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRef    = useRef<HTMLInputElement>(null);

  // ── Auth / role gate ───────────────────────────────────────────────────────
  const { user } = useAuth();
  const isAdmin = user?.role === 'manager';

  // ── Excel bulk-upload state ────────────────────────────────────────────────
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadRows,      setUploadRows]      = useState<AMCRecord[]>([]);
  const [uploadMode,      setUploadMode]      = useState<'new' | 'update'>('new');
  const [uploading,       setUploading]       = useState(false);

  // ── Fetch functions ────────────────────────────────────────────────────────

  const fetchAmc = async () => {
    setLoadingAmc(true);
    try {
      const r = await fetch(`${API}`);
      if (!r.ok) throw new Error('Failed to load AMC records');
      setAmcList(await r.json());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load AMC records');
    } finally {
      setLoadingAmc(false);
    }
  };

  const fetchSchedules = async () => {
    setLoadingSch(true);
    try {
      const r = await fetch(`${API}/schedules/all`);
      if (!r.ok) throw new Error('Failed to load schedules');
      setSchedules(await r.json());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load schedules');
    } finally {
      setLoadingSch(false);
    }
  };

  const fetchBudgets = async () => {
    try {
      const url = budgetYear ? `${API}/budget/all?year=${budgetYear}` : `${API}/budget/all`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('Failed to load budgets');
      setBudgets(await r.json());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load budgets');
    }
  };

  const fetchPayments = async () => {
    try {
      const params = new URLSearchParams();
      if (paymentStatusFilter !== 'All') params.set('status', paymentStatusFilter);
      const r = await fetch(`${API}/payments/all?${params}`);
      if (!r.ok) throw new Error('Failed to load payments');
      setPayments(await r.json());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load payments');
    }
  };

  useEffect(() => { fetchAmc(); }, []);
  useEffect(() => { if (tab === 'schedules') fetchSchedules(); }, [tab]);
  useEffect(() => { if (tab === 'finance') { fetchBudgets(); fetchPayments(); } }, [tab, budgetYear, paymentStatusFilter]);

  // ── Excel template download ───────────────────────────────────────────────
  const downloadTemplate = () => {
    const headers = [
      'Department','Area','Equipment Category','Equipment Name','Equipment Code',
      'Manufacturer','Model Number','Serial Number','Asset ID','AMC Type',
      'Frequency','Custom Interval Days','Start Date (YYYY-MM-DD)','End Date (YYYY-MM-DD)',
      'Auto Renewal (Yes/No)','Grace Period Days','Criticality','Status',
      'Contractor Company','Contact Person','Mobile','Email','Address',
      'Trade License','TRN Number','Contract Number','PO Number',
      'Agreement Number','Invoice Number','Currency','Contract Value',
      'VAT Percent','Payment Terms','Remarks',
    ];
    const sample = [
      'E&I','Production','HVAC','Air Handling Unit 01','EQ-001',
      'Carrier','AHU-2000','SN12345','AST-001','Service Contract',
      'Quarterly','','2025-01-01','2025-12-31',
      'Yes','30','High','Active',
      'ABC Maintenance LLC','John Smith','+971501234567','john@abc.com','Dubai, UAE',
      'TL-12345','TRN-123456','CON-001','PO-001',
      'AGR-001','INV-001','AED','5000','5','Quarterly','Sample AMC record',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    ws['!cols'] = headers.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AMC_Template');
    XLSX.writeFile(wb, 'AMC_Master_Template.xlsx');
  };

  // ── Parse uploaded Excel file ─────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
        const year = new Date().getFullYear();
        const parsed: AMCRecord[] = rows.map((r, idx) => {
          const cv  = parseFloat(r['Contract Value'] || '0') || 0;
          const vat = parseFloat(r['VAT Percent'] || '5') || 5;
          return {
            ...BLANK,
            amcNumber:          r['AMC Number'] || `AMC-${year}-${String(amcList.length + idx + 1).padStart(3,'0')}`,
            department:         r['Department'] || '',
            area:               r['Area'] || '',
            equipmentCategory:  r['Equipment Category'] || '',
            equipmentName:      r['Equipment Name'] || '',
            equipmentCode:      r['Equipment Code'] || '',
            manufacturer:       r['Manufacturer'] || '',
            modelNumber:        r['Model Number'] || '',
            serialNumber:       r['Serial Number'] || '',
            assetId:            r['Asset ID'] || '',
            amcType:            r['AMC Type'] || 'Service Contract',
            frequency:          r['Frequency'] || 'Yearly',
            customIntervalDays: parseInt(r['Custom Interval Days'] || '0') || 0,
            visitsPerYear:      getVisitsPerYear(r['Frequency'] || 'Yearly', parseInt(r['Custom Interval Days'] || '0') || 0),
            startDate:          r['Start Date (YYYY-MM-DD)'] || '',
            endDate:            r['End Date (YYYY-MM-DD)'] || '',
            autoRenewal:        (r['Auto Renewal (Yes/No)'] || '').toLowerCase() === 'yes',
            gracePeriodDays:    parseInt(r['Grace Period Days'] || '30') || 30,
            criticality:        r['Criticality'] || 'Medium',
            status:             r['Status'] || 'Active',
            contractorCompany:  r['Contractor Company'] || '',
            contactPerson:      r['Contact Person'] || '',
            mobile:             r['Mobile'] || '',
            email:              r['Email'] || '',
            address:            r['Address'] || '',
            tradeLicense:       r['Trade License'] || '',
            trnNumber:          r['TRN Number'] || '',
            contractNumber:     r['Contract Number'] || '',
            poNumber:           r['PO Number'] || '',
            agreementNumber:    r['Agreement Number'] || '',
            invoiceNumber:      r['Invoice Number'] || '',
            currency:           r['Currency'] || 'AED',
            contractValue:      cv,
            vatPercent:         vat,
            vatAmount:          Math.round(cv * vat / 100 * 100) / 100,
            totalContractValue: Math.round(cv * (1 + vat / 100) * 100) / 100,
            paymentTerms:       r['Payment Terms'] || 'Yearly',
            remarks:            r['Remarks'] || '',
          };
        });
        if (parsed.length === 0) { toast.error('No data rows found in the file'); return; }
        setUploadRows(parsed);
        setUploadMode('new');
        setShowUploadModal(true);
      } catch {
        toast.error('Failed to parse file. Please use the downloaded template.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // ── Process bulk upload ───────────────────────────────────────────────────
  const processUpload = async () => {
    setUploading(true);
    let success = 0, failed = 0;
    for (const rec of uploadRows) {
      try {
        if (uploadMode === 'update') {
          const existing = amcList.find(a => a.amcNumber === rec.amcNumber);
          if (existing?._id) {
            const r = await fetch(`${API}/${existing._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) });
            if (r.ok) { success++; continue; }
          }
        }
        const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) });
        if (r.ok) success++; else failed++;
      } catch { failed++; }
    }
    setUploading(false);
    setShowUploadModal(false);
    setUploadRows([]);
    toast.success(`${success} record(s) saved${failed > 0 ? `, ${failed} failed` : ''}`);
    fetchAmc();
  };

  // ── AMC Master filtered/sorted ─────────────────────────────────────────────

  const departments = useMemo(() => ['All', ...Array.from(new Set(amcList.map(a => a.department).filter(Boolean)))], [amcList]);

  const filteredAmc = useMemo(() => {
    let list = amcList.filter(a => {
      const q = search.toLowerCase();
      if (q && !a.amcNumber.toLowerCase().includes(q) && !a.equipmentName.toLowerCase().includes(q) && !a.contractorCompany.toLowerCase().includes(q) && !a.department.toLowerCase().includes(q)) return false;
      if (fStatus !== 'All' && a.status !== fStatus) return false;
      if (fCriticality !== 'All' && a.criticality !== fCriticality) return false;
      if (fFrequency !== 'All' && a.frequency !== fFrequency) return false;
      if (fDepartment !== 'All' && a.department !== fDepartment) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const av = String(a[sortKey] ?? '');
      const bv = String(b[sortKey] ?? '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [amcList, search, fStatus, fCriticality, fFrequency, fDepartment, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAmc.length / PAGE_SIZE));
  const pagedAmc = filteredAmc.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── KPI computations ───────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const active = amcList.filter(a => a.status === 'Active').length;
    const expired = amcList.filter(a => a.status === 'Expired').length;
    const expiring30 = amcList.filter(a => {
      const d = daysUntil(a.endDate);
      return d !== null && d >= 0 && d <= 30 && a.status === 'Active';
    }).length;
    const thisMonth = amcList.filter(a => {
      if (!a.nextDueDate) return false;
      const d = new Date(a.nextDueDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const quarterly = amcList.filter(a => a.frequency === 'Quarterly').length;
    const halfYearly = amcList.filter(a => a.frequency === 'Half-Yearly').length;
    const yearly = amcList.filter(a => a.frequency === 'Yearly').length;
    const totalBudget = amcList.reduce((s, a) => s + (a.totalContractValue || 0), 0);
    const utilized = budgets.reduce((s, b) => s + (b.actualSpent || 0), 0);
    return { active, expired, expiring30, thisMonth, quarterly, halfYearly, yearly, totalBudget, utilized, remaining: totalBudget - utilized };
  }, [amcList, budgets]);

  // ── Chart data ─────────────────────────────────────────────────────────────

  const categoryChartData = useMemo(() => {
    const map: Record<string, number> = {};
    amcList.forEach(a => {
      const cat = a.equipmentCategory || 'Uncategorized';
      map[cat] = (map[cat] || 0) + (a.totalContractValue || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [amcList]);

  const vendorChartData = useMemo(() => {
    const map: Record<string, number> = {};
    amcList.forEach(a => {
      const v = a.contractorCompany || 'Unknown';
      map[v] = (map[v] || 0) + (a.totalContractValue || 0);
    });
    return Object.entries(map).slice(0, 8).map(([name, value]) => ({ name, value }));
  }, [amcList]);

  const renewalStatusData = useMemo(() => {
    const map: Record<string, number> = {};
    amcList.forEach(a => { map[a.status] = (map[a.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [amcList]);

  const budgetChartData = useMemo(() => {
    return budgets.map(b => ({
      name: b.department.length > 12 ? b.department.slice(0, 12) + '…' : b.department,
      Allocated: b.allocatedBudget,
      Actual: b.actualSpent,
    }));
  }, [budgets]);

  // ── Open Add modal ─────────────────────────────────────────────────────────

  const openAdd = async () => {
    try {
      const r = await fetch(`${API}/next-number`);
      const data = await r.json();
      setForm({ ...BLANK, amcNumber: data.amcNumber });
    } catch {
      setForm({ ...BLANK });
    }
    setEditRecord(null);
    setShowModal(true);
  };

  const openEdit = (rec: AMCRecord) => {
    setEditRecord(rec);
    setForm({
      ...rec,
      startDate: toDateInput(rec.startDate),
      endDate:   toDateInput(rec.endDate),
    });
    setShowModal(true);
  };

  // ── Auto-calc VAT and visits ───────────────────────────────────────────────

  const handleFormChange = (key: keyof AMCRecord, value: unknown) => {
    setForm(prev => {
      const updated = { ...prev, [key]: value };
      if (key === 'contractValue' || key === 'vatPercent') {
        const cv = key === 'contractValue' ? Number(value) : prev.contractValue;
        const vp = key === 'vatPercent' ? Number(value) : prev.vatPercent;
        updated.vatAmount = Math.round(cv * vp / 100 * 100) / 100;
        updated.totalContractValue = cv + updated.vatAmount;
      }
      if (key === 'frequency' || key === 'customIntervalDays') {
        const freq = key === 'frequency' ? String(value) : prev.frequency;
        const ci = key === 'customIntervalDays' ? Number(value) : prev.customIntervalDays;
        updated.visitsPerYear = getVisitsPerYear(freq, ci);
      }
      return updated;
    });
  };

  // ── Save AMC ───────────────────────────────────────────────────────────────

  const saveAmc = async () => {
    if (!form.equipmentName.trim()) { toast.error('Equipment name is required'); return; }
    if (!form.startDate || !form.endDate) { toast.error('Start and end dates are required'); return; }
    setSaving(true);
    try {
      const method = editRecord ? 'PUT' : 'POST';
      const url = editRecord ? `${API}/${editRecord._id}` : `${API}`;
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message || 'Save failed');
      }
      const saved: AMCRecord = await r.json();
      toast.success(editRecord ? 'AMC updated' : 'AMC created');
      setShowModal(false);

      if (!editRecord) {
        // Auto-generate schedules
        const scheds = generateSchedules(saved);
        if (scheds.length > 0) {
          await fetch(`${API}/schedules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scheds),
          });
          toast.success(`${scheds.length} schedule(s) auto-generated`);
        }
      }
      fetchAmc();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete AMC ─────────────────────────────────────────────────────────────

  const deleteAmc = async (id: string) => {
    try {
      const r = await fetch(`${API}/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Delete failed');
      toast.success('AMC deleted');
      setDeleteTarget(null);
      fetchAmc();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  // ── Document upload ────────────────────────────────────────────────────────

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const doc: AMCDocument = {
        name: file.name,
        type: file.type,
        dataUrl: reader.result as string,
        uploadDate: new Date().toISOString(),
      };
      setForm(prev => ({ ...prev, documents: [...prev.documents, doc] }));
    };
    reader.readAsDataURL(file);
  };

  const removeDoc = (idx: number) => {
    setForm(prev => ({ ...prev, documents: prev.documents.filter((_, i) => i !== idx) }));
  };

  // ── Complete schedule ──────────────────────────────────────────────────────

  const openCompleteModal = (sch: AMCScheduleRecord) => {
    setCompletingSchedule(sch);
    setCompleteForm({ engineerName: sch.engineerName, workDone: sch.workDone, observations: sch.observations, partsReplaced: sch.partsReplaced, recommendations: sch.recommendations });
    setShowCompleteModal(true);
  };

  const saveComplete = async () => {
    if (!completingSchedule) return;
    try {
      const r = await fetch(`${API}/schedules/${completingSchedule._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...completeForm,
          status: 'Completed',
          completionDate: new Date().toISOString().split('T')[0],
        }),
      });
      if (!r.ok) throw new Error('Failed to mark complete');
      toast.success('Visit marked as completed');
      setShowCompleteModal(false);
      fetchSchedules();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  // ── Budget CRUD ────────────────────────────────────────────────────────────

  const saveBudget = async () => {
    if (!budgetForm.department.trim()) { toast.error('Department is required'); return; }
    try {
      const method = editBudget ? 'PUT' : 'POST';
      const url = editBudget ? `${API}/budget/${editBudget._id}` : `${API}/budget`;
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budgetForm),
      });
      if (!r.ok) throw new Error('Save failed');
      toast.success(editBudget ? 'Budget updated' : 'Budget added');
      setShowBudgetModal(false);
      fetchBudgets();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const deleteBudget = async (id: string) => {
    try {
      await fetch(`${API}/budget/${id}`, { method: 'DELETE' });
      toast.success('Budget deleted');
      fetchBudgets();
    } catch {
      toast.error('Delete failed');
    }
  };

  // ── Payment CRUD ───────────────────────────────────────────────────────────

  const savePayment = async () => {
    if (!paymentForm.amcNumber.trim()) { toast.error('AMC Number is required'); return; }
    try {
      const method = editPayment ? 'PUT' : 'POST';
      const url = editPayment ? `${API}/payments/${editPayment._id}` : `${API}/payments`;
      const payload = {
        ...paymentForm,
        amcId: paymentForm.amcId || amcList.find(a => a.amcNumber === paymentForm.amcNumber)?._id || '',
        balance: (paymentForm.invoiceAmount || 0) - (paymentForm.paidAmount || 0),
      };
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('Save failed');
      toast.success(editPayment ? 'Payment updated' : 'Payment recorded');
      setShowPaymentModal(false);
      fetchPayments();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const deletePayment = async (id: string) => {
    try {
      await fetch(`${API}/payments/${id}`, { method: 'DELETE' });
      toast.success('Payment deleted');
      fetchPayments();
    } catch {
      toast.error('Delete failed');
    }
  };

  // ── PDF Export ─────────────────────────────────────────────────────────────

  const exportPdf = async (reportType: string) => {
    const logoDataUrl = await new Promise<string>(resolve => {
      const canvas = document.createElement('canvas');
      canvas.width = 810; canvas.height = 162;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(''); return; }
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, 810, 162); resolve(canvas.toDataURL('image/png')); };
      img.onerror = () => resolve('');
      img.src = '/logo.svg';
    });

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const ML = 10, MR = 10, MT = 8;

    const addHeader = (title: string) => {
      doc.setFillColor(30, 58, 138);
      doc.rect(0, 0, pw, 16, 'F');
      if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', ML, 2, 21, 4.2);
      doc.setFontSize(11); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
      doc.text(title, pw / 2, 10, { align: 'center' });
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pw - MR, 10, { align: 'right' });
      doc.setTextColor(30, 30, 30);
    };

    if (reportType === 'AMC Register') {
      addHeader('AMC Register — All Contracts');
      autoTable(doc, {
        startY: 20,
        margin: { left: ML, right: MR },
        head: [['AMC No', 'Equipment', 'Department', 'Contractor', 'Frequency', 'Start', 'End', 'Value (AED)', 'Status', 'Criticality']],
        body: amcList.map(a => [
          a.amcNumber, a.equipmentName, a.department, a.contractorCompany,
          a.frequency, fmtDate(a.startDate), fmtDate(a.endDate),
          fmtCurrency(a.totalContractValue), a.status, a.criticality,
        ]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 255] },
      });
    } else if (reportType === 'Expiry Report') {
      addHeader('AMC Expiry Report — Contracts Expiring ≤30 Days');
      const expiring = amcList.filter(a => {
        const d = daysUntil(a.endDate);
        return d !== null && d >= 0 && d <= 30;
      });
      autoTable(doc, {
        startY: 20,
        margin: { left: ML, right: MR },
        head: [['AMC No', 'Equipment', 'Contractor', 'End Date', 'Days Left', 'Status']],
        body: expiring.map(a => [
          a.amcNumber, a.equipmentName, a.contractorCompany,
          fmtDate(a.endDate), String(daysUntil(a.endDate) ?? '—'), a.status,
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255 },
      });
    } else if (reportType === 'Schedule Report') {
      addHeader('AMC Schedule Report');
      autoTable(doc, {
        startY: 20,
        margin: { left: ML, right: MR },
        head: [['AMC No', 'Equipment', 'Dept', 'Contractor', 'Visit#', 'Scheduled Date', 'Status', 'Engineer']],
        body: schedules.map(s => [
          s.amcNumber, s.equipmentName, s.department, s.contractorCompany,
          s.visitNumber, fmtDate(s.scheduledDate), s.status, s.engineerName || '—',
        ]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255 },
      });
    } else if (reportType === 'Payment Report') {
      addHeader('AMC Payment Report');
      autoTable(doc, {
        startY: 20,
        margin: { left: ML, right: MR },
        head: [['AMC No', 'Equipment', 'Contractor', 'Invoice No', 'Invoice Date', 'Invoice Amt', 'Paid', 'Balance', 'Status']],
        body: payments.map(p => [
          p.amcNumber, p.equipmentName, p.contractorCompany,
          p.invoiceNumber, fmtDate(p.invoiceDate),
          fmtCurrency(p.invoiceAmount), fmtCurrency(p.paidAmount),
          fmtCurrency(p.balance), p.paymentStatus,
        ]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255 },
      });
    } else if (reportType === 'Budget Report') {
      addHeader('AMC Budget Report');
      autoTable(doc, {
        startY: 20,
        margin: { left: ML, right: MR },
        head: [['Year', 'Department', 'Category', 'Allocated (AED)', 'Actual (AED)', 'Variance']],
        body: budgets.map(b => [
          b.budgetYear, b.department, b.category,
          fmtCurrency(b.allocatedBudget), fmtCurrency(b.actualSpent),
          fmtCurrency(b.allocatedBudget - b.actualSpent),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255 },
      });
    }

    // Footer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pages = (doc.internal as any).getNumberOfPages() as number;
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pages}`, pw / 2, ph - 4, { align: 'center' });
      doc.text('Glass Technology — AMC Management', ML, ph - 4);
    }

    doc.save(`AMC_${reportType.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success(`${reportType} PDF downloaded`);
  };

  // ── Excel Export ───────────────────────────────────────────────────────────

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(amcList.map(a => ({
      'AMC Number': a.amcNumber,
      'Equipment': a.equipmentName,
      'Department': a.department,
      'Category': a.equipmentCategory,
      'Contractor': a.contractorCompany,
      'Frequency': a.frequency,
      'Start Date': fmtDate(a.startDate),
      'End Date': fmtDate(a.endDate),
      'Contract Value': a.contractValue,
      'VAT': a.vatAmount,
      'Total Value': a.totalContractValue,
      'Status': a.status,
      'Criticality': a.criticality,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AMC Register');
    XLSX.writeFile(wb, `AMC_Register_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel exported');
  };

  // ── Tab header ─────────────────────────────────────────────────────────────

  const TAB_LIST: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard',  label: 'Dashboard',   icon: <BarChart2 size={14} /> },
    { key: 'master',     label: 'AMC Master',  icon: <FileText size={14} /> },
    { key: 'schedules',  label: 'Schedules',   icon: <Calendar size={14} /> },
    { key: 'finance',    label: 'Finance',     icon: <DollarSign size={14} /> },
    { key: 'reports',    label: 'Reports',     icon: <Download size={14} /> },
  ];

  // ── Filtered schedules ─────────────────────────────────────────────────────

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => schedFilter === 'All' || s.status === schedFilter);
  }, [schedules, schedFilter]);

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      {/* Page title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>AMC Management</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Annual Maintenance Contract — Equipment &amp; Service Tracking</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...S.btn, ...S.btnGhost }} onClick={fetchAmc}><RefreshCw size={14} />Refresh</button>
          <button style={{ ...S.btn, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }} onClick={exportExcel}><FileSpreadsheet size={14} />Excel</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 0 }}>
        {TAB_LIST.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: tab === t.key ? 'rgba(37,99,235,0.15)' : 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid #2563EB' : '2px solid transparent',
              color: tab === t.key ? '#60a5fa' : '#64748b',
              padding: '8px 18px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 6,
              borderRadius: '6px 6px 0 0',
              transition: 'all 0.15s',
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD TAB ── */}
      {tab === 'dashboard' && (
        <div>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, marginBottom: 24 }}>
            <KpiCard label="Total Active AMC"      value={kpis.active}      icon={<CheckCircle size={18}/>}  color="#10B981" />
            <KpiCard label="Expired AMC"           value={kpis.expired}     icon={<AlertTriangle size={18}/>} color="#EF4444" />
            <KpiCard label="Expiring ≤30 Days"     value={kpis.expiring30}  icon={<Clock size={18}/>}        color="#F59E0B" />
            <KpiCard label="Monthly Due (This Mo)" value={kpis.thisMonth}   icon={<Calendar size={18}/>}     color="#2563EB" />
            <KpiCard label="Quarterly AMC"         value={kpis.quarterly}   icon={<Activity size={18}/>}     color="#8B5CF6" />
            <KpiCard label="Half-Yearly AMC"       value={kpis.halfYearly}  icon={<Activity size={18}/>}     color="#06B6D4" />
            <KpiCard label="Yearly AMC"            value={kpis.yearly}      icon={<Activity size={18}/>}     color="#F97316" />
            <KpiCard label="Total AMC Budget"      value={`AED ${fmtCurrency(kpis.totalBudget)}`}  icon={<DollarSign size={18}/>} color="#2563EB" />
            <KpiCard label="Budget Utilized"       value={`AED ${fmtCurrency(kpis.utilized)}`}     icon={<TrendingUp size={18}/>} color="#10B981" />
            <KpiCard label="Budget Remaining"      value={`AED ${fmtCurrency(kpis.remaining)}`}    icon={<Building size={18}/>}   color="#F59E0B" />
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Cost by Category */}
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>AMC Cost by Equipment Category</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryChartData} margin={{ top: 4, right: 10, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0', fontSize: 11 }} formatter={(v: number) => [`AED ${fmtCurrency(v)}`, 'Value']} />
                  <Bar dataKey="value" fill="#2563EB" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Budget vs Actual */}
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>Budget vs Actual by Department</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={budgetChartData} margin={{ top: 4, right: 10, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0', fontSize: 11 }} formatter={(v: number) => [`AED ${fmtCurrency(v)}`]} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  <Bar dataKey="Allocated" fill="#2563EB" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Actual"    fill="#10B981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Vendor-wise cost */}
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>Vendor-wise Contract Value</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={vendorChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {vendorChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0', fontSize: 11 }} formatter={(v: number) => [`AED ${fmtCurrency(v)}`]} />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Renewal Status */}
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>AMC Renewal Status</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={renewalStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {renewalStatusData.map((entry, i) => {
                      const colorMap: Record<string, string> = { Active: '#10B981', Expired: '#EF4444', 'Pending Renewal': '#F59E0B', Cancelled: '#6B7280' };
                      return <Cell key={i} fill={colorMap[entry.name] || CHART_COLORS[i % CHART_COLORS.length]} />;
                    })}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── AMC MASTER TAB ── */}
      {tab === 'master' && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input placeholder="Search AMC No, Equipment, Contractor…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ ...S.input, paddingLeft: 32 }} />
            </div>
            <select value={fDepartment} onChange={e => { setFDepartment(e.target.value); setPage(1); }} style={{ ...S.select, flex: '0 0 140px' }}>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1); }} style={{ ...S.select, flex: '0 0 140px' }}>
              {['All', ...STATUS_OPTIONS].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={fCriticality} onChange={e => { setFCriticality(e.target.value); setPage(1); }} style={{ ...S.select, flex: '0 0 130px' }}>
              {['All', ...CRITICALITY_OPTIONS].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={fFrequency} onChange={e => { setFFrequency(e.target.value); setPage(1); }} style={{ ...S.select, flex: '0 0 130px' }}>
              {['All', ...FREQ_OPTIONS].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {isAdmin && (
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button style={{ ...S.btn, ...S.btnGhost }} onClick={downloadTemplate} title="Download Excel template">
                  <Download size={14} />Template
                </button>
                <button style={{ ...S.btn, ...S.btnGhost }} onClick={() => uploadRef.current?.click()} title="Upload filled Excel">
                  <FileSpreadsheet size={14} />Upload
                </button>
                <input ref={uploadRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
                <button style={{ ...S.btn, ...S.btnPrimary }} onClick={openAdd}><Plus size={14} />Add AMC</button>
              </div>
            )}
          </div>

          {/* Table */}
          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0 }}>
                  <tr>
                    {[
                      { k: 'amcNumber', l: 'AMC No' }, { k: 'equipmentName', l: 'Equipment' },
                      { k: 'department', l: 'Dept' }, { k: 'contractorCompany', l: 'Contractor' },
                      { k: 'frequency', l: 'Freq' }, { k: 'endDate', l: 'End Date' },
                      { k: 'totalContractValue', l: 'Value (AED)' }, { k: 'status', l: 'Status' },
                      { k: 'criticality', l: 'Priority' },
                    ].map(col => (
                      <th key={col.k} style={S.th}>
                        <button
                          onClick={() => { if (sortKey === col.k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(col.k as keyof AMCRecord); setSortDir('asc'); } }}
                          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          {col.l}
                          {sortKey === col.k && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                        </button>
                      </th>
                    ))}
                    {isAdmin && <th style={S.th}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {loadingAmc ? (
                    <tr><td colSpan={10} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#475569' }}>Loading…</td></tr>
                  ) : pagedAmc.length === 0 ? (
                    <tr><td colSpan={10} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#475569' }}>No records found</td></tr>
                  ) : pagedAmc.map((a, i) => {
                    const days = daysUntil(a.endDate);
                    return (
                      <tr key={a._id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(37,99,235,0.07)')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)')}
                      >
                        <td style={S.td}><span style={{ color: '#60a5fa', fontWeight: 600, fontSize: 11 }}>{a.amcNumber}</span></td>
                        <td style={S.td}><div style={{ fontWeight: 500 }}>{a.equipmentName}</div><div style={{ fontSize: 10, color: '#64748b' }}>{a.equipmentCode}</div></td>
                        <td style={S.td}>{a.department || '—'}</td>
                        <td style={S.td}>{a.contractorCompany || '—'}</td>
                        <td style={S.td}>{a.frequency}</td>
                        <td style={S.td}>
                          <div>{fmtDate(a.endDate)}</div>
                          {days !== null && days <= 30 && days >= 0 && <div style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600 }}>{days}d left</div>}
                          {days !== null && days < 0 && <div style={{ fontSize: 10, color: '#EF4444', fontWeight: 600 }}>{Math.abs(days)}d overdue</div>}
                        </td>
                        <td style={{ ...S.td, textAlign: 'right' as const }}>{fmtCurrency(a.totalContractValue)}</td>
                        <td style={S.td}><StatusBadge status={a.status} /></td>
                        <td style={S.td}><CriticalityBadge criticality={a.criticality} /></td>
                        {isAdmin && (
                          <td style={S.td}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => openEdit(a)} style={{ background: 'rgba(37,99,235,0.15)', border: 'none', borderRadius: 5, padding: '5px 8px', color: '#60a5fa', cursor: 'pointer' }} title="Edit"><Pencil size={13} /></button>
                              <button onClick={() => setDeleteTarget(a)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 5, padding: '5px 8px', color: '#EF4444', cursor: 'pointer' }} title="Delete"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Showing {Math.min((page-1)*PAGE_SIZE+1, filteredAmc.length)}–{Math.min(page*PAGE_SIZE, filteredAmc.length)} of {filteredAmc.length}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} style={{ ...S.btn, ...S.btnGhost, padding: '5px 10px', opacity: page === 1 ? 0.4 : 1 }}><ChevronLeft size={13} /></button>
                <span style={{ fontSize: 12, color: '#94a3b8', alignSelf: 'center', padding: '0 4px' }}>Page {page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} style={{ ...S.btn, ...S.btnGhost, padding: '5px 10px', opacity: page === totalPages ? 0.4 : 1 }}><ChevronRight size={13} /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULES TAB ── */}
      {tab === 'schedules' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>Filter by status:</div>
            {['All', 'Scheduled', 'Completed', 'Overdue', 'Cancelled'].map(s => (
              <button key={s} onClick={() => setSchedFilter(s)}
                style={{ ...S.btn, padding: '5px 14px', fontSize: 12, background: schedFilter === s ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.04)', color: schedFilter === s ? '#60a5fa' : '#64748b', border: schedFilter === s ? '1px solid rgba(37,99,235,0.4)' : '1px solid rgba(255,255,255,0.06)' }}>
                {s}
              </button>
            ))}
            <button style={{ ...S.btn, ...S.btnGhost, marginLeft: 'auto' }} onClick={fetchSchedules}><RefreshCw size={13} />Refresh</button>
          </div>

          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <tr>
                    {['AMC No', 'Equipment', 'Dept', 'Contractor', 'Visit#', 'Scheduled Date', 'Days', 'Status', 'Engineer', 'Actions'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingSch ? (
                    <tr><td colSpan={10} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#475569' }}>Loading…</td></tr>
                  ) : filteredSchedules.length === 0 ? (
                    <tr><td colSpan={10} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#475569' }}>No schedules found</td></tr>
                  ) : filteredSchedules.map((s, i) => {
                    const days = daysUntil(s.scheduledDate);
                    let daysBadge: React.ReactNode = null;
                    if (days !== null) {
                      if (days > 0) daysBadge = <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>{days}d left</span>;
                      else if (days === 0) daysBadge = <span style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>Today</span>;
                      else daysBadge = <span style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>{Math.abs(days)}d overdue</span>;
                    }
                    return (
                      <tr key={s._id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                        <td style={S.td}><span style={{ color: '#60a5fa', fontSize: 11, fontWeight: 600 }}>{s.amcNumber}</span></td>
                        <td style={S.td}>{s.equipmentName}</td>
                        <td style={S.td}>{s.department || '—'}</td>
                        <td style={S.td}>{s.contractorCompany || '—'}</td>
                        <td style={{ ...S.td, textAlign: 'center' as const }}>{s.visitNumber}</td>
                        <td style={S.td}>{fmtDate(s.scheduledDate)}</td>
                        <td style={S.td}>{daysBadge}</td>
                        <td style={S.td}><ScheduleStatusBadge status={s.status} /></td>
                        <td style={S.td}>{s.engineerName || '—'}</td>
                        <td style={S.td}>
                          {s.status !== 'Completed' && s.status !== 'Cancelled' && (
                            <button onClick={() => openCompleteModal(s)} style={{ background: 'rgba(16,185,129,0.15)', border: 'none', borderRadius: 5, padding: '5px 10px', color: '#10B981', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                              Mark Complete
                            </button>
                          )}
                          {s.status === 'Completed' && <span style={{ fontSize: 11, color: '#10B981' }}>✓ Done {fmtDate(s.completionDate)}</span>}
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

      {/* ── FINANCE TAB ── */}
      {tab === 'finance' && (
        <div>
          {/* Finance sub-tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {(['budget', 'payments'] as FinanceSubTab[]).map(ft => (
              <button key={ft} onClick={() => setFinanceTab(ft)}
                style={{ ...S.btn, background: financeTab === ft ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.04)', color: financeTab === ft ? '#60a5fa' : '#64748b', border: financeTab === ft ? '1px solid rgba(37,99,235,0.4)' : '1px solid rgba(255,255,255,0.06)', textTransform: 'capitalize' }}>
                {ft === 'budget' ? 'Budget Management' : 'Payment Tracking'}
              </button>
            ))}
          </div>

          {/* Budget sub-tab */}
          {financeTab === 'budget' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
                <label style={{ fontSize: 12, color: '#94a3b8' }}>Year:</label>
                <select value={budgetYear} onChange={e => setBudgetYear(e.target.value)} style={{ ...S.select, width: 100 }}>
                  {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {isAdmin && <button style={{ ...S.btn, ...S.btnPrimary, marginLeft: 'auto' }} onClick={() => { setEditBudget(null); setBudgetForm({ ...BLANK_BUDGET, budgetYear: Number(budgetYear) }); setShowBudgetModal(true); }}><Plus size={14} />Add Budget</button>}
              </div>

              {/* Budget bar chart */}
              {budgets.length > 0 && (
                <div style={{ ...S.card, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>Budget vs Actual ({budgetYear})</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={budgetChartData} margin={{ top: 4, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0', fontSize: 11 }} formatter={(v: number) => [`AED ${fmtCurrency(v)}`]} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                      <Bar dataKey="Allocated" fill="#2563EB" radius={[3,3,0,0]} />
                      <Bar dataKey="Actual"    fill="#10B981" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <tr>
                      {['Year', 'Department', 'Category', 'Allocated (AED)', 'Actual Spent (AED)', 'Variance', ...(isAdmin ? ['Actions'] : [])].map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {budgets.length === 0 ? (
                      <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', padding: 30, color: '#475569' }}>No budget records</td></tr>
                    ) : budgets.map((b, i) => {
                      const variance = b.allocatedBudget - b.actualSpent;
                      return (
                        <tr key={b._id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                          <td style={S.td}>{b.budgetYear}</td>
                          <td style={S.td}>{b.department}</td>
                          <td style={S.td}>{b.category || '—'}</td>
                          <td style={{ ...S.td, textAlign: 'right' as const }}>{fmtCurrency(b.allocatedBudget)}</td>
                          <td style={{ ...S.td, textAlign: 'right' as const }}>{fmtCurrency(b.actualSpent)}</td>
                          <td style={{ ...S.td, textAlign: 'right' as const, color: variance >= 0 ? '#10B981' : '#EF4444', fontWeight: 600 }}>{variance >= 0 ? '+' : ''}{fmtCurrency(variance)}</td>
                          {isAdmin && (
                            <td style={S.td}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => { setEditBudget(b); setBudgetForm({ budgetYear: b.budgetYear, department: b.department, category: b.category, allocatedBudget: b.allocatedBudget, actualSpent: b.actualSpent }); setShowBudgetModal(true); }} style={{ background: 'rgba(37,99,235,0.15)', border: 'none', borderRadius: 5, padding: '5px 8px', color: '#60a5fa', cursor: 'pointer' }}><Pencil size={12} /></button>
                                <button onClick={() => b._id && deleteBudget(b._id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 5, padding: '5px 8px', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={12} /></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payments sub-tab */}
          {financeTab === 'payments' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
                <label style={{ fontSize: 12, color: '#94a3b8' }}>Status:</label>
                <select value={paymentStatusFilter} onChange={e => setPaymentStatusFilter(e.target.value)} style={{ ...S.select, width: 150 }}>
                  {['All', ...PAYMENT_STATUS_OPTIONS].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {isAdmin && <button style={{ ...S.btn, ...S.btnPrimary, marginLeft: 'auto' }} onClick={() => { setEditPayment(null); setPaymentForm({ ...BLANK_PAYMENT }); setShowPaymentModal(true); }}><Plus size={14} />Add Payment</button>}
              </div>

              <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <tr>
                      {['AMC No', 'Equipment', 'Contractor', 'Invoice No', 'Invoice Date', 'Invoice Amt', 'Paid', 'Balance', 'Payment Date', 'Status', ...(isAdmin ? ['Actions'] : [])].map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr><td colSpan={11} style={{ ...S.td, textAlign: 'center', padding: 30, color: '#475569' }}>No payment records</td></tr>
                    ) : payments.map((p, i) => (
                      <tr key={p._id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                        <td style={S.td}><span style={{ color: '#60a5fa', fontSize: 11, fontWeight: 600 }}>{p.amcNumber}</span></td>
                        <td style={S.td}>{p.equipmentName}</td>
                        <td style={S.td}>{p.contractorCompany}</td>
                        <td style={S.td}>{p.invoiceNumber}</td>
                        <td style={S.td}>{fmtDate(p.invoiceDate)}</td>
                        <td style={{ ...S.td, textAlign: 'right' as const }}>{fmtCurrency(p.invoiceAmount)}</td>
                        <td style={{ ...S.td, textAlign: 'right' as const, color: '#10B981' }}>{fmtCurrency(p.paidAmount)}</td>
                        <td style={{ ...S.td, textAlign: 'right' as const, color: p.balance > 0 ? '#EF4444' : '#10B981', fontWeight: 600 }}>{fmtCurrency(p.balance)}</td>
                        <td style={S.td}>{fmtDate(p.paymentDate)}</td>
                        <td style={S.td}><PaymentStatusBadge status={p.paymentStatus} /></td>
                        {isAdmin && (
                          <td style={S.td}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => { setEditPayment(p); setPaymentForm({ amcId: p.amcId, amcNumber: p.amcNumber, equipmentName: p.equipmentName, contractorCompany: p.contractorCompany, invoiceNumber: p.invoiceNumber, invoiceDate: p.invoiceDate ? p.invoiceDate.split('T')[0] : '', invoiceAmount: p.invoiceAmount, paidAmount: p.paidAmount, balance: p.balance, paymentDate: p.paymentDate ? p.paymentDate.split('T')[0] : '', paymentStatus: p.paymentStatus, remarks: p.remarks }); setShowPaymentModal(true); }} style={{ background: 'rgba(37,99,235,0.15)', border: 'none', borderRadius: 5, padding: '5px 8px', color: '#60a5fa', cursor: 'pointer' }}><Pencil size={12} /></button>
                              <button onClick={() => p._id && deletePayment(p._id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 5, padding: '5px 8px', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={12} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REPORTS TAB ── */}
      {tab === 'reports' && (
        <div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Click any report to generate and download a PDF. Use the Excel button in the header for spreadsheet export.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
            {[
              { title: 'AMC Register',    desc: 'Complete list of all AMC contracts with status, dates, and values.',         icon: <FileText size={22}/>,    color: '#2563EB' },
              { title: 'Expiry Report',   desc: 'Contracts expiring within 30 days — requires urgent renewal action.',         icon: <AlertTriangle size={22}/>,color: '#F59E0B' },
              { title: 'Schedule Report', desc: 'Full schedule of planned and completed maintenance visits.',                   icon: <Calendar size={22}/>,    color: '#10B981' },
              { title: 'Payment Report',  desc: 'Invoice and payment tracking with outstanding balance summary.',              icon: <DollarSign size={22}/>,  color: '#8B5CF6' },
              { title: 'Budget Report',   desc: 'Allocated vs actual spend by department and category.',                       icon: <TrendingUp size={22}/>,  color: '#06B6D4' },
            ].map(r => (
              <div key={r.title} onClick={() => exportPdf(r.title)}
                style={{ ...S.card, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 10 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = `${r.color}44`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
              >
                <div style={{ color: r.color }}>{r.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>{r.title}</div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{r.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', color: r.color, fontSize: 12, fontWeight: 600 }}>
                  <Download size={13} /> Download PDF
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ADD / EDIT MODAL ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '30px 16px', overflowY: 'auto' }}>
          <div style={{ background: '#0d1526', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, width: '100%', maxWidth: 900, position: 'relative' }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{editRecord ? 'Edit AMC' : 'Add New AMC'}</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
            </div>
            {/* Modal body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', maxHeight: 'calc(90vh - 130px)' }}>

              {/* Section 1: Equipment Information */}
              <SectionHeader title="1. Equipment Information" color="#2563EB" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                <Field label="AMC Number *">
                  <input value={form.amcNumber} onChange={e => handleFormChange('amcNumber', e.target.value)} style={S.input} placeholder="Auto-generated" />
                </Field>
                <Field label="Equipment Name *">
                  <input value={form.equipmentName} onChange={e => handleFormChange('equipmentName', e.target.value)} style={S.input} placeholder="e.g. HVAC Unit" />
                </Field>
                <Field label="Equipment Code">
                  <input value={form.equipmentCode} onChange={e => handleFormChange('equipmentCode', e.target.value)} style={S.input} placeholder="e.g. EQ-001" />
                </Field>
                <Field label="Equipment Category">
                  <input value={form.equipmentCategory} onChange={e => handleFormChange('equipmentCategory', e.target.value)} style={S.input} placeholder="e.g. HVAC" />
                </Field>
                <Field label="Department">
                  <input value={form.department} onChange={e => handleFormChange('department', e.target.value)} style={S.input} placeholder="e.g. Production" />
                </Field>
                <Field label="Area / Location">
                  <input value={form.area} onChange={e => handleFormChange('area', e.target.value)} style={S.input} placeholder="e.g. Building A" />
                </Field>
                <Field label="Manufacturer">
                  <input value={form.manufacturer} onChange={e => handleFormChange('manufacturer', e.target.value)} style={S.input} />
                </Field>
                <Field label="Model Number">
                  <input value={form.modelNumber} onChange={e => handleFormChange('modelNumber', e.target.value)} style={S.input} />
                </Field>
                <Field label="Serial Number">
                  <input value={form.serialNumber} onChange={e => handleFormChange('serialNumber', e.target.value)} style={S.input} />
                </Field>
                <Field label="Asset ID">
                  <input value={form.assetId} onChange={e => handleFormChange('assetId', e.target.value)} style={S.input} />
                </Field>
                <Field label="Criticality">
                  <select value={form.criticality} onChange={e => handleFormChange('criticality', e.target.value)} style={S.select}>
                    {CRITICALITY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={e => handleFormChange('status', e.target.value)} style={S.select}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>

              {/* Section 2: AMC Details */}
              <SectionHeader title="2. AMC Details" color="#10B981" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                <Field label="AMC Type">
                  <select value={form.amcType} onChange={e => handleFormChange('amcType', e.target.value)} style={S.select}>
                    {AMC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Frequency">
                  <select value={form.frequency} onChange={e => handleFormChange('frequency', e.target.value)} style={S.select}>
                    {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                {form.frequency === 'Custom' && (
                  <Field label="Custom Interval (Days)">
                    <input type="number" value={form.customIntervalDays} onChange={e => handleFormChange('customIntervalDays', Number(e.target.value))} style={S.input} min={1} />
                  </Field>
                )}
                <Field label="Visits per Year">
                  <input type="number" value={form.visitsPerYear} readOnly style={{ ...S.input, opacity: 0.7 }} />
                </Field>
                <Field label="Start Date *">
                  <DateInput value={form.startDate} onChange={v => handleFormChange('startDate', v)} />
                </Field>
                <Field label="End Date *">
                  <DateInput value={form.endDate} onChange={v => handleFormChange('endDate', v)} />
                </Field>
                <Field label="Payment Terms">
                  <select value={form.paymentTerms} onChange={e => handleFormChange('paymentTerms', e.target.value)} style={S.select}>
                    {['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly', 'Advance', 'On Completion'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Grace Period (Days)">
                  <input type="number" value={form.gracePeriodDays} onChange={e => handleFormChange('gracePeriodDays', Number(e.target.value))} style={S.input} min={0} />
                </Field>
                <Field label="Auto Renewal">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                    <input type="checkbox" checked={form.autoRenewal} onChange={e => handleFormChange('autoRenewal', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#2563EB' }} />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Enable auto-renewal</span>
                  </div>
                </Field>
              </div>

              {/* Section 3: Contractor Information */}
              <SectionHeader title="3. Contractor Information" color="#F59E0B" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                <Field label="Contractor Company">
                  <input value={form.contractorCompany} onChange={e => handleFormChange('contractorCompany', e.target.value)} style={S.input} />
                </Field>
                <Field label="Contact Person">
                  <input value={form.contactPerson} onChange={e => handleFormChange('contactPerson', e.target.value)} style={S.input} />
                </Field>
                <Field label="Mobile">
                  <input value={form.mobile} onChange={e => handleFormChange('mobile', e.target.value)} style={S.input} />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.email} onChange={e => handleFormChange('email', e.target.value)} style={S.input} />
                </Field>
                <Field label="Trade License">
                  <input value={form.tradeLicense} onChange={e => handleFormChange('tradeLicense', e.target.value)} style={S.input} />
                </Field>
                <Field label="TRN Number">
                  <input value={form.trnNumber} onChange={e => handleFormChange('trnNumber', e.target.value)} style={S.input} />
                </Field>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label="Address">
                    <textarea value={form.address} onChange={e => handleFormChange('address', e.target.value)} style={{ ...S.input, height: 64, resize: 'vertical' }} />
                  </Field>
                </div>
              </div>

              {/* Section 4: Financial Information */}
              <SectionHeader title="4. Financial Information" color="#8B5CF6" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                <Field label="Contract Number">
                  <input value={form.contractNumber} onChange={e => handleFormChange('contractNumber', e.target.value)} style={S.input} />
                </Field>
                <Field label="PO Number">
                  <input value={form.poNumber} onChange={e => handleFormChange('poNumber', e.target.value)} style={S.input} />
                </Field>
                <Field label="Agreement Number">
                  <input value={form.agreementNumber} onChange={e => handleFormChange('agreementNumber', e.target.value)} style={S.input} />
                </Field>
                <Field label="Invoice Number">
                  <input value={form.invoiceNumber} onChange={e => handleFormChange('invoiceNumber', e.target.value)} style={S.input} />
                </Field>
                <Field label="Currency">
                  <select value={form.currency} onChange={e => handleFormChange('currency', e.target.value)} style={S.select}>
                    {['AED', 'USD', 'EUR', 'GBP', 'SAR'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Contract Value">
                  <input type="number" value={form.contractValue} onChange={e => handleFormChange('contractValue', Number(e.target.value))} style={S.input} min={0} step={0.01} />
                </Field>
                <Field label="VAT %">
                  <input type="number" value={form.vatPercent} onChange={e => handleFormChange('vatPercent', Number(e.target.value))} style={S.input} min={0} max={100} />
                </Field>
                <Field label="VAT Amount">
                  <input type="number" value={form.vatAmount} readOnly style={{ ...S.input, opacity: 0.7 }} />
                </Field>
                <Field label="Total Contract Value">
                  <input type="number" value={form.totalContractValue} readOnly style={{ ...S.input, opacity: 0.7, fontWeight: 700 }} />
                </Field>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label="Remarks">
                    <textarea value={form.remarks} onChange={e => handleFormChange('remarks', e.target.value)} style={{ ...S.input, height: 64, resize: 'vertical' }} />
                  </Field>
                </div>
              </div>

              {/* Section 5: Documents */}
              <SectionHeader title="5. Documents" color="#06B6D4" />
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <button onClick={() => fileInputRef.current?.click()} style={{ ...S.btn, ...S.btnGhost, fontSize: 12 }}><Plus size={13} />Upload Document</button>
                  <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleDocUpload} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                </div>
                {form.documents.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {form.documents.map((d, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                        <FileText size={12} />{d.name}
                        <button onClick={() => removeDoc(i)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0, marginLeft: 2 }}><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button onClick={() => setShowModal(false)} style={{ ...S.btn, ...S.btnGhost }}>Cancel</button>
              <button onClick={saveAmc} disabled={saving} style={{ ...S.btn, ...S.btnPrimary, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : editRecord ? 'Update AMC' : 'Create AMC'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION ── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0d1526', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '28px 32px', maxWidth: 420, width: '90%', textAlign: 'center' }}>
            <div style={{ color: '#EF4444', marginBottom: 12 }}><Trash2 size={32} /></div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Delete AMC Record?</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              This will permanently delete <strong style={{ color: '#e2e8f0' }}>{deleteTarget.amcNumber} — {deleteTarget.equipmentName}</strong> along with all associated schedules and payments.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ ...S.btn, ...S.btnGhost, padding: '8px 24px' }}>Cancel</button>
              <button onClick={() => deleteTarget._id && deleteAmc(deleteTarget._id)} style={{ ...S.btn, ...S.btnDanger, padding: '8px 24px' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── COMPLETE SCHEDULE MODAL ── */}
      {showCompleteModal && completingSchedule && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0d1526', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, width: '100%', maxWidth: 560 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>Mark Visit as Completed</div>
              <button onClick={() => setShowCompleteModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'rgba(37,99,235,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#94a3b8' }}>
                <strong style={{ color: '#60a5fa' }}>{completingSchedule.amcNumber}</strong> — {completingSchedule.equipmentName} — Visit #{completingSchedule.visitNumber} — Scheduled: {fmtDate(completingSchedule.scheduledDate)}
              </div>
              <Field label="Engineer Name">
                <input value={completeForm.engineerName} onChange={e => setCompleteForm(p => ({ ...p, engineerName: e.target.value }))} style={S.input} />
              </Field>
              <Field label="Work Done">
                <textarea value={completeForm.workDone} onChange={e => setCompleteForm(p => ({ ...p, workDone: e.target.value }))} style={{ ...S.input, height: 70, resize: 'vertical' }} />
              </Field>
              <Field label="Observations">
                <textarea value={completeForm.observations} onChange={e => setCompleteForm(p => ({ ...p, observations: e.target.value }))} style={{ ...S.input, height: 60, resize: 'vertical' }} />
              </Field>
              <Field label="Parts Replaced">
                <input value={completeForm.partsReplaced} onChange={e => setCompleteForm(p => ({ ...p, partsReplaced: e.target.value }))} style={S.input} />
              </Field>
              <Field label="Recommendations">
                <textarea value={completeForm.recommendations} onChange={e => setCompleteForm(p => ({ ...p, recommendations: e.target.value }))} style={{ ...S.input, height: 60, resize: 'vertical' }} />
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button onClick={() => setShowCompleteModal(false)} style={{ ...S.btn, ...S.btnGhost }}>Cancel</button>
              <button onClick={saveComplete} style={{ ...S.btn, background: 'rgba(16,185,129,0.2)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}><CheckCircle size={14} />Mark Completed</button>
            </div>
          </div>
        </div>
      )}

      {/* ── UPLOAD PREVIEW MODAL ── */}
      {showUploadModal && uploadRows.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#0d1526', border: '1px solid rgba(37,99,235,0.35)', borderRadius: 12, width: '100%', maxWidth: 900, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>Upload Preview — {uploadRows.length} record(s)</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Review the parsed data before saving to the database.</div>
              </div>
              <button onClick={() => { setShowUploadModal(false); setUploadRows([]); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            {/* Mode selector */}
            <div style={{ padding: '12px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 24, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Upload Mode:</span>
              {(['new','update'] as const).map(m => (
                <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: uploadMode === m ? '#60a5fa' : '#94a3b8', fontWeight: uploadMode === m ? 600 : 400 }}>
                  <input type="radio" name="uploadMode" value={m} checked={uploadMode === m} onChange={() => setUploadMode(m)}
                    style={{ accentColor: '#2563EB' }} />
                  {m === 'new' ? '➕ Add as New Records' : '✏️ Update Existing (match by AMC Number)'}
                </label>
              ))}
              {uploadMode === 'update' && (
                <span style={{ fontSize: 11, color: '#F59E0B', marginLeft: 4 }}>If AMC number is not found it will be created as new.</span>
              )}
            </div>

            {/* Preview table */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '0 22px 8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, fontSize: 11 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#0d1526' }}>
                  <tr>
                    {['#','AMC No','Equipment','Dept','Contractor','Frequency','Start','End','Value (AED)','Criticality','Status'].map(h =>
                      <th key={h} style={{ ...S.th, background: 'rgba(30,58,138,0.4)', padding: '8px 10px' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {uploadRows.map((r, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <td style={{ ...S.td, color: '#475569', fontSize: 10 }}>{i + 1}</td>
                      <td style={{ ...S.td, color: '#60a5fa', fontWeight: 600 }}>{r.amcNumber}</td>
                      <td style={S.td}>{r.equipmentName || <span style={{ color: '#EF4444' }}>⚠ Missing</span>}</td>
                      <td style={S.td}>{r.department || '—'}</td>
                      <td style={S.td}>{r.contractorCompany || '—'}</td>
                      <td style={S.td}>{r.frequency}</td>
                      <td style={S.td}>{r.startDate || '—'}</td>
                      <td style={S.td}>{r.endDate || '—'}</td>
                      <td style={{ ...S.td, textAlign: 'right' as const }}>{fmtCurrency(r.totalContractValue)}</td>
                      <td style={S.td}><CriticalityBadge criticality={r.criticality} /></td>
                      <td style={S.td}><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button onClick={() => { setShowUploadModal(false); setUploadRows([]); }} style={{ ...S.btn, ...S.btnGhost }}>Cancel</button>
              <button onClick={processUpload} disabled={uploading} style={{ ...S.btn, ...S.btnPrimary, opacity: uploading ? 0.7 : 1 }}>
                <FileSpreadsheet size={14} />{uploading ? 'Saving…' : `Save ${uploadRows.length} Record(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BUDGET MODAL ── */}
      {showBudgetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0d1526', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{editBudget ? 'Edit Budget' : 'Add Budget'}</div>
              <button onClick={() => setShowBudgetModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Budget Year">
                <input type="number" value={budgetForm.budgetYear} onChange={e => setBudgetForm(p => ({ ...p, budgetYear: Number(e.target.value) }))} style={S.input} />
              </Field>
              <Field label="Department *">
                <input value={budgetForm.department} onChange={e => setBudgetForm(p => ({ ...p, department: e.target.value }))} style={S.input} />
              </Field>
              <Field label="Category">
                <input value={budgetForm.category} onChange={e => setBudgetForm(p => ({ ...p, category: e.target.value }))} style={S.input} />
              </Field>
              <Field label="Allocated Budget (AED)">
                <input type="number" value={budgetForm.allocatedBudget} onChange={e => setBudgetForm(p => ({ ...p, allocatedBudget: Number(e.target.value) }))} style={S.input} min={0} />
              </Field>
              <Field label="Actual Spent (AED)">
                <input type="number" value={budgetForm.actualSpent} onChange={e => setBudgetForm(p => ({ ...p, actualSpent: Number(e.target.value) }))} style={S.input} min={0} />
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button onClick={() => setShowBudgetModal(false)} style={{ ...S.btn, ...S.btnGhost }}>Cancel</button>
              <button onClick={saveBudget} style={{ ...S.btn, ...S.btnPrimary }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENT MODAL ── */}
      {showPaymentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0d1526', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, width: '100%', maxWidth: 560 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{editPayment ? 'Edit Payment' : 'Add Payment'}</div>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="AMC Number *">
                <select value={paymentForm.amcNumber} onChange={e => {
                  const amc = amcList.find(a => a.amcNumber === e.target.value);
                  setPaymentForm(p => ({ ...p, amcNumber: e.target.value, amcId: amc?._id || '', equipmentName: amc?.equipmentName || '', contractorCompany: amc?.contractorCompany || '' }));
                }} style={S.select}>
                  <option value="">Select AMC</option>
                  {amcList.map(a => <option key={a._id} value={a.amcNumber}>{a.amcNumber} — {a.equipmentName}</option>)}
                </select>
              </Field>
              <Field label="Invoice Number">
                <input value={paymentForm.invoiceNumber} onChange={e => setPaymentForm(p => ({ ...p, invoiceNumber: e.target.value }))} style={S.input} />
              </Field>
              <Field label="Invoice Date *">
                <input type="date" value={paymentForm.invoiceDate} onChange={e => setPaymentForm(p => ({ ...p, invoiceDate: e.target.value }))} style={S.input} />
              </Field>
              <Field label="Invoice Amount (AED)">
                <input type="number" value={paymentForm.invoiceAmount} onChange={e => setPaymentForm(p => ({ ...p, invoiceAmount: Number(e.target.value), balance: Number(e.target.value) - p.paidAmount }))} style={S.input} min={0} />
              </Field>
              <Field label="Paid Amount (AED)">
                <input type="number" value={paymentForm.paidAmount} onChange={e => setPaymentForm(p => ({ ...p, paidAmount: Number(e.target.value), balance: p.invoiceAmount - Number(e.target.value) }))} style={S.input} min={0} />
              </Field>
              <Field label="Balance (AED)">
                <input type="number" value={paymentForm.balance} readOnly style={{ ...S.input, opacity: 0.7 }} />
              </Field>
              <Field label="Payment Date">
                <input type="date" value={paymentForm.paymentDate || ''} onChange={e => setPaymentForm(p => ({ ...p, paymentDate: e.target.value }))} style={S.input} />
              </Field>
              <Field label="Payment Status">
                <select value={paymentForm.paymentStatus} onChange={e => setPaymentForm(p => ({ ...p, paymentStatus: e.target.value }))} style={S.select}>
                  {PAYMENT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Remarks">
                  <textarea value={paymentForm.remarks} onChange={e => setPaymentForm(p => ({ ...p, remarks: e.target.value }))} style={{ ...S.input, height: 60, resize: 'vertical' }} />
                </Field>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button onClick={() => setShowPaymentModal(false)} style={{ ...S.btn, ...S.btnGhost }}>Cancel</button>
              <button onClick={savePayment} style={{ ...S.btn, ...S.btnPrimary }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
