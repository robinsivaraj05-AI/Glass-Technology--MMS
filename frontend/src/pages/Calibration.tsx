import { useState, useRef, useEffect, useCallback } from 'react';
import {
  FlaskConical, AlertTriangle, CheckCircle, Clock,
  Plus, Search, Download, FileSpreadsheet, Upload, XCircle, Trash2, Edit2, Save, Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ── Types ─────────────────────────────────────────────────────────────────────
interface CalibrationRecord {
  id: string;
  instrumentId: string;
  name: string;
  location: string;
  type: 'Internal' | 'External';
  vendor: string;
  lastDate: string;
  nextDate: string;
  status: 'due-soon' | 'upcoming' | 'overdue' | 'completed';
  certificate: string;
  range: string;
  accuracy: string;
  frequency: string;
}

// ── Persistence key ───────────────────────────────────────────────────────────
const STORAGE_KEY = 'mms_calibration_master';

const SEED_DATA: CalibrationRecord[] = [
  { id: '1', instrumentId: 'PT-023', name: 'Pressure Transmitter 0-10 bar',  location: 'Process Line 1',   type: 'External', vendor: 'Endress+Hauser',       lastDate: '2026-01-15', nextDate: '2026-07-28', status: 'due-soon', certificate: 'CAL-2026-001', range: '0-10 bar',       accuracy: '±0.1%',    frequency: 'Half Yearly' },
  { id: '2', instrumentId: 'FT-045', name: 'Coriolis Flow Meter',            location: 'Cooling Tower',    type: 'External', vendor: 'E+H Calibration Lab',  lastDate: '2026-02-10', nextDate: '2026-08-10', status: 'upcoming', certificate: 'CAL-2026-015', range: '0-100 m³/h',     accuracy: '±0.2%',    frequency: 'Half Yearly' },
  { id: '3', instrumentId: 'TT-012', name: 'Temperature Transmitter PT100',  location: 'Boiler Room',      type: 'Internal', vendor: 'In-house',             lastDate: '2026-03-20', nextDate: '2026-09-20', status: 'upcoming', certificate: 'CAL-2026-022', range: '-50 to 250°C',   accuracy: '±0.5°C',   frequency: 'Half Yearly' },
  { id: '4', instrumentId: 'LT-008', name: 'Level Transmitter',              location: 'Chemical Storage', type: 'External', vendor: 'Yokogawa Service',     lastDate: '2025-12-05', nextDate: '2026-06-05', status: 'overdue',  certificate: 'CAL-2025-098', range: '0-5 m',          accuracy: '±5mm',     frequency: 'Half Yearly' },
  { id: '5', instrumentId: 'ANA-001', name: 'pH Analyzer',                   location: 'ETP',              type: 'External', vendor: 'Hach Service',         lastDate: '2026-04-01', nextDate: '2026-07-01', status: 'overdue',  certificate: 'CAL-2026-031', range: '0-14 pH',        accuracy: '±0.05 pH', frequency: 'Quarterly'   },
  { id: '6', instrumentId: 'WM-003', name: 'Energy Meter 3-Phase',           location: 'Substation 1',     type: 'External', vendor: 'Legal Metrology Dept', lastDate: '2025-07-20', nextDate: '2026-07-20', status: 'due-soon', certificate: 'CAL-2025-055', range: '0-500V 0-1000A', accuracy: 'Class 1',  frequency: 'Yearly'      },
];

function loadFromStorage(): CalibrationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return SEED_DATA;
}

function saveToStorage(records: CalibrationRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; badgeClass: string }> = {
  'due-soon':  { label: 'Due Soon',   color: '#f59e0b', badgeClass: 'badge-warning' },
  'upcoming':  { label: 'Upcoming',   color: '#3b82f6', badgeClass: 'badge-blue'    },
  'overdue':   { label: 'Overdue',    color: '#ef4444', badgeClass: 'badge-danger'  },
  'completed': { label: 'Calibrated', color: '#22c55e', badgeClass: 'badge-success' },
};

function computeStatus(nextDate: string): CalibrationRecord['status'] {
  const days = Math.ceil((new Date(nextDate).getTime() - Date.now()) / 86400000);
  if (days < 0)   return 'overdue';
  if (days <= 30) return 'due-soon';
  return 'upcoming';
}

