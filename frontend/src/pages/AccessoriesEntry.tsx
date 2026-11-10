import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, X, Save, Search, Fuel, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../utils/api';
import AccessoryInvoiceScan from '../components/AccessoryInvoiceScan';

interface EquipmentOption { _id: string; equipmentName: string; vendorCompany: string; }

interface AccessoryItem {
  id: string;   // local only
  itemName: string;
  category: string;
  unit: string;
  quantity: number;
  unitRate: number;
  totalCost: number;
}

interface AccessoryEntry {
  _id: string;
  entryDate: string;
  equipmentId?: string;
  equipmentName: string;
  poNumber: string;
  department: string;
  area: string;
  items: (AccessoryItem & { id?: string })[];
  totalCost: number;
  approvedBy: string;
  remarks: string;
  invoiceNumber?: string;
  deliveryOrderNumber?: string;
  supplierName?: string;
  subTotal?: number;
  vatPercent?: number;
  vatAmount?: number;
}

interface FormState {
  entryDate: string;
  equipmentId: string;
  equipmentName: string;
  poNumber: string;
  department: string;
  area: string;
  approvedBy: string;
  remarks: string;
  vatPercent: number;
}

const CATEGORIES = ['Fuel', 'Lubricant', 'Electrical', 'Water', 'Chemical', 'Safety', 'Other'];
const ITEM_PRESETS: Record<string, { category: string; unit: string }> = {
  'Diesel':           { category: 'Fuel',       unit: 'Liters' },
  'Petrol':           { category: 'Fuel',       unit: 'Liters' },
  'Engine Oil':       { category: 'Lubricant',  unit: 'Liters' },
  'Hydraulic Oil':    { category: 'Lubricant',  unit: 'Liters' },
  'Gear Oil':         { category: 'Lubricant',  unit: 'Liters' },
  'Grease':           { category: 'Lubricant',  unit: 'Kg' },
  'Distilled Water':  { category: 'Water',      unit: 'Liters' },
  'Battery':          { category: 'Electrical', unit: 'Pcs' },
  'Battery Acid':     { category: 'Electrical', unit: 'Liters' },
  'Coolant':          { category: 'Chemical',   unit: 'Liters' },
  'Other':            { category: 'Other',       unit: 'Pcs' },
};
const ITEM_NAMES = Object.keys(ITEM_PRESETS);
const UNITS = ['Liters', 'Kg', 'Pcs', 'Bottles', 'Gallons', 'Drums', 'Bags', 'Meters'];

let rowKey = 0;
const blankItem = (): AccessoryItem => ({
  id: `i${++rowKey}`, itemName: 'Diesel', category: 'Fuel', unit: 'Liters', quantity: 0, unitRate: 0, totalCost: 0,
});

const BLANK_FORM: FormState = {
  entryDate: new Date().toISOString().slice(0, 10),
  equipmentId: '', equipmentName: '', poNumber: '',
  department: 'E&I', area: '', approvedBy: '', remarks: '',
  vatPercent: 5,
};


