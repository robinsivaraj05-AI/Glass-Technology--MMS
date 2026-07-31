import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, X, Save, Search, Wrench, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface Equipment {
  _id: string;
  equipmentName: string;
  equipmentType: string;
  make: string;
  modelSpec: string;
  capacity: string;
  regNumber: string;
  vendorCompany: string;
  contactPerson: string;
  contactPhone: string;
  contractRef: string;
  rateType: 'Daily' | 'Hourly' | 'Monthly';
  rate: number;
  status: 'Active' | 'Inactive' | 'Under Maintenance';
  remarks: string;
}

const EQUIPMENT_TYPES = ['Crane', 'Excavator', 'Generator', 'Vehicle', 'Pump', 'Compressor', 'Forklift', 'Welding Machine', 'Air Compressor', 'Concrete Mixer', 'Scaffolding', 'Hoist', 'Boom Lift', 'Scissor Lift', 'Other'];
const RATE_TYPES = ['Daily', 'Hourly', 'Monthly'] as const;
const STATUSES = ['Active', 'Inactive', 'Under Maintenance'] as const;

const BLANK: Omit<Equipment, '_id'> = {
  equipmentName: '', equipmentType: 'Other', make: '', modelSpec: '', capacity: '',
  regNumber: '', vendorCompany: '', contactPerson: '', contactPhone: '', contractRef: '',
  rateType: 'Daily', rate: 0, status: 'Active', remarks: '',
};

