// @ts-nocheck
import React, { useState, useCallback, useEffect } from 'react';
import { Plus, Search, Download, Edit2, Trash2, Eye, X, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useEmployees } from '../context/EmployeeContext';

// ── Types ─────────────────────────────────────────────────────────────────────
interface RFQItem {
  slNo: number;
  category: string;
  description: string;
  make: string;
  quantity: number;
  unit: string;
  criticalRemarks: string;
}

interface RFQ {
  id: string;
  rfqNo: string;
  date: string;
  subject: string;
  from: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  purposeOfRFQ: string;
  scopeOfWork: string;
  vendors: string;
  estimatedBudget: number;
  requiredBy: string;
  submissionDeadline: string;
  items: RFQItem[];
  status: 'draft' | 'sent' | 'quotation-received' | 'converted-to-po' | 'closed';
  quotationRef: string;
  poRef: string;
  remarks: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const UNITS = ['No', 'Nos', 'Set', 'Meter', 'Roll', 'Kg', 'Ltr', 'Box', 'Pair', 'Lot'];

const DEFAULT_FROM        = 'Glass Technology FZ-LLC';
const DEFAULT_EMAIL       = 'rabin.sivaraj@glasstechnology.ae';
const DEFAULT_PHONE       = '(+37154582 9302)';
const DEFAULT_DEADLINE    = 'All quotations must be submitted by one week from receipt of mail.';
const DEFAULT_REQUIREMENTS = [
  'Complete technical specifications',
  'Price details (itemized).',
  'Delivery timelines.',
  'Warranty terms and conditions.',
  'Validity of the quotation.',
];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  'draft':              { label: 'Draft',             color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  'sent':               { label: 'Sent to Vendor',    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  'quotation-received': { label: 'Quotation Received',color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  'converted-to-po':    { label: 'Converted to PO',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  'closed':             { label: 'Closed',             color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
};

// ── API helper ────────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Request failed');
  }
  return res.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function nextRFQNo(existing: RFQ[]): string {
  const year = new Date().getFullYear();
  const nums = existing.map(r => parseInt(r.rfqNo.split('-')[2] ?? '0')).filter(n => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `RFQ-${year}-${String(next).padStart(3,'0')}`;
}

const BLANK_ITEM = (): RFQItem => ({ slNo:1, category:'', description:'', make:'', quantity:1, unit:'No', criticalRemarks:'' });

function blankRFQ(existing: RFQ[]): Omit<RFQ,'id'> {
  return {
    rfqNo: nextRFQNo(existing), date: new Date().toISOString().slice(0,10),
    subject:'', from: DEFAULT_FROM, contactPerson:'', contactEmail: DEFAULT_EMAIL, contactPhone: DEFAULT_PHONE,
    purposeOfRFQ:'', scopeOfWork:'', vendors:'',
    estimatedBudget: 0,
    requiredBy:'', submissionDeadline: DEFAULT_DEADLINE,
    items:[BLANK_ITEM()],
    status:'draft', quotationRef:'', poRef:'', remarks:'',
  };
}

function fmtDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'numeric', year:'numeric' });
}

// ── Export single RFQ → colored HTML/XLS ─────────────────────────────────────
function exportRFQ(rfq: RFQ) {
  const rfqNum = rfq.rfqNo.split('-').pop() || '001';
  const B = (s: string) => `style="border:1px solid #000;padding:5px 8px;font-family:Arial;font-size:10pt;${s}"`;
  const itemRows = (rfq.items || []).map(it => `
    <tr>
      <td ${B('text-align:center;')}>${it.slNo}</td>
      <td ${B('')}>${it.category}</td>
      <td ${B('')}>${it.description}</td>
      <td ${B('')}>${it.make}</td>
      <td ${B('text-align:center;')}>${it.quantity}</td>
      <td ${B('text-align:center;')}>${it.unit}</td>
      <td ${B('')}>${it.criticalRemarks}</td>
    </tr>`).join('');

  const reqRows = DEFAULT_REQUIREMENTS.map((r, i) =>
    `<tr><td colspan="7" ${B('border-color:#ccc;')}>${i+1}) ${r}</td></tr>`
  ).join('');

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"/></head><body>
<table style="border-collapse:collapse;width:750px;">
  <tr>
    <td colspan="7" style="background:#FFD700;text-align:center;font-weight:bold;font-size:14pt;padding:10px 8px;border:2px solid #000;font-family:Arial;">
      Request for Quotation (RFQ)&nbsp;&nbsp;- ${rfqNum}
    </td>
  </tr>
  <tr><td colspan="2" ${B('font-weight:bold;')} >Subject:</td><td colspan="5" ${B('')}>${rfq.subject}</td></tr>
  <tr><td colspan="2" ${B('font-weight:bold;')} >Date:</td><td colspan="5" ${B('')}>${fmtDate(rfq.date)}</td></tr>
  <tr><td colspan="2" ${B('font-weight:bold;')} >From:</td><td colspan="5" ${B('')}>${rfq.from}</td></tr>
  <tr><td colspan="2" ${B('font-weight:bold;')} >Contact Person:</td><td colspan="5" ${B('')}>${rfq.contactPerson}</td></tr>
  <tr><td colspan="2" ${B('font-weight:bold;')} >Email:</td><td colspan="5" ${B('color:#0000CC;text-decoration:underline;')}>${rfq.contactEmail}</td></tr>
  <tr><td colspan="2" ${B('font-weight:bold;')} >Phone:</td><td colspan="5" ${B('')}>${rfq.contactPhone}</td></tr>

  <tr><td colspan="7" style="color:#0000CC;font-weight:bold;font-size:11pt;border:1px solid #000;padding:5px 8px;font-family:Arial;text-decoration:underline;">General Information:</td></tr>
  <tr><td colspan="2" ${B('')}>1 Purpose of the RFQ</td><td colspan="5" ${B('')}>${rfq.purposeOfRFQ}</td></tr>
  <tr><td colspan="2" ${B('')}>2 Scope of Work</td><td colspan="5" ${B('')}>${rfq.scopeOfWork}</td></tr>

  <tr><td colspan="7" style="color:#CC0000;font-weight:bold;font-size:11pt;border:1px solid #000;padding:5px 8px;font-family:Arial;">Technical Specifications :</td></tr>
  <tr style="background:#C0C0C0;font-weight:bold;">
    <td ${B('text-align:center;')}>Sl. No</td>
    <td ${B('')}>Category</td>
    <td ${B('')}>Item Description</td>
    <td ${B('')}>Make</td>
    <td ${B('text-align:center;')}>Quantity</td>
    <td ${B('text-align:center;')}>Units</td>
    <td ${B('')}>Critical Remarks / Details</td>
  </tr>
  ${itemRows}

  <tr><td colspan="7" ${B('font-weight:bold;')}>Please provide the following information along with your quotation:</td></tr>
  ${reqRows}

  <tr><td colspan="7" ${B('font-weight:bold;')}>Submission Deadline</td></tr>
  <tr><td colspan="7" ${B('border-color:#ccc;')}>${rfq.submissionDeadline}</td></tr>
  <tr><td colspan="7" ${B('border-color:#ccc;font-style:italic;')}>Note: The purchaser reserves the right to accept or reject any or all quotations without assigning any reason.</td></tr>

  <tr><td colspan="7" ${B('font-weight:bold;')}>Acknowledgment:</td></tr>
  <tr><td colspan="7" ${B('border-color:#ccc;')}>Please confirm receipt of this RFQ and your intent to submit a quotation by end of the working date.</td></tr>
</table>
</body></html>`;

  const blob = new Blob([html], { type:'application/vnd.ms-excel;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${rfq.rfqNo}.xls`; a.click();
  URL.revokeObjectURL(url);
}

// ── Export list → Excel summary ───────────────────────────────────────────────
function exportList(rfqs: RFQ[]) {
  const wb = XLSX.utils.book_new();
  const rows = rfqs.map(r => ({
    'RFQ No': r.rfqNo, 'Date': r.date, 'Subject': r.subject,
    'Est. Budget (AED)': r.estimatedBudget || 0, 'Vendor(s)': r.vendors,
    'Contact Person': r.contactPerson,
    'Purpose': r.purposeOfRFQ, 'Scope': r.scopeOfWork,
    'Required By': r.requiredBy, 'Items': (r.items||[]).length,
    'Status': STATUS_CFG[r.status]?.label,
    'Quotation Ref': r.quotationRef, 'PO Ref': r.poRef, 'Remarks': r.remarks,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch:14 },{ wch:12 },{ wch:30 },{ wch:26 },{ wch:18 },{ wch:18 },{ wch:28 },{ wch:12 },{ wch:6 },{ wch:20 },{ wch:16 },{ wch:12 },{ wch:24 }];
  XLSX.utils.book_append_sheet(wb, ws, 'RFQ List');
  XLSX.writeFile(wb, `RFQ_List_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ── Print ─────────────────────────────────────────────────────────────────────
function printRFQ(rfq: RFQ) {
  const rfqNum = rfq.rfqNo.split('-').pop() || '001';
  const itemRows = (rfq.items || []).map(it => `
    <tr>
      <td style="text-align:center;">${it.slNo}</td>
      <td>${it.category}</td>
      <td>${it.description}</td>
      <td>${it.make}</td>
      <td style="text-align:center;">${it.quantity}</td>
      <td style="text-align:center;">${it.unit}</td>
      <td>${it.criticalRemarks}</td>
    </tr>`).join('');

  const html = `<html><head><title>${rfq.rfqNo}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; color:#000; margin:20px; }
    table { width:100%; border-collapse:collapse; margin-bottom:4px; }
    td, th { border:1px solid #000; padding:5px 8px; vertical-align:top; }
    .hdr { background:#FFD700; text-align:center; font-weight:bold; font-size:15pt; padding:10px; }
    .lbl { font-weight:bold; width:160px; }
    .sec-blue { color:#0000CC; font-weight:bold; font-size:12pt; text-decoration:underline; }
    .sec-red  { color:#CC0000; font-weight:bold; font-size:12pt; }
    .col-hdr  { background:#C0C0C0; font-weight:bold; text-align:center; }
    .note { font-style:italic; }
    @media print { @page { margin:15mm; } }
  </style></head><body>
  <table>
    <tr><td colspan="7" class="hdr">Request for Quotation (RFQ)&nbsp;&nbsp;- ${rfqNum}</td></tr>
    <tr><td colspan="2" class="lbl">Subject:</td><td colspan="5">${rfq.subject}</td></tr>
    <tr><td colspan="2" class="lbl">Date:</td><td colspan="5">${fmtDate(rfq.date)}</td></tr>
    <tr><td colspan="2" class="lbl">From:</td><td colspan="5">${rfq.from}</td></tr>
    <tr><td colspan="2" class="lbl">Contact Person:</td><td colspan="5">${rfq.contactPerson}</td></tr>
    <tr><td colspan="2" class="lbl">Email:</td><td colspan="5" style="color:#0000CC;text-decoration:underline;">${rfq.contactEmail}</td></tr>
    <tr><td colspan="2" class="lbl">Phone:</td><td colspan="5">${rfq.contactPhone}</td></tr>
  </table>
  <table>
    <tr><td colspan="7" class="sec-blue">General Information:</td></tr>
    <tr><td colspan="2">1 Purpose of the RFQ</td><td colspan="5">${rfq.purposeOfRFQ}</td></tr>
    <tr><td colspan="2">2 Scope of Work</td><td colspan="5">${rfq.scopeOfWork}</td></tr>
  </table>
  <table>
    <tr><td colspan="7" class="sec-red">Technical Specifications :</td></tr>
    <tr>
      <th class="col-hdr" style="width:40px;">Sl. No</th>
      <th class="col-hdr" style="width:120px;">Category</th>
      <th class="col-hdr">Item Description</th>
      <th class="col-hdr" style="width:110px;">Make</th>
      <th class="col-hdr" style="width:60px;">Quantity</th>
      <th class="col-hdr" style="width:50px;">Units</th>
      <th class="col-hdr">Critical Remarks / Details</th>
    </tr>
    ${itemRows}
  </table>
  <table>
    <tr><td colspan="7" style="font-weight:bold;">Please provide the following information along with your quotation:</td></tr>
    ${DEFAULT_REQUIREMENTS.map((r, i) => `<tr><td colspan="7" style="border-color:#ccc;">${i+1}) ${r}</td></tr>`).join('')}
  </table>
  <table>
    <tr><td colspan="7" style="font-weight:bold;">Submission Deadline</td></tr>
    <tr><td colspan="7" style="border-color:#ccc;">${rfq.submissionDeadline}</td></tr>
    <tr><td colspan="7" style="border-color:#ccc;" class="note">Note: The purchaser reserves the right to accept or reject any or all quotations without assigning any reason.</td></tr>
  </table>
  <table>
    <tr><td colspan="7" style="font-weight:bold;">Acknowledgment:</td></tr>
    <tr><td colspan="7" style="border-color:#ccc;">Please confirm receipt of this RFQ and your intent to submit a quotation by end of the working date.</td></tr>
  </table>
  <script>window.onload=()=>window.print();</script>
  </body></html>`;

  const w = window.open('','_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PurchaseRFQ() {
  const { employees } = useEmployees();
  const activeEmployees = employees
    .filter(e => e.status !== 'resigned')
    .sort((a, b) => a.name.localeCompare(b.name));

  const [rfqs, setRFQs]         = useState<RFQ[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [listTab, setListTab]   = useState<'pending'|'completed'>('pending');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<string|null>(null);
  const [form, setForm]         = useState<Omit<RFQ,'id'>>(blankRFQ([]));
  const [viewRFQ, setViewRFQ]   = useState<RFQ|null>(null);

  const PENDING_STATUSES   = new Set(['draft','sent','quotation-received']);
  const COMPLETED_STATUSES = new Set(['converted-to-po','closed']);

  // ── Load on mount ──
  useEffect(() => {
    (async () => {
      try {
        await fetch('/api/health');
        const data = await apiFetch('/api/purchase-rfq');
        setRFQs(data);
      } catch (e) {
        console.error('Failed to load RFQs', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tabSet = listTab === 'pending' ? PENDING_STATUSES : COMPLETED_STATUSES;
  const filtered = rfqs.filter(r => {
    const t = search.toLowerCase();
    const ms = !t || r.rfqNo.toLowerCase().includes(t) || r.subject.toLowerCase().includes(t) || r.vendors.toLowerCase().includes(t);
    return ms && tabSet.has(r.status) && (statusFilter === 'all' || r.status === statusFilter);
  });

  const stats = {
    total:  rfqs.length,
    draft:  rfqs.filter(r => r.status === 'draft').length,
    sent:   rfqs.filter(r => r.status === 'sent').length,
    quoted: rfqs.filter(r => r.status === 'quotation-received').length,
    po:     rfqs.filter(r => r.status === 'converted-to-po').length,
    overdue:rfqs.filter(r => r.requiredBy && new Date(r.requiredBy) < new Date() && r.status !== 'converted-to-po' && r.status !== 'closed').length,
  };

  const openAdd  = () => { setForm(blankRFQ(rfqs)); setEditId(null); setShowForm(true); };
  const openEdit = (r: RFQ) => {
    const { id, ...rest } = r;
    const items = Array.isArray(rest.items) && rest.items.length > 0 ? rest.items : [BLANK_ITEM()];
    setForm({ ...rest, items });
    setEditId(id);
    setShowForm(true);
  };
  const setF     = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const addItem  = () => setForm(f => { const cur = f.items || []; return { ...f, items:[...cur, { ...BLANK_ITEM(), slNo:cur.length+1 }] }; });
  const removeItem = (idx) => setForm(f => ({ ...f, items:(f.items||[]).filter((_,i)=>i!==idx).map((it,i)=>({...it,slNo:i+1})) }));
  const setItem  = (idx, k, v) =>
    setForm(f => ({ ...f, items: (f.items||[]).map((it,i) => i===idx ? { ...it, [k]: v } : it) }));

  const saveForm = async () => {
    if (!form.rfqNo || !form.subject) { alert('RFQ No. and Subject are required.'); return; }
    try {
      if (editId) {
        const updated = await apiFetch(`/api/purchase-rfq/${editId}`, { method: 'PUT', body: JSON.stringify(form) });
        setRFQs(p => p.map(r => r.id === editId ? updated : r));
      } else {
        const created = await apiFetch('/api/purchase-rfq', { method: 'POST', body: JSON.stringify(form) });
        setRFQs(p => [created, ...p]);
      }
      setShowForm(false);
    } catch (e: any) {
      alert(e.message || 'Failed to save RFQ');
    }
  };

  const deleteRFQ = async (id) => {
    if (!confirm('Delete this RFQ?')) return;
    try {
      await apiFetch(`/api/purchase-rfq/${id}`, { method: 'DELETE' });
      setRFQs(p => p.filter(r => r.id !== id));
    } catch (e: any) {
      alert(e.message || 'Failed to delete');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const updated = await apiFetch(`/api/purchase-rfq/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      setRFQs(p => p.map(r => r.id === id ? updated : r));
    } catch (e: any) {
      alert(e.message || 'Failed to update status');
    }
  };

  // ── Shared input styles ──
  const lbl: React.CSSProperties = { fontSize:12, color:'#94a3b8', display:'block', marginBottom:5 };
  const inp: React.CSSProperties = { width:'100%' };

  // ── Section header helper ──
  const secHdr = (label, color) => (
    <div style={{ padding:'7px 12px', marginBottom:10, borderLeft:`4px solid ${color}`, background:`${color}12`, borderRadius:'0 6px 6px 0', fontSize:13, fontWeight:700, color }}>
      {label}
    </div>
  );

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, flexDirection:'column', gap:16 }}>
        <div style={{ width:40, height:40, border:'3px solid rgba(59,130,246,0.3)', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <div style={{ color:'#64748b', fontSize:14 }}>Loading RFQs…</div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10 }}>
        {[
          { label:'Total RFQs',         value:stats.total,   color:'#3b82f6' },
          { label:'Draft',              value:stats.draft,   color:'#94a3b8' },
          { label:'Sent to Vendor',     value:stats.sent,    color:'#3b82f6' },
          { label:'Quotation Received', value:stats.quoted,  color:'#f59e0b' },
          { label:'Converted to PO',    value:stats.po,      color:'#22c55e' },
          { label:'Overdue',            value:stats.overdue, color:'#ef4444' },
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
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search RFQ No., subject, vendor…" className="input-dark" style={{ paddingLeft:30 }} />
        </div>
        <button className="btn-secondary" style={{ fontSize:12, display:'flex', alignItems:'center', gap:5 }} onClick={() => exportList(rfqs)}><Download size={13}/> Export List</button>
        <button onClick={openAdd} className="btn-primary" style={{ fontSize:12, display:'flex', alignItems:'center', gap:5 }}><Plus size={13}/> Create RFQ</button>
      </div>

      {/* Pending / Completed tabs */}
      <div style={{ display:'flex', gap:0, borderBottom:'2px solid rgba(255,255,255,0.07)' }}>
        {([
          { key:'pending',   label:'Pending RFQ',   count: rfqs.filter(r => PENDING_STATUSES.has(r.status)).length,   color:'#f59e0b' },
          { key:'completed', label:'Completed RFQ',  count: rfqs.filter(r => COMPLETED_STATUSES.has(r.status)).length, color:'#22c55e' },
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
        {listTab === 'pending' && (
          <select value={statusFilter} onChange={e=>setStatus(e.target.value)} className="input-dark"
            style={{ marginLeft:'auto', width:190, alignSelf:'center', fontSize:11 }}>
            <option value="all">All Pending Status</option>
            {(['draft','sent','quotation-received'] as const).map(k => <option key={k} value={k}>{STATUS_CFG[k].label}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow:'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>RFQ No.</th><th>Date</th><th>Subject</th><th>Est. Budget</th>
              <th>Items</th><th>Required By</th><th>Status</th>
              <th style={{ position:'sticky', right:0, background:'#0b0b18', zIndex:3 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length===0 && (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:32, color:'#475569' }}>
                {listTab === 'completed' ? 'No completed RFQs yet — convert an RFQ to PO to see it here.' : 'No pending RFQs found.'}
              </td></tr>
            )}
            {filtered.map(r => {
              const overdue = r.requiredBy && new Date(r.requiredBy) < new Date() && r.status!=='converted-to-po' && r.status!=='closed';
              const sc = STATUS_CFG[r.status];
              return (
                <tr key={r.id}>
                  <td style={{ color:'#60a5fa', fontFamily:'monospace', fontWeight:700, fontSize:12 }}>{r.rfqNo}</td>
                  <td style={{ fontSize:12, color:'#64748b' }}>{r.date}</td>
                  <td style={{ fontWeight:600, color:'#e2e8f0', maxWidth:200 }}>{r.subject}</td>
                  <td style={{ fontSize:12, color:'#22c55e', fontWeight:600, whiteSpace:'nowrap' }}>
                    {r.estimatedBudget ? `AED ${r.estimatedBudget.toLocaleString()}` : '—'}
                  </td>
                  <td style={{ textAlign:'center', color:'#3b82f6', fontWeight:600 }}>{(r.items||[]).length}</td>
                  <td style={{ fontSize:11, color: overdue ? '#ef4444' : '#64748b', fontWeight: overdue ? 700 : 400 }}>
                    {r.requiredBy||'—'}
                    {overdue && <span style={{ display:'block', fontSize:9, color:'#ef4444' }}>OVERDUE</span>}
                  </td>
                  <td style={{ minWidth:170 }}>
                    <select
                      value={r.status}
                      onChange={e => updateStatus(r.id, e.target.value)}
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
                      <button onClick={()=>setViewRFQ(r)} className="btn-secondary" style={{ padding:'4px 7px', fontSize:10 }} title="View"><Eye size={10}/></button>
                      <button onClick={()=>printRFQ(r)} className="btn-secondary" style={{ padding:'4px 7px', fontSize:10 }} title="Print"><Printer size={10}/></button>
                      <button onClick={()=>exportRFQ(r)} className="btn-secondary" style={{ padding:'4px 7px', fontSize:10 }} title="Download Excel"><Download size={10}/></button>
                      <button onClick={()=>openEdit(r)} className="btn-secondary" style={{ padding:'4px 7px', fontSize:10 }} title="Edit"><Edit2 size={10}/></button>
                      <button onClick={()=>deleteRFQ(r.id)} style={{ padding:'4px 7px', fontSize:10, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:6, color:'#ef4444', cursor:'pointer' }} title="Delete"><Trash2 size={10}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── View Modal (document-preview style) ── */}
      {viewRFQ && (
        <div className="modal-overlay" onClick={()=>setViewRFQ(null)}>
          <div className="modal-content" style={{ maxWidth:900 }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:15, fontWeight:700, color:'#f1f5f9' }}>{viewRFQ.rfqNo} — {viewRFQ.subject}</div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>printRFQ(viewRFQ)} className="btn-secondary" style={{ fontSize:12, display:'flex', alignItems:'center', gap:5 }}><Printer size={13}/> Print</button>
                <button onClick={()=>exportRFQ(viewRFQ)} className="btn-secondary" style={{ fontSize:12, display:'flex', alignItems:'center', gap:5 }}><Download size={13}/> Excel</button>
                <button onClick={()=>setViewRFQ(null)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={18}/></button>
              </div>
            </div>
            <div style={{ maxHeight:'78vh', overflowY:'auto' }}>
              <div style={{ background:'linear-gradient(135deg,#b8860b,#d4a017)', padding:'12px 20px', textAlign:'center' }}>
                <div style={{ fontSize:18, fontWeight:800, color:'#1a1a0a', letterSpacing:0.5 }}>
                  Request for Quotation (RFQ) &nbsp;—&nbsp; {viewRFQ.rfqNo.split('-').pop()}
                </div>
              </div>

              <div style={{ padding:'0 20px 20px' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', marginTop:12, fontSize:13 }}>
                  <tbody>
                    {[
                      ['Subject', viewRFQ.subject],
                      ['Date', fmtDate(viewRFQ.date)],
                      ['From', viewRFQ.from],
                      ['Contact Person', viewRFQ.contactPerson],
                      ['Email', viewRFQ.contactEmail],
                      ['Phone', viewRFQ.contactPhone],
                    ].map(([l,v]) => (
                      <tr key={l} style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding:'6px 12px', fontWeight:700, color:'#94a3b8', width:160, whiteSpace:'nowrap' }}>{l}:</td>
                        <td style={{ padding:'6px 12px', color: l==='Email' ? '#60a5fa' : '#e2e8f0' }}>{v||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ marginTop:16, padding:'6px 12px', color:'#60a5fa', fontWeight:700, fontSize:14, textDecoration:'underline' }}>General Information:</div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <tbody>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding:'6px 12px', color:'#94a3b8', width:160 }}>1 Purpose of the RFQ</td>
                      <td style={{ padding:'6px 12px', color:'#e2e8f0' }}>{viewRFQ.purposeOfRFQ||'—'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding:'6px 12px', color:'#94a3b8', width:160 }}>2 Scope of Work</td>
                      <td style={{ padding:'6px 12px', color:'#e2e8f0' }}>{viewRFQ.scopeOfWork||'—'}</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ marginTop:16, padding:'6px 12px', color:'#f87171', fontWeight:700, fontSize:14 }}>Technical Specifications :</div>
                <div style={{ overflow:'auto', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'rgba(255,255,255,0.06)' }}>
                        {['Sl. No','Category','Item Description','Make','Qty','Units','Critical Remarks / Details'].map(h => (
                          <th key={h} style={{ padding:'8px 10px', textAlign:'left', color:'#93c5fd', fontSize:11, fontWeight:700, borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(viewRFQ.items || []).map(it => (
                        <tr key={it.slNo} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding:'7px 10px', color:'#64748b', textAlign:'center' }}>{it.slNo}</td>
                          <td style={{ padding:'7px 10px', color:'#f59e0b', fontWeight:600 }}>{it.category}</td>
                          <td style={{ padding:'7px 10px', color:'#e2e8f0', fontWeight:500 }}>{it.description}</td>
                          <td style={{ padding:'7px 10px', color:'#94a3b8' }}>{it.make||'—'}</td>
                          <td style={{ padding:'7px 10px', color:'#f1f5f9', fontWeight:600, textAlign:'center' }}>{it.quantity}</td>
                          <td style={{ padding:'7px 10px', color:'#64748b', textAlign:'center' }}>{it.unit}</td>
                          <td style={{ padding:'7px 10px', color:'#94a3b8', fontSize:11 }}>{it.criticalRemarks||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop:14, padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:8, fontSize:12, color:'#94a3b8' }}>
                  <div style={{ fontWeight:700, color:'#e2e8f0', marginBottom:6 }}>Please provide the following information along with your quotation:</div>
                  {DEFAULT_REQUIREMENTS.map((r,i) => <div key={i} style={{ marginTop:3 }}>{i+1}) {r}</div>)}
                </div>

                <div style={{ marginTop:10, padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:8, fontSize:12, color:'#94a3b8' }}>
                  <div style={{ fontWeight:700, color:'#e2e8f0', marginBottom:4 }}>Submission Deadline</div>
                  <div>{viewRFQ.submissionDeadline}</div>
                  <div style={{ marginTop:4, fontStyle:'italic', fontSize:11, color:'#475569' }}>Note: The purchaser reserves the right to accept or reject any or all quotations without assigning any reason.</div>
                </div>

                <div style={{ marginTop:10, padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:8, fontSize:12, color:'#94a3b8' }}>
                  <div style={{ fontWeight:700, color:'#e2e8f0', marginBottom:4 }}>Acknowledgment:</div>
                  <div>Please confirm receipt of this RFQ and your intent to submit a quotation by end of the working date.</div>
                </div>

                <div style={{ marginTop:14, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'#64748b' }}>Update Status:</span>
                  {Object.entries(STATUS_CFG).map(([k,v]) => (
                    <button key={k} onClick={()=>{ updateStatus(viewRFQ.id, k); setViewRFQ(p => p ? {...p, status:k} : p); }}
                      style={{ padding:'5px 12px', borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer',
                        background: viewRFQ.status===k ? v.color : 'rgba(255,255,255,0.05)',
                        border:`1px solid ${viewRFQ.status===k ? v.color : 'rgba(255,255,255,0.08)'}`,
                        color: viewRFQ.status===k ? '#fff' : v.color, transition:'all 0.2s',
                      }}>{v.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showForm && (
        <div className="modal-overlay" onClick={()=>setShowForm(false)}>
          <div className="modal-content" style={{ maxWidth:1000 }} onClick={e=>e.stopPropagation()}>
            <div style={{ background:'linear-gradient(135deg,#b8860b,#d4a017)', padding:'12px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#1a1a0a' }}>
                {editId ? 'Edit RFQ' : 'Create New RFQ'} — Request for Quotation
              </div>
              <button onClick={()=>setShowForm(false)} style={{ background:'rgba(0,0,0,0.15)', border:'none', color:'#1a1a0a', cursor:'pointer', borderRadius:6, padding:'4px 8px', fontSize:16, fontWeight:700 }}>✕</button>
            </div>

            <div style={{ padding:20, maxHeight:'82vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:16 }}>

              {secHdr('RFQ Details', '#60a5fa')}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
                <div>
                  <label style={lbl}>RFQ No. *</label>
                  <input className="input-dark" style={inp} value={form.rfqNo} onChange={e=>setF('rfqNo',e.target.value)} placeholder="RFQ-2026-001" />
                </div>
                <div>
                  <label style={lbl}>Date *</label>
                  <input type="date" className="input-dark" style={inp} value={form.date} onChange={e=>setF('date',e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Required By (Material Estimation)</label>
                  <input type="date" className="input-dark" style={inp} value={form.requiredBy} onChange={e=>setF('requiredBy',e.target.value)} />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={lbl}>Subject *</label>
                  <input className="input-dark" style={inp} value={form.subject} onChange={e=>setF('subject',e.target.value)} placeholder="e.g. Furnace Heat Up" />
                </div>
                <div>
                  <label style={lbl}>Estimated Budget (AED)</label>
                  <input type="number" className="input-dark" style={inp} value={form.estimatedBudget || ''} onChange={e=>setF('estimatedBudget', Number(e.target.value))} placeholder="e.g. 5000" min={0} />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={lbl}>Vendor(s) to Send RFQ</label>
                  <input className="input-dark" style={inp} value={form.vendors} onChange={e=>setF('vendors',e.target.value)} placeholder="e.g. Siemens UAE, ABB Gulf, Endress+Hauser UAE" />
                </div>
              </div>

              {secHdr('From — Company Details', '#a78bfa')}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={lbl}>From (Company Name)</label>
                  <input className="input-dark" style={inp} value={form.from} onChange={e=>setF('from',e.target.value)} placeholder="Glass Technology FZ-LLC" />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={lbl}>Select Contact Person from Employee List (auto-fills email & phone)</label>
                  <select
                    className="input-dark" style={inp}
                    value=""
                    onChange={e => {
                      const emp = activeEmployees.find(em => em.id === e.target.value);
                      if (!emp) return;
                      setF('contactPerson', emp.name);
                      const BLANK = /^(nil|n\/a|none|--|—|-|na)$/i;
                      const email = [emp.companyEmail, emp.personalEmail].find(v => v && !BLANK.test(v.trim())) || '';
                      const phone = [emp.companyPhone, emp.uaePhone, emp.indiaPhone].find(v => v && !BLANK.test(v.trim())) || '';
                      setF('contactEmail', email);
                      setF('contactPhone', phone);
                    }}
                  >
                    <option value="">— Select employee —</option>
                    {activeEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}  ·  {emp.designation}  ({emp.empId})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Contact Person Name</label>
                  <input className="input-dark" style={inp} value={form.contactPerson} onChange={e=>setF('contactPerson',e.target.value)} placeholder="Mr. Rabin Sivaraj" />
                </div>
                <div>
                  <label style={lbl}>Email</label>
                  <input className="input-dark" style={inp} value={form.contactEmail} onChange={e=>setF('contactEmail',e.target.value)} placeholder="rabin.sivaraj@glasstechnology.ae" />
                </div>
                <div>
                  <label style={lbl}>Phone</label>
                  <input className="input-dark" style={inp} value={form.contactPhone} onChange={e=>setF('contactPhone',e.target.value)} placeholder="(+37154582 9302)" />
                </div>
              </div>

              {secHdr('General Information', '#22c55e')}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div>
                  <label style={lbl}>1 · Purpose of the RFQ</label>
                  <input className="input-dark" style={inp} value={form.purposeOfRFQ} onChange={e=>setF('purposeOfRFQ',e.target.value)} placeholder="e.g. Furnace" />
                </div>
                <div>
                  <label style={lbl}>2 · Scope of Work</label>
                  <input className="input-dark" style={inp} value={form.scopeOfWork} onChange={e=>setF('scopeOfWork',e.target.value)} placeholder="e.g. Heat Up preparation" />
                </div>
              </div>

              {secHdr('Technical Specifications', '#f87171')}
              <div>
              <div style={{ border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:740 }}>
                  <thead>
                    <tr style={{ background:'rgba(248,113,113,0.1)' }}>
                      {['Sl.','Category','Item Description','Make','Qty','Unit','Critical Remarks / Details',''].map(h => (
                        <th key={h} style={{ padding:'8px 8px', textAlign:'left', color:'#fca5a5', fontSize:11, fontWeight:700, borderBottom:'1px solid rgba(248,113,113,0.2)', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(form.items || []).map((it,idx) => (
                      <tr key={idx} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding:'5px 8px', color:'#64748b', width:28 }}>{it.slNo}</td>
                        <td style={{ padding:'4px 5px', minWidth:120 }}>
                          <input className="input-dark" style={{ fontSize:11, padding:'4px 6px', width:'100%' }} value={it.category} onChange={e=>setItem(idx,'category',e.target.value)} placeholder="Category" />
                        </td>
                        <td style={{ padding:'4px 5px', minWidth:180 }}>
                          <input className="input-dark" style={{ fontSize:11, padding:'4px 6px', width:'100%' }} value={it.description} onChange={e=>setItem(idx,'description',e.target.value)} placeholder="Item description / part no." />
                        </td>
                        <td style={{ padding:'4px 5px', minWidth:100 }}>
                          <input className="input-dark" style={{ fontSize:11, padding:'4px 6px', width:'100%' }} value={it.make} onChange={e=>setItem(idx,'make',e.target.value)} placeholder="Make / Brand" />
                        </td>
                        <td style={{ padding:'4px 5px', width:60 }}>
                          <input type="number" className="input-dark" style={{ fontSize:11, padding:'4px 6px', width:54 }} value={it.quantity} onChange={e=>setItem(idx,'quantity',Number(e.target.value))} min={1} />
                        </td>
                        <td style={{ padding:'4px 5px', width:70 }}>
                          <select className="input-dark" style={{ fontSize:11, padding:'4px 5px' }} value={it.unit} onChange={e=>setItem(idx,'unit',e.target.value)}>
                            {UNITS.map(u => <option key={u}>{u}</option>)}
                          </select>
                        </td>
                        <td style={{ padding:'4px 5px', minWidth:180 }}>
                          <input className="input-dark" style={{ fontSize:11, padding:'4px 6px', width:'100%' }} value={it.criticalRemarks} onChange={e=>setItem(idx,'criticalRemarks',e.target.value)} placeholder="Critical remarks / technical details" />
                        </td>
                        <td style={{ padding:'4px 8px', width:36 }}>
                          {(form.items || []).length > 1 && (
                            <button onClick={()=>removeItem(idx)} style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:6, color:'#ef4444', cursor:'pointer', padding:'3px 6px' }}>
                              <Trash2 size={11}/>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
              <button onClick={addItem} className="btn-secondary" style={{ fontSize:11, padding:'5px 14px', alignSelf:'flex-start', display:'flex', alignItems:'center', gap:5 }}>
                <Plus size={11}/> Add Item
              </button>

              {secHdr('Submission Deadline', '#f59e0b')}
              <div>
                <label style={lbl}>Deadline Text</label>
                <input className="input-dark" style={inp} value={form.submissionDeadline} onChange={e=>setF('submissionDeadline',e.target.value)} />
              </div>

              {secHdr('Internal Tracking', '#64748b')}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
                <div>
                  <label style={lbl}>Status</label>
                  <select className="input-dark" style={inp} value={form.status} onChange={e=>setF('status',e.target.value)}>
                    {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Quotation Reference (if received)</label>
                  <input className="input-dark" style={inp} value={form.quotationRef} onChange={e=>setF('quotationRef',e.target.value)} placeholder="Vendor quotation ref no." />
                </div>
                <div>
                  <label style={lbl}>PO Reference (if converted)</label>
                  <input className="input-dark" style={inp} value={form.poRef} onChange={e=>setF('poRef',e.target.value)} placeholder="PO-2026-001" />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={lbl}>Internal Remarks</label>
                  <input className="input-dark" style={inp} value={form.remarks} onChange={e=>setF('remarks',e.target.value)} placeholder="Follow-up notes, any pending actions" />
                </div>
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <button className="btn-primary" style={{ flex:1, justifyContent:'center' }} onClick={saveForm}>{editId ? 'Update RFQ' : 'Create RFQ'}</button>
                <button onClick={()=>setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
