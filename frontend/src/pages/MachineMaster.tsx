// @ts-nocheck
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Settings2, Plus, Search, Download, FileSpreadsheet, Upload,
  CheckCircle, XCircle, AlertTriangle, Edit2, Trash2, Eye, X,
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ── Types ─────────────────────────────────────────────────────────────────────
interface MachineRecord {
  id: string;
  machineId: string;       // Tag / Machine ID, e.g. M-001
  name: string;
  category: string;
  location: string;
  department: string;
  manufacturer: string;
  model: string;
  serialNo: string;
  installDate: string;
  capacity: string;        // kW / HP / m³h etc.
  voltage: string;         // V
  current: string;         // A
  speed: string;           // RPM
  driveType: string;       // DOL / VFD / Star-Delta / Direct
  plcTag: string;
  controlPanel: string;
  lastPM: string;
  nextPM: string;
  pmFrequency: string;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  status: 'running' | 'stopped' | 'under-maintenance' | 'breakdown';
  drawingNo: string;
  remarks: string;
}

// ── API helper ────────────────────────────────────────────────────────────────
async function apiFetch(path, options: any = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) { const e = await res.json().catch(() => ({ message: res.statusText })); throw new Error(e.message || 'Request failed'); }
  return res.json();
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES  = ['Motor', 'Pump', 'Compressor', 'Fan / Blower', 'Conveyor', 'Crane / Hoist', 'Chiller', 'Cooling Tower', 'Boiler', 'Generator', 'Transformer', 'Panel / Switchgear', 'Other'];
const DRIVE_TYPES = ['DOL', 'Star-Delta', 'VFD', 'Soft Starter', 'Direct Drive', 'Gear Box', 'Hydraulic', 'N/A'];
const PM_FREQ     = ['Weekly', 'Monthly', 'Quarterly', 'Half Yearly', 'Yearly'];
const DEPARTMENTS = ['Electrical', 'Instrumentation', 'Mechanical', 'Utility', 'Production'];
const CRITICALITY = ['critical', 'high', 'medium', 'low'] as const;
const STATUSES    = ['running', 'stopped', 'under-maintenance', 'breakdown'] as const;

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  running:             { label: 'Running',          color: '#22c55e' },
  stopped:             { label: 'Stopped',           color: '#64748b' },
  'under-maintenance': { label: 'Under Maintenance', color: '#f59e0b' },
  breakdown:           { label: 'Breakdown',         color: '#ef4444' },
};
const CRIT_CFG: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#ef4444' },
  high:     { label: 'High',     color: '#f59e0b' },
  medium:   { label: 'Medium',   color: '#3b82f6' },
  low:      { label: 'Low',      color: '#22c55e' },
};