export default function AccessoriesEntry() {
  const [entries,   setEntries]   = useState<AccessoryEntry[]>([]);
  const [equipment, setEquipment] = useState<EquipmentOption[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [editing,   setEditing]   = useState<AccessoryEntry | null>(null);
  const [form,      setForm]      = useState<FormState>(BLANK_FORM);
  const [items,     setItems]     = useState<AccessoryItem[]>([blankItem()]);
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo,   setFilterTo]   = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 34, padding: '0 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1e293b', background: '#f8fafc', outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 3 };
  const cellInp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 30, padding: '0 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, color: '#1e293b', background: '#fff', outline: 'none' };

  const totalCost  = items.reduce((s, i) => s + i.totalCost, 0);
  const vatAmount  = Math.round(totalCost * (form.vatPercent / 100) * 100) / 100;
  const grandTotal = Math.round((totalCost + vatAmount) * 100) / 100;

  const loadEquipment = useCallback(async () => {
    try { setEquipment(await apiFetch('/api/equipment/active')); } catch {}
  }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo)   params.set('to', filterTo);
      const data = await apiFetch(`/api/accessories?${params}`);
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
    } catch { toast.error('Failed to load entries'); }
    finally { setLoading(false); }
  }, [page, filterFrom, filterTo]);

  useEffect(() => { loadEquipment(); }, [loadEquipment]);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  const openAdd = () => { setEditing(null); setForm(BLANK_FORM); setItems([blankItem()]); setModal(true); };
  const openEdit = (e: AccessoryEntry) => {
    setEditing(e);
    setForm({
      entryDate: e.entryDate?.slice(0, 10) ?? '',
      equipmentId: e.equipmentId ?? '', equipmentName: e.equipmentName ?? '',
      poNumber: e.poNumber ?? '', department: e.department, area: e.area,
      approvedBy: e.approvedBy ?? '', remarks: e.remarks ?? '',
      vatPercent: e.vatPercent ?? 5,
    });
    setItems(e.items.map(it => ({ ...it, id: `i${++rowKey}` })));
    setModal(true);
  };

  // Repeat: copy all details from an existing entry as a new entry with today's date
  const openRepeat = (e: AccessoryEntry) => {
    setEditing(null); // new entry, not an edit
    setForm({
      entryDate: new Date().toISOString().slice(0, 10), // today
      equipmentId: e.equipmentId ?? '', equipmentName: e.equipmentName ?? '',
      poNumber: '', // clear PO — user will enter new invoice
      department: e.department, area: e.area,
      approvedBy: e.approvedBy ?? '', remarks: '',
      vatPercent: e.vatPercent ?? 5,
    });
    setItems(e.items.map(it => ({ ...it, id: `i${++rowKey}` })));
    setModal(true);
    toast('Entry duplicated — update date & PO number then save.', { icon: '📋' });
  };

  const updateItem = (id: string, patch: Partial<AccessoryItem>) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const updated = { ...it, ...patch };
      if (patch.itemName) {
        const preset = ITEM_PRESETS[patch.itemName];
        if (preset) { updated.category = preset.category; updated.unit = preset.unit; }
      }
      updated.totalCost = Math.round(updated.quantity * updated.unitRate * 100) / 100;
      return updated;
    }));
  };

  const addItem = () => setItems(prev => [...prev, blankItem()]);
  const removeItem = (id: string) => {
    if (items.length === 1) { toast.error('At least one item required'); return; }
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleEquipmentChange = (id: string) => {
    const eq = equipment.find(e => e._id === id);
    setForm(f => ({ ...f, equipmentId: id, equipmentName: eq?.equipmentName ?? '' }));
  };

  const handleSave = async () => {
    if (!form.entryDate) { toast.error('Entry date is required'); return; }
    if (items.some(i => !i.itemName.trim())) { toast.error('Item name required for all rows'); return; }
    const payload = {
      ...form,
      items: items.map(({ id: _id, ...it }) => it),
      subTotal: totalCost,
      vatPercent: form.vatPercent,
      vatAmount,
      totalCost: grandTotal,
    };
    setSaving(true);
    try {
      if (editing) {
        const updated = await apiFetch(`/api/accessories/${editing._id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setEntries(prev => prev.map(e => e._id === editing._id ? updated : e));
        toast.success('Entry updated');
      } else {
        await apiFetch('/api/accessories', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Entry saved');
        loadEntries();
      }
      setModal(false);
    } catch (err: any) { toast.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this accessories entry?')) return;
    try {
      await apiFetch(`/api/accessories/${id}`, { method: 'DELETE' });
      setEntries(prev => prev.filter(e => e._id !== id));
      setTotal(t => t - 1);
      toast.success('Deleted');
    } catch { toast.error('Delete failed'); }
  };

  const displayed = entries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (e.equipmentName || '').toLowerCase().includes(q) || (e.area || '').toLowerCase().includes(q) ||
      e.items.some(i => i.itemName.toLowerCase().includes(q));
  });

  const pages = Math.ceil(total / 25);
  const thStyle: React.CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: 0.5, background: '#1e293b', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 12, color: '#334155', verticalAlign: 'middle' };
  const itemThStyle: React.CSSProperties = { padding: '5px 8px', fontSize: 10, fontWeight: 700, color: '#fff', background: '#334155', textTransform: 'uppercase', letterSpacing: 0.4 };

  const categoryColor: Record<string, { bg: string; color: string }> = {
    Fuel:        { bg: '#fef9c3', color: '#a16207' },
    Lubricant:   { bg: '#dbeafe', color: '#1d4ed8' },
    Electrical:  { bg: '#fce7f3', color: '#9d174d' },
    Water:       { bg: '#cffafe', color: '#164e63' },
    Chemical:    { bg: '#f0fdf4', color: '#15803d' },
    Safety:      { bg: '#fef3c7', color: '#92400e' },
    Other:       { bg: '#f1f5f9', color: '#475569' },
  };

  return (
    <div style={{ padding: '20px 24px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#d97706,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Fuel size={20} color="#fff"/>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Accessories & Consumables</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Track diesel, oil, battery, distilled water and other equipment consumables</p>
        </div>
        <button onClick={openAdd} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15}/> New Entry
        </button>
      </div>

      <AccessoryInvoiceScan onApproved={loadEntries} />

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}/>
          <input style={{ ...inp, paddingLeft: 30, background: '#f8fafc' }} placeholder="Search item, equipment, area…" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div style={{ flex: '1 1 110px' }}>
          <div style={lbl}>From</div>
          <input type="date" style={{ ...inp, height: 32 }} value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1); }}/>
        </div>
        <div style={{ flex: '1 1 110px' }}>
          <div style={lbl}>To</div>
          <input type="date" style={{ ...inp, height: 32 }} value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1); }}/>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center' }}>{total} records</div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Fuel size={40} color="#e2e8f0" style={{ marginBottom: 12 }}/>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#94a3b8' }}>No consumables entries yet</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Click "New Entry" to log diesel, oil or other accessories</div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 32 }}/>
                    {['Date','Equipment','Invoice / D.O. No.','Area','Items','Total Cost (AED)',''].map(h => (
                      <th key={h} style={{ ...thStyle, textAlign: h === 'Total Cost (AED)' ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((e, idx) => (
                    <>
                      <tr key={e._id} style={{ borderBottom: expandedRow === e._id ? 'none' : '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc', cursor: 'pointer' }} onClick={() => setExpandedRow(expandedRow === e._id ? null : e._id)}>
                        <td style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8', paddingRight: 0 }}>
                          {expandedRow === e._id ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                        </td>
                        <td style={tdStyle}>{new Date(e.entryDate).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td style={{ ...tdStyle, color: e.equipmentName ? '#0f172a' : '#94a3b8', fontStyle: e.equipmentName ? 'normal' : 'italic' }}>{e.equipmentName || 'No equipment linked'}</td>
                        <td style={tdStyle}>{e.deliveryOrderNumber ? 'D.O. No: ' + e.deliveryOrderNumber : (e.invoiceNumber || e.poNumber || '—')}</td>
                        <td style={tdStyle}>{e.area || '—'}</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {e.items.slice(0, 3).map((it, i) => (
                              <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, ...(categoryColor[it.category] || categoryColor['Other']) }}>
                                {it.itemName} {it.quantity}{it.unit.slice(0, 1)}
                              </span>
                            ))}
                            {e.items.length > 3 && <span style={{ fontSize: 10, color: '#94a3b8' }}>+{e.items.length - 3} more</span>}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, color: '#d97706', fontSize: 13 }}>AED {(e.totalCost || 0).toLocaleString('en-AE')}</div>
                          {e.vatPercent ? (
                            <div style={{ fontSize: 10, color: '#92400e', background: '#fef3c7', borderRadius: 6, padding: '1px 5px', display: 'inline-block', marginTop: 2 }}>
                              VAT {e.vatPercent}% incl.
                            </div>
                          ) : null}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }} onClick={ev => ev.stopPropagation()}>
                          <button onClick={() => openRepeat(e)} title="Repeat — create new entry with same details" style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 3 }}><Copy size={13}/></button>
                          <button onClick={() => openEdit(e)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 3 }}><Edit2 size={13}/></button>
                          <button onClick={() => handleDelete(e._id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 3 }}><Trash2 size={13}/></button>
                        </td>
                      </tr>
                      {expandedRow === e._id && (
                        <tr key={`${e._id}-exp`} style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                          <td colSpan={8} style={{ padding: '12px 20px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: 8, overflow: 'hidden' }}>
                              <thead>
                                <tr>
                                  {['Item','Category','Qty','Unit','Unit Rate (AED)','Total (AED)'].map(h => (
                                    <th key={h} style={itemThStyle}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {e.items.map((it, i) => (
                                  <tr key={i} style={{ background: i % 2 === 0 ? '#fffbeb' : '#fef9c3', borderBottom: '1px solid #fde68a' }}>
                                    <td style={{ padding: '5px 8px', fontWeight: 600, color: '#92400e', fontSize: 12 }}>{it.itemName}</td>
                                    <td style={{ padding: '5px 8px', fontSize: 12 }}>
                                      <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 10, fontWeight: 600, ...(categoryColor[it.category] || categoryColor.Other) }}>{it.category}</span>
                                    </td>
                                    <td style={{ padding: '5px 8px', fontSize: 12, color: '#78350f' }}>{it.quantity}</td>
                                    <td style={{ padding: '5px 8px', fontSize: 12, color: '#78350f' }}>{it.unit}</td>
                                    <td style={{ padding: '5px 8px', fontSize: 12, color: '#78350f' }}>AED {it.unitRate.toLocaleString('en-AE')}</td>
                                    <td style={{ padding: '5px 8px', fontSize: 12, fontWeight: 700, color: '#92400e', textAlign: 'right' }}>AED {it.totalCost.toLocaleString('en-AE')}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td colSpan={5} style={{ padding: '6px 8px', fontWeight: 700, color: '#92400e', borderTop: '2px solid #f59e0b', fontSize: 12 }}>SUBTOTAL</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#92400e', borderTop: '2px solid #f59e0b', fontSize: 13 }}>AED {(e.subTotal ?? e.items.reduce((s,i)=>s+i.totalCost,0)).toLocaleString('en-AE')}</td>
                                </tr>
                                {(e.vatPercent ?? 0) > 0 && (
                                  <tr style={{ background: '#fef9c3' }}>
                                    <td colSpan={5} style={{ padding: '5px 8px', fontWeight: 600, color: '#92400e', fontSize: 12 }}>VAT ({e.vatPercent}%)</td>
                                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#d97706', fontSize: 12 }}>AED {(e.vatAmount ?? 0).toLocaleString('en-AE')}</td>
                                  </tr>
                                )}
                                {(e.vatPercent ?? 0) > 0 && (
                                  <tr style={{ background: '#fde68a' }}>
                                    <td colSpan={5} style={{ padding: '7px 8px', fontWeight: 800, color: '#78350f', fontSize: 12 }}>GRAND TOTAL (incl. VAT)</td>
                                    <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 900, color: '#92400e', fontSize: 15 }}>AED {(e.totalCost || 0).toLocaleString('en-AE')}</td>
                                  </tr>
                                )}
                              </tfoot>
                            </table>
                            {e.remarks && <div style={{ marginTop: 8, fontSize: 11, color: '#92400e' }}><strong>Remarks:</strong> {e.remarks}</div>}
                          </td>
                        </tr>
                      )}
                    </>
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
          <div style={{ width: '100%', maxWidth: 980, background: '#fff', borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', marginTop: 4, marginBottom: 24 }}>

            <div style={{ padding: '14px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb', borderRadius: '16px 16px 0 0' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#d97706' }}>{editing ? 'Edit Consumables Entry' : 'New Consumables Entry'}</div>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18}/></button>
            </div>

            <div style={{ padding: 22 }}>
              {/* Header fields */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={lbl}>Entry Date *</label>
                  <input type="date" style={inp} value={form.entryDate} onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))}/>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={lbl}>Linked Equipment (optional)</label>
                  <select style={inp} value={form.equipmentId} onChange={e => handleEquipmentChange(e.target.value)}>
                    <option value="">— Not linked to specific equipment —</option>
                    {equipment.map(eq => <option key={eq._id} value={eq._id}>{eq.equipmentName} ({eq.vendorCompany})</option>)}
                  </select>
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
                  <input style={inp} value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="e.g. Generator Room"/>
                </div>
                <div>
                  <label style={lbl}>Approved By</label>
                  <input style={inp} value={form.approvedBy} onChange={e => setForm(f => ({ ...f, approvedBy: e.target.value }))} placeholder="Name"/>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Accessories / Consumables — {items.length} item{items.length !== 1 ? 's' : ''}
                  </div>
                  <button onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <Plus size={12}/> Add Item
                  </button>
                </div>

                <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                    <thead>
                      <tr>
                        {['Item Name','Category','Unit','Quantity','Unit Rate (AED)','Total Cost (AED)',''].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Total Cost (AED)' ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: 0.5, background: '#1e293b', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                          <td style={{ padding: '5px 6px', width: 160 }}>
                            <select style={cellInp} value={it.itemName} onChange={e => updateItem(it.id, { itemName: e.target.value })}>
                              {ITEM_NAMES.map(n => <option key={n}>{n}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '5px 6px', width: 110 }}>
                            <select style={cellInp} value={it.category} onChange={e => updateItem(it.id, { category: e.target.value })}>
                              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '5px 6px', width: 90 }}>
                            <select style={cellInp} value={it.unit} onChange={e => updateItem(it.id, { unit: e.target.value })}>
                              {UNITS.map(u => <option key={u}>{u}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '5px 6px', width: 90 }}>
                            <input type="number" min="0" step="0.01" style={cellInp} value={it.quantity || ''} onChange={e => updateItem(it.id, { quantity: Number(e.target.value) })} placeholder="0"/>
                          </td>
                          <td style={{ padding: '5px 6px', width: 130 }}>
                            <input type="number" min="0" step="0.01" style={cellInp} value={it.unitRate || ''} onChange={e => updateItem(it.id, { unitRate: Number(e.target.value) })} placeholder="AED/unit"/>
                          </td>
                          <td style={{ padding: '5px 10px', width: 130, textAlign: 'right', fontWeight: 700, color: '#d97706', fontSize: 13 }}>
                            AED {it.totalCost.toLocaleString('en-AE')}
                          </td>
                          <td style={{ padding: '5px 6px', textAlign: 'center', width: 36 }}>
                            <button onClick={() => removeItem(it.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 3 }}><X size={13}/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      {/* Subtotal row */}
                      <tr style={{ background: '#fef3c7', borderTop: '2px solid #d97706' }}>
                        <td colSpan={5} style={{ padding: '8px 10px', fontWeight: 700, color: '#92400e', fontSize: 12 }}>
                          SUBTOTAL — {items.length} item{items.length !== 1 ? 's' : ''}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#d97706', fontSize: 14 }}>
                          AED {totalCost.toLocaleString('en-AE')}
                        </td>
                        <td/>
                      </tr>
                      {/* VAT row */}
                      <tr style={{ background: '#fef9c3' }}>
                        <td colSpan={3} style={{ padding: '7px 10px', fontWeight: 700, color: '#92400e', fontSize: 12 }}>
                          VAT
                        </td>
                        <td colSpan={2} style={{ padding: '7px 6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="number" min="0" max="100" step="0.5"
                              style={{ ...cellInp, width: 70, height: 26 }}
                              value={form.vatPercent}
                              onChange={e => setForm(f => ({ ...f, vatPercent: Math.max(0, Number(e.target.value)) }))}
                              placeholder="0"
                            />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>%</span>
                          </div>
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#d97706', fontSize: 13 }}>
                          AED {vatAmount.toLocaleString('en-AE')}
                        </td>
                        <td/>
                      </tr>
                      {/* Grand Total row */}
                      <tr style={{ background: '#fde68a', borderTop: '2px solid #d97706' }}>
                        <td colSpan={5} style={{ padding: '10px 10px', fontWeight: 800, color: '#78350f', fontSize: 13 }}>
                          GRAND TOTAL (incl. VAT {form.vatPercent}%)
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 900, color: '#92400e', fontSize: 17 }}>
                          AED {grandTotal.toLocaleString('en-AE')}
                        </td>
                        <td/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label style={lbl}>Remarks</label>
                <textarea style={{ ...inp, height: 50, resize: 'vertical', paddingTop: 8 }} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Any notes about this consumables entry…"/>
              </div>
            </div>

            <div style={{ padding: '12px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#fffbeb', borderRadius: '0 0 16px 16px' }}>
              <button onClick={() => setModal(false)} style={{ padding: '8px 18px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 22px', background: '#d97706', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
                <Save size={14}/> {saving ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

