import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Edit2, Trash2, X, Save, Search, ClipboardList, Copy, FileDown, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface EquipmentOption {
  _id: string;
  equipmentName: string;
  equipmentType: string;
  vendorCompany: string;
  rateType: 'Daily' | 'Hourly' | 'Monthly';
  rate: number;
}

interface Entry {
  _id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentType: string;
  vendorCompany: string;
  workDate: string;
  poNumber: string;
  department: string;
  area: string;
  shift: string;
  operatorName: string;
  startTime: string;
  endTime: string;
  workingHours: number;
  overtimeHours: number;
  otRatePercent: number;
  workDescription: string;
  maintenanceType: string;
  rateType: 'Daily' | 'Hourly' | 'Monthly';
  rate: number;
  regularCost: number;
  otCost: number;
  totalCost: number;
  completionStatus: 'Completed' | 'In Progress' | 'Pending';
  approvedBy: string;
  supervisorName: string;
  remarks: string;
  vatPercent?: number;
  vatAmount?: number;
}

interface FormState {
  equipmentId: string; equipmentName: string; equipmentType: string; vendorCompany: string;
  workDate: string; poNumber: string; department: string; area: string; shift: string;
  operatorName: string; startTime: string; endTime: string;
  workingHours: number; overtimeHours: number; otRatePercent: number;
  workDescription: string; maintenanceType: string;
  rateType: 'Daily' | 'Hourly' | 'Monthly'; rate: number;
  completionStatus: 'Completed' | 'In Progress' | 'Pending';
  approvedBy: string; supervisorName: string; remarks: string;
  vatPercent: number;
}

const BLANK: FormState = {
  equipmentId: '', equipmentName: '', equipmentType: '', vendorCompany: '',
  workDate: new Date().toISOString().slice(0, 10), poNumber: '',
  department: 'E&I', area: '', shift: 'General',
  operatorName: '', startTime: '', endTime: '',
  workingHours: 8, overtimeHours: 0, otRatePercent: 125,
  workDescription: '', maintenanceType: 'Preventive',
  rateType: 'Daily', rate: 0,
  completionStatus: 'Completed', approvedBy: '', supervisorName: '', remarks: '',
  vatPercent: 5,
};

const MAINTENANCE_TYPES = ['Preventive', 'Corrective', 'Breakdown', 'Project', 'Shutdown', 'Installation', 'Commissioning', 'Inspection', 'Other'];
const SHIFTS = ['General', 'Morning', 'Afternoon', 'Night', 'Rotational'];

// ── Cost helpers ───────────────────────────────────────────────────────────────
function calcCost(form: FormState): { regular: number; ot: number; total: number } {
  if (form.rateType === 'Daily') {
    const ot = Math.round((form.rate / 8) * form.overtimeHours * (form.otRatePercent / 100));
    return { regular: form.rate, ot, total: form.rate + ot };
  }
  if (form.rateType === 'Hourly') {
    const regular = Math.round(form.workingHours * form.rate);
    const ot      = Math.round(form.overtimeHours * form.rate * (form.otRatePercent / 100));
    return { regular, ot, total: regular + ot };
  }
  // Monthly — just return the monthly rate as total, no per-day calc
  return { regular: form.rate, ot: 0, total: form.rate };
}