// ── Seed Data ─────────────────────────────────────────────────────────────────
const SEED_DATA: MachineRecord[] = [
  { id: '1', machineId: 'M-001', name: 'Cooling Water Pump A',          category: 'Pump',       location: 'Utility Block',    department: 'Mechanical',      manufacturer: 'Kirloskar',  model: 'DB-65-200',   serialNo: 'KW-2019-001', installDate: '2019-06-15', capacity: '45 kW',     voltage: '415V', current: '84A',  speed: '1450 RPM', driveType: 'DOL',         plcTag: 'PMP-CW-A', controlPanel: 'MCC-01', lastPM: '2026-04-10', nextPM: '2026-10-10', pmFrequency: 'Half Yearly', criticality: 'critical', status: 'running',   drawingNo: 'DWG-PUMP-001', remarks: '' },
  { id: '2', machineId: 'M-002', name: 'Chiller Unit 1',                category: 'Chiller',    location: 'Chiller Plant',    department: 'Mechanical',      manufacturer: 'Carrier',    model: '30XA-200',    serialNo: 'CA-2020-020', installDate: '2020-03-20', capacity: '200 TR',    voltage: '415V', current: '280A', speed: '—',        driveType: 'VFD',         plcTag: 'CHLR-01',  controlPanel: 'MCC-02', lastPM: '2026-03-15', nextPM: '2026-09-15', pmFrequency: 'Half Yearly', criticality: 'critical', status: 'running',   drawingNo: 'DWG-CHLR-001', remarks: '' },
  { id: '3', machineId: 'M-003', name: 'Compressed Air Compressor',     category: 'Compressor', location: 'Utility Block',    department: 'Mechanical',      manufacturer: 'Atlas Copco', model: 'GA90',       serialNo: 'AC-2021-003', installDate: '2021-01-10', capacity: '90 kW',     voltage: '415V', current: '165A', speed: '1500 RPM', driveType: 'Star-Delta',  plcTag: 'COMP-01',  controlPanel: 'MCC-01', lastPM: '2026-05-01', nextPM: '2026-11-01', pmFrequency: 'Half Yearly', criticality: 'high',     status: 'running',   drawingNo: 'DWG-COMP-001', remarks: '' },
  { id: '4', machineId: 'M-004', name: 'Cooling Tower Fan A',           category: 'Fan / Blower', location: 'Cooling Tower Area', department: 'Mechanical',   manufacturer: 'Paharpur',   model: 'CT-500',      serialNo: 'PP-2019-004', installDate: '2019-06-15', capacity: '22 kW',     voltage: '415V', current: '42A',  speed: '960 RPM',  driveType: 'DOL',         plcTag: 'FAN-CT-A', controlPanel: 'MCC-03', lastPM: '2026-04-20', nextPM: '2026-10-20', pmFrequency: 'Half Yearly', criticality: 'medium',   status: 'running',   drawingNo: 'DWG-FAN-001',  remarks: '' },
  { id: '5', machineId: 'M-005', name: 'Overhead Crane 5T',             category: 'Crane / Hoist', location: 'Production Hall', department: 'Mechanical',    manufacturer: 'Demag',      model: 'DRS-5T',      serialNo: 'DM-2018-005', installDate: '2018-09-01', capacity: '5 Ton',     voltage: '415V', current: '18A',  speed: '—',        driveType: 'VFD',         plcTag: 'CRN-01',   controlPanel: 'PNL-CR1', lastPM: '2026-02-10', nextPM: '2026-08-10', pmFrequency: 'Half Yearly', criticality: 'high',     status: 'stopped',   drawingNo: 'DWG-CRN-001',  remarks: 'Annual inspection due' },
  { id: '6', machineId: 'M-006', name: 'DG Set 500 kVA',                category: 'Generator',  location: 'DG Yard',          department: 'Electrical',      manufacturer: 'Cummins',    model: 'C500D5',      serialNo: 'CM-2016-006', installDate: '2016-05-12', capacity: '500 kVA',   voltage: '415V', current: '694A', speed: '1500 RPM', driveType: 'Direct Drive', plcTag: 'DG-01',    controlPanel: 'DG-PNL', lastPM: '2026-06-01', nextPM: '2026-12-01', pmFrequency: 'Half Yearly', criticality: 'critical', status: 'running',   drawingNo: 'DWG-DG-001',   remarks: '' },
];

