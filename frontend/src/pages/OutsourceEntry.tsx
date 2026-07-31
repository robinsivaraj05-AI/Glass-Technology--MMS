import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Edit2, Trash2, X, Save, Search, ClipboardList, Filter, UserPlus, Copy, FileDown, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Contract { _id: string; contractName: string; contractorCompany: string; paymentTerms: string; }

interface WorkerRow {
  id: string;       // local key only
  name: string;
  age: number;
  workerId: string;
  designation: string;
  workingHours: number;
  overtimeHours: number;
  rate: number;     // per-day rate; 0 = Nil / package
}

interface Entry {
  _id: string;
  contractId: string;
  contractName: string;
  contractorCompany: string;
  poNumber: string;
  workDate: string;
  workers: WorkerRow[];
  // legacy single-worker fields (old data compat)
  workerName?: string;
  workerAge?: number;
  designation?: string;
  workingHours?: number;
  department: string;
  area: string;
  shift: string;
  workDescription: string;
  maintenanceType: string;
  numberOfPersons: number;
  costType: 'daily' | 'package';
  packageCost: number;
  totalCost: number;
  approvedBy: string;
  supervisorName: string;
  completionStatus: 'Completed' | 'In Progress' | 'Pending';
  remarks: string;
}

interface FormBase {
  contractId: string; contractName: string; contractorCompany: string;
  poNumber: string; workDate: string;
  department: string; area: string; shift: string;
  workDescription: string; maintenanceType: string;
  costType: 'daily' | 'package'; packageCost: number;
  approvedBy: string; supervisorName: string;
  completionStatus: 'Completed' | 'In Progress' | 'Pending'; remarks: string;
  // OT Authorization
  otStartTime: string; otEndTime: string;
  otRatePercent: number;   // e.g. 125 = 1.25× (OT hourly = dayRate/8 × otRatePercent/100)
  otReason: string; otReasonDetails: string;
  otApprovedBy: string; otApprovalRef: string;
}

const BLANK_BASE: FormBase = {
  contractId: '', contractName: '', contractorCompany: '',
  poNumber: '', workDate: new Date().toISOString().slice(0, 10),
  department: 'E&I', area: '', shift: 'General',
  workDescription: '', maintenanceType: 'Preventive',
  costType: 'daily', packageCost: 0,
  approvedBy: '', supervisorName: '',
  completionStatus: 'Completed', remarks: '',
  otStartTime: '', otEndTime: '',
  otRatePercent: 125,
  otReason: '', otReasonDetails: '',
  otApprovedBy: '', otApprovalRef: '',
};

const OT_REASONS = [
  'Emergency Breakdown',
  'Production Requirement',
  'Project Deadline',
  'Shutdown / Planned Maintenance',
  'Client / Management Request',
  'Material / Equipment Arrival',
  'Inspection / Audit',
  'Other',
];

const DESIGNATIONS = ['Fitter', 'Welder', 'Helper', 'Electrician', 'Instrumentation Tech', 'Supervisor', 'Engineer', 'Rigger', 'Painter', 'Fabricator', 'Operator', 'Mechanic', 'Carpenter', 'Mason', 'Safety Officer', 'Other'];
const MAINTENANCE_TYPES = ['Preventive', 'Corrective', 'Breakdown', 'Project', 'Shutdown', 'Installation', 'Commissioning', 'Inspection', 'Other'];
const SHIFTS = ['General', 'Morning', 'Afternoon', 'Night', 'Rotational'];

let rowKey = 0;
const blankWorker = (): WorkerRow => ({
  id: `w${++rowKey}`, name: '', age: 0, workerId: '',
  designation: 'Fitter', workingHours: 8, overtimeHours: 0, rate: 0,
});

// Rate is always a flat DAY salary. OT = (dayRate/8) × OT hrs × (otRatePct/100)
const workerRegCost = (w: WorkerRow) => w.rate;
const workerOtCost  = (w: WorkerRow, otRatePct: number) =>
  Math.round((w.rate / 8) * w.overtimeHours * (otRatePct / 100));
const workerCost    = (w: WorkerRow, costType: 'daily' | 'package', otRatePct = 125) =>
  costType === 'package' ? 0 : workerRegCost(w) + workerOtCost(w, otRatePct);

function calcTotal(workers: WorkerRow[], costType: 'daily' | 'package', packageCost: number, otRatePct = 125): number {
  if (costType === 'package') return packageCost;
  return workers.reduce((s, w) => s + workerCost(w, costType, otRatePct), 0);
}

