import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, X, Save, Search, FileText, CheckCircle, Clock, XCircle, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Contract {
  _id: string;
  contractName: string;
  contractorCompany: string;
  contractNumber: string;
  poNumber: string;
  startDate: string;
  endDate: string;
  contractType: string;
  paymentTerms: string;
  scopeOfWork: string;
  contractValue: number;
  contactPerson: string;
  mobile: string;
  email: string;
  status: 'Active' | 'Expired' | 'Closed';
}

const CONTRACT_TYPES    = ['AMC', 'Annual Contract', 'Shutdown', 'Project', 'Daily Labour', 'Term Contract', 'Rate Contract'];
const PAYMENT_TERMS_OPT = ['Daily', 'Monthly', 'Weekly', 'AMC', 'Quarterly'];
const STATUS_OPTS       = ['Active', 'Expired', 'Closed'] as const;

const BLANK: Omit<Contract, '_id'> = {
  contractName: '', contractorCompany: '', contractNumber: '', poNumber: '',
  startDate: '', endDate: '', contractType: 'AMC', paymentTerms: 'Monthly',
  scopeOfWork: '', contractValue: 0, contactPerson: '', mobile: '', email: '', status: 'Active',
};

const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const currency = (n: number) => n ? `AED ${n.toLocaleString('en-AE')}` : '—';