const statusStyle: Record<string, { bg: string; color: string }> = {
  'Active':              { bg: '#dcfce7', color: '#15803d' },
  'Inactive':            { bg: '#fee2e2', color: '#dc2626' },
  'Under Maintenance':   { bg: '#fef9c3', color: '#a16207' },
};

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function EquipmentMaster() {
  const [list,    setList]    = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form,    setForm]    = useState<Omit<Equipment, '_id'>>(BLANK);
  const [saving,  setSaving]  = useState(false);
  const [search,  setSearch]  = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType,   setFilterType]   = useState('All');

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 34, padding: '0 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1e293b', background: '#f8fafc', outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 3 };
  const sec = (t: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 1, gridColumn: '1/-1', borderBottom: '1px solid #ede9fe', paddingBottom: 4, marginTop: 6 }}>{t}</div>
  );

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await apiFetch('/api/equipment')); }
    catch { toast.error('Failed to load equipment'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(BLANK); setModal(true); };
  const openEdit = (eq: Equipment) => { setEditing(eq); setForm({ ...eq }); setModal(true); };

  const handleSave = async () => {
    if (!form.equipmentName.trim()) { toast.error('Equipment name is required'); return; }
    if (!form.vendorCompany.trim()) { toast.error('Vendor / Company is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        const updated = await apiFetch(`/api/equipment/${editing._id}`, { method: 'PUT', body: JSON.stringify(form) });
        setList(prev => prev.map(e => e._id === editing._id ? updated : e));
        toast.success('Equipment updated');
      } else {
        const created = await apiFetch('/api/equipment', { method: 'POST', body: JSON.stringify(form) });
        setList(prev => [created, ...prev]);
        toast.success('Equipment added');
      }
      setModal(false);
    } catch (err: any) { toast.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this equipment record?')) return;
    try {
      await apiFetch(`/api/equipment/${id}`, { method: 'DELETE' });
      setList(prev => prev.filter(e => e._id !== id));
      toast.success('Deleted');
    } catch { toast.error('Delete failed'); }
  };

  const displayed = list.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.equipmentName.toLowerCase().includes(q) || e.vendorCompany.toLowerCase().includes(q) || (e.regNumber || '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'All' || e.status === filterStatus;
    const matchType   = filterType   === 'All' || e.equipmentType === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const thStyle: React.CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#f1f5f9', textTransform: 'uppercase', letterSpacing: 0.5, background: '#1e293b', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '9px 12px', fontSize: 12, color: '#334155', verticalAlign: 'middle' };

  return (
    <div style={{ padding: '20px 24px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Wrench size={20} color="#fff"/>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Equipment Master</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Register all rental equipment with vendor details and rate information</p>
        </div>
        <button onClick={openAdd} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15}/> Add Equipment
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}/>
          <input style={{ ...inp, paddingLeft: 30, background: '#f8fafc' }} placeholder="Search equipment, vendor, reg no…" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div style={{ flex: '1 1 130px' }}>
          <div style={lbl}>Status</div>
          <select style={{ ...inp, height: 32 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="All">All Status</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <div style={lbl}>Type</div>
          <select style={{ ...inp, height: 32 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="All">All Types</option>
            {EQUIPMENT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center', whiteSpace: 'nowrap' }}>
          {displayed.length} of {list.length} records
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Loading…</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Wrench size={40} color="#e2e8f0" style={{ marginBottom: 12 }}/>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#94a3b8' }}>No equipment registered yet</div>
            <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>Click "Add Equipment" to register your first rental equipment</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Equipment Name','Type','Make / Model','Capacity','Reg No.','Vendor / Company','Rate Type','Rate (AED)','Status',''].map(h => (
                    <th key={h} style={{ ...thStyle, textAlign: h === 'Rate (AED)' ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((eq, idx) => (
                  <tr key={eq._id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#0f172a' }}>{eq.equipmentName}</td>
                    <td style={tdStyle}>{eq.equipmentType}</td>
                    <td style={tdStyle}>{[eq.make, eq.modelSpec].filter(Boolean).join(' / ') || '—'}</td>
                    <td style={tdStyle}>{eq.capacity || '—'}</td>
                    <td style={tdStyle}>{eq.regNumber || '—'}</td>
                    <td style={tdStyle}>{eq.vendorCompany}</td>
                    <td style={tdStyle}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: '#ede9fe', color: '#7c3aed' }}>{eq.rateType}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>
                      {eq.rate.toLocaleString('en-AE')}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, ...statusStyle[eq.status] }}>{eq.status}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button onClick={() => openEdit(eq)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 4 }} title="Edit"><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete(eq._id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }} title="Delete"><Trash2 size={14}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div style={{ width: '100%', maxWidth: 860, background: '#fff', borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', marginBottom: 24 }}>

            {/* Modal Header */}
            <div style={{ padding: '14px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#faf5ff', borderRadius: '16px 16px 0 0' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#7c3aed' }}>
                {editing ? 'Edit Equipment' : 'Add Equipment'}
              </div>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18}/></button>
            </div>

            <div style={{ padding: 22 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {sec('Equipment Details')}

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={lbl}>Equipment Name *</label>
                  <input style={inp} value={form.equipmentName} onChange={e => setForm(f => ({ ...f, equipmentName: e.target.value }))} placeholder="e.g. 25-Ton Mobile Crane"/>
                </div>
                <div>
                  <label style={lbl}>Equipment Type *</label>
                  <select style={inp} value={form.equipmentType} onChange={e => setForm(f => ({ ...f, equipmentType: e.target.value }))}>
                    {EQUIPMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Make / Brand</label>
                  <input style={inp} value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value }))} placeholder="e.g. Liebherr, Caterpillar"/>
                </div>
                <div>
                  <label style={lbl}>Model / Spec</label>
                  <input style={inp} value={form.modelSpec} onChange={e => setForm(f => ({ ...f, modelSpec: e.target.value }))} placeholder="e.g. LTM 1025-3.1"/>
                </div>
                <div>
                  <label style={lbl}>Capacity / Power</label>
                  <input style={inp} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="e.g. 25 Ton / 500 kVA"/>
                </div>
                <div>
                  <label style={lbl}>Reg / Serial Number</label>
                  <input style={inp} value={form.regNumber} onChange={e => setForm(f => ({ ...f, regNumber: e.target.value }))} placeholder="Vehicle plate or serial no."/>
                </div>

                {sec('Vendor / Supplier')}

                <div>
                  <label style={lbl}>Vendor Company *</label>
                  <input style={inp} value={form.vendorCompany} onChange={e => setForm(f => ({ ...f, vendorCompany: e.target.value }))} placeholder="Company name"/>
                </div>
                <div>
                  <label style={lbl}>Contact Person</label>
                  <input style={inp} value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Name"/>
                </div>
                <div>
                  <label style={lbl}>Contact Phone</label>
                  <input style={inp} value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="+971 …"/>
                </div>
                <div>
                  <label style={lbl}>Contract / PO Reference</label>
                  <input style={inp} value={form.contractRef} onChange={e => setForm(f => ({ ...f, contractRef: e.target.value }))} placeholder="PO or contract number"/>
                </div>

                {sec('Rate & Status')}

                <div>
                  <label style={lbl}>Rate Type</label>
                  <select style={inp} value={form.rateType} onChange={e => setForm(f => ({ ...f, rateType: e.target.value as any }))}>
                    {RATE_TYPES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Rate (AED / {form.rateType.toLowerCase()})</label>
                  <input type="number" min="0" style={inp} value={form.rate || ''} onChange={e => setForm(f => ({ ...f, rate: Number(e.target.value) }))} placeholder="0.00"/>
                </div>
                <div>
                  <label style={lbl}>Status</label>
                  <select style={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>Remarks</label>
                  <textarea style={{ ...inp, height: 56, resize: 'vertical', paddingTop: 8 }} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Any notes or special conditions…"/>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#faf5ff', borderRadius: '0 0 16px 16px' }}>
              <button onClick={() => setModal(false)} style={{ padding: '8px 18px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 22px', background: '#7c3aed', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
                <Save size={14}/> {saving ? 'Saving…' : 'Save Equipment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