const statusStyle: Record<string, { bg: string; color: string }> = {
  Completed:     { bg: '#dcfce7', color: '#15803d' },
  'In Progress': { bg: '#dbeafe', color: '#1d4ed8' },
  Pending:       { bg: '#fef9c3', color: '#a16207' },
};

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700,
  color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5,
  borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', background: '#f1f5f9',
};
const tdStyle: React.CSSProperties = { padding: '5px 6px', verticalAlign: 'middle' };
const cellInp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', height: 32, padding: '0 7px',
  border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12,
  color: '#1e293b', background: '#fff', outline: 'none',
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function OutsourceEntry() {
  const [entries,   setEntries]   = useState<Entry[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [editing,   setEditing]   = useState<Entry | null>(null);

  // Form state — split into base fields + workers array
  const [formBase, setFormBase] = useState<FormBase>(BLANK_BASE);
  const [workers,  setWorkers]  = useState<WorkerRow[]>([blankWorker()]);
  const [saving,    setSaving]   = useState(false);
  const [deleting,  setDeleting] = useState<string | null>(null);
  const [isRepeat,  setIsRepeat] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const [filterContract, setFilterContract] = useState('');
  const [filterFrom,     setFilterFrom]     = useState('');
  const [filterTo,       setFilterTo]       = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterType,     setFilterType]     = useState('');
  const [search,         setSearch]         = useState('');

  const [otExpanded, setOtExpanded] = useState(false);
  const hasOT     = workers.some(w => w.overtimeHours > 0);
  const isPackage = formBase.costType === 'package';
  const totalCost = calcTotal(workers, formBase.costType, formBase.packageCost, formBase.otRatePercent);

  // ── Data loaders ────────────────────────────────────────────────────────────
  const loadContracts = useCallback(async () => {
    try { setContracts(await apiFetch('/api/contracts/active')); } catch {}
  }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (filterContract) params.set('contractId', filterContract);
      if (filterFrom)     params.set('from', filterFrom);
      if (filterTo)       params.set('to', filterTo);
      if (filterStatus)   params.set('status', filterStatus);
      if (filterType)     params.set('maintenanceType', filterType);
      const data = await apiFetch(`/api/outsource?${params}`);
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
    } catch { toast.error('Failed to load entries'); }
    finally { setLoading(false); }
  }, [page, filterContract, filterFrom, filterTo, filterStatus, filterType]);

  useEffect(() => { loadContracts(); }, [loadContracts]);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  // ── Modal helpers ────────────────────────────────────────────────────────────
  const handleContractChange = (id: string) => {
    const c = contracts.find(c => c._id === id);
    setFormBase(f => ({ ...f, contractId: id, contractName: c?.contractName ?? '', contractorCompany: c?.contractorCompany ?? '' }));
  };

  const openAdd = () => {
    setEditing(null);
    setIsRepeat(false);
    setFormBase(BLANK_BASE);
    setWorkers([blankWorker()]);
    setModal(true);
  };

  const openEdit = (e: Entry) => {
    setIsRepeat(false);
    setEditing(e);
    setFormBase({
      contractId: e.contractId, contractName: e.contractName, contractorCompany: e.contractorCompany,
      poNumber: e.poNumber ?? '',
      workDate: e.workDate?.slice(0, 10) ?? '',
      department: e.department, area: e.area, shift: e.shift,
      workDescription: e.workDescription, maintenanceType: e.maintenanceType,
      costType: e.costType, packageCost: e.packageCost,
      approvedBy: e.approvedBy, supervisorName: e.supervisorName,
      completionStatus: e.completionStatus, remarks: e.remarks,
      otStartTime: (e as any).otStartTime ?? '',
      otEndTime: (e as any).otEndTime ?? '',
      otRatePercent: (e as any).otRatePercent ?? Math.round(((e as any).otMultiplier ?? 1.25) * 100),
      otReason: (e as any).otReason ?? '',
      otReasonDetails: (e as any).otReasonDetails ?? '',
      otApprovedBy: (e as any).otApprovedBy ?? '',
      otApprovalRef: (e as any).otApprovalRef ?? '',
    });
    // Use new workers array if available, else create one row from legacy fields
    if (e.workers && e.workers.length > 0) {
      setWorkers(e.workers.map(w => ({ ...w, id: `w${++rowKey}` })));
    } else {
      setWorkers([{
        id: `w${++rowKey}`,
        name: e.workerName ?? '', age: e.workerAge ?? 0, workerId: '',
        designation: e.designation ?? 'Fitter',
        workingHours: e.workingHours ?? 8, overtimeHours: 0, rate: 0,
      }]);
    }
    setModal(true);
  };

  const openRepeat = (e: Entry) => {
    setEditing(null);
    setIsRepeat(true);
    setFormBase({
      contractId: e.contractId, contractName: e.contractName, contractorCompany: e.contractorCompany,
      poNumber: e.poNumber ?? '',
      workDate: new Date().toISOString().slice(0, 10), // today's date
      department: e.department, area: e.area, shift: e.shift,
      workDescription: e.workDescription, maintenanceType: e.maintenanceType,
      costType: e.costType, packageCost: e.packageCost,
      approvedBy: e.approvedBy, supervisorName: e.supervisorName,
      completionStatus: 'In Progress', remarks: e.remarks,
      otStartTime: '', otEndTime: '',
      otRatePercent: (e as any).otRatePercent ?? Math.round(((e as any).otMultiplier ?? 1.25) * 100),
      otReason: '', otReasonDetails: '', otApprovedBy: '', otApprovalRef: '',
    });
    if (e.workers?.length > 0) {
      setWorkers(e.workers.map(w => ({ ...w, id: `w${++rowKey}` })));
    } else {
      setWorkers([{
        id: `w${++rowKey}`,
        name: e.workerName ?? '', age: e.workerAge ?? 0, workerId: '',
        designation: e.designation ?? 'Fitter',
        workingHours: e.workingHours ?? 8, overtimeHours: 0, rate: 0,
      }]);
    }
    setModal(true);
    toast('Entry copied — adjust date if needed, then save.', { icon: '📋' });
  };

  // ── Template download ────────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const headers = [
      'Work Date', 'Contract Name', 'PO Number', 'Department', 'Area', 'Shift',
      'Cost Type (daily/package)', 'Package Cost', 'OT Rate %',
      'Worker Name', 'Trade/Designation', 'Day Rate (AED)', 'OT Hours',
      'Work Description', 'Maintenance Type', 'Completion Status',
      'Approved By', 'Supervisor Name', 'Remarks',
    ];
    const example = [
      new Date().toISOString().slice(0, 10), 'Contract A', 'PO-001', 'E&I', 'Plant Area', 'General',
      'daily', 0, 125,
      'John Doe', 'Fitter', 250, 0,
      'Preventive maintenance work', 'Preventive', 'Completed',
      'Manager Name', 'Supervisor Name', '',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = headers.map((_, i) => ({ wch: i < 9 ? 16 : 20 }));
    const notes = [
      ['Field', 'Guidance'],
      ['Work Date', 'Format: YYYY-MM-DD (e.g. 2025-07-15)'],
      ['Contract Name', 'Must exactly match an active contract name in the system'],
      ['Shift', 'General / Morning / Afternoon / Night / Rotational'],
      ['Cost Type', '"daily" for per-worker cost, "package" for lump-sum'],
      ['Package Cost', 'Fill only when Cost Type = package; else leave 0'],
      ['OT Rate %', 'Default 125 (= 1.25×). Use 150, 200 for higher rates. Leave 125 if no OT'],
      ['Trade/Designation', 'Fitter / Welder / Helper / Electrician / Supervisor / Engineer …'],
      ['Day Rate (AED)', 'Flat daily salary for the worker (AED)'],
      ['OT Hours', 'Overtime hours worked. Leave 0 if none'],
      ['Maintenance Type', 'Preventive / Corrective / Breakdown / Project / Shutdown / Installation …'],
      ['Completion Status', 'Completed / In Progress / Pending'],
      ['Multiple Workers', 'Add one row per worker. Repeat same date+contract+shift for multiple workers on same day'],
    ];
    const notesWs = XLSX.utils.aoa_to_sheet(notes);
    notesWs['!cols'] = [{ wch: 22 }, { wch: 70 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Work Entry');
    XLSX.utils.book_append_sheet(wb, notesWs, 'Notes');
    XLSX.writeFile(wb, 'Outsource_WorkEntry_Template.xlsx');
  };

  // ── Bulk import from template ─────────────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const dataRows = rows.slice(1).filter(r => r[0] && r[9]); // workDate + workerName required
      if (dataRows.length === 0) { toast.error('No valid data rows found in the file'); setImporting(false); return; }

      const groups: Record<string, { meta: any; workers: any[] }> = {};
      for (const r of dataRows) {
        const workDate        = r[0] instanceof Date ? r[0].toISOString().slice(0,10) : String(r[0]).trim();
        const contractName    = String(r[1]).trim();
        const poNumber        = String(r[2]).trim();
        const department      = String(r[3]).trim() || 'E&I';
        const area            = String(r[4]).trim();
        const shift           = String(r[5]).trim() || 'General';
        const costType        = String(r[6]).trim() === 'package' ? 'package' : 'daily';
        const packageCost     = Number(r[7]) || 0;
        const otRatePercent   = Number(r[8]) || 125;
        const workerName      = String(r[9]).trim();
        const designation     = String(r[10]).trim() || 'Fitter';
        const dayRate         = Number(r[11]) || 0;
        const overtimeHours   = Number(r[12]) || 0;
        const workDescription = String(r[13]).trim();
        const maintenanceType = String(r[14]).trim() || 'Preventive';
        const completionStatus= String(r[15]).trim() || 'Completed';
        const approvedBy      = String(r[16]).trim();
        const supervisorName  = String(r[17]).trim();
        const remarks         = String(r[18]).trim();

        const key = `${workDate}||${contractName}||${poNumber}||${department}||${area}||${shift}||${costType}`;
        if (!groups[key]) {
          const contract = contracts.find(c => c.contractName.toLowerCase() === contractName.toLowerCase());
          groups[key] = {
            meta: {
              contractId: contract?._id ?? '', contractName,
              contractorCompany: contract?.contractorCompany ?? '',
              poNumber, workDate, department, area, shift,
              costType, packageCost, otRatePercent,
              workDescription, maintenanceType, completionStatus,
              approvedBy, supervisorName, remarks,
              otStartTime: '', otEndTime: '', otReason: '', otReasonDetails: '', otApprovedBy: '', otApprovalRef: '',
            },
            workers: [],
          };
        }
        const otCost = Math.round((dayRate / 8) * overtimeHours * (otRatePercent / 100));
        groups[key].workers.push({
          name: workerName, age: 0, workerId: '',
          designation, workingHours: 8, overtimeHours, rate: dayRate,
          cost: dayRate + otCost,
        });
      }

      const allGroups = Object.values(groups);
      let saved = 0, failed = 0;
      for (const g of allGroups) {
        const totalCost = g.meta.costType === 'package'
          ? g.meta.packageCost
          : g.workers.reduce((s: number, w: any) => s + w.cost, 0);
        const payload = { ...g.meta, workers: g.workers, numberOfPersons: g.workers.length, totalCost };
        try {
          await apiFetch('/api/outsource', { method: 'POST', body: JSON.stringify(payload) });
          saved++;
        } catch { failed++; }
      }
      toast.success(`Import complete — ${saved} entr${saved === 1 ? 'y' : 'ies'} saved${failed ? `, ${failed} failed` : ''}`);
      loadEntries();
    } catch (err: any) {
      toast.error('Import failed: ' + (err.message || 'check file format'));
    } finally { setImporting(false); }
  };

  // ── Worker row helpers ───────────────────────────────────────────────────────
  const addWorker    = () => setWorkers(prev => [...prev, blankWorker()]);
  const removeWorker = (id: string) => {
    if (workers.length === 1) { toast.error('At least one worker required'); return; }
    setWorkers(prev => prev.filter(w => w.id !== id));
  };
  const updateWorker = (id: string, patch: Partial<WorkerRow>) =>
    setWorkers(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w));

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formBase.contractName || !formBase.workDate) {
      toast.error('Select a Contract and Work Date'); return;
    }
    const emptyName = workers.find(w => !w.name.trim());
    if (emptyName) { toast.error('Enter name for all workers'); return; }

    // OT validation — if any worker has OT hours, timing + reason + approval are mandatory
    if (workers.some(w => w.overtimeHours > 0)) {
      if (!formBase.otStartTime || !formBase.otEndTime) {
        toast.error('OT timing required — enter OT Start and End time'); setOtExpanded(true); return;
      }
      if (!formBase.otReason) {
        toast.error('Select the reason for Overtime'); setOtExpanded(true); return;
      }
      if (!formBase.otApprovedBy) {
        toast.error('OT Approved By is required'); setOtExpanded(true); return;
      }
    }

    const workerPayload = workers.map(w => ({
      name: w.name, age: w.age, workerId: w.workerId,
      designation: w.designation, workingHours: w.workingHours,
      overtimeHours: w.overtimeHours, rate: w.rate,
      cost: workerCost(w, formBase.costType, formBase.otRatePercent),
    }));

    const payload = {
      ...formBase,
      workers: workerPayload,
      numberOfPersons: workers.length,
      totalCost,
    };

    setSaving(true);
    try {
      if (editing) {
        const updated = await apiFetch(`/api/outsource/${editing._id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setEntries(prev => prev.map(e => e._id === editing._id ? updated : e));
        toast.success('Entry updated');
      } else {
        await apiFetch('/api/outsource', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Entry saved');
        loadEntries();
      }
      setModal(false);
    } catch (err: any) { toast.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this work entry?')) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/outsource/${id}`, { method: 'DELETE' });
      setEntries(prev => prev.filter(e => e._id !== id));
      setTotal(t => t - 1);
      toast.success('Deleted');
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(null); }
  };

  // ── Display helpers ──────────────────────────────────────────────────────────
  const entryWorkerLabel = (e: Entry) => {
    if (e.workers?.length > 0) {
      const first = e.workers[0].name;
      return e.workers.length > 1 ? `${first} +${e.workers.length - 1} more` : first;
    }
    return e.workerName ?? '—';
  };
  const entryDesigLabel = (e: Entry) => {
    if (e.workers?.length > 0) {
      const unique = [...new Set(e.workers.map(w => w.designation))];
      return unique.length > 2 ? unique.slice(0, 2).join(', ') + '…' : unique.join(', ');
    }
    return e.designation ?? '—';
  };

  const displayed = entries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    const workerMatch = e.workers?.some(w => w.name.toLowerCase().includes(q) || w.designation.toLowerCase().includes(q));
    return workerMatch || e.contractorCompany.toLowerCase().includes(q) || (e.poNumber || '').toLowerCase().includes(q) || (e.workerName || '').toLowerCase().includes(q);
  });

  // ── Styles ───────────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 34, padding: '0 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1e293b', background: '#f8fafc', outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 3 };
  const sectionTitle = (t: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: 1, gridColumn: '1/-1', borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginTop: 4 }}>{t}</div>
  );
  const pages = Math.ceil(total / 25);

  return (
    <div style={{ padding: '20px 24px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#0f766e,#14b8a6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ClipboardList size={20} color="#fff"/>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Work Entry</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Daily contractor manpower — per-worker name, designation & individual cost</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport}/>
          <button onClick={handleDownloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', color: '#0f766e', border: '1.5px solid #0f766e', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <FileDown size={15}/> Template
          </button>
          <button onClick={() => importRef.current?.click()} disabled={importing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', color: '#7c3aed', border: '1.5px solid #7c3aed', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: importing ? 'default' : 'pointer', opacity: importing ? 0.6 : 1 }}>
            <Upload size={15}/> {importing ? 'Importing…' : 'Import'}
          </button>
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={15}/> New Entry
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12, fontWeight: 600 }}><Filter size={13}/> Filters:</div>
        <div style={{ flex: '1 1 160px' }}>
          <div style={lbl}>Contract</div>
          <select style={{ ...inp, height: 32 }} value={filterContract} onChange={e => { setFilterContract(e.target.value); setPage(1); }}>
            <option value="">All Contracts</option>
            {contracts.map(c => <option key={c._id} value={c._id}>{c.contractName}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 110px' }}>
          <div style={lbl}>From</div>
          <input type="date" style={{ ...inp, height: 32 }} value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1); }}/>
        </div>
        <div style={{ flex: '1 1 110px' }}>
          <div style={lbl}>To</div>
          <input type="date" style={{ ...inp, height: 32 }} value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1); }}/>
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <div style={lbl}>Work Type</div>
          <select style={{ ...inp, height: 32 }} value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            {MAINTENANCE_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 110px' }}>
          <div style={lbl}>Status</div>
          <select style={{ ...inp, height: 32 }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option>Completed</option><option>In Progress</option><option>Pending</option>
          </select>
        </div>
        <div style={{ position: 'relative', flex: '1 1 170px' }}>
          <div style={lbl}>Search</div>
          <Search size={12} style={{ position: 'absolute', left: 9, bottom: 10, color: '#94a3b8' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Worker, contractor, PO…"
            style={{ ...inp, height: 32, paddingLeft: 26 }}/>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Total Records', value: total },
          { label: 'Showing',       value: displayed.length },
          { label: 'Total Workers', value: displayed.reduce((s, e) => s + (e.workers?.length || e.numberOfPersons || 0), 0) },
          { label: 'Total Cost',    value: `AED ${displayed.reduce((s, e) => s + e.totalCost, 0).toLocaleString('en-AE')}` },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '8px 14px' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{k.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Entries table ── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <ClipboardList size={40} color="#e2e8f0" style={{ marginBottom: 12 }}/>
            <div style={{ color: '#94a3b8', fontSize: 14 }}>No entries found</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1e293b' }}>
                  {['Date','Contract','PO No.','Workers','Designation(s)','Work Type','Persons','Cost Type','Total Cost','Status',''].map(h => (
                    <th key={h} style={{ padding: '11px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#f1f5f9', textTransform: 'uppercase', letterSpacing: 0.7, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((e, i) => {
                  const st = statusStyle[e.completionStatus] || statusStyle.Pending;
                  return (
                    <tr key={e._id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                        {new Date(e.workDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{e.contractName}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{e.contractorCompany}</div>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#374151', fontFamily: 'monospace' }}>{e.poNumber || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{entryWorkerLabel(e)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '3px 10px', borderRadius: 12 }}>{entryDesigLabel(e)}</span>
                        {(e.workers?.some((w: any) => w.overtimeHours > 0) || (e as any).overtimeHours > 0) && (
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 7px', borderRadius: 10, border: '1px solid #fde68a' }}>OT</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#374151' }}>{e.maintenanceType}</td>
                      <td style={{ padding: '10px 12px', fontSize: 15, fontWeight: 800, color: '#0f172a', textAlign: 'center' }}>{e.workers?.length || e.numberOfPersons}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: e.costType === 'package' ? '#6d28d9' : '#065f46', background: e.costType === 'package' ? '#ddd6fe' : '#d1fae5', padding: '3px 10px', borderRadius: 10 }}>
                          {e.costType === 'package' ? 'Package' : 'Per Day'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 800, color: '#0f766e', whiteSpace: 'nowrap' }}>
                        AED {e.totalCost.toLocaleString('en-AE')}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>{e.completionStatus}</span>
                      </td>
                      <td style={{ padding: '9px 11px' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => openRepeat(e)} title="Repeat — copy to today" style={{ padding: '4px 7px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6, color: '#b45309', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600 }}>
                            <Copy size={11}/> Repeat
                          </button>
                          <button onClick={() => openEdit(e)} title="Edit" style={{ padding: '4px 7px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Edit2 size={11}/></button>
                          <button onClick={() => handleDelete(e._id)} disabled={deleting === e._id} title="Delete" style={{ padding: '4px 7px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            {deleting === e._id ? '…' : <Trash2 size={11}/>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#94a3b8', marginRight: 8 }}>Page {page} of {pages}</span>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: page === 1 ? '#f8fafc' : '#fff', color: page === 1 ? '#cbd5e1' : '#475569', cursor: page === 1 ? 'default' : 'pointer', fontSize: 12 }}>Prev</button>
            <button disabled={page === pages} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: page === pages ? '#f8fafc' : '#fff', color: page === pages ? '#cbd5e1' : '#475569', cursor: page === pages ? 'default' : 'pointer', fontSize: 12 }}>Next</button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL
      ════════════════════════════════════════════════════════════════════════ */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12px 16px', overflowY: 'auto' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}
        >
          <div style={{ width: '100%', maxWidth: 1100, background: '#fff', borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', marginTop: 4, marginBottom: 24 }}>

            {/* Header */}
            <div style={{ padding: '14px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdfa', borderRadius: '16px 16px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f766e' }}>
                  {editing ? 'Edit Work Entry' : isRepeat ? 'Repeat Entry (New)' : 'New Work Entry'}
                </div>
                {isRepeat && (
                  <span style={{ fontSize: 11, fontWeight: 700, background: '#fefce8', color: '#b45309', border: '1px solid #fde68a', padding: '2px 10px', borderRadius: 12 }}>
                    📋 Copied from previous — change date &amp; save
                  </span>
                )}
              </div>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18}/></button>
            </div>

            <div style={{ padding: 22 }}>

              {/* ── Contract & Reference ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
                {sectionTitle('Contract & Reference')}
                <div style={{ gridColumn: '1/3' }}>
                  <label style={lbl}>Contract *</label>
                  <select style={inp} value={formBase.contractId} onChange={e => handleContractChange(e.target.value)}>
                    <option value="">— Select Contract —</option>
                    {contracts.map(c => <option key={c._id} value={c._id}>{c.contractName} ({c.contractorCompany})</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Work Date *</label>
                  <input type="date" style={inp} value={formBase.workDate} onChange={e => setFormBase(f => ({ ...f, workDate: e.target.value }))}/>
                </div>
                <div>
                  <label style={lbl}>PO Number</label>
                  <input style={inp} value={formBase.poNumber} onChange={e => setFormBase(f => ({ ...f, poNumber: e.target.value }))} placeholder="e.g. PO/2025/0123"/>
                </div>
                <div>
                  <label style={lbl}>Department</label>
                  <select style={inp} value={formBase.department} onChange={e => setFormBase(f => ({ ...f, department: e.target.value }))}>
                    {['E&I','Mechanical','Civil','Instrumentation','Electrical','Operations'].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Area / Location</label>
                  <input style={inp} value={formBase.area} onChange={e => setFormBase(f => ({ ...f, area: e.target.value }))} placeholder="e.g. Boiler Area"/>
                </div>
                <div>
                  <label style={lbl}>Shift</label>
                  <select style={inp} value={formBase.shift} onChange={e => setFormBase(f => ({ ...f, shift: e.target.value }))}>
                    {SHIFTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Work Type *</label>
                  <select style={inp} value={formBase.maintenanceType} onChange={e => setFormBase(f => ({ ...f, maintenanceType: e.target.value }))}>
                    {MAINTENANCE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* ── Cost Type selector ── */}
              <div style={{ marginBottom: 18, padding: '12px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Cost Type</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {(['daily','package'] as const).map(ct => (
                    <label key={ct} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '7px 18px', borderRadius: 20, border: `2px solid ${formBase.costType === ct ? (ct==='package' ? '#7c3aed' : '#0f766e') : '#e2e8f0'}`, background: formBase.costType === ct ? (ct==='package' ? '#f5f3ff' : '#f0fdfa') : '#fff', fontWeight: 600, fontSize: 13, color: formBase.costType === ct ? (ct==='package' ? '#7c3aed' : '#0f766e') : '#94a3b8' }}>
                      <input type="radio" name="costType" value={ct} checked={formBase.costType === ct} onChange={() => setFormBase(f => ({ ...f, costType: ct }))} style={{ accentColor: ct==='package' ? '#7c3aed' : '#0f766e' }}/>
                      {ct === 'daily' ? 'Per Person / Per Day (flat day salary per worker)' : 'Package / Lump Sum (fixed total price)'}
                    </label>
                  ))}
                  {isPackage && (
                    <div style={{ marginLeft: 12 }}>
                      <label style={lbl}>Package Amount (AED) *</label>
                      <input type="number" min="0" style={{ ...inp, width: 180 }}
                        value={formBase.packageCost || ''}
                        onChange={e => setFormBase(f => ({ ...f, packageCost: Number(e.target.value) }))}
                        placeholder="Total fixed price"/>
                    </div>
                  )}
                </div>
                {isPackage && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#7c3aed', background: '#ede9fe', padding: '6px 12px', borderRadius: 8, display: 'inline-block' }}>
                    Workers below are recorded for manpower tracking only — cost is the fixed package amount above.
                  </div>
                )}
              </div>

              {/* ── Workers Table ── */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Manpower Details &nbsp;—&nbsp; {workers.length} worker{workers.length !== 1 ? 's' : ''}
                  </div>
                  <button onClick={addWorker} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <UserPlus size={13}/> Add Worker
                  </button>
                </div>

                <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isPackage ? 560 : 760 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Worker Name *</th>
                        <th style={{ ...thStyle, width: 65 }}>Age</th>
                        <th style={{ ...thStyle, width: 175 }}>Designation *</th>
                        <th style={{ ...thStyle, width: 70 }}>OT Hrs</th>
                        {!isPackage && <th style={{ ...thStyle, width: 130 }}>Day Rate (AED)</th>}
                        {!isPackage && <th style={{ ...thStyle, width: 150, textAlign: 'right' }}>Worker Cost (AED)</th>}
                        <th style={{ ...thStyle, width: 40 }}/>
                      </tr>
                    </thead>
                    <tbody>
                      {workers.map((w, idx) => {
                        const wCost = workerCost(w, formBase.costType, formBase.otRatePercent);
                        const otHrRate = w.rate > 0 ? (w.rate / 8) * (formBase.otRatePercent / 100) : 0;
                        return (
                          <tr key={w.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                            {/* Name */}
                            <td style={tdStyle}>
                              <input style={cellInp} value={w.name} onChange={e => updateWorker(w.id, { name: e.target.value })} placeholder="Full name"/>
                            </td>
                            {/* Age */}
                            <td style={tdStyle}>
                              <input type="number" min="0" max="99" style={cellInp} value={w.age || ''} onChange={e => updateWorker(w.id, { age: Number(e.target.value) })} placeholder="—"/>
                            </td>
                            {/* Designation */}
                            <td style={tdStyle}>
                              <select style={cellInp} value={w.designation} onChange={e => updateWorker(w.id, { designation: e.target.value })}>
                                {DESIGNATIONS.map(d => <option key={d}>{d}</option>)}
                              </select>
                            </td>
                            {/* OT Hours */}
                            <td style={tdStyle}>
                              <input type="number" min="0" style={cellInp} value={w.overtimeHours || ''} onChange={e => updateWorker(w.id, { overtimeHours: Number(e.target.value) })} placeholder="0"/>
                            </td>
                            {/* Day Rate */}
                            {!isPackage && (
                              <td style={tdStyle}>
                                <input type="number" min="0" style={cellInp} value={w.rate || ''} onChange={e => updateWorker(w.id, { rate: Number(e.target.value) })} placeholder="AED / day"/>
                              </td>
                            )}
                            {/* Computed cost */}
                            {!isPackage && (
                              <td style={{ ...tdStyle, textAlign: 'right' }}>
                                <div style={{ paddingRight: 8 }}>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f766e' }}>
                                    AED {wCost.toLocaleString('en-AE')}
                                  </div>
                                  {w.rate > 0 && (
                                    <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.7 }}>
                                      Day: AED {w.rate.toLocaleString('en-AE')}
                                      {w.overtimeHours > 0 && (
                                        <span style={{ color: '#b45309', display: 'block', fontWeight: 600 }}>
                                          OT: {w.overtimeHours}h × AED {otHrRate.toFixed(2)}/hr = AED {workerOtCost(w, formBase.otRatePercent).toLocaleString('en-AE')}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            )}
                            {/* Delete row */}
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              <button onClick={() => removeWorker(w.id)} title="Remove worker" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', borderRadius: 4, display: 'flex', alignItems: 'center' }}>
                                <X size={14}/>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {!isPackage && (
                      <tfoot>
                        <tr style={{ background: '#f0fdfa', borderTop: '2px solid #0f766e' }}>
                          <td colSpan={4} style={{ padding: '9px 10px', fontWeight: 700, color: '#0f766e', fontSize: 12 }}>
                            SUBTOTAL — {workers.length} person{workers.length !== 1 ? 's' : ''}
                          </td>
                          <td/>
                          <td style={{ padding: '9px 10px', textAlign: 'right', paddingRight: 18, fontWeight: 800, color: '#0f766e', fontSize: 16 }}>
                            AED {totalCost.toLocaleString('en-AE')}
                          </td>
                          <td/>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Total cost badge */}
                <div style={{ marginTop: 10, padding: '12px 20px', background: isPackage ? '#f5f3ff' : '#f0fdfa', borderRadius: 10, border: `2px solid ${isPackage ? '#7c3aed' : '#0f766e'}`, display: 'flex', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.7 }}>Total Cost for this Entry</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: isPackage ? '#7c3aed' : '#0f766e' }}>
                      AED {totalCost.toLocaleString('en-AE')}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 12, color: '#64748b' }}>
                    <div style={{ marginBottom: 2 }}>{workers.length} worker{workers.length !== 1 ? 's' : ''}</div>
                    <div style={{ fontWeight: 700, color: isPackage ? '#7c3aed' : '#0f766e' }}>
                      {isPackage ? 'Package / Lump Sum' : 'Per Person Per Day'}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── OT Authorization (collapsible, appears when any worker has OT) ── */}
              {hasOT && (
                <div style={{ marginBottom: 18, border: `2px solid ${otExpanded ? '#f59e0b' : '#fde68a'}`, borderRadius: 12, overflow: 'hidden' }}>
                  {/* Toggle header — always visible */}
                  <button
                    type="button"
                    onClick={() => setOtExpanded(o => !o)}
                    style={{ width: '100%', background: otExpanded ? '#fef3c7' : '#fffbeb', border: 'none', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 16 }}>⏱</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        Overtime Authorization
                        {!formBase.otStartTime && <span style={{ marginLeft: 8, fontSize: 10, color: '#dc2626', fontWeight: 700 }}>● Required — fill before saving</span>}
                        {formBase.otStartTime && formBase.otApprovedBy && <span style={{ marginLeft: 8, fontSize: 10, color: '#15803d', fontWeight: 700 }}>✓ Filled</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#b45309', marginTop: 1 }}>
                        {workers.filter(w => w.overtimeHours > 0).map(w => `${w.name || 'Worker'} (${w.overtimeHours}h)`).join(', ')}
                        {' · '}Total OT: <strong>{workers.reduce((s, w) => s + (w.overtimeHours || 0), 0)} hrs</strong>
                        {formBase.otStartTime && formBase.otEndTime && ` · ${formBase.otStartTime} → ${formBase.otEndTime}`}
                      </div>
                    </div>
                    <span style={{ fontSize: 18, color: '#b45309', transition: 'transform 0.2s', transform: otExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                  </button>

                  {/* Expandable body */}
                  {otExpanded && (
                    <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, background: '#fffbeb', borderTop: '1px solid #fde68a' }}>

                      {/* OT Rate % */}
                      <div>
                        <label style={{ ...lbl, color: '#92400e' }}>OT Rate (%)</label>
                        <input type="number" min="100" max="500" step="5" style={{ ...inp, borderColor: '#fcd34d' }}
                          value={formBase.otRatePercent}
                          onChange={e => setFormBase(f => ({ ...f, otRatePercent: Number(e.target.value) }))}/>
                        <div style={{ fontSize: 10, color: '#b45309', marginTop: 2 }}>
                          125 = 1.25× &nbsp;|&nbsp; 150 = 1.5× &nbsp;|&nbsp; 200 = 2× (holiday)
                        </div>
                      </div>

                      {/* Timing */}
                      <div>
                        <label style={{ ...lbl, color: '#92400e' }}>OT Start Time *</label>
                        <input type="time" style={{ ...inp, borderColor: formBase.otStartTime ? '#fcd34d' : '#ef4444' }}
                          value={formBase.otStartTime}
                          onChange={e => setFormBase(f => ({ ...f, otStartTime: e.target.value }))}/>
                      </div>
                      <div>
                        <label style={{ ...lbl, color: '#92400e' }}>OT End Time *</label>
                        <input type="time" style={{ ...inp, borderColor: formBase.otEndTime ? '#fcd34d' : '#ef4444' }}
                          value={formBase.otEndTime}
                          onChange={e => setFormBase(f => ({ ...f, otEndTime: e.target.value }))}/>
                      </div>

                      {/* Duration auto-display */}
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        {formBase.otStartTime && formBase.otEndTime ? (() => {
                          const [sh, sm] = formBase.otStartTime.split(':').map(Number);
                          const [eh, em] = formBase.otEndTime.split(':').map(Number);
                          const mins = (eh * 60 + em) - (sh * 60 + sm);
                          if (mins <= 0) return <div style={{ fontSize: 11, color: '#dc2626' }}>End time must be after start</div>;
                          const h = Math.floor(mins / 60), m = mins % 60;
                          return (
                            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, color: '#92400e' }}>
                              ⏱ {h > 0 ? `${h}h ` : ''}{m > 0 ? `${m}min` : ''}
                            </div>
                          );
                        })() : <div style={{ fontSize: 11, color: '#94a3b8' }}>Enter start & end</div>}
                      </div>

                      {/* Reason */}
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ ...lbl, color: '#92400e' }}>Reason for OT *</label>
                        <select style={{ ...inp, borderColor: formBase.otReason ? '#fcd34d' : '#ef4444' }}
                          value={formBase.otReason}
                          onChange={e => setFormBase(f => ({ ...f, otReason: e.target.value }))}>
                          <option value="">— Select Reason —</option>
                          {OT_REASONS.map(r => <option key={r}>{r}</option>)}
                        </select>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ ...lbl, color: '#92400e' }}>Details / Justification</label>
                        <input style={{ ...inp, borderColor: '#fcd34d' }}
                          value={formBase.otReasonDetails}
                          onChange={e => setFormBase(f => ({ ...f, otReasonDetails: e.target.value }))}
                          placeholder="Brief description of why OT was required…"/>
                      </div>

                      {/* Approval */}
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ ...lbl, color: '#92400e' }}>OT Approved By *</label>
                        <input style={{ ...inp, borderColor: formBase.otApprovedBy ? '#fcd34d' : '#ef4444' }}
                          value={formBase.otApprovedBy}
                          onChange={e => setFormBase(f => ({ ...f, otApprovedBy: e.target.value }))}
                          placeholder="Name / Designation of approver"/>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ ...lbl, color: '#92400e' }}>Approval Reference / Permit No.</label>
                        <input style={{ ...inp, borderColor: '#fcd34d' }}
                          value={formBase.otApprovalRef}
                          onChange={e => setFormBase(f => ({ ...f, otApprovalRef: e.target.value }))}
                          placeholder="e.g. OT/2025/001"/>
                      </div>

                      {/* OT cost breakdown table */}
                      <div style={{ gridColumn: '1/-1', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                          OT Cost — Formula: (Day Rate ÷ 8) × OT Hrs × {formBase.otRatePercent}% = OT Cost
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #fcd34d' }}>
                              {['Worker','OT Hrs','Day Rate','Rate / Hr','OT %','OT Cost'].map(h => (
                                <th key={h} style={{ padding: '3px 8px', textAlign: h === 'OT Cost' ? 'right' : 'left', color: '#92400e', fontWeight: 700 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {workers.filter(w => w.overtimeHours > 0 && w.rate > 0).map(w => {
                              const hrRate = w.rate / 8;
                              const otCost = workerOtCost(w, formBase.otRatePercent);
                              return (
                                <tr key={w.id} style={{ borderBottom: '1px solid #fde68a' }}>
                                  <td style={{ padding: '3px 8px', fontWeight: 600, color: '#92400e' }}>{w.name || 'Worker'}</td>
                                  <td style={{ padding: '3px 8px', color: '#78350f' }}>{w.overtimeHours}h</td>
                                  <td style={{ padding: '3px 8px', color: '#78350f' }}>AED {w.rate}/day</td>
                                  <td style={{ padding: '3px 8px', color: '#78350f' }}>AED {hrRate.toFixed(2)}/hr</td>
                                  <td style={{ padding: '3px 8px', color: '#78350f' }}>{formBase.otRatePercent}%</td>
                                  <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 700, color: '#92400e' }}>AED {otCost.toLocaleString('en-AE')}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={5} style={{ padding: '5px 8px', fontWeight: 700, color: '#92400e', borderTop: '2px solid #f59e0b' }}>Total OT Cost</td>
                              <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 800, fontSize: 13, color: '#92400e', borderTop: '2px solid #f59e0b' }}>
                                AED {workers.filter(w => w.overtimeHours > 0).reduce((s, w) => s + workerOtCost(w, formBase.otRatePercent), 0).toLocaleString('en-AE')}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Completion ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {sectionTitle('Completion & Remarks')}
                <div>
                  <label style={lbl}>Supervisor Name</label>
                  <input style={inp} value={formBase.supervisorName} onChange={e => setFormBase(f => ({ ...f, supervisorName: e.target.value }))} placeholder="Name"/>
                </div>
                <div>
                  <label style={lbl}>Approved By</label>
                  <input style={inp} value={formBase.approvedBy} onChange={e => setFormBase(f => ({ ...f, approvedBy: e.target.value }))} placeholder="Name"/>
                </div>
                <div>
                  <label style={lbl}>Status</label>
                  <select style={inp} value={formBase.completionStatus} onChange={e => setFormBase(f => ({ ...f, completionStatus: e.target.value as any }))}>
                    <option>Completed</option><option>In Progress</option><option>Pending</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>Work Description</label>
                  <textarea style={{ ...inp, height: 60, resize: 'vertical', paddingTop: 8 }} value={formBase.workDescription} onChange={e => setFormBase(f => ({ ...f, workDescription: e.target.value }))} placeholder="Describe the work done…"/>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>Remarks</label>
                  <textarea style={{ ...inp, height: 44, resize: 'vertical', paddingTop: 8 }} value={formBase.remarks} onChange={e => setFormBase(f => ({ ...f, remarks: e.target.value }))} placeholder="Any additional remarks…"/>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#f0fdfa', borderRadius: '0 0 16px 16px' }}>
              <button onClick={() => setModal(false)} style={{ padding: '8px 18px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 22px', background: '#0f766e', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
                <Save size={14}/> {saving ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