const statusStyle: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  Active:  { bg: '#dcfce7', color: '#15803d', icon: <CheckCircle size={12}/> },
  Expired: { bg: '#fef9c3', color: '#a16207', icon: <Clock size={12}/> },
  Closed:  { bg: '#fee2e2', color: '#dc2626', icon: <XCircle size={12}/> },
};

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function ContractMaster() {
  const { user } = useAuth();
  const canEdit = user?.role === 'manager' || user?.role === 'deputy_manager';

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState<'All' | 'Active' | 'Expired' | 'Closed'>('All');
  const [modal,     setModal]     = useState(false);
  const [editing,   setEditing]   = useState<Contract | null>(null);
  const [form,      setForm]      = useState<Omit<Contract,'_id'>>(BLANK);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setContracts(await apiFetch('/api/contracts')); }
    catch { toast.error('Failed to load contracts'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(BLANK); setModal(true); };
  const openEdit = (c: Contract) => {
    setEditing(c);
    setForm({
      contractName: c.contractName, contractorCompany: c.contractorCompany,
      contractNumber: c.contractNumber, poNumber: c.poNumber ?? '',
      startDate: c.startDate?.slice(0, 10) ?? '', endDate: c.endDate?.slice(0, 10) ?? '',
      contractType: c.contractType, paymentTerms: c.paymentTerms || 'Monthly',
      scopeOfWork: c.scopeOfWork, contractValue: c.contractValue,
      contactPerson: c.contactPerson, mobile: c.mobile, email: c.email, status: c.status,
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.contractName || !form.contractorCompany || !form.contractNumber || !form.startDate || !form.endDate) {
      toast.error('Please fill all required fields'); return;
    }
    setSaving(true);
    try {
      if (editing) {
        const updated = await apiFetch(`/api/contracts/${editing._id}`, { method: 'PUT', body: JSON.stringify(form) });
        setContracts(prev => prev.map(c => c._id === editing._id ? updated : c));
        toast.success('Contract updated');
      } else {
        const created = await apiFetch('/api/contracts', { method: 'POST', body: JSON.stringify(form) });
        setContracts(prev => [created, ...prev]);
        toast.success('Contract created');
      }
      setModal(false);
    } catch (e: any) { toast.error(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await apiFetch(`/api/contracts/${id}`, { method: 'DELETE' });
      setContracts(prev => prev.filter(c => c._id !== id));
      toast.success('Deleted');
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(null); }
  };

  const displayed = contracts.filter(c => {
    const matchFilter = filter === 'All' || c.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || c.contractName.toLowerCase().includes(q) || c.contractorCompany.toLowerCase().includes(q) || c.contractNumber.toLowerCase().includes(q) || (c.poNumber || '').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const counts = {
    All: contracts.length,
    Active: contracts.filter(c => c.status === 'Active').length,
    Expired: contracts.filter(c => c.status === 'Expired').length,
    Closed: contracts.filter(c => c.status === 'Closed').length,
  };

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 36, padding: '0 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, color: '#1e293b', background: '#f8fafc', outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.7, display: 'block', marginBottom: 4 };
  const fld = (l: string, el: React.ReactNode) => (<div><label style={lbl}>{l}</label>{el}</div>);

  return (
    <div style={{ padding: '20px 24px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#1e40af,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={20} color="#fff"/>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Contract Master</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Manage all outsource & contractor contracts</p>
        </div>
        {canEdit && (
          <button onClick={openAdd} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={15}/> Add Contract
          </button>
        )}
      </div>

      {/* Tabs + search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 8, padding: 3, gap: 2 }}>
          {(['All', 'Active', 'Expired', 'Closed'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filter === s ? '#fff' : 'transparent', color: filter === s ? '#1e40af' : '#64748b',
              boxShadow: filter === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>{s} ({counts[s]})</button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contract, company, PO…"
            style={{ ...inp, paddingLeft: 28, height: 34 }}/>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading contracts…</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Building2 size={40} color="#e2e8f0" style={{ marginBottom: 12 }}/>
            <div style={{ color: '#94a3b8', fontSize: 14 }}>No contracts found</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  {['Contract Name', 'Company', 'Contract No.', 'PO No.', 'Type', 'Payment', 'Period', 'Value', 'Status', 'Contact', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((c, i) => {
                  const st = statusStyle[c.status];
                  return (
                    <tr key={c._id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{c.contractName}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#334155' }}>{c.contractorCompany}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{c.contractNumber}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{c.poNumber || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: '#475569' }}>{c.contractType}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#0f766e', background: '#ccfbf1', padding: '2px 8px', borderRadius: 12 }}>{c.paymentTerms}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{fmt(c.startDate)} – {fmt(c.endDate)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#1e40af' }}>{currency(c.contractValue)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>
                          {st.icon} {c.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b' }}>
                        <div>{c.contactPerson}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.mobile}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {canEdit && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openEdit(c)} style={{ padding: '4px 8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Edit2 size={12}/></button>
                            <button onClick={() => handleDelete(c._id)} disabled={deleting === c._id} style={{ padding: '4px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                              {deleting === c._id ? '…' : <Trash2 size={12}/>}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div style={{ width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
            {/* Header */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: '16px 16px 0 0' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{editing ? 'Edit Contract' : 'Add New Contract'}</div>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18}/></button>
            </div>

            {/* Form */}
            <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Section: Contract Identity */}
              <div style={{ gridColumn: '1 / -1', fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 6, borderBottom: '1px solid #e2e8f0' }}>
                Contract Identity
              </div>
              {fld('Contract Name *', <input style={inp} value={form.contractName} onChange={e => setForm(f => ({ ...f, contractName: e.target.value }))} placeholder="e.g. E&I Maintenance AMC 2025"/>)}
              {fld('Contractor Company *', <input style={inp} value={form.contractorCompany} onChange={e => setForm(f => ({ ...f, contractorCompany: e.target.value }))} placeholder="Company name"/>)}
              {fld('Contract Number *', <input style={inp} value={form.contractNumber} onChange={e => setForm(f => ({ ...f, contractNumber: e.target.value }))} placeholder="e.g. GT-EI-2025-001"/>)}
              {fld('PO Number', <input style={inp} value={form.poNumber} onChange={e => setForm(f => ({ ...f, poNumber: e.target.value }))} placeholder="e.g. PO/2025/0123 (if applicable)"/>)}

              {/* Section: Contract Terms */}
              <div style={{ gridColumn: '1 / -1', fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 6, borderBottom: '1px solid #e2e8f0', marginTop: 6 }}>
                Contract Terms
              </div>
              {fld('Contract Type *', (
                <select style={inp} value={form.contractType} onChange={e => setForm(f => ({ ...f, contractType: e.target.value }))}>
                  {CONTRACT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              ))}
              {fld('Payment Terms *', (
                <select style={inp} value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}>
                  {PAYMENT_TERMS_OPT.map(t => <option key={t}>{t}</option>)}
                </select>
              ))}
              {fld('Start Date *', <input type="date" style={inp} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}/>)}
              {fld('End Date *', <input type="date" style={inp} value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}/>)}
              {fld('Contract Value (AED)', <input type="number" style={inp} value={form.contractValue || ''} onChange={e => setForm(f => ({ ...f, contractValue: Number(e.target.value) }))} placeholder="0"/>)}
              {fld('Status', (
                <select style={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                </select>
              ))}

              {/* Section: Contact */}
              <div style={{ gridColumn: '1 / -1', fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 6, borderBottom: '1px solid #e2e8f0', marginTop: 6 }}>
                Contact Details
              </div>
              {fld('Contact Person', <input style={inp} value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Name"/>)}
              {fld('Mobile', <input style={inp} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="+971 …"/>)}
              <div style={{ gridColumn: '1 / -1' }}>
                {fld('Email', <input type="email" style={inp} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@company.com"/>)}
              </div>

              {/* Section: Scope */}
              <div style={{ gridColumn: '1 / -1', fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 6, borderBottom: '1px solid #e2e8f0', marginTop: 6 }}>
                Scope of Work
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                {fld('Scope of Work', <textarea style={{ ...inp, height: 80, resize: 'vertical', paddingTop: 8 }} value={form.scopeOfWork} onChange={e => setForm(f => ({ ...f, scopeOfWork: e.target.value }))} placeholder="Describe the scope of work…"/>)}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#f8fafc', borderRadius: '0 0 16px 16px' }}>
              <button onClick={() => setModal(false)} style={{ padding: '8px 18px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', background: '#1e40af', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
                <Save size={14}/> {saving ? 'Saving…' : 'Save Contract'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
