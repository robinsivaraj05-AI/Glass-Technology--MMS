// @ts-nocheck
import { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, Search, Download, Edit2, Trash2, Eye, X, Upload, FileCheck } from 'lucide-react';
import * as XLSX from 'xlsx';
import { extractPOFromPDF } from '../utils/pdfPOExtractor';

// ── Types ─────────────────────────────────────────────────────────────────────
interface POItem {
  slNo: number;
  tagNo: string;
  description: string;
  specification: string;
  make: string;
  qty: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  receivedQty: number;
}

interface PO {
  id: string;
  poNo: string;
  poDate: string;
  rfqRef: string;
  vendor: string;
  vendorContact: string;
  department: string;
  requestedBy: string;
  approvedBy: string;
  estimatedDelivery: string;   // material estimation date
  actualDelivery: string;
  items: POItem[];
  totalValue: number;
  currency: string;
  deliveryAddress: string;
  paymentTerms: string;
  status: 'ordered' | 'acknowledged' | 'in-transit' | 'partially-received' | 'received' | 'delayed' | 'cancelled';
  trackingRef: string;
  remarks: string;
}

// ── API helper ────────────────────────────────────────────────────────────────
async function apiFetch(path, options: any = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) { const e = await res.json().catch(() => ({ message: res.statusText })); throw new Error(e.message || 'Request failed'); }
  return res.json();
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DEPARTMENTS = ['Electrical', 'Instrumentation', 'Mechanical', 'Utility', 'IT'];
const CURRENCIES  = ['AED', 'USD', 'INR', 'EUR'];
const UNITS       = ['Nos', 'Set', 'Meter', 'Roll', 'Kg', 'Ltr', 'Box', 'Pair', 'Lot'];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  'ordered':            { label: 'Ordered',           color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  'acknowledged':       { label: 'Acknowledged',       color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  'in-transit':         { label: 'In Transit',         color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'partially-received': { label: 'Partially Received', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  'received':           { label: 'Received',           color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  'delayed':            { label: 'Delayed',            color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  'cancelled':          { label: 'Cancelled',          color: '#64748b', bg: 'rgba(100,116,139,0.12)'},
};

// load() replaced by API

// ── Seed ─────────────────────────────────────────────────────────────────────
const SEED: PO[] = [
  {
    id:'po1', poNo:'PO-2026-001', poDate:'2026-07-05', rfqRef:'RFQ-2026-001',
    vendor:'Endress+Hauser UAE LLC', vendorContact:'sales.uae@endress.com',
    department:'Electrical', requestedBy:'Senthil Babu', approvedBy:'Rajesh Kumar',
    estimatedDelivery:'2026-07-28', actualDelivery:'',
    items:[
      { slNo:1, tagNo:'PT-023', description:'Pressure Transmitter Repair Kit', specification:'E+H PMC51, 0-10 bar, HART', make:'Endress+Hauser', qty:2, unit:'Set', unitPrice:1250, totalPrice:2500, receivedQty:0 },
      { slNo:2, tagNo:'FT-045', description:'Coriolis Flow Meter O-Ring Set',  specification:'DN50, SS316, EPDM', make:'Endress+Hauser', qty:1, unit:'Set', unitPrice:380, totalPrice:380, receivedQty:0 },
    ],
    totalValue:2880, currency:'AED',
    deliveryAddress:'Glass Technology LLC, Maintenance Store, Gate 2',
    paymentTerms:'30 days credit', status:'in-transit',
    trackingRef:'DHL-9876543210', remarks:'Follow up with vendor on 20-Jul',
  },
  {
    id:'po2', poNo:'PO-2026-002', poDate:'2026-07-12', rfqRef:'RFQ-2026-002',
    vendor:'Siemens UAE LLC', vendorContact:'industry.uae@siemens.com',
    department:'Electrical', requestedBy:'Rajesh Kumar', approvedBy:'Senthil Babu',
    estimatedDelivery:'2026-08-15', actualDelivery:'',
    items:[
      { slNo:1, tagNo:'VFD-013', description:'IGBT Module G120C', specification:'6SL3210-1KE21-3UF1, 7.5kW', make:'Siemens', qty:1, unit:'Nos', unitPrice:4800, totalPrice:4800, receivedQty:0 },
    ],
    totalValue:4800, currency:'AED',
    deliveryAddress:'Glass Technology LLC, Maintenance Store, Gate 2',
    paymentTerms:'45 days credit', status:'ordered',
    trackingRef:'', remarks:'',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function nextPONo(existing: PO[]): string {
  const year = new Date().getFullYear();
  const nums = existing.map(p => parseInt(p.poNo.split('-')[2] ?? '0')).filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `PO-${year}-${String(next).padStart(3,'0')}`;
}

const BLANK_ITEM = (): POItem => ({ slNo:1, tagNo:'', description:'', specification:'', make:'', qty:1, unit:'Nos', unitPrice:0, totalPrice:0, receivedQty:0 });

function blankPO(existing: PO[]): Omit<PO,'id'> {
  return {
    poNo: nextPONo(existing), poDate: new Date().toISOString().slice(0,10),
    rfqRef:'', vendor:'', vendorContact:'', department:'Electrical',
    requestedBy:'', approvedBy:'', estimatedDelivery:'', actualDelivery:'',
    items:[BLANK_ITEM()], totalValue:0, currency:'AED',
    deliveryAddress:'Glass Technology LLC, Maintenance Store, Gate 2',
    paymentTerms:'30 days credit', status:'ordered', trackingRef:'', remarks:'',
  };
}

function calcTotal(items: POItem[]): number {
  return items.reduce((s, i) => s + i.totalPrice, 0);
}

function daysToDelivery(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function exportList(pos: PO[]) {
  const wb = XLSX.utils.book_new();
  const rows = pos.map(p => ({
    'PO No':         p.poNo,          'PO Date':    p.poDate,
    'RFQ Ref':       p.rfqRef,        'Vendor':     p.vendor,
    'Department':    p.department,    'Requested By': p.requestedBy,
    'Approved By':   p.approvedBy,    'Items':      p.items.length,
    'Total Value':   `${p.currency} ${p.totalValue.toLocaleString()}`,
    'Est. Delivery': p.estimatedDelivery, 'Actual Delivery': p.actualDelivery,
    'Tracking Ref':  p.trackingRef,   'Status':     STATUS_CFG[p.status]?.label,
    'Remarks':       p.remarks,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch:14 },{ wch:12 },{ wch:14 },{ wch:28 },{ wch:14 },{ wch:16 },{ wch:16 },{ wch:6 },{ wch:16 },{ wch:14 },{ wch:14 },{ wch:18 },{ wch:20 },{ wch:24 }];
  XLSX.utils.book_append_sheet(wb, ws, 'PO Follow-up');
  XLSX.writeFile(wb, `PO_Followup_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PurchasePO() {
  const [pos, setPOs]             = useState<PO[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [listTab, setListTab]     = useState<'pending' | 'completed'>('pending');
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState<Omit<PO,'id'>>(blankPO([]));
  const [viewPO, setViewPO]       = useState<PO | null>(null);
  const [pdfLoading, setPDFLoading] = useState(false);
  const [fromPDF, setFromPDF]       = useState<Set<string>>(new Set());

  const PENDING_STATUSES   = new Set(['ordered','acknowledged','in-transit','partially-received','delayed']);
  const COMPLETED_STATUSES = new Set(['received','cancelled']);
  const fileRef                     = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        await fetch('/api/health');
        const data = await apiFetch('/api/purchase-po');
        setPOs(data);
      } catch (e) { console.error('Failed to load POs', e); }
      finally { setLoading(false); }
    })();
  }, []);

  const tabSet = listTab === 'pending' ? PENDING_STATUSES : COMPLETED_STATUSES;
  const filtered = pos.filter(p => {
    const t = search.toLowerCase();
    const ms = !t || p.poNo.toLowerCase().includes(t) || p.vendor.toLowerCase().includes(t) || p.rfqRef.toLowerCase().includes(t);
    return ms && tabSet.has(p.status) && (statusFilter === 'all' || p.status === statusFilter);
  });

  const stats = {
    total:    pos.length,
    ordered:  pos.filter(p => p.status === 'ordered' || p.status === 'acknowledged').length,
    transit:  pos.filter(p => p.status === 'in-transit').length,
    received: pos.filter(p => p.status === 'received').length,
    delayed:  pos.filter(p => p.status === 'delayed' || (p.estimatedDelivery && daysToDelivery(p.estimatedDelivery) < 0 && p.status !== 'received' && p.status !== 'cancelled')).length,
    pending:  pos.filter(p => p.status === 'partially-received').length,
  };

  const openAdd  = () => { setForm(blankPO(pos)); setEditId(null); setFromPDF(new Set()); setShowForm(true); };
  const openEdit = (p: PO) => { const { id, ...rest } = p; setForm(rest); setEditId(id); setFromPDF(new Set()); setShowForm(true); };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';
    setPDFLoading(true);
    try {
      const ext = await extractPOFromPDF(file);
      const base = blankPO(pos);
      const found = new Set<string>(ext.fieldsFound);

      const merged: Omit<PO,'id'> = {
        ...base,
        ...(ext.poNo             ? { poNo: ext.poNo }                           : {}),
        ...(ext.poDate           ? { poDate: ext.poDate }                       : {}),
        ...(ext.rfqRef           ? { rfqRef: ext.rfqRef }                       : {}),
        ...(ext.vendor           ? { vendor: ext.vendor }                       : {}),
        ...(ext.vendorContact    ? { vendorContact: ext.vendorContact }         : {}),
        ...(ext.requestedBy      ? { requestedBy: ext.requestedBy }             : {}),
        ...(ext.approvedBy       ? { approvedBy: ext.approvedBy }               : {}),
        ...(ext.estimatedDelivery? { estimatedDelivery: ext.estimatedDelivery } : {}),
        ...(ext.currency         ? { currency: ext.currency }                   : {}),
        ...(ext.totalValue       ? { totalValue: ext.totalValue }               : {}),
        ...(ext.paymentTerms     ? { paymentTerms: ext.paymentTerms }           : {}),
        ...(ext.deliveryAddress  ? { deliveryAddress: ext.deliveryAddress }     : {}),
        ...(ext.items?.length    ? {
          items: ext.items.map((it, i) => ({
            slNo: i + 1, tagNo: '',
            description: it.description, specification: it.specification, make: it.make,
            qty: it.qty, unit: it.unit, unitPrice: it.unitPrice, totalPrice: it.totalPrice, receivedQty: 0,
          }))
        } : {}),
      };

      setForm(merged);
      setFromPDF(found);
      setEditId(null);
      setShowForm(true);
    } catch (err: any) {
      alert(err?.message || 'Could not parse this PDF. Only text-based (not scanned) PDFs are supported.');
      openAdd();
    } finally {
      setPDFLoading(false);
    }
  };
  const setF     = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }));
  const addItem  = () => setForm(f => ({ ...f, items: [...f.items, { ...BLANK_ITEM(), slNo: f.items.length+1 }] }));
  const removeItem = (idx: number) => setForm(f => ({ ...f, items: f.items.filter((_,i)=>i!==idx).map((it,i)=>({...it,slNo:i+1})) }));
  const setItem  = (idx: number, k: keyof POItem, v: any) =>
    setForm(f => ({
      ...f,
      items: f.items.map((it,i) => {
        if (i !== idx) return it;
        const updated = { ...it, [k]: v };
        if (k === 'qty' || k === 'unitPrice') updated.totalPrice = updated.qty * updated.unitPrice;
        return updated;
      }),
    }));

  const saveForm = async () => {
    if (!form.poNo || !form.vendor || !form.estimatedDelivery) { alert('PO No., Vendor and Estimated Delivery Date are required.'); return; }
    const totalValue = calcTotal(form.items);
    try {
      if (editId) {
        const updated = await apiFetch(`/api/purchase-po/${editId}`, { method: 'PUT', body: JSON.stringify({ ...form, totalValue }) });
        setPOs(p => p.map(r => r.id === editId ? updated : r));
      } else {
        const created = await apiFetch('/api/purchase-po', { method: 'POST', body: JSON.stringify({ ...form, totalValue }) });
        setPOs(p => [created, ...p]);
      }
      setShowForm(false);
    } catch (e: any) { alert(e.message || 'Failed to save PO'); }
  };

  const deletePO = async (id) => {
    if (!confirm('Delete this PO?')) return;
    try {
      await apiFetch(`/api/purchase-po/${id}`, { method: 'DELETE' });
      setPOs(p => p.filter(r => r.id !== id));
    } catch (e: any) { alert(e.message || 'Failed to delete'); }
  };

  const updateStatus = async (id, status) => {
    const extra = status === 'received' ? { actualDelivery: new Date().toISOString().slice(0,10) } : {};
    try {
      const updated = await apiFetch(`/api/purchase-po/${id}`, { method: 'PUT', body: JSON.stringify({ status, ...extra }) });
      setPOs(p => p.map(r => r.id === id ? updated : r));
    } catch (e: any) { alert(e.message || 'Failed to update status'); }
  };

  const inp: React.CSSProperties = { width:'100%' };
  const lbl: React.CSSProperties = { fontSize:12, color:'#94a3b8', display:'block', marginBottom:5 };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, flexDirection:'column', gap:16 }}>
      <div style={{ width:40, height:40, border:'3px solid rgba(59,130,246,0.3)', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <div style={{ color:'#64748b', fontSize:14 }}>Loading purchase orders…</div>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10 }}>
        {[
          { label:'Total POs',          value:stats.total,    color:'#3b82f6' },
          { label:'Ordered / Ack.',     value:stats.ordered,  color:'#8b5cf6' },
          { label:'In Transit',         value:stats.transit,  color:'#f59e0b' },
          { label:'Partially Received', value:stats.pending,  color:'#f97316' },
          { label:'Received',           value:stats.received, color:'#22c55e' },
          { label:'Delayed / Overdue',  value:stats.delayed,  color:'#ef4444' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding:'12px 14px' }}>
            <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:'#64748b', marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:220 }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#475569' }} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search PO No., vendor, RFQ ref…" className="input-dark" style={{ paddingLeft:30 }} />
        </div>
        {/* PDF Upload */}
        <label style={{
          display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:600,
          background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.35)', color:'#a78bfa',
          cursor: pdfLoading ? 'wait' : 'pointer', transition:'all 0.2s', opacity: pdfLoading ? 0.7 : 1,
        }}>
          {pdfLoading
            ? <><span style={{ width:12,height:12,border:'2px solid #a78bfa',borderTopColor:'transparent',borderRadius:'50%',display:'inline-block',animation:'spin 0.7s linear infinite' }}/> Parsing PDF…</>
            : <><Upload size={13}/> Upload PO PDF</>
          }
          <input ref={fileRef} type="file" accept=".pdf" style={{ display:'none' }} onChange={handlePDFUpload} disabled={pdfLoading} />
        </label>
        <button className="btn-secondary" style={{ fontSize:12, display:'flex', alignItems:'center', gap:5 }} onClick={() => exportList(pos)}><Download size={13}/> Export</button>
        <button onClick={openAdd} className="btn-primary" style={{ fontSize:12 }}><Plus size={13}/> Add PO</button>
      </div>

      {/* Pending / Completed tabs */}
      <div style={{ display:'flex', gap:0, borderBottom:'2px solid rgba(255,255,255,0.07)' }}>
        {([
          { key:'pending',   label:'Pending PO',   count: pos.filter(p => PENDING_STATUSES.has(p.status)).length,   color:'#f59e0b' },
          { key:'completed', label:'Completed PO',  count: pos.filter(p => COMPLETED_STATUSES.has(p.status)).length, color:'#22c55e' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => { setListTab(t.key); setStatus('all'); }} style={{
            padding:'10px 22px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
            color: listTab===t.key ? t.color : '#475569',
            borderBottom: listTab===t.key ? `2px solid ${t.color}` : '2px solid transparent',
            marginBottom:-2, display:'flex', alignItems:'center', gap:8, transition:'all 0.15s',
          }}>
            {t.label}
            <span style={{ padding:'1px 8px', borderRadius:20, fontSize:11, fontWeight:700,
              background: listTab===t.key ? `${t.color}22` : 'rgba(255,255,255,0.05)',
              color: listTab===t.key ? t.color : '#475569',
            }}>{t.count}</span>
          </button>
        ))}
        {/* Inline status sub-filter */}
        <select value={statusFilter} onChange={e=>setStatus(e.target.value)} className="input-dark"
          style={{ marginLeft:'auto', width:210, alignSelf:'center', fontSize:11 }}>
          <option value="all">All {listTab === 'pending' ? 'Pending' : 'Completed'} Status</option>
          {(listTab === 'pending'
            ? ['ordered','acknowledged','in-transit','partially-received','delayed']
            : ['received','cancelled']
          ).map(k => <option key={k} value={k}>{STATUS_CFG[k].label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow:'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>PO No.</th><th>PO Date</th><th>RFQ Ref</th><th>Vendor</th>
              <th>Items</th><th>Total Value</th><th>Est. Delivery</th><th>Actual Delivery</th>
              <th>Tracking</th><th>Status</th>
              <th style={{ position:'sticky', right:0, background:'#0b0b18', zIndex:3 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign:'center', padding:32, color:'#475569' }}>
                {listTab === 'completed'
                  ? 'No completed POs yet — mark a PO as "Received" to see it here.'
                  : 'No pending purchase orders found.'}
              </td></tr>
            )}
            {filtered.map(p => {
              const days = p.estimatedDelivery ? daysToDelivery(p.estimatedDelivery) : null;
              const isOverdue = days !== null && days < 0 && p.status !== 'received' && p.status !== 'cancelled';
              const sc = STATUS_CFG[p.status];
              return (
                <tr key={p.id}>
                  <td style={{ color:'#60a5fa', fontFamily:'monospace', fontWeight:700, fontSize:12 }}>{p.poNo}</td>
                  <td style={{ fontSize:12, color:'#64748b' }}>{p.poDate}</td>
                  <td style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace' }}>{p.rfqRef||'—'}</td>
                  <td style={{ fontWeight:600, color:'#e2e8f0', fontSize:12, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.vendor}</td>
                  <td style={{ textAlign:'center', color:'#3b82f6', fontWeight:600 }}>{p.items.length}</td>
                  <td style={{ fontSize:12, fontWeight:600, color:'#22c55e' }}>{p.currency} {p.totalValue.toLocaleString()}</td>
                  <td style={{ fontSize:11, color: isOverdue ? '#ef4444' : '#64748b', fontWeight: isOverdue ? 700 : 400 }}>
                    {p.estimatedDelivery||'—'}
                    {days !== null && p.status !== 'received' && p.status !== 'cancelled' && (
                      <span style={{ display:'block', fontSize:9, color: isOverdue ? '#ef4444' : days <= 7 ? '#f59e0b' : '#475569' }}>
                        {isOverdue ? `${Math.abs(days)}d overdue` : `in ${days}d`}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize:11, color:'#22c55e' }}>{p.actualDelivery||'—'}</td>
                  <td style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace' }}>{p.trackingRef||'—'}</td>
                  <td style={{ minWidth:175 }}>
                    <select
                      value={p.status}
                      onChange={e => updateStatus(p.id, e.target.value as PO['status'])}
                      style={{
                        padding:'4px 8px', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer',
                        background: sc.bg, border:`1px solid ${sc.color}55`, color: sc.color,
                        outline:'none', width:'100%',
                      }}
                    >
                      {Object.entries(STATUS_CFG).map(([k,v]) => (
                        <option key={k} value={k} style={{ background:'#0b0b18', color: v.color }}>{v.label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ position:'sticky', right:0, background:'#0b0b18', zIndex:1, boxShadow:'-3px 0 8px rgba(0,0,0,0.5)', whiteSpace:'nowrap' }}>
                    <div style={{ display:'flex', gap:5 }}>
                      <button onClick={()=>setViewPO(p)} className="btn-secondary" style={{ padding:'4px 7px', fontSize:10 }} title="View"><Eye size={10}/></button>
                      <button onClick={()=>openEdit(p)} className="btn-secondary" style={{ padding:'4px 7px', fontSize:10 }} title="Edit"><Edit2 size={10}/></button>
                      <button onClick={()=>deletePO(p.id)} style={{ padding:'4px 7px', fontSize:10, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:6, color:'#ef4444', cursor:'pointer' }} title="Delete"><Trash2 size={10}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── View Modal ── */}
      {viewPO && (
        <div className="modal-overlay" onClick={()=>setViewPO(null)}>
          <div className="modal-content" style={{ maxWidth:860 }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'18px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'#60a5fa', fontFamily:'monospace' }}>{viewPO.poNo}</div>
                <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{viewPO.vendor}</div>
              </div>
              <button onClick={()=>setViewPO(null)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div style={{ padding:24, maxHeight:'76vh', overflowY:'auto' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>
                {[
                  ['PO Date',        viewPO.poDate],
                  ['RFQ Reference',  viewPO.rfqRef],
                  ['Department',     viewPO.department],
                  ['Requested By',   viewPO.requestedBy],
                  ['Approved By',    viewPO.approvedBy],
                  ['Currency',       viewPO.currency],
                  ['Est. Delivery',  viewPO.estimatedDelivery],
                  ['Actual Delivery',viewPO.actualDelivery || 'Pending'],
                  ['Tracking Ref',   viewPO.trackingRef || '—'],
                  ['Payment Terms',  viewPO.paymentTerms],
                  ['Total Value',    `${viewPO.currency} ${viewPO.totalValue.toLocaleString()}`],
                  ['Status',         STATUS_CFG[viewPO.status]?.label],
                ].map(([l,v]) => (
                  <div key={l} style={{ padding:'8px 12px', background:'rgba(255,255,255,0.03)', borderRadius:8 }}>
                    <div style={{ fontSize:10, color:'#475569', textTransform:'uppercase', letterSpacing:0.5 }}>{l}</div>
                    <div style={{ fontSize:13, color:'#e2e8f0', fontWeight:500, marginTop:2 }}>{v}</div>
                  </div>
                ))}
                <div style={{ gridColumn:'1/-1', padding:'8px 12px', background:'rgba(255,255,255,0.03)', borderRadius:8 }}>
                  <div style={{ fontSize:10, color:'#475569', textTransform:'uppercase', letterSpacing:0.5 }}>Vendor Contact</div>
                  <div style={{ fontSize:13, color:'#e2e8f0', fontWeight:500, marginTop:2 }}>{viewPO.vendorContact||'—'}</div>
                </div>
              </div>

              {/* Items */}
              <div style={{ fontSize:12, fontWeight:600, color:'#93c5fd', marginBottom:8, textTransform:'uppercase', letterSpacing:0.5 }}>Line Items</div>
              <div style={{ overflow:'auto', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)', marginBottom:14 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'rgba(59,130,246,0.1)' }}>
                      {['Sl.','Tag No.','Description','Specification','Make','Qty','Unit','Unit Price','Total','Received'].map(h=>(
                        <th key={h} style={{ padding:'7px 10px', textAlign:'left', color:'#93c5fd', fontSize:11, fontWeight:600, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewPO.items.map(it=>(
                      <tr key={it.slNo} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding:'7px 10px', color:'#64748b' }}>{it.slNo}</td>
                        <td style={{ padding:'7px 10px', color:'#60a5fa', fontFamily:'monospace', fontSize:11 }}>{it.tagNo||'—'}</td>
                        <td style={{ padding:'7px 10px', color:'#e2e8f0', fontWeight:500 }}>{it.description}</td>
                        <td style={{ padding:'7px 10px', color:'#94a3b8', fontSize:11 }}>{it.specification}</td>
                        <td style={{ padding:'7px 10px', color:'#94a3b8' }}>{it.make||'—'}</td>
                        <td style={{ padding:'7px 10px', color:'#f1f5f9', fontWeight:600 }}>{it.qty}</td>
                        <td style={{ padding:'7px 10px', color:'#64748b' }}>{it.unit}</td>
                        <td style={{ padding:'7px 10px', color:'#94a3b8' }}>{viewPO.currency} {it.unitPrice.toLocaleString()}</td>
                        <td style={{ padding:'7px 10px', color:'#22c55e', fontWeight:600 }}>{viewPO.currency} {it.totalPrice.toLocaleString()}</td>
                        <td style={{ padding:'7px 10px', color: it.receivedQty >= it.qty ? '#22c55e' : it.receivedQty > 0 ? '#f59e0b' : '#64748b', fontWeight:600 }}>
                          {it.receivedQty}/{it.qty}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background:'rgba(34,197,94,0.05)', borderTop:'2px solid rgba(34,197,94,0.2)' }}>
                      <td colSpan={8} style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'#94a3b8' }}>TOTAL</td>
                      <td style={{ padding:'8px 10px', fontWeight:700, color:'#22c55e', fontSize:14 }}>{viewPO.currency} {viewPO.totalValue.toLocaleString()}</td>
                      <td/>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Status update */}
              <div style={{ fontSize:12, fontWeight:600, color:'#93c5fd', marginBottom:8 }}>Update Status</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {Object.entries(STATUS_CFG).map(([k,v])=>(
                  <button key={k} onClick={()=>{ updateStatus(viewPO.id, k as PO['status']); setViewPO(p=>p?{...p,status:k as PO['status']}:p); }}
                    style={{ padding:'5px 12px', borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer',
                      background: viewPO.status===k ? v.color : 'rgba(255,255,255,0.05)',
                      border:`1px solid ${viewPO.status===k ? v.color : 'rgba(255,255,255,0.08)'}`,
                      color: viewPO.status===k ? '#fff' : v.color, transition:'all 0.2s',
                    }}>{v.label}</button>
                ))}
              </div>
              {viewPO.remarks && <div style={{ marginTop:12, padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:8, fontSize:12, color:'#94a3b8' }}><strong>Remarks:</strong> {viewPO.remarks}</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="modal-overlay" onClick={()=>setShowForm(false)}>
          <div className="modal-content" style={{ maxWidth:980 }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'18px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:16, fontWeight:600, color:'#f1f5f9' }}>{editId?'Edit PO':'Add Purchase Order'}</div>
                {fromPDF.size > 0 && !editId && (
                  <div style={{ fontSize:11, color:'#86efac', display:'flex', alignItems:'center', gap:4, marginTop:3 }}>
                    <FileCheck size={11}/> {fromPDF.size} fields auto-filled from PDF — green border = extracted. Review before saving.
                  </div>
                )}
              </div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:20 }}>×</button>
            </div>
            <div style={{ padding:24, maxHeight:'80vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
                {[
                  { k:'poNo',             l:'PO No. *',             pl:'Auto-generated' },
                  { k:'poDate',           l:'PO Date *',            t:'date' },
                  { k:'rfqRef',           l:'RFQ Reference',        pl:'RFQ-2026-001' },
                  { k:'vendor',           l:'Vendor *',             pl:'Vendor company name' },
                  { k:'vendorContact',    l:'Vendor Contact',       pl:'email / phone' },
                  { k:'department',       l:'Department',           t:'select', opts: DEPARTMENTS },
                  { k:'requestedBy',      l:'Requested By',         pl:'Name' },
                  { k:'approvedBy',       l:'Approved By',          pl:'Manager name' },
                  { k:'currency',         l:'Currency',             t:'select', opts: CURRENCIES },
                  { k:'estimatedDelivery',l:'Est. Delivery Date * (Material Estimation)', t:'date' },
                  { k:'paymentTerms',     l:'Payment Terms',        pl:'e.g. 30 days credit' },
                  { k:'trackingRef',      l:'Tracking / AWB Ref.',  pl:'Courier tracking number' },
                  { k:'status',           l:'Status',               t:'select', opts: Object.keys(STATUS_CFG) },
                  { k:'actualDelivery',   l:'Actual Delivery Date', t:'date' },
                ].map((f: any) => (
                  <div key={f.k} style={{
                    gridColumn: f.k==='estimatedDelivery' ? 'span 2' : undefined,
                    borderLeft: fromPDF.has(f.k) ? '3px solid rgba(34,197,94,0.7)' : undefined,
                    paddingLeft: fromPDF.has(f.k) ? 8 : undefined,
                    borderRadius: fromPDF.has(f.k) ? 6 : undefined,
                  }}>
                    <label style={lbl}>{f.l}</label>
                    {f.t==='select' ? (
                      <select className="input-dark" style={inp} value={(form as any)[f.k]} onChange={e=>setF(f.k,e.target.value)}>
                        {f.opts.map((o:string)=><option key={o} value={o}>{STATUS_CFG[o]?.label||o}</option>)}
                      </select>
                    ) : (
                      <input type={f.t??'text'} placeholder={f.pl} className="input-dark" style={inp}
                        value={(form as any)[f.k]} onChange={e=>setF(f.k,e.target.value)} />
                    )}
                  </div>
                ))}
                <div style={{
                  gridColumn:'1/-1',
                  borderLeft: fromPDF.has('deliveryAddress') ? '3px solid rgba(34,197,94,0.7)' : undefined,
                  paddingLeft: fromPDF.has('deliveryAddress') ? 8 : undefined,
                  borderRadius: fromPDF.has('deliveryAddress') ? 6 : undefined,
                }}>
                  <label style={lbl}>Delivery Address</label>
                  <input className="input-dark" style={inp} value={form.deliveryAddress} onChange={e=>setF('deliveryAddress',e.target.value)} />
                </div>
              </div>

              {/* Items */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#93c5fd' }}>
                    Line Items {fromPDF.has('items') && <span style={{ fontSize:10, color:'#86efac', fontWeight:500, marginLeft:6 }}>✓ extracted from PDF</span>}
                  </span>
                  <button onClick={addItem} className="btn-secondary" style={{ fontSize:11, padding:'5px 12px' }}><Plus size={11}/> Add Item</button>
                </div>
                <div style={{ border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, overflow:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'rgba(59,130,246,0.08)' }}>
                        {['Sl.','Tag No.','Description','Specification','Make','Qty','Unit','Unit Price','Total','Rcvd',''].map(h=>(
                          <th key={h} style={{ padding:'7px 8px', textAlign:'left', color:'#93c5fd', fontSize:11, fontWeight:600, borderBottom:'1px solid rgba(255,255,255,0.06)', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((it,idx)=>(
                        <tr key={idx} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding:'5px 8px', color:'#64748b', width:28 }}>{it.slNo}</td>
                          {(['tagNo','description','specification','make'] as const).map(k=>(
                            <td key={k} style={{ padding:'4px 5px', minWidth: k==='description'||k==='specification'?140:80 }}>
                              <input className="input-dark" style={{ fontSize:11, padding:'4px 6px', width:'100%' }} value={it[k]} onChange={e=>setItem(idx,k,e.target.value)} placeholder={k==='tagNo'?'PT-023':k} />
                            </td>
                          ))}
                          <td style={{ padding:'4px 5px', width:52 }}>
                            <input type="number" className="input-dark" style={{ fontSize:11, padding:'4px 6px', width:48 }} value={it.qty} onChange={e=>setItem(idx,'qty',Number(e.target.value))} min={1}/>
                          </td>
                          <td style={{ padding:'4px 5px', width:70 }}>
                            <select className="input-dark" style={{ fontSize:11, padding:'4px 5px' }} value={it.unit} onChange={e=>setItem(idx,'unit',e.target.value)}>
                              {UNITS.map(u=><option key={u}>{u}</option>)}
                            </select>
                          </td>
                          <td style={{ padding:'4px 5px', width:80 }}>
                            <input type="number" className="input-dark" style={{ fontSize:11, padding:'4px 6px', width:74 }} value={it.unitPrice} onChange={e=>setItem(idx,'unitPrice',Number(e.target.value))} min={0}/>
                          </td>
                          <td style={{ padding:'4px 5px', width:80 }}>
                            <input type="number" className="input-dark" style={{ fontSize:11, padding:'4px 6px', width:74 }} value={it.totalPrice} onChange={e=>setItem(idx,'totalPrice',Number(e.target.value))} min={0}/>
                          </td>
                          <td style={{ padding:'4px 5px', width:52 }}>
                            <input type="number" className="input-dark" style={{ fontSize:11, padding:'4px 6px', width:48 }} value={it.receivedQty} onChange={e=>setItem(idx,'receivedQty',Number(e.target.value))} min={0}/>
                          </td>
                          <td style={{ padding:'4px 8px' }}>
                            {form.items.length>1&&<button onClick={()=>removeItem(idx)} style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:6, color:'#ef4444', cursor:'pointer', padding:'3px 6px' }}><Trash2 size={11}/></button>}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background:'rgba(34,197,94,0.05)' }}>
                        <td colSpan={8} style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'#94a3b8', fontSize:12 }}>TOTAL</td>
                        <td style={{ padding:'8px 10px', fontWeight:700, color:'#22c55e' }}>{form.currency} {calcTotal(form.items).toLocaleString()}</td>
                        <td colSpan={2}/>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label style={lbl}>Remarks</label>
                <input className="input-dark" style={inp} value={form.remarks} onChange={e=>setF('remarks',e.target.value)} placeholder="Follow-up notes, any pending actions…" />
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <button className="btn-primary" style={{ flex:1, justifyContent:'center' }} onClick={saveForm}>{editId?'Update PO':'Add PO'}</button>
                <button onClick={()=>setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