// ── Excel Template ────────────────────────────────────────────────────────────
const TMPL_COLS = [
  'machineId','name','category','location','department','manufacturer','model','serialNo',
  'installDate','capacity','voltage','current','speed','driveType',
  'plcTag','controlPanel','lastPM','nextPM','pmFrequency','criticality','status','drawingNo','remarks',
];
const COL_NOTES: Record<string,string> = {
  machineId:    'Required · Unique tag  e.g. M-001',
  name:         'Required · Descriptive machine name',
  category:     `Required · One of: ${CATEGORIES.join(', ')}`,
  location:     'Required · Physical location / area',
  department:   `Required · One of: ${DEPARTMENTS.join(', ')}`,
  manufacturer: 'Required · Make / brand name',
  model:        'Optional · Model number or series',
  serialNo:     'Optional · Serial / tag number',
  installDate:  'Required · YYYY-MM-DD',
  capacity:     'Optional · e.g. 45 kW / 200 TR / 5 Ton',
  voltage:      'Optional · e.g. 415V',
  current:      'Optional · e.g. 84A',
  speed:        'Optional · e.g. 1450 RPM',
  driveType:    `Optional · One of: ${DRIVE_TYPES.join(', ')}`,
  plcTag:       'Optional · PLC / SCADA tag',
  controlPanel: 'Optional · Associated control panel',
  lastPM:       'Optional · YYYY-MM-DD',
  nextPM:       'Required · YYYY-MM-DD',
  pmFrequency:  `Required · One of: ${PM_FREQ.join(', ')}`,
  criticality:  `Required · One of: ${CRITICALITY.join(', ')}`,
  status:       `Required · One of: ${STATUSES.join(', ')}`,
  drawingNo:    'Optional · Drawing / document number',
  remarks:      'Optional · Any notes',
};
const SAMPLE_TMPL = [
  { machineId:'M-007', name:'Process Pump B', category:'Pump', location:'Process Area', department:'Mechanical', manufacturer:'Grundfos', model:'CR-15', serialNo:'GF-22-007', installDate:'2022-06-01', capacity:'15 kW', voltage:'415V', current:'28A', speed:'2900 RPM', driveType:'VFD', plcTag:'PMP-PR-B', controlPanel:'MCC-04', lastPM:'2026-03-01', nextPM:'2026-09-01', pmFrequency:'Half Yearly', criticality:'high', status:'running', drawingNo:'DWG-PUMP-007', remarks:'' },
  { machineId:'M-008', name:'Exhaust Fan Boiler Room', category:'Fan / Blower', location:'Boiler Room', department:'Utility', manufacturer:'TechFan', model:'EF-500', serialNo:'TF-21-008', installDate:'2021-04-15', capacity:'7.5 kW', voltage:'415V', current:'15A', speed:'1450 RPM', driveType:'DOL', plcTag:'FAN-BR-01', controlPanel:'MCC-05', lastPM:'2026-05-10', nextPM:'2026-11-10', pmFrequency:'Half Yearly', criticality:'medium', status:'running', drawingNo:'DWG-FAN-008', remarks:'' },
];