const statusStyle: Record<string, { bg: string; color: string }> = {
  'Completed':   { bg: '#dcfce7', color: '#15803d' },
  'In Progress': { bg: '#dbeafe', color: '#1d4ed8' },
  'Pending':     { bg: '#fef9c3', color: '#a16207' },
};

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function EquipmentEntry() {
  const [entries,   setEntries]   = useState<Entry[]>([]);
  const [equipment, setEquipment] = useState<EquipmentOption[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [editing,   setEditing]   = useState<Entry | null>(null);
  const [form,      setForm]      = useState<FormState>(BLANK);
  const [saving,    setSaving]    = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [search,    setSearch]    = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo,   setFilterTo]   = useState('');

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 34, padding: '0 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1e293b', background: '#f8fafc', outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 3 };
  const sec = (t: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 1, gridColumn: '1/-1', borderBottom: '1px solid #ede9fe', paddingBottom: 4, marginTop: 6 }}>{t}</div>
  );

  const cost       = calcCost(form);
  const vatAmount  = Math.round(cost.total * (form.vatPercent / 100) * 100) / 100;
  const grandTotal = Math.round((cost.total + vatAmount) * 100) / 100;

  const loadEquipment = useCallback(async () => {
    try { setEquipment(await apiFetch('/api/equipment/active')); } catch {}
  }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo)   params.set('to', filterTo);
      const data = await apiFetch(`/api/equipment-entries?${params}`);
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
    } catch { toast.error('Failed to load entries'); }
    finally { setLoading(false); }
  }, [page, filterFrom, filterTo]);

  useEffect(() => { loadEquipment(); }, [loadEquipment]);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleEquipmentChange = (id: string) => {
    const eq = equipment.find(e => e._id === id);
    if (eq) {
      setForm(f => ({ ...f, equipmentId: id, equipmentName: eq.equipmentName, equipmentType: eq.equipmentType, vendorCompany: eq.vendorCompany, rateType: eq.rateType, rate: eq.rate }));
    } else {
      setForm(f => ({ ...f, equipmentId: '', equipmentName: '', equipmentType: '', vendorCompany: '', rateType: 'Daily', rate: 0 }));
    }
  };

  const openAdd = () => { setEditing(null); setForm(BLANK); setModal(true); };
  const openEdit = (e: Entry) => {
    setEditing(e);
    setForm({
      equipmentId: e.equipmentId, equipmentName: e.equipmentName, equipmentType: e.equipmentType,
      vendorCompany: e.vendorCompany, workDate: e.workDate?.slice(0, 10) ?? '',
      poNumber: e.poNumber ?? '', department: e.department, area: e.area, shift: e.shift,
      operatorName: e.operatorName ?? '', startTime: e.startTime ?? '', endTime: e.endTime ?? '',
      workingHours: e.workingHours, overtimeHours: e.overtimeHours, otRatePercent: e.otRatePercent ?? 125,
      workDescription: e.workDescription, maintenanceType: e.maintenanceType,
      rateType: e.rateType, rate: e.rate,
      completionStatus: e.completionStatus, approvedBy: e.approvedBy ?? '',
      supervisorName: e.supervisorName ?? '', remarks: e.remarks ?? '',
      vatPercent: e.vatPercent ?? 5,
    });
    setModal(true);
  };
  const openRepeat = (e: Entry) => {
    setEditing(null);
    setForm({
      equipmentId: e.equipmentId, equipmentName: e.equipmentName, equipmentType: e.equipmentType,
      vendorCompany: e.vendorCompany, workDate: new Date().toISOString().slice(0, 10),
      poNumber: e.poNumber ?? '', department: e.department, area: e.area, shift: e.shift,
      operatorName: e.operatorName ?? '', startTime: '', endTime: '',
      workingHours: e.workingHours, overtimeHours: 0, otRatePercent: e.otRatePercent ?? 125,
      workDescription: e.workDescription, maintenanceType: e.maintenanceType,
      rateType: e.rateType, rate: e.rate,
      completionStatus: 'In Progress', approvedBy: '', supervisorName: '', remarks: '',
    });
    setModal(true);
    toast('Entry copied — adjust date if needed, then save.', { icon: '📋' });
  };

  const handleSave = async () => {
    if (!form.equipmentName.trim()) { toast.error('Select an equipment'); return; }
    if (!form.workDate) { toast.error('Work date is required'); return; }
    const c = calcCost(form);
    const payload = { ...form, regularCost: c.regular, otCost: c.ot, subTotal: c.total, vatAmount, totalCost: grandTotal };
    setSaving(true);
    try {
      if (editing) {
        const updated = await apiFetch(`/api/equipment-entries/${editing._id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setEntries(prev => prev.map(e => e._id === editing._id ? updated : e));
        toast.success('Entry updated');
      } else {
        await apiFetch('/api/equipment-entries', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Entry saved');
        loadEntries();
      }
      setModal(false);
    } catch (err: any) { toast.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  // ── Template download ────────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const headers = [
      'Work Date', 'Equipment Name', 'PO Number', 'Department', 'Area', 'Shift',
      'Operator Name', 'Start Time (HH:MM)', 'End Time (HH:MM)', 'Working Hours', 'OT Hours', 'OT Rate %',
      'Work Description', 'Maintenance Type', 'Completion Status',
      'Approved By', 'Supervisor Name', 'Remarks',
    ];
    const example = [
      new Date().toISOString().slice(0, 10), 'Crane XL-500', 'PO-001', 'E&I', 'Plant Area', 'General',
      'Operator Name', '08:00', '17:00', 8, 0, 125,
      'Equipment maintenance work', 'Preventive', 'Completed',
      'Manager Name', 'Supervisor Name', '',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = headers.map((_, i) => ({ wch: i === 12 ? 30 : 18 }));
    const notes = [
      ['Field', 'Guidance'],
      ['Work Date', 'Format: YYYY-MM-DD (e.g. 2025-07-15)'],
      ['Equipment Name', 'Must exactly match an active equipment name in the system'],
      ['Start / End Time', 'Format HH:MM in 24-hour (e.g. 08:00, 17:30). Leave blank if not tracked.'],
      ['Working Hours', 'Regular working hours (e.g. 8)'],
      ['OT Hours', 'Overtime hours worked. Leave 0 if none'],
      ['OT Rate %', 'Default 125 (= 1.25×). Leave 125 if no OT'],
      ['Maintenance Type', 'Preventive / Corrective / Breakdown / Project / Shutdown …'],
      ['Completion Status', 'Completed / In Progress / Pending'],
      ['Rate & Rate Type', 'Auto-filled from Equipment Master. Do not add to template.'],
      ['Each Row', 'One row = one equipment usage day'],
    ];
    const notesWs = XLSX.utils.aoa_to_sheet(notes);
    notesWs['!cols'] = [{ wch: 22 }, { wch: 70 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipment Entry');
    XLSX.utils.book_append_sheet(wb, notesWs, 'Notes');
    XLSX.writeFile(wb, 'Equipment_WorkEntry_Template.xlsx');
  };

  // ── Bulk import from template ─────────────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const dataRows = rows.slice(1).filter(r => r[0] && r[1]); // workDate + equipmentName required
      if (dataRows.length === 0) { toast.error('No valid data rows found in the file'); setImporting(false); return; }

      let saved = 0, failed = 0;
      for (const r of dataRows) {
        const workDate        = r[0] instanceof Date ? r[0].toISOString().slice(0,10) : String(r[0]).trim();
        const equipmentName   = String(r[1]).trim();
        const poNumber        = String(r[2]).trim();
        const department      = String(r[3]).trim() || 'E&I';
        const area            = String(r[4]).trim();
        const shift           = String(r[5]).trim() || 'General';
        const operatorName    = String(r[6]).trim();
        const startTime       = String(r[7]).trim();
        const endTime         = String(r[8]).trim();
        const workingHours    = Number(r[9]) || 8;
        const overtimeHours   = Number(r[10]) || 0;
        const otRatePercent   = Number(r[11]) || 125;
        const workDescription = String(r[12]).trim();
        const maintenanceType = String(r[13]).trim() || 'Preventive';
        const completionStatus= String(r[14]).trim() || 'Completed';
        const approvedBy      = String(r[15]).trim();
        const supervisorName  = String(r[16]).trim();
        const remarks         = String(r[17]).trim();

        const eq = equipment.find(e => e.equipmentName.toLowerCase() === equipmentName.toLowerCase());
        const rateType = eq?.rateType ?? 'Daily';
        const rate     = eq?.rate ?? 0;
        const equipmentId   = eq?._id ?? '';
        const equipmentType = eq?.equipmentType ?? '';
        const vendorCompany = eq?.vendorCompany ?? '';

        let regularCost = 0, otCost = 0;
        if (rateType === 'Daily') {
          regularCost = rate;
          otCost = Math.round((rate / 8) * overtimeHours * (otRatePercent / 100));
        } else if (rateType === 'Hourly') {
          regularCost = Math.round(workingHours * rate);
          otCost = Math.round(overtimeHours * rate * (otRatePercent / 100));
        } else {
          regularCost = rate;
        }
        const totalCost = regularCost + otCost;

        const payload = {
          equipmentId, equipmentName, equipmentType, vendorCompany,
          workDate, poNumber, department, area, shift,
          operatorName, startTime, endTime, workingHours, overtimeHours, otRatePercent,
          workDescription, maintenanceType, rateType, rate,
          regularCost, otCost, totalCost,
          completionStatus, approvedBy, supervisorName, remarks,
        };
        try {
          await apiFetch('/api/equipment-entries', { method: 'POST', body: JSON.stringify(payload) });
          saved++;
        } catch { failed++; }
      }
      toast.success(`Import complete — ${saved} entr${saved === 1 ? 'y' : 'ies'} saved${failed ? `, ${failed} failed` : ''}`);
      loadEntries();
    } catch (err: any) {
      toast.error('Import failed: ' + (err.message || 'check file format'));
    } finally { setImporting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await apiFetch(`/api/equipment-entries/${id}`, { method: 'DELETE' });
      setEntries(prev => prev.filter(e => e._id !== id));
      setTotal(t => t - 1);
      toast.success('Deleted');
    } catch { toast.error('Delete failed'); }
  };

  const displayed = entries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.equipmentName.toLowerCase().includes(q) || e.vendorCompany.toLowerCase().includes(q) || (e.operatorName || '').toLowerCase().includes(q);
  });

  const pages = Math.ceil(total / 25);
  const thStyle: React.CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#f1f5f9', textTransform: 'uppercase', letterSpacing: 0.5, background: '#1e293b', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 12, color: '#334155', verticalAlign: 'middle' };

  return (
    <div style={{ padding: '20px 24px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ClipboardList size={20} color="#fff"/>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Equipment Work Entry</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Daily usage log for all rented equipment — hours, cost, operator details</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport}/>
          <button onClick={handleDownloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', color: '#7c3aed', border: '1.5px solid #7c3aed', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <FileDown size={15}/> Template
          </button>
          <button onClick={() => importRef.current?.click()} disabled={importing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', color: '#0f766e', border: '1.5px solid #0f766e', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: importing ? 'default' : 'pointer', opacity: importing ? 0.6 : 1 }}>
            <Upload size={15}/> {importing ? 'Importing…' : 'Import'}
          </button>
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={15}/> New Entry
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}/>
          <input style={{ ...inp, paddingLeft: 30, background: '#f8fafc' }} placeholder="Search equipment, vendor, operator…" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div style={{ flex: '1 1 110px' }}>
          <div style={lbl}>From</div>
          <input type="date" style={{ ...inp, height: 32 }} value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1); }}/>
        </div>
        <div style={{ flex: '1 1 110px' }}>
          <div style={lbl}>To</div>
          <input type="date" style={{ ...inp, height: 32 }} value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1); }}/>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center', whiteSpace: 'nowrap' }}>{total} records</div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <ClipboardList size={40} color="#e2e8f0" style={{ marginBottom: 12 }}/>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#94a3b8' }}>No entries yet</div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Date','Equipment','Type','Vendor','Operator','Hours','OT Hrs','Rate','Total Cost (AED)','Status',''].map(h => (
                      <th key={h} style={{ ...thStyle, textAlign: h === 'Total Cost (AED)' ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((e, idx) => (
                    <tr key={e._id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={tdStyle}>{new Date(e.workDate).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#0f172a' }}>{e.equipmentName}</td>
                      <td style={tdStyle}>{e.equipmentType}</td>
                      <td style={tdStyle}>{e.vendorCompany}</td>
                      <td style={tdStyle}>{e.operatorName || '—'}</td>
                      <td style={tdStyle}>{e.workingHours}h</td>
                      <td style={tdStyle}>{e.overtimeHours > 0 ? <span style={{ color: '#b45309', fontWeight: 600 }}>{e.overtimeHours}h OT</span> : '—'}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600, background: '#ede9fe', padding: '1px 6px', borderRadius: 8 }}>{e.rateType}</span>
                        {' '}AED {(e.rate || 0).toLocaleString('en-AE')}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: '#7c3aed', fontSize: 13 }}>AED {(e.totalCost || 0).toLocaleString('en-AE')}</div>
                        {e.vatPercent ? (
                          <div style={{ fontSize: 10, color: '#7c3aed', background: '#ede9fe', borderRadius: 6, padding: '1px 5px', display: 'inline-block', marginTop: 2 }}>
                            VAT {e.vatPercent}% incl.
                          </div>
                        ) : null}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, ...statusStyle[e.completionStatus] }}>{e.completionStatus}</span>
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        <button onClick={() => openRepeat(e)} title="Repeat" style={{ background: 'none', border: 'none', color: '#0f766e', cursor: 'pointer', padding: 3 }}><Copy size={13}/></button>
                        <button onClick={() => openEdit(e)} title="Edit" style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 3 }}><Edit2 size={13}/></button>
                        <button onClick={() => handleDelete(e._id)} title="Delete" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 3 }}><Trash2 size={13}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div style={{ padding: '10px 14px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#94a3b8', marginRight: 8 }}>Page {page} of {pages}</span>
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: page === 1 ? '#f8fafc' : '#fff', color: page === 1 ? '#cbd5e1' : '#475569', cursor: page === 1 ? 'default' : 'pointer', fontSize: 12 }}>Prev</button>
                <button disabled={page === pages} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: page === pages ? '#f8fafc' : '#fff', color: page === pages ? '#cbd5e1' : '#475569', cursor: page === pages ? 'default' : 'pointer', fontSize: 12 }}>Next</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12px 16px', overflowY: 'auto' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div style={{ width: '100%', maxWidth: 900, background: '#fff', borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', marginTop: 4, marginBottom: 24 }}>

            <div style={{ padding: '14px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#faf5ff', borderRadius: '16px 16px 0 0' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#7c3aed' }}>{editing ? 'Edit Equipment Entry' : 'New Equipment Entry'}</div>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18}/></button>
            </div>

            <div style={{ padding: 22 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {sec('Equipment & Reference')}

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={lbl}>Equipment *</label>
                  <select style={inp} value={form.equipmentId} onChange={e => handleEquipmentChange(e.target.value)}>
                    <option value="">— Select Equipment —</option>
                    {equipment.map(eq => <option key={eq._id} value={eq._id}>{eq.equipmentName} ({eq.vendorCompany})</option>)}
                  </select>
                  {form.equipmentName && <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 3 }}>{form.equipmentType} · AED {form.rate}/{form.rateType}</div>}
                </div>
                <div>
                  <label style={lbl}>Work Date *</label>
                  <input type="date" style={inp} value={form.workDate} onChange={e => setForm(f => ({ ...f, workDate: e.target.value }))}/>
                </div>
                <div>
                  <label style={lbl}>PO Number</label>
                  <input style={inp} value={form.poNumber} onChange={e => setForm(f => ({ ...f, poNumber: e.target.value }))} placeholder="e.g. PO/2025/0123"/>
                </div>
                <div>
                  <label style={lbl}>Department</label>
                  <select style={inp} value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                    {['E&I','Mechanical','Civil','Instrumentation','Electrical','Operations'].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Area / Location</label>
                  <input style={inp} value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="e.g. Boiler Area"/>
                </div>
                <div>
                  <label style={lbl}>Shift</label>
                  <select style={inp} value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}>
                    {SHIFTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Work Type</label>
                  <select style={inp} value={form.maintenanceType} onChange={e => setForm(f => ({ ...f, maintenanceType: e.target.value }))}>
                    {MAINTENANCE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>

                {sec('Usage & Hours')}

                <div>
                  <label style={lbl}>Operator Name</label>
                  <input style={inp} value={form.operatorName} onChange={e => setForm(f => ({ ...f, operatorName: e.target.value }))} placeholder="Operator / driver name"/>
                </div>
                <div>
                  <label style={lbl}>Start Time</label>
                  <input type="time" style={inp} value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}/>
                </div>
                <div>
                  <label style={lbl}>End Time</label>
                  <input type="time" style={inp} value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}/>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  {form.startTime && form.endTime ? (() => {
                    const [sh, sm] = form.startTime.split(':').map(Number);
                    const [eh, em] = form.endTime.split(':').map(Number);
                    const mins = (eh * 60 + em) - (sh * 60 + sm);
                    if (mins > 0) {
                      const h = Math.floor(mins / 60), m = mins % 60;
                      return <div style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>⏱ {h}h{m > 0 ? ` ${m}min` : ''}</div>;
                    }
                    return null;
                  })() : null}
                </div>

                <div>
                  <label style={lbl}>Working Hours</label>
                  <input type="number" min="0" max="24" step="0.5" style={inp} value={form.workingHours || ''} onChange={e => setForm(f => ({ ...f, workingHours: Number(e.target.value) }))} placeholder="8"/>
                </div>
                <div>
                  <label style={lbl}>OT Hours</label>
                  <input type="number" min="0" step="0.5" style={inp} value={form.overtimeHours || ''} onChange={e => setForm(f => ({ ...f, overtimeHours: Number(e.target.value) }))} placeholder="0"/>
                </div>
                {form.overtimeHours > 0 && (
                  <div>
                    <label style={lbl}>OT Rate (%)</label>
                    <input type="number" min="100" max="500" step="5" style={inp} value={form.otRatePercent} onChange={e => setForm(f => ({ ...f, otRatePercent: Number(e.target.value) }))}/>
                    <div style={{ fontSize: 10, color: '#b45309', marginTop: 2 }}>125 = 1.25× | 150 = 1.5× | 200 = 2×</div>
                  </div>
                )}

                {sec('Rate & Cost')}

                <div>
                  <label style={lbl}>Rate Type</label>
                  <select style={inp} value={form.rateType} onChange={e => setForm(f => ({ ...f, rateType: e.target.value as any }))}>
                    <option value="Daily">Daily</option>
                    <option value="Hourly">Hourly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Rate (AED / {form.rateType.toLowerCase()})</label>
                  <input type="number" min="0" style={inp} value={form.rate || ''} onChange={e => setForm(f => ({ ...f, rate: Number(e.target.value) }))} placeholder="0.00"/>
                </div>

                {/* Cost breakdown */}
                <div style={{ gridColumn: '1/-1', background: '#f5f3ff', border: '2px solid #7c3aed', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>Regular Cost</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed' }}>AED {cost.regular.toLocaleString('en-AE')}</div>
                    <div style={{ fontSize: 10, color: '#a78bfa' }}>
                      {form.rateType === 'Daily' ? `Flat day rate` : form.rateType === 'Hourly' ? `${form.workingHours}h × AED ${form.rate}/hr` : `Monthly rate`}
                    </div>
                  </div>
                  {cost.ot > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: '#b45309', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>OT Cost</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#b45309' }}>AED {cost.ot.toLocaleString('en-AE')}</div>
                      <div style={{ fontSize: 10, color: '#d97706' }}>
                        {form.rateType === 'Daily'
                          ? `${form.overtimeHours}h × AED ${(form.rate/8).toFixed(2)}/hr @ ${form.otRatePercent}%`
                          : `${form.overtimeHours}h × AED ${form.rate}/hr @ ${form.otRatePercent}%`}
                      </div>
                    </div>
                  )}
                  {/* VAT input */}
                  <div>
                    <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>VAT %</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <input
                        type="number" min="0" max="100" step="0.5"
                        style={{ width: 72, height: 32, padding: '0 8px', border: '1.5px solid #c4b5fd', borderRadius: 7, fontSize: 14, fontWeight: 700, color: '#7c3aed', background: '#fff', outline: 'none' }}
                        value={form.vatPercent}
                        onChange={e => setForm(f => ({ ...f, vatPercent: Math.max(0, Number(e.target.value)) }))}
                      />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#7c3aed' }}>%</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 2 }}>AED {vatAmount.toLocaleString('en-AE')}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>Subtotal</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#a78bfa' }}>AED {cost.total.toLocaleString('en-AE')}</div>
                    <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 }}>Grand Total (incl. VAT)</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#7c3aed' }}>AED {grandTotal.toLocaleString('en-AE')}</div>
                  </div>
                </div>

                {sec('Completion')}

                <div>
                  <label style={lbl}>Supervisor Name</label>
                  <input style={inp} value={form.supervisorName} onChange={e => setForm(f => ({ ...f, supervisorName: e.target.value }))} placeholder="Name"/>
                </div>
                <div>
                  <label style={lbl}>Approved By</label>
                  <input style={inp} value={form.approvedBy} onChange={e => setForm(f => ({ ...f, approvedBy: e.target.value }))} placeholder="Name"/>
                </div>
                <div>
                  <label style={lbl}>Status</label>
                  <select style={inp} value={form.completionStatus} onChange={e => setForm(f => ({ ...f, completionStatus: e.target.value as any }))}>
                    <option>Completed</option><option>In Progress</option><option>Pending</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>Work Description</label>
                  <textarea style={{ ...inp, height: 60, resize: 'vertical', paddingTop: 8 }} value={form.workDescription} onChange={e => setForm(f => ({ ...f, workDescription: e.target.value }))} placeholder="Describe the work done…"/>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>Remarks</label>
                  <textarea style={{ ...inp, height: 44, resize: 'vertical', paddingTop: 8 }} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Any additional remarks…"/>
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#faf5ff', borderRadius: '0 0 16px 16px' }}>
              <button onClick={() => setModal(false)} style={{ padding: '8px 18px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 22px', background: '#7c3aed', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
                <Save size={14}/> {saving ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
