import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Search, QrCode, Download, Eye, Edit, Activity, Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Save } from 'lucide-react';
import { mockAssets } from '../data/mockData';
import type { Asset } from '../types';
import * as XLSX from 'xlsx';

const ASSET_STORAGE_KEY = 'mms_asset_master';

function loadAssets(): Asset[] {
  try {
    const raw = localStorage.getItem(ASSET_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return mockAssets;
}

const CATEGORY_ICONS: Record<string, string> = {
  'Transformer': '🔌', 'HT Panel': '⚡', 'VFD': '🔄', 'UPS': '🔋', 'PLC': '💻',
  'Flow Meter': '💧', 'DG': '🔧', 'Capacitor Bank': '⚡', 'SCADA': '🖥️', 'Motor': '⚙️',
};

const STATUS_COLOR: Record<string, string> = {
  operational: '#22c55e', 'under-maintenance': '#f59e0b', breakdown: '#ef4444', decommissioned: '#64748b',
};
const CRIT_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#22c55e',
};

const CATEGORIES = ['All', 'Transformer', 'HT Panel', 'VFD', 'UPS', 'PLC', 'Flow Meter', 'DG', 'Capacitor Bank', 'Motor', 'Sensor'];

const VALID_STATUSES   = ['operational', 'under-maintenance', 'breakdown', 'decommissioned'];
const VALID_CRITICALITY = ['critical', 'high', 'medium', 'low'];
const VALID_CATEGORIES  = CATEGORIES.slice(1);
const VALID_DEPARTMENTS = ['Electrical', 'Instrumentation', 'Mechanical', 'Utility'];

// ── Template & Import helpers ─────────────────────────────────────────────────
const TEMPLATE_COLUMNS = [
  'code', 'name', 'category', 'type', 'location', 'department',
  'manufacturer', 'model', 'serialNumber', 'installDate',
  'status', 'criticality', 'nextPM', 'nextCalibration', 'amcVendor', 'amcExpiry',
];

const COLUMN_NOTES: Record<string, string> = {
  code:            'Required · Unique code e.g. VFD-013',
  name:            'Required · Full descriptive name',
  category:        `Required · One of: ${VALID_CATEGORIES.join(', ')}`,
  type:            'Optional · Equipment sub-type',
  location:        'Required · Physical location e.g. Production Hall B',
  department:      `Required · One of: ${VALID_DEPARTMENTS.join(', ')}`,
  manufacturer:    'Required · OEM / brand name',
  model:           'Optional · Model number or series',
  serialNumber:    'Optional · Serial / tag number',
  installDate:     'Required · Format: YYYY-MM-DD',
  status:          `Required · One of: ${VALID_STATUSES.join(', ')}`,
  criticality:     `Required · One of: ${VALID_CRITICALITY.join(', ')}`,
  nextPM:          'Required · Next PM date, Format: YYYY-MM-DD',
  nextCalibration: 'Optional · Next calibration date, Format: YYYY-MM-DD',
  amcVendor:       'Optional · AMC vendor/supplier name',
  amcExpiry:       'Optional · AMC expiry date, Format: YYYY-MM-DD',
};

const SAMPLE_ROWS = [
  {
    code: 'VFD-013', name: 'VFD Panel Line 3', category: 'VFD', type: 'Variable Frequency Drive',
    location: 'Production Hall B', department: 'Electrical', manufacturer: 'Siemens', model: 'G120C',
    serialNumber: 'SN-20230115-001', installDate: '2023-01-15', status: 'operational', criticality: 'high',
    nextPM: '2026-09-01', nextCalibration: '', amcVendor: 'Siemens UAE', amcExpiry: '2027-01-14',
  },
  {
    code: 'PLC-007', name: 'Main PLC Controller', category: 'PLC', type: 'Programmable Logic Controller',
    location: 'Control Room A', department: 'Instrumentation', manufacturer: 'Allen Bradley', model: 'CompactLogix 5380',
    serialNumber: 'AB-5380-CR007', installDate: '2021-06-10', status: 'operational', criticality: 'critical',
    nextPM: '2026-10-15', nextCalibration: '2026-12-01', amcVendor: 'Rockwell Automation', amcExpiry: '2026-06-09',
  },
  {
    code: 'TRF-002', name: '11kV/415V Distribution Transformer', category: 'Transformer', type: 'Oil Cooled',
    location: 'Substation 1', department: 'Electrical', manufacturer: 'ABB', model: 'Oil Immersed 1000kVA',
    serialNumber: 'ABB-TRF-2019-002', installDate: '2019-03-20', status: 'under-maintenance', criticality: 'critical',
    nextPM: '2026-08-20', nextCalibration: '', amcVendor: '', amcExpiry: '',
  },
];

function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Template ──
  const headerRow  = TEMPLATE_COLUMNS;
  const noteRow    = TEMPLATE_COLUMNS.map(c => COLUMN_NOTES[c] ?? '');
  const sampleRows = SAMPLE_ROWS.map(r => TEMPLATE_COLUMNS.map(c => (r as any)[c] ?? ''));

  const ws = XLSX.utils.aoa_to_sheet([headerRow, noteRow, ...sampleRows]);

  // Column widths
  ws['!cols'] = TEMPLATE_COLUMNS.map(c =>
    c === 'name' || c === 'amcVendor' ? { wch: 35 } :
    c.includes('Date') || c.includes('PM') || c.includes('Calibration') || c.includes('Expiry') ? { wch: 18 } :
    { wch: 22 }
  );

  // Style header row cells
  TEMPLATE_COLUMNS.forEach((_, ci) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (!ws[cellRef]) return;
    ws[cellRef].s = {
      font:    { bold: true, color: { rgb: 'FFFFFF' } },
      fill:    { fgColor: { rgb: '1E3A8A' } },
      alignment: { horizontal: 'center' },
    };
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Asset Template');

  // ── Sheet 2: Valid Values ──
  const refData = [
    ['Field', 'Valid Values'],
    ['category',    VALID_CATEGORIES.join(', ')],
    ['department',  VALID_DEPARTMENTS.join(', ')],
    ['status',      VALID_STATUSES.join(', ')],
    ['criticality', VALID_CRITICALITY.join(', ')],
    ['Date fields', 'Use YYYY-MM-DD format  e.g. 2026-09-01'],
  ];
  const wsRef = XLSX.utils.aoa_to_sheet(refData);
  wsRef['!cols'] = [{ wch: 20 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsRef, 'Valid Values');

  XLSX.writeFile(wb, 'Asset_Master_Template.xlsx');
}

interface ImportRow {
  row: number;
  data: Partial<Asset>;
  errors: string[];
  mode: 'add' | 'update';
}

function parseImportFile(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb    = XLSX.read(e.target!.result, { type: 'binary' });
        const ws    = wb.Sheets[wb.SheetNames[0]];
        const rows  = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

        const results: ImportRow[] = rows.map((raw, i) => {
          const errors: string[] = [];
          const d: Partial<Asset> = {};

          // Map & validate each field
          const str = (k: string) => String(raw[k] ?? '').trim();

          d.code         = str('code');
          d.name         = str('name');
          d.category     = str('category');
          d.type         = str('type');
          d.location     = str('location');
          d.department   = str('department');
          d.manufacturer = str('manufacturer');
          d.model        = str('model');
          d.serialNumber = str('serialNumber');
          d.installDate  = str('installDate');
          d.nextPM       = str('nextPM');
          if (str('nextCalibration')) d.nextCalibration = str('nextCalibration');
          if (str('amcVendor'))       d.amcVendor       = str('amcVendor');
          if (str('amcExpiry'))       d.amcExpiry       = str('amcExpiry');

          const status = str('status').toLowerCase() as Asset['status'];
          if (VALID_STATUSES.includes(status)) d.status = status;
          else errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);

          const crit = str('criticality').toLowerCase() as Asset['criticality'];
          if (VALID_CRITICALITY.includes(crit)) d.criticality = crit;
          else errors.push(`criticality must be one of: ${VALID_CRITICALITY.join(', ')}`);

          if (!d.code)         errors.push('code is required');
          if (!d.name)         errors.push('name is required');
          if (!d.category)     errors.push('category is required');
          if (!d.location)     errors.push('location is required');
          if (!d.department)   errors.push('department is required');
          if (!d.manufacturer) errors.push('manufacturer is required');
          if (!d.installDate)  errors.push('installDate is required');
          if (!d.nextPM)       errors.push('nextPM is required');

          return { row: i + 2, data: d, errors, mode: 'add' };
        });

        resolve(results);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

// ── Asset card ────────────────────────────────────────────────────────────────
function AssetCard({ asset, onView }: { asset: Asset; onView: (a: Asset) => void }) {
  const daysToNextPM = Math.ceil((new Date(asset.nextPM).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return (
    <div className="glass-card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => onView(asset)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, fontSize: 20, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {CATEGORY_ICONS[asset.category] ?? '🔧'}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>{asset.name}</div>
            <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{asset.code}</div>
          </div>
        </div>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[asset.status] ?? '#64748b', marginTop: 4 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Category',     value: asset.category },
          { label: 'Location',     value: asset.location },
          { label: 'Manufacturer', value: asset.manufacturer },
          { label: 'Installed',    value: new Date(asset.installDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) },
        ].map(f => (
          <div key={f.label}>
            <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{f.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="badge badge-gray" style={{ fontSize: 10, color: STATUS_COLOR[asset.status] }}>{asset.status}</span>
          <span className="badge badge-gray" style={{ fontSize: 10, color: CRIT_COLOR[asset.criticality] }}>{asset.criticality}</span>
        </div>
        <div style={{ fontSize: 10, color: daysToNextPM <= 7 ? '#f59e0b' : '#475569' }}>
          PM: {daysToNextPM > 0 ? `${daysToNextPM}d` : 'Overdue'}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AssetManagement() {
  const BLANK_ASSET = {
    code: '', name: '', category: CATEGORIES[1], type: '', location: '',
    department: VALID_DEPARTMENTS[0], manufacturer: '', model: '', serialNumber: '',
    installDate: '', status: 'operational' as Asset['status'],
    criticality: 'medium' as Asset['criticality'],
    nextPM: '', nextCalibration: '', amcVendor: '', amcExpiry: '',
  };

  const [assets,       setAssets]       = useState<Asset[]>(loadAssets);
  const [isDirty,      setIsDirty]      = useState(false);
  const [savedAt,      setSavedAt]      = useState<string | null>(() =>
    localStorage.getItem(ASSET_STORAGE_KEY) ? 'Loaded' : null
  );
  const [search,       setSearch]       = useState('');
  const [category,     setCategory]     = useState('All');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected,     setSelected]     = useState<Asset | null>(null);
  const [showCreate,   setShowCreate]   = useState(false);
  const [newAsset,     setNewAsset]     = useState({ ...BLANK_ASSET });

  // Import state
  const importRef                       = useRef<HTMLInputElement>(null);
  const [importRows,   setImportRows]   = useState<ImportRow[]>([]);
  const [showImport,   setShowImport]   = useState(false);
  const [importing,    setImporting]    = useState(false);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (isDirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleSave = useCallback(() => {
    localStorage.setItem(ASSET_STORAGE_KEY, JSON.stringify(assets));
    setIsDirty(false);
    setSavedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
  }, [assets]);

  const mutateAssets = useCallback((updater: (prev: Asset[]) => Asset[]) => {
    setAssets(updater);
    setIsDirty(true);
  }, []);

  const filtered = assets.filter(a => {
    const s = search.toLowerCase();
    const matchSearch  = !s || a.name.toLowerCase().includes(s) || a.code.toLowerCase().includes(s) || a.location.toLowerCase().includes(s);
    const matchCat     = category === 'All' || a.category === category;
    const matchStatus  = statusFilter === 'all' || a.status === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  const stats = {
    total:       assets.length,
    operational: assets.filter(a => a.status === 'operational').length,
    maintenance: assets.filter(a => a.status === 'under-maintenance').length,
    breakdown:   assets.filter(a => a.status === 'breakdown').length,
    critical:    assets.filter(a => a.criticality === 'critical').length,
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const rows = await parseImportFile(file);
      // Mark rows as 'update' if asset code already exists
      const existing = new Set(assets.map(a => a.code));
      rows.forEach(r => { if (r.data.code && existing.has(r.data.code)) r.mode = 'update'; });
      setImportRows(rows);
      setShowImport(true);
    } catch { alert('Failed to read file. Please use the downloaded template.'); }
    finally { setImporting(false); }
  };

  const applyImport = () => {
    const valid = importRows.filter(r => r.errors.length === 0);
    mutateAssets(prev => {
      const map = new Map(prev.map(a => [a.code, a]));
      valid.forEach(r => {
        const d = r.data as Asset;
        d.id = d.id || `imported-${Date.now()}-${Math.random()}`;
        map.set(d.code, { ...map.get(d.code), ...d } as Asset);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Assets',       value: stats.total,       color: '#3b82f6' },
          { label: 'Operational',        value: stats.operational, color: '#22c55e' },
          { label: 'Under Maintenance',  value: stats.maintenance, color: '#f59e0b' },
          { label: 'Breakdown',          value: stats.breakdown,   color: '#ef4444' },
          { label: 'Critical Assets',    value: stats.critical,    color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)} style={{
            padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
            background: category === cat ? '#3b82f6' : 'rgba(255,255,255,0.05)',
            color: category === cat ? 'white' : '#64748b', transition: 'all 0.2s',
          }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…" className="input-dark" style={{ paddingLeft: 30 }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-dark" style={{ width: 160 }}>
          <option value="all">All Status</option>
          <option value="operational">Operational</option>
          <option value="under-maintenance">Under Maintenance</option>
          <option value="breakdown">Breakdown</option>
          <option value="decommissioned">Decommissioned</option>
        </select>
        <button className="btn-secondary" style={{ fontSize: 12 }} onClick={downloadTemplate} title="Download Excel template to fill and re-import">
          <FileSpreadsheet size={13} /> Template
        </button>
        <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => importRef.current?.click()} disabled={importing} title="Import filled template to add / update assets">
          <Upload size={13} /> {importing ? 'Reading…' : 'Import Excel'}
        </button>
        <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImportFile} />
        <button className="btn-secondary" style={{ fontSize: 12 }}><QrCode size={13} /> QR Scan</button>

        {/* ── SAVE button — always visible ── */}
        <button
          onClick={handleSave}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: isDirty ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(34,197,94,0.12)',
            border: isDirty ? '1px solid #22c55e' : '1px solid rgba(34,197,94,0.3)',
            color: isDirty ? '#fff' : '#22c55e',
            boxShadow: isDirty ? '0 0 18px rgba(34,197,94,0.4)' : 'none',
            transition: 'all 0.2s',
          }}
          title={isDirty ? 'Save changes to browser storage' : `Last saved: ${savedAt ?? 'never'}`}
        >
          <Save size={14} /> {isDirty ? 'Save' : savedAt ? 'Saved ✓' : 'Save'}
        </button>

        <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ fontSize: 12 }}>
          <Plus size={13} /> Add Asset
        </button>
      </div>

      {/* Asset Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {filtered.map(a => <AssetCard key={a.id} asset={a} onView={setSelected} />)}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#475569' }}>No assets found</div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{selected.name}</div>
                <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{selected.code} · {selected.serialNumber}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Category',   value: selected.category },
                  { label: 'Type',       value: selected.type },
                  { label: 'Location',   value: selected.location },
                  { label: 'Department', value: selected.department },
                  { label: 'Manufacturer', value: selected.manufacturer },
                  { label: 'Model',      value: selected.model },
                  { label: 'Install Date', value: new Date(selected.installDate).toLocaleDateString('en-IN') },
                  { label: 'Status',     value: selected.status,      color: STATUS_COLOR[selected.status] },
                  { label: 'Criticality',value: selected.criticality, color: CRIT_COLOR[selected.criticality] },
                  { label: 'Next PM',    value: new Date(selected.nextPM).toLocaleDateString('en-IN') },
                  ...(selected.nextCalibration ? [{ label: 'Next Calibration', value: new Date(selected.nextCalibration).toLocaleDateString('en-IN') }] : []),
                  ...(selected.amcVendor  ? [{ label: 'AMC Vendor',  value: selected.amcVendor }] : []),
                  ...(selected.amcExpiry  ? [{ label: 'AMC Expiry',  value: new Date(selected.amcExpiry).toLocaleDateString('en-IN') }] : []),
                ].map(f => (
                  <div key={f.label} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontSize: 13, color: (f as any).color ?? '#e2e8f0', fontWeight: 500 }}>{f.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button className="btn-primary"   style={{ fontSize: 12 }}><Edit size={12} />     Edit Asset</button>
                <button className="btn-secondary" style={{ fontSize: 12 }}><QrCode size={12} />   Generate QR</button>
                <button className="btn-secondary" style={{ fontSize: 12 }}><Activity size={12} /> View History</button>
                <button className="btn-secondary" style={{ fontSize: 12 }}><Download size={12} /> Documents</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Asset Modal ── */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>Add New Asset</div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {([
                { key: 'code',         label: 'Asset Code *',    placeholder: 'e.g., VFD-013' },
                { key: 'name',         label: 'Asset Name *',    placeholder: 'Full descriptive name' },
                { key: 'category',     label: 'Category',        type: 'select', options: CATEGORIES.slice(1) },
                { key: 'location',     label: 'Location *',      placeholder: 'Physical location' },
                { key: 'manufacturer', label: 'Manufacturer *',  placeholder: 'OEM name' },
                { key: 'model',        label: 'Model',           placeholder: 'Model number' },
                { key: 'serialNumber', label: 'Serial Number',   placeholder: 'Serial / Tag number' },
                { key: 'installDate',  label: 'Install Date *',  type: 'date' },
                { key: 'nextPM',       label: 'Next PM Date *',  type: 'date' },
                { key: 'criticality',  label: 'Criticality',     type: 'select', options: VALID_CRITICALITY },
                { key: 'department',   label: 'Department',      type: 'select', options: VALID_DEPARTMENTS },
                { key: 'status',       label: 'Status',          type: 'select', options: VALID_STATUSES },
              ] as { key: keyof typeof newAsset; label: string; placeholder?: string; type?: string; options?: string[] }[]).map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select className="input-dark" value={newAsset[f.key]} onChange={e => setNewAsset(p => ({ ...p, [f.key]: e.target.value }))}>
                      {f.options!.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={f.type ?? 'text'} placeholder={f.placeholder} className="input-dark"
                      value={newAsset[f.key]} onChange={e => setNewAsset(p => ({ ...p, [f.key]: e.target.value }))} />
                  )}
                </div>
              ))}
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
                <button
                  className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => {
                    if (!newAsset.code || !newAsset.name || !newAsset.location || !newAsset.manufacturer || !newAsset.installDate || !newAsset.nextPM) {
                      alert('Please fill all required (*) fields.'); return;
                    }
                    if (assets.find(a => a.code === newAsset.code)) { alert('Asset code already exists.'); return; }
                    mutateAssets(p => [...p, { ...newAsset, id: `asset-${Date.now()}` } as Asset]);
                    setNewAsset({ ...BLANK_ASSET });
                    setShowCreate(false);
                  }}
                >
                  Save Asset
                </button>
                <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Preview Modal ── */}
      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal-content" style={{ maxWidth: 900, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>Import Preview</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {importRows.length} row{importRows.length !== 1 ? 's' : ''} found ·
                  <span style={{ color: '#22c55e' }}> {addCount} to add</span> ·
                  <span style={{ color: '#f59e0b' }}> {updateCount} to update</span>
                  {errorCount > 0 && <span style={{ color: '#ef4444' }}> · {errorCount} with errors (will be skipped)</span>}
                </div>
              </div>
              <button onClick={() => setShowImport(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            {/* Summary badges */}
            <div style={{ padding: '12px 24px', display: 'flex', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { label: `${addCount} New`,    color: '#22c55e', icon: <CheckCircle size={12}/> },
                { label: `${updateCount} Update`, color: '#f59e0b', icon: <AlertTriangle size={12}/> },
                { label: `${errorCount} Error`,   color: '#ef4444', icon: <XCircle size={12}/> },
              ].map(b => (
                <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: b.color + '18', border: `1px solid ${b.color}40`, borderRadius: 8, padding: '4px 12px', color: b.color, fontSize: 12, fontWeight: 600 }}>
                  {b.icon} {b.label}
                </div>
              ))}
            </div>

            {/* Rows table */}
            <div style={{ overflowY: 'auto', maxHeight: 420, padding: '0 24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 12 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {['Row', 'Status', 'Code', 'Name', 'Category', 'Location', 'Status', 'Criticality', 'Issues'].map(h => (
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
                          {ok ? (
                            <span style={{ color: r.mode === 'add' ? '#22c55e' : '#f59e0b', fontWeight: 600, fontSize: 11 }}>
                              {r.mode === 'add' ? '+ Add' : '↻ Update'}
                            </span>
                          ) : (
                            <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 11 }}>✕ Skip</span>
                          )}
                        </td>
                        <td style={{ padding: '7px 10px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 11 }}>{r.data.code || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#e2e8f0', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.data.name || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#94a3b8' }}>{r.data.category || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#94a3b8' }}>{r.data.location || '—'}</td>
                        <td style={{ padding: '7px 10px', color: STATUS_COLOR[r.data.status ?? ''] ?? '#64748b' }}>{r.data.status || '—'}</td>
                        <td style={{ padding: '7px 10px', color: CRIT_COLOR[r.data.criticality ?? ''] ?? '#64748b' }}>{r.data.criticality || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#ef4444', fontSize: 10 }}>{r.errors.join(' · ') || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowImport(false)}>Cancel</button>
              <button
                className="btn-primary"
                disabled={validCount === 0}
                onClick={applyImport}
                style={{ opacity: validCount === 0 ? 0.5 : 1 }}
              >
                <CheckCircle size={13} />
                Apply {validCount} valid row{validCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