// ── Validation constants ──────────────────────────────────────────────────────
const VALID_TYPES    = ['Internal', 'External'];
const VALID_STATUSES = ['due-soon', 'upcoming', 'overdue', 'completed'];
const VALID_FREQ     = ['Monthly', 'Quarterly', 'Half Yearly', 'Yearly', '2 Years'];

// ── Excel: Download Template ──────────────────────────────────────────────────
const TEMPLATE_COLS = [
  'instrumentId', 'name', 'location', 'type', 'vendor',
  'lastDate', 'nextDate', 'frequency', 'range', 'accuracy', 'certificate',
];

const COL_NOTES: Record<string, string> = {
  instrumentId: 'Required · Unique tag  e.g. PT-024',
  name:         'Required · Full instrument name',
  location:     'Required · Physical location',
  type:         `Required · One of: ${VALID_TYPES.join(', ')}`,
  vendor:       'Required · Calibration vendor / agency',
  lastDate:     'Required · Format: YYYY-MM-DD',
  nextDate:     'Required · Format: YYYY-MM-DD  (status auto-computed)',
  frequency:    `Required · One of: ${VALID_FREQ.join(', ')}`,
  range:        'Optional · Measuring range  e.g. 0-10 bar',
  accuracy:     'Optional · Accuracy class  e.g. ±0.1%',
  certificate:  'Optional · Certificate number',
};

const SAMPLE_ROWS = [
  { instrumentId:'PT-024', name:'Pressure Transmitter 0-16 bar', location:'Process Line 2', type:'External', vendor:'Endress+Hauser',   lastDate:'2026-01-20', nextDate:'2026-07-20', frequency:'Half Yearly', range:'0-16 bar',    accuracy:'±0.1%',   certificate:'CAL-2026-050' },
  { instrumentId:'TT-015', name:'Thermocouple Type-K',           location:'Furnace Area',   type:'Internal', vendor:'In-house',         lastDate:'2026-03-01', nextDate:'2026-09-01', frequency:'Half Yearly', range:'0 to 1200°C', accuracy:'±2°C',    certificate:'CAL-2026-060' },
  { instrumentId:'DP-009', name:'Differential Pressure TX',      location:'Filter Skid',    type:'External', vendor:'Yokogawa Service', lastDate:'2026-02-15', nextDate:'2026-08-15', frequency:'Half Yearly', range:'0-250 mbar',  accuracy:'±0.075%', certificate:'CAL-2026-070' },
];