function downloadTemplate() {
  const wb  = XLSX.utils.book_new();
  const rows = [
    TMPL_COLS,
    TMPL_COLS.map(c => COL_NOTES[c] ?? ''),
    ...SAMPLE_TMPL.map(r => TMPL_COLS.map(c => (r as any)[c] ?? '')),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = TMPL_COLS.map(c =>
    c === 'name' || c === 'remarks' ? { wch: 35 } : c.includes('Date') || c.includes('PM') ? { wch: 16 } : { wch: 20 }
  );
  TMPL_COLS.forEach((_, ci) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (!ws[ref]) return;
    ws[ref].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E3A8A' } }, alignment: { horizontal: 'center' } };
  });
  XLSX.utils.book_append_sheet(wb, ws, 'Machine Template');

  const refSheet = XLSX.utils.aoa_to_sheet([
    ['Field','Valid Values'],
    ['category',    CATEGORIES.join(', ')],
    ['department',  DEPARTMENTS.join(', ')],
    ['driveType',   DRIVE_TYPES.join(', ')],
    ['pmFrequency', PM_FREQ.join(', ')],
    ['criticality', CRITICALITY.join(', ')],
    ['status',      STATUSES.join(', ')],
    ['Date fields', 'YYYY-MM-DD  e.g. 2026-09-01'],
  ]);
  refSheet['!cols'] = [{ wch: 16 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, refSheet, 'Valid Values');
  XLSX.writeFile(wb, 'Machine_Master_Template.xlsx');
}

function exportData(records: MachineRecord[]) {
  const wb = XLSX.utils.book_new();
  const rows = records.map(r => ({
    'Machine ID':     r.machineId,    'Name':         r.name,
    'Category':       r.category,     'Location':     r.location,
    'Department':     r.department,   'Manufacturer': r.manufacturer,
    'Model':          r.model,        'Serial No':    r.serialNo,
    'Install Date':   r.installDate,  'Capacity':     r.capacity,
    'Voltage':        r.voltage,      'Current':      r.current,
    'Speed':          r.speed,        'Drive Type':   r.driveType,
    'PLC Tag':        r.plcTag,       'Control Panel':r.controlPanel,
    'Last PM':        r.lastPM,       'Next PM':      r.nextPM,
    'PM Frequency':   r.pmFrequency,  'Criticality':  r.criticality,
    'Status':         STATUS_CFG[r.status]?.label ?? r.status,
    'Drawing No':     r.drawingNo,    'Remarks':      r.remarks,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Machine Master');
  XLSX.writeFile(wb, `Machine_Master_List_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ── Import ────────────────────────────────────────────────────────────────────
interface ImportRow { row: number; data: Partial<MachineRecord>; errors: string[]; mode: 'add' | 'update'; }

function parseImport(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb   = XLSX.read(e.target!.result, { type: 'binary' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string,any>>(ws, { defval: '' });
        const results: ImportRow[] = rows.map((raw, i) => {
          const errors: string[] = [];
          const d: Partial<MachineRecord> = {};
          const s = (k: string) => String(raw[k] ?? '').trim();
          d.machineId    = s('machineId');    d.name      = s('name');
          d.category     = s('category');     d.location  = s('location');
          d.department   = s('department');   d.manufacturer = s('manufacturer');
          d.model        = s('model');        d.serialNo  = s('serialNo');
          d.installDate  = s('installDate');  d.capacity  = s('capacity');
          d.voltage      = s('voltage');      d.current   = s('current');
          d.speed        = s('speed');        d.driveType = s('driveType');
          d.plcTag       = s('plcTag');       d.controlPanel = s('controlPanel');
          d.lastPM       = s('lastPM');       d.nextPM    = s('nextPM');
          d.pmFrequency  = s('pmFrequency');  d.drawingNo = s('drawingNo');
          d.remarks      = s('remarks');
          const crit = s('criticality').toLowerCase() as MachineRecord['criticality'];
          if ((CRITICALITY as readonly string[]).includes(crit)) d.criticality = crit; else errors.push(`criticality: one of ${CRITICALITY.join(', ')}`);
          const stat = s('status').toLowerCase() as MachineRecord['status'];
          if ((STATUSES as readonly string[]).includes(stat)) d.status = stat; else errors.push(`status: one of ${STATUSES.join(', ')}`);
          if (!d.machineId)   errors.push('machineId is required');
          if (!d.name)        errors.push('name is required');
          if (!d.location)    errors.push('location is required');
          if (!d.manufacturer) errors.push('manufacturer is required');
          if (!d.nextPM)      errors.push('nextPM is required');
          if (!d.pmFrequency) errors.push('pmFrequency is required');
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
const BLANK: Omit<MachineRecord,'id'> = {
  machineId:'', name:'', category: CATEGORIES[0], location:'', department: DEPARTMENTS[0],
  manufacturer:'', model:'', serialNo:'', installDate:'', capacity:'',
  voltage:'', current:'', speed:'', driveType: DRIVE_TYPES[0],
  plcTag:'', controlPanel:'', lastPM:'', nextPM:'', pmFrequency: PM_FREQ[2],
  criticality:'medium', status:'running', drawingNo:'', remarks:'',
};

// ── PM days helper ────────────────────────────────────────────────────────────
function pmDays(nextPM: string) {
  return Math.ceil((new Date(nextPM).getTime() - Date.now()) / 86400000);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MachineMaster() {
  const [records, setRecords]       = useState<MachineRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState('All');
  const [statFilter, setStatFilter] = useState('all');
  const [showForm, setShowForm]     = useState(false);
  const [editId, setEditId]         = useState<string | null>(null);
  const [form, setForm]             = useState({ ...BLANK });
  const [viewRec, setViewRec]       = useState<MachineRecord | null>(null);

  const importRef                   = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await fetch('/api/health');
        const data = await apiFetch('/api/machines');
        setRecords(data);
      } catch (e) { console.error('Failed to load machines', e); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = records.filter(r => {
    const t = search.toLowerCase();
    const ms = !t || r.name.toLowerCase().includes(t) || r.machineId.toLowerCase().includes(t) || r.location.toLowerCase().includes(t) || r.manufacturer.toLowerCase().includes(t);
    const mc = catFilter === 'All' || r.category === catFilter;
    const mst = statFilter === 'all' || r.status === statFilter;
    return ms && mc && mst;
  });

  const stats = {
    total:    records.length,
    running:  records.filter(r => r.status === 'running').length,
    maint:    records.filter(r => r.status === 'under-maintenance').length,
    breakdown:records.filter(r => r.status === 'breakdown').length,
    critical: records.filter(r => r.criticality === 'critical').length,
    pmDue:    records.filter(r => pmDays(r.nextPM) <= 30).length,
  };

  const openAdd  = () => { setForm({ ...BLANK }); setEditId(null); setShowForm(true); };
  const openEdit = (r: MachineRecord) => { const { id, ...rest } = r; setForm(rest); setEditId(id); setShowForm(true); };
  const setF     = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveForm = async () => {
    if (!form.machineId || !form.name || !form.nextPM) { alert('Machine ID, Name and Next PM Date are required.'); return; }
    try {
      if (editId) {
        const updated = await apiFetch(`/api/machines/${editId}`, { method: 'PUT', body: JSON.stringify(form) });
        setRecords(p => p.map(r => r.id === editId ? updated : r));
      } else {
        const created = await apiFetch('/api/machines', { method: 'POST', body: JSON.stringify(form) });
        setRecords(p => [...p, created]);
      }
      setShowForm(false);
    } catch (e: any) { alert(e.message || 'Failed to save machine'); }
  };

  const deleteRec = async (id) => {
    if (!confirm('Delete this machine record?')) return;
    try {
      await apiFetch(`/api/machines/${id}`, { method: 'DELETE' });
      setRecords(p => p.filter(r => r.id !== id));
    } catch (e: any) { alert(e.message || 'Failed to delete'); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = ''; setImporting(true);
    try {
      const rows = await parseImport(file);
      const ex = new Set(records.map(r => r.machineId));
      rows.forEach(r => { if (r.data.machineId && ex.has(r.data.machineId)) r.mode = 'update'; });
      setImportRows(rows); setShowImport(true);
    } catch { alert('Failed to read file. Use the downloaded template.'); }
    finally { setImporting(false); }
  };

  const applyImport = async () => {
    const valid = importRows.filter(r => r.errors.length === 0);
    try {
      const result = await apiFetch('/api/machines/bulk', { method: 'POST', body: JSON.stringify({ machines: valid.map(r => r.data) }) });
      // Refresh from server
      const data = await apiFetch('/api/machines');
      setRecords(data);
    } catch (e: any) { alert(e.message || 'Import failed'); }
    setShowImport(false); setImportRows([]);
  };

  const validCount  = importRows.filter(r => r.errors.length === 0).length;
  const errorCount  = importRows.filter(r => r.errors.length > 0).length;
  const addCount    = importRows.filter(r => r.errors.length === 0 && r.mode === 'add').length;
  const updateCount = importRows.filter(r => r.errors.length === 0 && r.mode === 'update').length;

  const inp: React.CSSProperties = { width: '100%' };
  const lbl: React.CSSProperties = { fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 };

  const FORM_FIELDS: { key: keyof typeof form; label: string; type?: string; options?: string[]; placeholder?: string; span?: boolean }[] = [
    { key:'machineId',    label:'Machine ID *',    placeholder:'e.g. M-007' },
    { key:'name',         label:'Machine Name *',  placeholder:'Descriptive name' },
    { key:'category',     label:'Category',        type:'select', options: CATEGORIES },
    { key:'location',     label:'Location *',      placeholder:'Physical location / area' },
    { key:'department',   label:'Department',      type:'select', options: DEPARTMENTS },
    { key:'manufacturer', label:'Manufacturer *',  placeholder:'Make / brand' },
    { key:'model',        label:'Model',           placeholder:'Model number' },
    { key:'serialNo',     label:'Serial No.',      placeholder:'Serial / tag number' },
    { key:'installDate',  label:'Install Date',    type:'date' },
    { key:'capacity',     label:'Capacity / Rating', placeholder:'e.g. 45 kW / 200 TR' },
    { key:'voltage',      label:'Voltage',         placeholder:'e.g. 415V' },
    { key:'current',      label:'Current',         placeholder:'e.g. 84A' },
    { key:'speed',        label:'Speed',           placeholder:'e.g. 1450 RPM' },
    { key:'driveType',    label:'Drive Type',      type:'select', options: DRIVE_TYPES },
    { key:'plcTag',       label:'PLC / SCADA Tag', placeholder:'e.g. PMP-CW-A' },
    { key:'controlPanel', label:'Control Panel',   placeholder:'e.g. MCC-01' },
    { key:'lastPM',       label:'Last PM Date',    type:'date' },
    { key:'nextPM',       label:'Next PM Date *',  type:'date' },
    { key:'pmFrequency',  label:'PM Frequency',    type:'select', options: PM_FREQ },
    { key:'criticality',  label:'Criticality',     type:'select', options: [...CRITICALITY] },
    { key:'status',       label:'Status',          type:'select', options: [...STATUSES] },
    { key:'drawingNo',    label:'Drawing No.',     placeholder:'e.g. DWG-PUMP-001' },
    { key:'remarks',      label:'Remarks',         placeholder:'Any notes', span: true },
  ];

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, flexDirection:'column', gap:16 }}>
      <div style={{ width:40, height:40, border:'3px solid rgba(59,130,246,0.3)', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <div style={{ color:'#64748b', fontSize:14 }}>Loading machine master…</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 }}>
        {[
          { label:'Total Machines',     value: stats.total,     color:'#3b82f6' },
          { label:'Running',            value: stats.running,   color:'#22c55e' },
          { label:'Under Maintenance',  value: stats.maint,     color:'#f59e0b' },
          { label:'Breakdown',          value: stats.breakdown, color:'#ef4444' },
          { label:'Critical',           value: stats.critical,  color:'#8b5cf6' },
          { label:'PM Due ≤30d',        value: stats.pmDue,     color:'#f97316' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding:'12px 14px' }}>
            <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:'#64748b', marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Category pills */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {['All', ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setCatFilter(c)} style={{
            padding:'4px 12px', borderRadius:20, border:'none', cursor:'pointer', fontSize:11, fontWeight:500,
            background: catFilter === c ? '#3b82f6' : 'rgba(255,255,255,0.05)',
            color: catFilter === c ? '#fff' : '#64748b', transition:'all 0.2s',
          }}>{c}</button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:220 }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ID, name, location, manufacturer…" className="input-dark" style={{ paddingLeft:30 }} />
        </div>
        <select value={statFilter} onChange={e => setStatFilter(e.target.value)} className="input-dark" style={{ width:170 }}>
          <option value="all">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
        </select>
        <button className="btn-secondary" style={{ fontSize:12 }} onClick={downloadTemplate} title="Download blank Excel template">
          <FileSpreadsheet size={13} /> Template
        </button>
        <button className="btn-secondary" style={{ fontSize:12 }} onClick={() => importRef.current?.click()} disabled={importing} title="Import filled Excel — adds new & updates existing by Machine ID">
          <Upload size={13} /> {importing ? 'Reading…' : 'Import Excel'}
        </button>
        <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={handleImport} />
        <button className="btn-secondary" style={{ fontSize:12 }} onClick={() => exportData(records)} title="Export master list to Excel">
          <Download size={13} /> Export
        </button>
        <button onClick={openAdd} className="btn-primary" style={{ fontSize:12 }}>
          <Plus size={13} /> Add Machine
        </button>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow:'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Machine ID</th><th>Name</th><th>Category</th><th>Location</th>
              <th>Manufacturer</th><th>Capacity</th><th>Drive</th><th>PLC Tag</th>
              <th>Next PM</th><th>Criticality</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={12} style={{ textAlign:'center', padding:32, color:'#475569' }}>No machines found</td></tr>
            )}
            {filtered.map(r => {
              const days = pmDays(r.nextPM);
              const sc   = STATUS_CFG[r.status];
              const cc   = CRIT_CFG[r.criticality];
              return (
                <tr key={r.id}>
                  <td style={{ color:'#60a5fa', fontFamily:'monospace', fontSize:12, fontWeight:700 }}>{r.machineId}</td>
                  <td style={{ fontWeight:600, color:'#e2e8f0', maxWidth:180 }}>{r.name}</td>
                  <td style={{ fontSize:12, color:'#94a3b8' }}>{r.category}</td>
                  <td style={{ fontSize:12, color:'#94a3b8' }}>{r.location}</td>
                  <td style={{ fontSize:12, color:'#64748b' }}>{r.manufacturer}</td>
                  <td style={{ fontSize:11, color:'#64748b' }}>{r.capacity || '—'}</td>
                  <td style={{ fontSize:11, color:'#94a3b8' }}>{r.driveType || '—'}</td>
                  <td style={{ fontSize:11, color:'#60a5fa', fontFamily:'monospace' }}>{r.plcTag || '—'}</td>
                  <td style={{ fontSize:11, color: days < 0 ? '#ef4444' : days <= 30 ? '#f59e0b' : '#64748b', fontWeight:600 }}>
                    {r.nextPM ? new Date(r.nextPM).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'}) : '—'}
                    <span style={{ fontSize:9, display:'block', color:'#475569' }}>
                      {r.nextPM ? (days < 0 ? `${Math.abs(days)}d overdue` : `in ${days}d`) : ''}
                    </span>
                  </td>
                  <td><span style={{ fontSize:10, fontWeight:600, color: cc.color }}>{cc.label}</span></td>
                  <td>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:600, color: sc.color }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background: sc.color, flexShrink:0 }} />
                      {sc.label}
                    </span>
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:5 }}>
                      <button onClick={() => setViewRec(r)} className="btn-secondary" style={{ padding:'4px 7px', fontSize:10 }} title="View details"><Eye size={10} /></button>
                      <button onClick={() => openEdit(r)} className="btn-secondary" style={{ padding:'4px 7px', fontSize:10 }} title="Edit"><Edit2 size={10} /></button>
                      <button onClick={() => deleteRec(r.id)} style={{ padding:'4px 7px', fontSize:10, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:6, color:'#ef4444', cursor:'pointer' }} title="Delete"><Trash2 size={10} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── View Detail Modal ── */}
      {viewRec && (
        <div className="modal-overlay" onClick={() => setViewRec(null)}>
          <div className="modal-content" style={{ maxWidth:750 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:'18px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'#f1f5f9' }}>{viewRec.name}</div>
                <div style={{ fontSize:11, color:'#64748b', fontFamily:'monospace', marginTop:2 }}>{viewRec.machineId} · {viewRec.serialNo || 'No serial'}</div>
              </div>
              <button onClick={() => setViewRec(null)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div style={{ padding:24, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, maxHeight:'70vh', overflowY:'auto' }}>
              {[
                ['Category',     viewRec.category],    ['Location',    viewRec.location],
                ['Department',   viewRec.department],   ['Manufacturer',viewRec.manufacturer],
                ['Model',        viewRec.model],        ['Serial No.',  viewRec.serialNo],
                ['Install Date', viewRec.installDate],  ['Capacity',    viewRec.capacity],
                ['Voltage',      viewRec.voltage],      ['Current',     viewRec.current],
                ['Speed',        viewRec.speed],        ['Drive Type',  viewRec.driveType],
                ['PLC Tag',      viewRec.plcTag],       ['Control Panel',viewRec.controlPanel],
                ['Last PM',      viewRec.lastPM],       ['Next PM',     viewRec.nextPM],
                ['PM Frequency', viewRec.pmFrequency],  ['Drawing No.', viewRec.drawingNo],
                ['Criticality',  CRIT_CFG[viewRec.criticality]?.label],
                ['Status',       STATUS_CFG[viewRec.status]?.label],
              ].map(([label, value]) => (
                <div key={label} style={{ padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:8 }}>
                  <div style={{ fontSize:10, color:'#475569', textTransform:'uppercase', letterSpacing:0.6, marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:13, color:'#e2e8f0', fontWeight:500 }}>{value || '—'}</div>
                </div>
              ))}
              {viewRec.remarks && (
                <div style={{ gridColumn:'1/-1', padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:8 }}>
                  <div style={{ fontSize:10, color:'#475569', textTransform:'uppercase', letterSpacing:0.6, marginBottom:3 }}>Remarks</div>
                  <div style={{ fontSize:13, color:'#e2e8f0' }}>{viewRec.remarks}</div>
                </div>
              )}
            </div>
            <div style={{ padding:'14px 24px', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:10 }}>
              <button className="btn-primary" style={{ fontSize:12 }} onClick={() => { openEdit(viewRec); setViewRec(null); }}><Edit2 size={12}/> Edit</button>
              <button className="btn-secondary" style={{ fontSize:12 }} onClick={() => setViewRec(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" style={{ maxWidth:780 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:'18px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between' }}>
              <div style={{ fontSize:16, fontWeight:600, color:'#f1f5f9' }}>{editId ? 'Edit Machine' : 'Add Machine to Master List'}</div>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:20 }}>×</button>
            </div>
            <div style={{ padding:24, display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, maxHeight:'75vh', overflowY:'auto' }}>
              {FORM_FIELDS.map(f => (
                <div key={f.key} style={{ gridColumn: f.span ? '1/-1' : undefined }}>
                  <label style={lbl}>{f.label}</label>
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
              <div style={{ gridColumn:'1/-1', display:'flex', gap:10, marginTop:4 }}>
                <button className="btn-primary" style={{ flex:1, justifyContent:'center' }} onClick={saveForm}>
                  {editId ? 'Update Machine' : 'Add to Master List'}
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
          <div className="modal-content" style={{ maxWidth:960, maxHeight:'90vh' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:'16px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:'#f1f5f9' }}>Import Preview — Machine Master</div>
                <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>
                  {importRows.length} row{importRows.length !== 1 ? 's' : ''} ·
                  <span style={{ color:'#22c55e' }}> {addCount} new</span> ·
                  <span style={{ color:'#f59e0b' }}> {updateCount} update</span>
                  {errorCount > 0 && <span style={{ color:'#ef4444' }}> · {errorCount} errors (skipped)</span>}
                </div>
              </div>
              <button onClick={() => setShowImport(false)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:20 }}>×</button>
            </div>
            <div style={{ padding:'12px 24px', display:'flex', gap:10, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              {[
                { label:`${addCount} New`,       color:'#22c55e', icon:<CheckCircle size={12}/> },
                { label:`${updateCount} Update`, color:'#f59e0b', icon:<AlertTriangle size={12}/> },
                { label:`${errorCount} Error`,   color:'#ef4444', icon:<XCircle size={12}/> },
              ].map(b => (
                <div key={b.label} style={{ display:'flex', alignItems:'center', gap:5, background:b.color+'18', border:`1px solid ${b.color}40`, borderRadius:8, padding:'4px 12px', color:b.color, fontSize:12, fontWeight:600 }}>
                  {b.icon} {b.label}
                </div>
              ))}
            </div>
            <div style={{ overflowY:'auto', maxHeight:380, padding:'0 24px' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, marginTop:12 }}>
                <thead>
                  <tr style={{ background:'rgba(255,255,255,0.04)' }}>
                    {['Row','Mode','Machine ID','Name','Category','Location','Manufacturer','Next PM','Status','Issues'].map(h => (
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', color:'#64748b', fontWeight:600, fontSize:11, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importRows.map(r => {
                    const ok = r.errors.length === 0;
                    return (
                      <tr key={r.row} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', background: ok ? 'transparent' : 'rgba(239,68,68,0.05)' }}>
                        <td style={{ padding:'7px 10px', color:'#64748b' }}>{r.row}</td>
                        <td style={{ padding:'7px 10px' }}>
                          {ok ? <span style={{ color: r.mode==='add'?'#22c55e':'#f59e0b', fontWeight:600, fontSize:11 }}>{r.mode==='add'?'+ Add':'↻ Update'}</span>
                              : <span style={{ color:'#ef4444', fontWeight:600, fontSize:11 }}>✕ Skip</span>}
                        </td>
                        <td style={{ padding:'7px 10px', color:'#60a5fa', fontFamily:'monospace', fontSize:11 }}>{r.data.machineId||'—'}</td>
                        <td style={{ padding:'7px 10px', color:'#e2e8f0', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.data.name||'—'}</td>
                        <td style={{ padding:'7px 10px', color:'#94a3b8' }}>{r.data.category||'—'}</td>
                        <td style={{ padding:'7px 10px', color:'#94a3b8' }}>{r.data.location||'—'}</td>
                        <td style={{ padding:'7px 10px', color:'#94a3b8' }}>{r.data.manufacturer||'—'}</td>
                        <td style={{ padding:'7px 10px', color: r.data.nextPM && pmDays(r.data.nextPM) < 0 ? '#ef4444' : '#64748b' }}>{r.data.nextPM||'—'}</td>
                        <td style={{ padding:'7px 10px', color: STATUS_CFG[r.data.status??'']?.color??'#64748b', fontSize:10 }}>{STATUS_CFG[r.data.status??'']?.label||'—'}</td>
                        <td style={{ padding:'7px 10px', color:'#ef4444', fontSize:10 }}>{r.errors.join(' · ')||'—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding:'16px 24px', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:10, justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:11, color:'#f59e0b' }}>After applying, click <strong>Save</strong> to persist the data.</span>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn-secondary" onClick={() => setShowImport(false)}>Cancel</button>
                <button className="btn-primary" disabled={validCount===0} onClick={applyImport} style={{ opacity: validCount===0?0.5:1 }}>
                  <CheckCircle size={13}/> Apply {validCount} row{validCount!==1?'s':''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