function downloadTemplate() {
  const wb  = XLSX.utils.book_new();
  const rows = [
    TEMPLATE_COLS,
    TEMPLATE_COLS.map(c => COL_NOTES[c] ?? ''),
    ...SAMPLE_ROWS.map(r => TEMPLATE_COLS.map(c => (r as any)[c] ?? '')),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = TEMPLATE_COLS.map(c =>
    c === 'name' || c === 'vendor' ? { wch: 36 } : c.includes('Date') ? { wch: 16 } : { wch: 22 }
  );
  TEMPLATE_COLS.forEach((_, ci) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (!ws[ref]) return;
    ws[ref].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E3A8A' } }, alignment: { horizontal: 'center' } };
  });
  XLSX.utils.book_append_sheet(wb, ws, 'Calibration Template');

  const refSheet = XLSX.utils.aoa_to_sheet([
    ['Field', 'Valid Values'],
    ['type',       VALID_TYPES.join(', ')],
    ['frequency',  VALID_FREQ.join(', ')],
    ['Date fields','YYYY-MM-DD  e.g. 2026-09-01'],
    ['status',     'Auto-computed from nextDate (overdue / due-soon / upcoming)'],
  ]);
  refSheet['!cols'] = [{ wch: 18 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, refSheet, 'Valid Values');
  XLSX.writeFile(wb, 'Calibration_Master_Template.xlsx');
}

// ── Excel: Export current master list ────────────────────────────────────────
function exportData(records: CalibrationRecord[]) {
  const wb = XLSX.utils.book_new();
  const rows = records.map(r => ({
    'Instrument ID':   r.instrumentId,
    'Name':            r.name,
    'Location':        r.location,
    'Type':            r.type,
    'Vendor / Lab':    r.vendor,
    'Last Calibrated': r.lastDate,
    'Next Due Date':   r.nextDate,
    'Frequency':       r.frequency,
    'Range':           r.range,
    'Accuracy':        r.accuracy,
    'Certificate':     r.certificate,
    'Status':          STATUS_CONFIG[r.status]?.label ?? r.status,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 14 }, { wch: 36 }, { wch: 22 }, { wch: 12 }, { wch: 28 },
    { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Calibration Master List');
  XLSX.writeFile(wb, `Calibration_Master_List_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Import parse & validate ───────────────────────────────────────────────────
interface ImportRow { row: number; data: Partial<CalibrationRecord>; errors: string[]; mode: 'add' | 'update'; }

function parseImportFile(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb   = XLSX.read(e.target!.result, { type: 'binary' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
        const results: ImportRow[] = rows.map((raw, i) => {
          const errors: string[] = [];
          const d: Partial<CalibrationRecord> = {};
          const str = (k: string) => String(raw[k] ?? '').trim();
          d.instrumentId = str('instrumentId');
          d.name         = str('name');
          d.location     = str('location');
          d.vendor       = str('vendor');
          d.lastDate     = str('lastDate');
          d.nextDate     = str('nextDate');
          d.frequency    = str('frequency');
          d.range        = str('range');
          d.accuracy     = str('accuracy');
          d.certificate  = str('certificate');
          const t = str('type') as CalibrationRecord['type'];
          if (VALID_TYPES.includes(t)) d.type = t; else errors.push(`type must be one of: ${VALID_TYPES.join(', ')}`);
          if (d.nextDate) d.status = computeStatus(d.nextDate);
          const freq = str('frequency');
          if (freq && !VALID_FREQ.includes(freq)) errors.push(`frequency must be one of: ${VALID_FREQ.join(', ')}`);
          if (!d.instrumentId) errors.push('instrumentId is required');
          if (!d.name)         errors.push('name is required');
          if (!d.location)     errors.push('location is required');
          if (!d.vendor)       errors.push('vendor is required');
          if (!d.lastDate)     errors.push('lastDate is required');
          if (!d.nextDate)     errors.push('nextDate is required');
          return { row: i + 2, data: d, errors, mode: 'add' };
        });
        resolve(results);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

// ── Blank form ────────────────────────────────────────────────────────────────
const BLANK: Omit<CalibrationRecord, 'id'> = {
  instrumentId: '', name: '', location: '', type: 'External', vendor: '',
  lastDate: '', nextDate: '', frequency: 'Half Yearly',
  range: '', accuracy: '', certificate: '', status: 'upcoming',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function Calibration() {
  const [records, setRecords]       = useState<CalibrationRecord[]>(loadFromStorage);
  const [isDirty, setIsDirty]       = useState(false);
  const [savedAt, setSavedAt]       = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY) ? 'Loaded from saved data' : null;
  });
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilter]   = useState('all');
  const [showForm, setShowForm]     = useState(false);
  const [editId, setEditId]         = useState<string | null>(null);
  const [form, setForm]             = useState({ ...BLANK });
  const [showInfo, setShowInfo]     = useState(false);

  const importRef                   = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting]   = useState(false);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ── Save to localStorage ──
  const handleSave = useCallback(() => {
    saveToStorage(records);
    setIsDirty(false);
    setSavedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
  }, [records]);

  // ── Mutate helpers — mark dirty ──
  const mutate = useCallback((updater: (prev: CalibrationRecord[]) => CalibrationRecord[]) => {
    setRecords(updater);
    setIsDirty(true);
  }, []);

  // ── Filtering ──
  const filtered = records.filter(c => {
    const t = search.toLowerCase();
    const matchSearch = !t || c.name.toLowerCase().includes(t) || c.instrumentId.toLowerCase().includes(t) || c.location.toLowerCase().includes(t);
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const stats = {
    total:    records.length,
    overdue:  records.filter(c => c.status === 'overdue').length,
    dueSoon:  records.filter(c => c.status === 'due-soon').length,
    upcoming: records.filter(c => c.status === 'upcoming').length,
  };

  // ── Form ──
  const openAdd  = () => { setForm({ ...BLANK }); setEditId(null); setShowForm(true); };
  const openEdit = (r: CalibrationRecord) => { const { id, ...rest } = r; setForm({ ...rest }); setEditId(id); setShowForm(true); };
  const setF     = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const saveForm = () => {
    if (!form.instrumentId || !form.name || !form.nextDate) return;
    const status = form.status || computeStatus(form.nextDate);
    if (editId) {
      mutate(p => p.map(r => r.id === editId ? { ...form, status, id: editId } : r));
    } else {
      if (records.find(r => r.instrumentId === form.instrumentId)) { alert('Instrument ID already exists.'); return; }
      mutate(p => [...p, { ...form, status, id: `cal-${Date.now()}` }]);
    }
    setShowForm(false);
  };

  const deleteRecord = (id: string) => {
    if (!confirm('Delete this calibration record?')) return;
    mutate(p => p.filter(r => r.id !== id));
  };

  // ── Import ──
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const rows = await parseImportFile(file);
      const existing = new Set(records.map(r => r.instrumentId));
      rows.forEach(r => { if (r.data.instrumentId && existing.has(r.data.instrumentId)) r.mode = 'update'; });
      setImportRows(rows);
      setShowImport(true);
    } catch { alert('Failed to read file. Please use the downloaded template.'); }
    finally { setImporting(false); }
  };

  const applyImport = () => {
    const valid = importRows.filter(r => r.errors.length === 0);
    mutate(prev => {
      const map = new Map(prev.map(r => [r.instrumentId, r]));
      valid.forEach(r => {
        const d = r.data as CalibrationRecord;
        d.id = d.id || `cal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        map.set(d.instrumentId, { ...map.get(d.instrumentId), ...d } as CalibrationRecord);
      });
      return Array.from(map.values());
    });
    setShowImport(false);
    setImportRows([]);
  };

  const validCount  = importRows.filter(r => r.errors.length === 0).length;
  const errorCount  = importRows.filter(r => r.errors.length > 0).length;
  const addCount    = importRows.filter(r => r.errors.length === 0 && r.mode === 'add').length;
  const updateCount = importRows.filter(r => r.errors.length === 0 && r.mode === 'update').length;
  const inp: React.CSSProperties = { width: '100%' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Master List Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10 }}>
        <FlaskConical size={16} style={{ color: '#60a5fa' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#93c5fd' }}>Calibration Master List</span>
        <span style={{ fontSize: 11, color: '#475569' }}>— Authoritative record of all instruments requiring periodic calibration</span>
        <button onClick={() => setShowInfo(!showInfo)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', marginLeft: 4 }}>
          <Info size={14} />
        </button>
      </div>

      {/* Info panel */}
      {showInfo && (
        <div style={{ padding: '14px 18px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 10, fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
          <strong style={{ color: '#93c5fd' }}>What is the Calibration Master List?</strong><br />
          It is the complete, authoritative database of every instrument (transmitters, meters, analyzers, sensors) that must be periodically calibrated to maintain measurement accuracy and regulatory compliance.<br /><br />
          <strong style={{ color: '#93c5fd' }}>Workflow:</strong>{' '}
          <span style={{ color: '#60a5fa' }}>① Download Template</span> → Fill in your instruments in Excel →{' '}
          <span style={{ color: '#60a5fa' }}>② Import Excel</span> → Review the preview → Apply →{' '}
          <span style={{ color: '#22c55e' }}>③ Save Master List</span> (data stored in browser) →{' '}
          <span style={{ color: '#60a5fa' }}>④ Export Data</span> for documentation / audit.<br /><br />
          <strong style={{ color: '#f59e0b' }}>Important:</strong> Click <strong>Save Master List</strong> after any add, edit, delete, or import — otherwise changes are lost when you leave this page.
        </div>
      )}


      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Instruments', value: stats.total,    color: '#3b82f6', icon: <FlaskConical size={18} /> },
          { label: 'Overdue',           value: stats.overdue,  color: '#ef4444', icon: <AlertTriangle size={18} /> },
          { label: 'Due Soon (30d)',    value: stats.dueSoon,  color: '#f59e0b', icon: <Clock size={18} /> },
          { label: 'Upcoming (90d)',    value: stats.upcoming, color: '#22c55e', icon: <CheckCircle size={18} /> },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ color: s.color }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Overdue alert */}
      {stats.overdue > 0 && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} style={{ color: '#ef4444' }} />
          <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
            {stats.overdue} instrument(s) overdue — schedule calibration immediately.
          </span>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search instrument ID, name, location…" className="input-dark" style={{ paddingLeft: 30 }} />
        </div>
        <select value={filterStatus} onChange={e => setFilter(e.target.value)} className="input-dark" style={{ width: 150 }}>
          <option value="all">All Status</option>
          <option value="overdue">Overdue</option>
          <option value="due-soon">Due Soon</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
        </select>

        <button className="btn-secondary" style={{ fontSize: 12 }} onClick={downloadTemplate} title="Download blank Excel template">
          <FileSpreadsheet size={13} /> Template
        </button>
        <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => importRef.current?.click()} disabled={importing} title="Import filled Excel — adds new & updates existing by Instrument ID">
          <Upload size={13} /> {importing ? 'Reading…' : 'Import Excel'}
        </button>
        <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImportFile} />
        <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => exportData(records)} title="Export master list to Excel for documentation">
          <Download size={13} /> Export
        </button>

        {/* ── SAVE BUTTON — always visible ── */}
        <button
          onClick={handleSave}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
            background: isDirty
              ? 'linear-gradient(135deg, #22c55e, #16a34a)'
              : 'rgba(34,197,94,0.12)',
            border: isDirty ? '1px solid #22c55e' : '1px solid rgba(34,197,94,0.3)',
            color: isDirty ? '#fff' : '#22c55e',
            boxShadow: isDirty ? '0 0 18px rgba(34,197,94,0.4)' : 'none',
            transition: 'all 0.2s',
          }}
          title={isDirty ? 'Save changes to browser storage' : `Last saved: ${savedAt ?? 'never'}`}
        >
          <Save size={14} />
          {isDirty ? 'Save' : savedAt ? `Saved ✓` : 'Save'}
        </button>

        <button onClick={openAdd} className="btn-primary" style={{ fontSize: 12 }}>
          <Plus size={13} /> Add Instrument
        </button>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Inst. ID</th><th>Instrument Name</th><th>Location</th><th>Type</th>
              <th>Vendor / Lab</th><th>Last Calibrated</th><th>Next Due</th>
              <th>Frequency</th><th>Range</th><th>Accuracy</th><th>Certificate</th>
              <th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={13} style={{ textAlign: 'center', padding: 32, color: '#475569' }}>No records found</td></tr>
            )}
            {filtered.map(c => {
              const daysLeft = Math.ceil((new Date(c.nextDate).getTime() - Date.now()) / 86400000);
              const cfg = STATUS_CONFIG[c.status];
              return (
                <tr key={c.id}>
                  <td style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: 12 }}>{c.instrumentId}</td>
                  <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{c.name}</td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>{c.location}</td>
                  <td><span className={`badge ${c.type === 'External' ? 'badge-blue' : 'badge-purple'}`} style={{ fontSize: 10 }}>{c.type}</span></td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>{c.vendor}</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{new Date(c.lastDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                  <td style={{ fontSize: 12, color: cfg?.color, fontWeight: 600 }}>
                    {new Date(c.nextDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                    <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>
                      {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `in ${daysLeft}d`}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: '#64748b' }}>{c.frequency}</td>
                  <td style={{ fontSize: 11, color: '#64748b' }}>{c.range || '—'}</td>
                  <td style={{ fontSize: 11, color: '#94a3b8' }}>{c.accuracy || '—'}</td>
                  <td style={{ fontSize: 11, color: '#60a5fa', fontFamily: 'monospace' }}>{c.certificate || '—'}</td>
                  <td><span className={`badge ${cfg?.badgeClass}`} style={{ fontSize: 10 }}>{cfg?.label}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(c)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: 10 }} title="Edit">
                        <Edit2 size={10} />
                      </button>
                      <button onClick={() => deleteRecord(c.id)} style={{ padding: '4px 8px', fontSize: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', cursor: 'pointer' }} title="Delete">
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

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>
                {editId ? 'Edit Instrument' : 'Add Instrument to Master List'}
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {([
                { key: 'instrumentId', label: 'Instrument ID *',   placeholder: 'e.g., PT-024' },
                { key: 'name',         label: 'Instrument Name *', placeholder: 'Full descriptive name' },
                { key: 'location',     label: 'Location *',        placeholder: 'Physical location' },
                { key: 'type',         label: 'Calibration Type',  type: 'select', options: VALID_TYPES },
                { key: 'vendor',       label: 'Vendor / Lab *',    placeholder: 'Calibration agency' },
                { key: 'frequency',    label: 'Frequency',         type: 'select', options: VALID_FREQ },
                { key: 'lastDate',     label: 'Last Calibrated',   type: 'date' },
                { key: 'nextDate',     label: 'Next Due Date *',   type: 'date' },
                { key: 'range',        label: 'Measuring Range',   placeholder: 'e.g., 0-10 bar' },
                { key: 'accuracy',     label: 'Accuracy Class',    placeholder: 'e.g., ±0.1%' },
                { key: 'certificate',  label: 'Certificate No.',   placeholder: 'e.g., CAL-2026-001' },
                { key: 'status',       label: 'Status',            type: 'select', options: VALID_STATUSES },
              ] as { key: keyof typeof form; label: string; placeholder?: string; type?: string; options?: string[] }[]).map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select className="input-dark" style={inp} value={form[f.key]} onChange={e => setF(f.key, e.target.value)}>
                      {f.options!.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={f.type ?? 'text'} placeholder={f.placeholder} className="input-dark" style={inp}
                      value={form[f.key]} onChange={e => setF(f.key, e.target.value)} />
                  )}
                </div>
              ))}
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, marginTop: 4 }}>
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={saveForm}>
                  {editId ? 'Update Record' : 'Add to Master List'}
                </button>
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Preview Modal ── */}
      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal-content" style={{ maxWidth: 940, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>Import Preview — Calibration Master List</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {importRows.length} row{importRows.length !== 1 ? 's' : ''} found ·
                  <span style={{ color: '#22c55e' }}> {addCount} new</span> ·
                  <span style={{ color: '#f59e0b' }}> {updateCount} update existing</span>
                  {errorCount > 0 && <span style={{ color: '#ef4444' }}> · {errorCount} errors (skipped)</span>}
                </div>
              </div>
              <button onClick={() => setShowImport(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ padding: '12px 24px', display: 'flex', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
              {[
                { label: `${addCount} New`,       color: '#22c55e', icon: <CheckCircle size={12} /> },
                { label: `${updateCount} Update`, color: '#f59e0b', icon: <AlertTriangle size={12} /> },
                { label: `${errorCount} Error`,   color: '#ef4444', icon: <XCircle size={12} /> },
              ].map(b => (
                <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: b.color + '18', border: `1px solid ${b.color}40`, borderRadius: 8, padding: '4px 12px', color: b.color, fontSize: 12, fontWeight: 600 }}>
                  {b.icon} {b.label}
                </div>
              ))}
              <div style={{ fontSize: 11, color: '#475569', alignSelf: 'center', marginLeft: 8 }}>
                Matched by Instrument ID — existing records will be overwritten with new values.
              </div>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 380, padding: '0 24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 12 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {['Row', 'Mode', 'Inst. ID', 'Name', 'Location', 'Type', 'Vendor', 'Next Due', 'Status', 'Issues'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importRows.map(r => {
                    const ok = r.errors.length === 0;
                    return (
                      <tr key={r.row} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: ok ? 'transparent' : 'rgba(239,68,68,0.05)' }}>
                        <td style={{ padding: '7px 10px', color: '#64748b' }}>{r.row}</td>
                        <td style={{ padding: '7px 10px' }}>
                          {ok ? <span style={{ color: r.mode === 'add' ? '#22c55e' : '#f59e0b', fontWeight: 600, fontSize: 11 }}>{r.mode === 'add' ? '+ Add' : '↻ Update'}</span>
                              : <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 11 }}>✕ Skip</span>}
                        </td>
                        <td style={{ padding: '7px 10px', color: '#60a5fa', fontFamily: 'monospace', fontSize: 11 }}>{r.data.instrumentId || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#e2e8f0', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.data.name || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#94a3b8' }}>{r.data.location || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#94a3b8' }}>{r.data.type || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#94a3b8', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.data.vendor || '—'}</td>
                        <td style={{ padding: '7px 10px', color: STATUS_CONFIG[r.data.status ?? '']?.color ?? '#64748b' }}>{r.data.nextDate || '—'}</td>
                        <td style={{ padding: '7px 10px', fontSize: 10 }}>
                          {r.data.status ? <span className={`badge ${STATUS_CONFIG[r.data.status]?.badgeClass}`} style={{ fontSize: 9 }}>{STATUS_CONFIG[r.data.status]?.label}</span> : '—'}
                        </td>
                        <td style={{ padding: '7px 10px', color: '#ef4444', fontSize: 10 }}>{r.errors.join(' · ') || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#f59e0b' }}>
                After applying, click <strong>Save Master List</strong> to persist the data.
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-secondary" onClick={() => setShowImport(false)}>Cancel</button>
                <button className="btn-primary" disabled={validCount === 0} onClick={applyImport} style={{ opacity: validCount === 0 ? 0.5 : 1 }}>
                  <CheckCircle size={13} /> Apply {validCount} row{validCount !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
