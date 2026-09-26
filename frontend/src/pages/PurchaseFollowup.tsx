// @ts-nocheck
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, Search, Download, Edit2, Trash2, RefreshCw, X, Check, Maximize2 } from 'lucide-react';

interface PaymentTransaction {
  id: string;
  date: string;
  amount: number;
  remarks: string;
}

interface FollowupRecord {
  id: string;
  section: string;
  itemDescription: string;
  requestDate: string;
  requiredTimeline: string;
  currentStatus: string;
  paymentStatus: string;
  prNumber: string;
  reqDate: string;
  budget: number;
  leadTime: string;
  workingTime: string;
  source: 'manual' | 'rfq' | 'po';
  remarks: string;
  receivedDate: string;
  paymentHistory: PaymentTransaction[];
}

type TableRow =
  | { type: 'section'; label: string }
  | { type: 'data'; record: FollowupRecord; sl: number };

// ── API helper ────────────────────────────────────────────────────────────────
async function apiFetch(path, options: any = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) { const e = await res.json().catch(() => ({ message: res.statusText })); throw new Error(e.message || 'Request failed'); }
  return res.json();
}

const STATUS_WEB: Record<string, { bg: string; tc: string }> = {
  'RFQ created':           { bg: 'rgba(59,130,246,0.85)',  tc: '#fff' },
  'Technical Review':      { bg: 'rgba(234,88,12,0.85)',   tc: '#fff' },
  'Quotation Received':    { bg: 'rgba(139,92,246,0.85)',  tc: '#fff' },
  'PO done':               { bg: 'rgba(180,130,0,0.90)',   tc: '#fff' },
  'Partially Received':{ bg: 'rgba(220,38,38,0.85)',   tc: '#fff' },
  'Rejected':              { bg: 'rgba(71,85,105,0.85)',   tc: '#fff' },
  'Material Received':     { bg: 'rgba(22,163,74,0.85)',   tc: '#fff' },
};

const STATUS_XLS: Record<string, string> = {
  'RFQ created':           '#4472C4',
  'Technical Review':      '#FFA500',
  'Quotation Received':    '#7030A0',
  'PO done':               '#B8860B',
  'Partially Received':'#FF0000',
  'Rejected':              '#808080',
  'Material Received':     '#00B050',
};

const TL_COLOR: Record<string, string> = {
  'Second Priority': '#22c55e',
  'Primary Priority': '#f97316',
};

const STATUSES  = ['', ...Object.keys(STATUS_WEB)];
const TIMELINES = ['', 'Need', 'Needed', 'Second Priority', 'Primary Priority'];

const PAYMENT_STATUSES = ['', 'Payment Under-Progress', 'Payment Initiated', 'Partial Payment Done', 'Payment Done'];
const PAYMENT_CFG: Record<string, { bg: string; tc: string }> = {
  'Payment Under-Progress': { bg: 'rgba(245,158,11,0.85)',  tc: '#fff' },
  'Payment Initiated':      { bg: 'rgba(59,130,246,0.85)',  tc: '#fff' },
  'Partial Payment Done':   { bg: 'rgba(168,85,247,0.85)',  tc: '#fff' },
  'Payment Done':           { bg: 'rgba(22,163,74,0.85)',   tc: '#fff' },
};
const PAYMENT_XLS: Record<string, string> = {
  'Payment Under-Progress': '#FFC000',
  'Payment Initiated':      '#4472C4',
  'Partial Payment Done':   '#7030A0',
  'Payment Done':           '#00B050',
};

function daysSince(date: string): number {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function fmtDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function fmtMonYear(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function mapRFQStatus(s: string): string {
  return ({ draft:'RFQ created', sent:'Technical Review', 'quotation-received':'Quotation Received', 'converted-to-po':'PO done', closed:'Material Received' } as Record<string,string>)[s] || s;
}
function mapPOStatus(s: string): string {
  return ({ ordered:'PO done', acknowledged:'PO done', 'in-transit':'Partially Received', 'partially-received':'Partially Received', received:'Material Received', delayed:'Partially Received', cancelled:'Rejected' } as Record<string,string>)[s] || s;
}

// Higher rank = further along in the workflow. Sync never downgrades.
const STATUS_RANK: Record<string, number> = {
  'RFQ created': 1, 'Technical Review': 2, 'Quotation Received': 3,
  'PO done': 4, 'Partially Received': 4,
  'Material Received': 5, 'Payment Done': 6, 'Rejected': 0,
};
function mapPriority(p: string): string {
  return ({ urgent:'Primary Priority', high:'Second Priority', normal:'Need', low:'' } as Record<string,string>)[p] || '';
}

const SEED: FollowupRecord[] = [
  { id:'f1',  section:'', itemDescription:'RFQ-01(2026) Furnace Heat Up panel.',         requestDate:'2026-01-02', requiredTimeline:'Second Priority', currentStatus:'Material Received',     paymentStatus:'Payment Under-Progress', prNumber:'PR10000031',           reqDate:'2026-12-01', budget:5800, leadTime:'2 week execution',  workingTime:'',        source:'manual', remarks:'', receivedDate:'2026-03-10', paymentHistory:[] },
  { id:'f2',  section:'', itemDescription:'RFQ-02(2026) Lehr thermocouple.',              requestDate:'2026-01-02', requiredTimeline:'Need',             currentStatus:'Partially Received', paymentStatus:'',                      prNumber:'PR10000040',           reqDate:'2026-09-01', budget:6300, leadTime:'1 week execution',  workingTime:'',        source:'manual', remarks:'', receivedDate:'', paymentHistory:[] },
  { id:'f3',  section:'', itemDescription:'Rolling Machine (Rail & Rope).',               requestDate:'2026-01-15', requiredTimeline:'Need',             currentStatus:'RFQ created',           paymentStatus:'',                      prNumber:'Waiting for Quotation',reqDate:'',          budget:0,    leadTime:'RFQ under progress', workingTime:'October', source:'manual', remarks:'', receivedDate:'', paymentHistory:[] },
  { id:'f4',  section:'', itemDescription:'RFQ-07 (2026) Step Down Transformer.',         requestDate:'2026-02-10', requiredTimeline:'Primary Priority', currentStatus:'Partially Received', paymentStatus:'',                      prNumber:'Older One',            reqDate:'',          budget:5800, leadTime:'1 week',             workingTime:'',        source:'manual', remarks:'', receivedDate:'', paymentHistory:[] },
  { id:'f5',  section:'', itemDescription:'Double Edger - Siemens Drive.',                requestDate:'2026-02-12', requiredTimeline:'Needed',           currentStatus:'PO done',               paymentStatus:'',                      prNumber:'Service',              reqDate:'',          budget:3300, leadTime:'6 week delivery',   workingTime:'',        source:'manual', remarks:'', receivedDate:'', paymentHistory:[] },
  { id:'f6',  section:'', itemDescription:'RFQ for robot EMD Tool',                       requestDate:'',          requiredTimeline:'',                 currentStatus:'',                      paymentStatus:'',                      prNumber:'',                     reqDate:'',          budget:0,    leadTime:'',                  workingTime:'',        source:'manual', remarks:'', receivedDate:'', paymentHistory:[] },
  { id:'f7',  section:'', itemDescription:'Utility starter',                              requestDate:'',          requiredTimeline:'',                 currentStatus:'',                      paymentStatus:'',                      prNumber:'',                     reqDate:'',          budget:0,    leadTime:'',                  workingTime:'',        source:'manual', remarks:'', receivedDate:'', paymentHistory:[] },
  { id:'f8',  section:'Spare Material for Manufacturing Line', itemDescription:'RFQ Batch Plant Critical Spare Material.', requestDate:'2026-03-28', requiredTimeline:'Need', currentStatus:'RFQ created', paymentStatus:'', prNumber:'Waiting for Quotation', reqDate:'', budget:0, leadTime:'', workingTime:'', source:'manual', remarks:'', receivedDate:'', paymentHistory:[] },
  { id:'f9',  section:'Spare Material for Manufacturing Line', itemDescription:'RFQ lehr Critical Spare Material.',        requestDate:'2026-03-28', requiredTimeline:'Need', currentStatus:'RFQ created', paymentStatus:'', prNumber:'Waiting for Quotation', reqDate:'', budget:0, leadTime:'', workingTime:'', source:'manual', remarks:'', receivedDate:'', paymentHistory:[] },
  { id:'f10', section:'Spare Material for Manufacturing Line', itemDescription:'RFQ Cutting Line Critical Spare Material.',requestDate:'2026-03-28', requiredTimeline:'Need', currentStatus:'RFQ created', paymentStatus:'', prNumber:'Waiting for Quotation', reqDate:'', budget:0, leadTime:'', workingTime:'', source:'manual', remarks:'', receivedDate:'', paymentHistory:[] },
];

// loadRecords replaced by API call in useEffect

function downloadXLS(records: FollowupRecord[]) {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

  // Exclude items that are already received — report is for PENDING items only
  const pending = records
    .filter(r => r.currentStatus !== 'Material Received' && r.currentStatus !== 'Payment Done' && r.currentStatus !== 'Rejected')
    .sort((a, b) => daysSince(b.requestDate) - daysSince(a.requestDate));

  const sectionOrder: string[] = [];
  const sectionMap: Record<string, FollowupRecord[]> = {};
  pending.forEach(r => {
    const s = r.section || '__main__';
    if (!sectionOrder.includes(s)) sectionOrder.push(s);
    (sectionMap[s] = sectionMap[s] || []).push(r);
  });

  let rows = '';
  let slNo = 0;
  let totalBudget = 0;
  const td = (v: string, bg = '', tc = '#000000', bold = false, align = 'left') =>
    `<td style="padding:5px 7px;border:1px solid #bbb;background:${bg||'#ffffff'};color:${tc};font-weight:${bold?'bold':'normal'};text-align:${align};font-family:Arial;font-size:10pt;">${v}</td>`;

  sectionOrder.forEach(sKey => {
    const recs = sectionMap[sKey] || [];
    if (sKey !== '__main__') {
      rows += `<tr><td colspan="11" style="background:#C00000;color:#fff;font-weight:bold;font-size:11pt;text-align:center;padding:7px;border:1px solid #bbb;font-family:Arial;">${sKey}</td></tr>`;
    }
    recs.forEach(r => {
      slNo++;
      totalBudget += r.budget || 0;
      const days = r.requestDate ? daysSince(r.requestDate) : '';
      const sBg  = STATUS_XLS[r.currentStatus] || '#ffffff';
      const sTc  = r.currentStatus ? '#ffffff' : '#000000';
      const tlc  = ({ 'Second Priority': '#007700', 'Primary Priority': '#CC4400' } as Record<string,string>)[r.requiredTimeline] || '#000000';
      rows += `<tr>
        ${td(String(slNo), '', '#000000', false, 'center')}
        ${td(r.itemDescription)}
        ${td(r.requestDate ? fmtDate(r.requestDate) : '', '', '#000000', false, 'center')}
        ${td(days ? String(days) : '', '', '#FF0000', true, 'center')}
        ${td(r.requiredTimeline, '', tlc, !!TL_COLOR[r.requiredTimeline], 'center')}
        ${td(r.currentStatus, sBg, sTc, true, 'center')}
        ${td(r.prNumber)}
        ${td(r.reqDate ? fmtMonYear(r.reqDate) : '', '', '#000000', false, 'center')}
        ${td(r.budget ? String(r.budget) : '', '', '#000000', false, 'center')}
        ${td(r.leadTime, '', '#000000', false, 'center')}
        ${td(r.workingTime, '', '#000000', false, 'center')}
      </tr>`;
    });
  });

  // Budget total row
  rows += `<tr>
    <td colspan="8" style="padding:6px 7px;border:1px solid #bbb;background:#FFFF00;font-weight:bold;font-family:Arial;font-size:10pt;text-align:right;">Total Budget (AED)</td>
    <td style="padding:6px 7px;border:1px solid #bbb;background:#FFFF00;font-weight:bold;font-family:Arial;font-size:11pt;text-align:center;">${totalBudget.toLocaleString()}</td>
    <td colspan="2" style="border:1px solid #bbb;background:#FFFF00;"></td>
  </tr>`;

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"/></head><body><table>
<tr>
  <td colspan="7" style="background:#B8D4E8;font-weight:bold;font-size:14pt;text-align:center;padding:9px;border:1px solid #bbb;font-family:Arial;">PR Pending Status - E &amp; I</td>
  <td colspan="4" style="background:#C6EFCE;font-weight:bold;font-size:11pt;text-align:center;padding:9px;border:1px solid #bbb;font-family:Arial;">${today}</td>
</tr>
<tr style="background:#FFFF00;">
  ${['Sl. No.','Item Description','Request date','Days','Required Timeline','Current Status','PR Number','Req. date','Budget','Lead time','Working time'].map((h,i)=>`<td style="padding:5px 7px;border:1px solid #bbb;font-weight:bold;font-family:Arial;font-size:10pt;${[3,9,10].includes(i)?'text-align:center;':''}">${h}</td>`).join('')}
</tr>
${rows}
</table></body></html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `PR_Pending_Status_${new Date().toISOString().slice(0,10)}.xls`; a.click();
  URL.revokeObjectURL(url);
}

const BLANK = (): Omit<FollowupRecord,'id'> => ({
  section: '', itemDescription: '', requestDate: new Date().toISOString().slice(0,10),
  requiredTimeline: 'Need', currentStatus: '', paymentStatus: '',
  prNumber: '', reqDate: '', budget: 0, leadTime: '', workingTime: '', source: 'manual', remarks: '',
  receivedDate: '', paymentHistory: [],
});

export default function PurchaseFollowup() {
  const [records, setRecords]     = useState<FollowupRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [listTab, setListTab]     = useState<'pending' | 'payment' | 'completed'>('pending');
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string|null>(null);
  const [form, setForm]           = useState<Omit<FollowupRecord,'id'>>(BLANK());
  const [syncMsg, setSyncMsg]     = useState('');

  const sections = useMemo(() => [...new Set(records.map(r => r.section).filter(Boolean))], [records]);

  // ── Load on mount ──
  useEffect(() => {
    (async () => {
      try {
        await fetch('/api/health');
        const data = await apiFetch('/api/purchase-followup');
        setRecords(data);
      } catch (e) { console.error('Failed to load followup records', e); }
      finally { setLoading(false); }
    })();
  }, []);

  const updateStatusDirect = async (id, status) => {
    try {
      const updated = await apiFetch(`/api/purchase-followup/${id}`, { method: 'PUT', body: JSON.stringify({ currentStatus: status }) });
      setRecords(rs => rs.map(r => r.id === id ? updated : r));
    } catch (e: any) { alert(e.message || 'Failed to update status'); }
  };

  const updatePaymentDirect = async (id, ps) => {
    try {
      const updated = await apiFetch(`/api/purchase-followup/${id}`, { method: 'PUT', body: JSON.stringify({ paymentStatus: ps }) });
      setRecords(rs => rs.map(r => r.id === id ? updated : r));
    } catch (e: any) { alert(e.message || 'Failed to update payment status'); }
  };

  const updateFieldDirect = async (id, updates) => {
    try {
      const updated = await apiFetch(`/api/purchase-followup/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
      setRecords(rs => rs.map(r => r.id === id ? updated : r));
    } catch (e: any) { alert(e.message || 'Failed to update field'); }
  };

  const handleSync = async () => {
    let added = 0, updated = 0;
    try {
      const [rfqs, pos] = await Promise.all([
        apiFetch('/api/purchase-rfq'),
        apiFetch('/api/purchase-po'),
      ]);
      const incoming = [
        ...rfqs.map(r => ({ section:'', itemDescription:r.subject||r.rfqNo, requestDate:r.date, requiredTimeline:mapPriority(r.priority||''), currentStatus:mapRFQStatus(r.status), paymentStatus:'', prNumber:r.rfqNo, reqDate:r.requiredBy||'', budget:r.estimatedBudget||0, leadTime:'', workingTime:'', source:'rfq', remarks:r.remarks||'', receivedDate:'', paymentHistory:[] })),
        ...pos.map(p  => ({ section:'', itemDescription:p.items?.[0]?.description||p.poNo, requestDate:p.poDate, requiredTimeline:'', currentStatus:mapPOStatus(p.status), paymentStatus:'', prNumber:p.poNo, reqDate:p.estimatedDelivery||'', budget:p.totalValue||0, leadTime:'', workingTime:'', source:'po', remarks:p.remarks||'', receivedDate:'', paymentHistory:[] })),
      ];

      const snap = records;
      const normalize = (s: string) => (s || '').trim().toLowerCase();
      // Track keys seen so far (prNumber or description) to prevent intra-loop duplicates
      const knownPRs   = new Set(snap.map(r => r.prNumber).filter(Boolean));
      const knownDescs = new Set(snap.map(r => normalize(r.itemDescription)).filter(Boolean));

      for (const inc of incoming) {
        try {
          const incDesc = normalize(inc.itemDescription);
          // Match by prNumber first, then fall back to item description
          const existing = snap.find(r =>
            (inc.prNumber && r.prNumber === inc.prNumber) ||
            (incDesc && normalize(r.itemDescription) === incDesc)
          );
          if (existing) {
            // Never downgrade status — only advance it
            const existingRank = STATUS_RANK[existing.currentStatus] ?? 0;
            const incomingRank = STATUS_RANK[inc.currentStatus]      ?? 0;
            const patch: Record<string, any> = {
              itemDescription: inc.itemDescription,
              reqDate:         inc.reqDate || existing.reqDate,
              budget:          inc.budget  || existing.budget,
            };
            if (incomingRank > existingRank) patch.currentStatus = inc.currentStatus;
            const up = await apiFetch(`/api/purchase-followup/${existing.id}`, { method: 'PUT', body: JSON.stringify(patch) });
            setRecords(prev => prev.map(r => r.id === existing.id ? up : r));
            updated++;
          } else if (
            (!inc.prNumber || !knownPRs.has(inc.prNumber)) &&
            (!incDesc     || !knownDescs.has(incDesc))
          ) {
            // Not a duplicate — safe to create
            if (inc.prNumber) knownPRs.add(inc.prNumber);
            if (incDesc)      knownDescs.add(incDesc);
            const created = await apiFetch('/api/purchase-followup', { method: 'POST', body: JSON.stringify(inc) });
            setRecords(prev => [...prev, created]);
            added++;
          }
        } catch (e) { console.error('Sync error for', inc.prNumber || inc.itemDescription, e); }
      }
    } catch (e) { console.error('Sync failed', e); }
    setSyncMsg(`Sync complete: ${added} added, ${updated} updated.`);
    setTimeout(() => setSyncMsg(''), 5000);
  };

  // ── Payment helpers ────────────────────────────────────────────────────────
  const getTotalPaid  = (r: FollowupRecord) => (r.paymentHistory || []).reduce((s, p) => s + p.amount, 0);
  const getRemaining  = (r: FollowupRecord) => Math.max(0, (r.budget || 0) - getTotalPaid(r));

  // tab membership helpers
  const inPending   = (r: FollowupRecord) => r.currentStatus !== 'Material Received' && r.currentStatus !== 'Rejected';
  // shows until fully paid (remaining > 0) and not manually set to Done
  const inPayment   = (r: FollowupRecord) => r.currentStatus === 'Material Received' && r.paymentStatus !== 'Payment Done';
  // each payment transaction appears in Completed; rejected items appear too
  const inCompleted = (r: FollowupRecord) => (r.paymentHistory || []).length > 0 || r.paymentStatus === 'Payment Done' || r.currentStatus === 'Rejected';

  // ── Add-payment modal ──────────────────────────────────────────────────────
  const [payModal, setPayModal] = useState<{ record: FollowupRecord; amount: string; date: string; remarks: string } | null>(null);

  const openPayModal = (r: FollowupRecord) => {
    setOpenMenuId(null); setMenuRec(null);
    setPayModal({ record: r, amount: '', date: new Date().toISOString().slice(0, 10), remarks: '' });
  };

  const savePayment = async () => {
    if (!payModal) return;
    const amt = parseFloat(payModal.amount);
    if (!amt || amt <= 0) { alert('Enter a valid payment amount.'); return; }
    const rec = records.find(r => r.id === payModal.record.id);
    if (!rec) return;
    const hist = [...(rec.paymentHistory || []), { date: payModal.date, amount: amt, remarks: payModal.remarks }];
    const paid = hist.reduce((s, p) => s + p.amount, 0);
    const rem  = Math.max(0, (rec.budget || 0) - paid);
    const ps   = rem <= 0 ? 'Payment Done' : 'Partial Payment Done';
    try {
      const updated = await apiFetch(`/api/purchase-followup/${rec.id}`, { method: 'PUT', body: JSON.stringify({ paymentHistory: hist, paymentStatus: ps }) });
      setRecords(rs => rs.map(r => r.id === rec.id ? updated : r));
      setPayModal(null);
    } catch (e: any) { alert(e.message || 'Failed to save payment'); }
  };

  const filtered = useMemo(() => {
    const t = search.toLowerCase();
    const result = records.filter(r => {
      const m = !t || r.itemDescription.toLowerCase().includes(t) || r.prNumber.toLowerCase().includes(t) || r.currentStatus.toLowerCase().includes(t);
      const inTab = listTab === 'pending' ? inPending(r) : listTab === 'payment' ? inPayment(r) : inCompleted(r);
      const sf = statusFilter === 'all' || (listTab === 'pending' ? r.currentStatus === statusFilter : r.paymentStatus === statusFilter);
      return m && inTab && sf;
    });
    // Sort pending tab by days (highest → lowest) for easy tracking
    if (listTab === 'pending') {
      result.sort((a, b) => daysSince(b.requestDate) - daysSince(a.requestDate));
    }
    return result;
  }, [records, search, statusFilter, listTab]);

  const tableRows = useMemo<TableRow[]>(() => {
    const rows: TableRow[] = [];
    let cur: string | undefined = undefined;
    let sl = 0;
    filtered.forEach(r => {
      if (r.section !== cur) {
        if (r.section) rows.push({ type: 'section', label: r.section });
        cur = r.section; sl = 0;
      }
      rows.push({ type: 'data', record: r, sl: ++sl });
    });
    return rows;
  }, [filtered]);

  const stats = {
    total:     records.length,
    rfqOrReview: records.filter(r => r.currentStatus === 'RFQ created' || r.currentStatus === 'Technical Review').length,
    notDelivered: records.filter(r => r.currentStatus === 'Partially Received').length,
    quotation: records.filter(r => r.currentStatus === 'Quotation Received' || r.currentStatus === 'PO done').length,
    received:  records.filter(r => r.currentStatus === 'Material Received').length,
    blank:     records.filter(r => !r.currentStatus).length,
  };

  // ── Inline edit state ──────────────────────────────────────────────────────
  const [inlineId,  setInlineId]  = useState<string | null>(null);
  const [inlineRow, setInlineRow] = useState<FollowupRecord | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{top:number;left:number}>({top:0,left:0});
  const [menuRec, setMenuRec] = useState<FollowupRecord|null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => { setOpenMenuId(null); setMenuRec(null); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openMenuId]);

  const startInline  = (r: FollowupRecord) => { setInlineId(r.id); setInlineRow({ ...r }); };
  const cancelInline = () => { setInlineId(null); setInlineRow(null); };
  const saveInline   = async () => {
    if (!inlineRow) return;
    try {
      const updated = await apiFetch(`/api/purchase-followup/${inlineId}`, { method: 'PUT', body: JSON.stringify(inlineRow) });
      setRecords(rs => rs.map(r => r.id === inlineId ? updated : r));
      setInlineId(null); setInlineRow(null);
    } catch (e: any) { alert(e.message || 'Failed to save'); }
  };
  const openMenu = (e: React.MouseEvent<HTMLButtonElement>, r: FollowupRecord) => {
    e.stopPropagation();
    if (openMenuId === r.id) { setOpenMenuId(null); setMenuRec(null); return; }
    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
    const menuH = 148; // approximate menu height
    const left  = Math.min(rect.right - 140, window.innerWidth - 148);
    const top   = rect.bottom + 4 + menuH > window.innerHeight
      ? rect.top - menuH - 4   // flip above when too close to bottom
      : rect.bottom + 4;
    setMenuPos({ top, left });
    setMenuRec(r);
    setOpenMenuId(r.id);
  };
  const setIR = (k: keyof FollowupRecord, v: any) =>
    setInlineRow(r => r ? { ...r, [k]: v } : r);

  const setF  = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const openAdd  = () => { setForm(BLANK()); setEditId(null); setShowForm(true); };
  const openEdit = (r: FollowupRecord) => { const { id, ...rest } = r; setForm(rest); setEditId(id); setShowForm(true); };
  const saveForm = async () => {
    if (!form.itemDescription.trim()) { alert('Item description is required.'); return; }
    try {
      if (editId) {
        const updated = await apiFetch(`/api/purchase-followup/${editId}`, { method: 'PUT', body: JSON.stringify(form) });
        setRecords(rs => rs.map(r => r.id === editId ? updated : r));
      } else {
        const created = await apiFetch('/api/purchase-followup', { method: 'POST', body: JSON.stringify(form) });
        setRecords(rs => [...rs, created]);
      }
      setShowForm(false);
    } catch (e: any) { alert(e.message || 'Failed to save'); }
  };
  const del = async (id) => {
    if (!confirm('Delete this record?')) return;
    try {
      await apiFetch(`/api/purchase-followup/${id}`, { method: 'DELETE' });
      setRecords(rs => rs.filter(r => r.id !== id));
    } catch (e: any) { alert(e.message || 'Failed to delete'); }
  };

  const lbl: React.CSSProperties = { fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 };
  const inp: React.CSSProperties = { width: '100%' };
  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, flexDirection:'column', gap:16 }}>
      <div style={{ width:40, height:40, border:'3px solid rgba(59,130,246,0.3)', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <div style={{ color:'#64748b', fontSize:14 }}>Loading purchase follow-up…</div>
    </div>
  );

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'linear-gradient(135deg, #F8FAFC 0%, #EEF4FF 55%, #E7F2FF 100%)', padding: '0 0 32px', margin: '-24px', overflow: 'hidden' }}>

      {/* Decorative blobs */}
      <div style={{ position:'absolute', top:-80, left:-80, width:340, height:340, borderRadius:'50%', background:'radial-gradient(circle, #DCEEFF 0%, transparent 70%)', opacity:0.55, pointerEvents:'none', filter:'blur(40px)' }}/>
      <div style={{ position:'absolute', top:60, right:-60, width:260, height:260, borderRadius:'50%', background:'radial-gradient(circle, #F2EEFF 0%, transparent 70%)', opacity:0.50, pointerEvents:'none', filter:'blur(35px)' }}/>
      <div style={{ position:'absolute', bottom:0, left:'35%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, #E6FBFF 0%, transparent 70%)', opacity:0.40, pointerEvents:'none', filter:'blur(50px)' }}/>

      <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', gap:16, padding:'24px' }}>

      {/* Page header */}
      <div style={{ background:'#FFFFFF', borderRadius:16, padding:'16px 22px', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 1px 4px rgba(15,23,42,0.07)', border:'1px solid rgba(0,0,0,0.05)' }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700, color:'#1e293b', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#2563EB,#7C3AED)', color:'#fff', fontSize:14 }}>🛒</span>
            PR Pending Status — E &amp; I
          </div>
          <div style={{ fontSize:12, color:'#64748b', marginTop:3, marginLeft:40 }}>Purchase follow-up register · auto-syncs from RFQ &amp; PO modules</div>
        </div>
        <div style={{ fontSize:13, fontWeight:700, color:'#2563EB', background:'#EEF4FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'7px 18px' }}>
          {todayStr}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 }}>
        {([
          { label: 'Total Items',           value: stats.total,        color: '#2563EB', bg:'#EEF4FF', border:'#BFDBFE' },
          { label: 'RFQ / Under Review',    value: stats.rfqOrReview,  color: '#F97316', bg:'#FFF7ED', border:'#FED7AA' },
          { label: 'Not Delivered',         value: stats.notDelivered, color: '#EF4444', bg:'#FEF2F2', border:'#FECACA' },
          { label: 'Quotation / PO done',   value: stats.quotation,    color: '#D97706', bg:'#FFFBEB', border:'#FDE68A' },
          { label: 'Material Received',     value: stats.received,     color: '#16A34A', bg:'#F0FDF4', border:'#BBF7D0' },
          { label: 'New / No Status',       value: stats.blank,        color: '#64748b', bg:'#F8FAFC', border:'#E2E8F0' },
        ] as any[]).map(s => (
          <div key={s.label} style={{ background:s.bg, borderRadius:14, padding:'14px 16px', border:`1px solid ${s.border}`, boxShadow:'0 1px 3px rgba(15,23,42,0.06)' }}>
            <div style={{ fontSize:24, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:10, color:'#64748b', marginTop:5, fontWeight:500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item, PR number, status…" className="input-dark" style={{ paddingLeft: 30 }} />
        </div>
        <button onClick={handleSync} className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
          <RefreshCw size={13} /> Sync RFQ/PO
        </button>
        <button onClick={() => downloadXLS(records)} className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Download size={13} /> Download Excel
        </button>
        <button onClick={openAdd} className="btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Plus size={13} /> Add Item
        </button>
      </div>

      {/* 3-tab navigation */}
      <div style={{ display:'flex', gap:0, borderBottom:'2px solid #E2E8F0', alignItems:'center', background:'#FFFFFF', borderRadius:'14px 14px 0 0', padding:'0 16px', boxShadow:'0 1px 3px rgba(15,23,42,0.05)', border:'1px solid rgba(0,0,0,0.05)', borderBottomLeftRadius:0, borderBottomRightRadius:0 }}>
        {([
          { key: 'pending',   label: 'Pending Purchase',   count: records.filter(inPending).length,   color: '#f59e0b' },
          { key: 'payment',   label: 'Payment History',    count: records.filter(inPayment).length,   color: '#60a5fa' },
          { key: 'completed', label: 'Completed',          count: records.filter(inCompleted).length, color: '#22c55e' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => { setListTab(t.key); setStatus('all'); }} style={{
            padding: '10px 22px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
            color: listTab === t.key ? t.color : '#475569',
            borderBottom: listTab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
            marginBottom: -2, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
          }}>
            {t.label}
            <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: listTab === t.key ? `${t.color}22` : '#F1F5F9',
              color: listTab === t.key ? t.color : '#475569',
            }}>{t.count}</span>
          </button>
        ))}
        {/* Adaptive sub-filter */}
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="input-dark"
          style={{ marginLeft: 'auto', width: 250, alignSelf: 'center', fontSize: 11 }}>
          {listTab === 'pending' ? (
            <>
              <option value="all">All Pending Status</option>
              {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
            </>
          ) : (
            <>
              <option value="all">All Payment Status</option>
              {PAYMENT_STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
            </>
          )}
        </select>
      </div>

      {/* Sync message */}
      {syncMsg && (
        <div style={{ padding: '8px 14px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, fontSize: 12, color: '#1d4ed8' }}>
          {syncMsg}
        </div>
      )}

      {/* ── PENDING PURCHASE TABLE ─────────────────────────────────────────── */}
      {listTab === 'pending' && (
      <div style={{ background:'#FFFFFF', borderRadius:'0 0 18px 18px', border:'1px solid rgba(0,0,0,0.05)', borderTop:'none', boxShadow:'0 20px 60px rgba(15,23,42,0.08)', overflow:'auto' }}>
        <table className="data-table" style={{ minWidth: 1160, tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: 40 }} /><col style={{ width: 195 }} /><col style={{ width: 90 }} />
            <col style={{ width: 52 }} /><col style={{ width: 118 }} /><col style={{ width: 170 }} />
            <col style={{ width: 115 }} /><col style={{ width: 68 }} /><col style={{ width: 68 }} />
            <col style={{ width: 115 }} /><col style={{ width: 80 }} /><col style={{ width: 46 }} />
          </colgroup>
          <thead><tr>
            <th style={{ textAlign:'center', position:'sticky', left:0, zIndex:3, background:'#FFFFFF', boxShadow:'1px 0 0 #E5E7EB' }}>Sl.</th>
            <th>Item Description</th><th style={{ whiteSpace:'nowrap' }}>Request Date</th>
            <th style={{ textAlign:'center' }}>Days</th><th>Required Timeline</th>
            <th>Current Status</th><th>PR Number</th>
            <th style={{ whiteSpace:'nowrap' }}>Req. Date</th>
            <th style={{ textAlign:'right', whiteSpace:'nowrap' }}>Budget</th>
            <th style={{ whiteSpace:'nowrap' }}>Lead Time</th><th style={{ whiteSpace:'nowrap' }}>Working Time</th>
            <th style={{ position:'sticky', right:0, zIndex:3, background:'#FFFFFF', boxShadow:'-1px 0 0 #E5E7EB', whiteSpace:'nowrap' }}>Actions</th>
          </tr></thead>
          <tbody>
            {tableRows.length === 0 && <tr><td colSpan={12} style={{ textAlign:'center', padding:32, color:'#475569' }}>No pending purchase items found.</td></tr>}
            {tableRows.map((row, i) => {
              if (row.type === 'section') return (
                <tr key={`sec-${i}`}><td colSpan={12} style={{ padding:'9px 14px', textAlign:'center', fontWeight:700, fontSize:13, background:'#FFF1F2', color:'#DC2626', borderTop:'2px solid #FECACA', borderBottom:'1px solid #FECACA', letterSpacing:0.4 }}>{row.label}</td></tr>
              );
              const { record: r, sl } = row;
              const isEditing = inlineId === r.id && inlineRow !== null;
              const iSel: React.CSSProperties = { fontSize:11, padding:'3px 5px', width:'100%' };
              const iInp: React.CSSProperties = { fontSize:11, padding:'3px 6px', width:'100%' };
              if (isEditing && inlineRow) return (
                <tr key={r.id} style={{ background:'rgba(59,130,246,0.07)', outline:'1px solid rgba(59,130,246,0.25)', outlineOffset:-1 }}>
                  <td style={{ textAlign:'center', color:'#60a5fa', fontSize:12, fontWeight:700, position:'sticky', left:0, background:'#F0F4FF', zIndex:1, boxShadow:'1px 0 0 #E5E7EB' }}>{sl}</td>
                  <td><input className="input-dark" style={iInp} value={inlineRow.itemDescription} onChange={e=>setIR('itemDescription',e.target.value)}/></td>
                  <td><input type="date" className="input-dark" style={{ fontSize:11, padding:'3px 5px' }} value={inlineRow.requestDate} onChange={e=>setIR('requestDate',e.target.value)}/></td>
                  <td style={{ textAlign:'center', color:'#64748b', fontSize:12 }}>{inlineRow.requestDate ? daysSince(inlineRow.requestDate) : '—'}</td>
                  <td><select className="input-dark" style={iSel} value={inlineRow.requiredTimeline} onChange={e=>setIR('requiredTimeline',e.target.value)}>{TIMELINES.map(t=><option key={t} value={t}>{t||'—'}</option>)}</select></td>
                  <td><select className="input-dark" style={iSel} value={inlineRow.currentStatus} onChange={e=>setIR('currentStatus',e.target.value)}>{STATUSES.map(s=><option key={s} value={s}>{s||'—'}</option>)}</select></td>
                  <td><input className="input-dark" style={iInp} value={inlineRow.prNumber} onChange={e=>setIR('prNumber',e.target.value)} placeholder="PR / RFQ No."/></td>
                  <td><input type="date" className="input-dark" style={{ fontSize:11, padding:'3px 5px' }} value={inlineRow.reqDate} onChange={e=>setIR('reqDate',e.target.value)}/></td>
                  <td><input type="number" className="input-dark" style={{ fontSize:11, padding:'3px 6px', width:80, textAlign:'right' }} value={inlineRow.budget||''} onChange={e=>setIR('budget',Number(e.target.value))} min={0}/></td>
                  <td><input className="input-dark" style={iInp} value={inlineRow.leadTime} onChange={e=>setIR('leadTime',e.target.value)} placeholder="Lead time"/></td>
                  <td><input className="input-dark" style={iInp} value={inlineRow.workingTime} onChange={e=>setIR('workingTime',e.target.value)} placeholder="Working time"/></td>
                  <td style={{ position:'sticky', right:0, background:'#F0F4FF', zIndex:1, boxShadow:'-1px 0 0 #E5E7EB', padding:'4px', textAlign:'center' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:3, alignItems:'center' }}>
                      <button onClick={saveInline} style={{ width:30, height:24, background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.45)', borderRadius:5, color:'#22c55e', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} title="Save"><Check size={11}/></button>
                      <button onClick={cancelInline} style={{ width:30, height:24, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:5, color:'#ef4444', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} title="Cancel"><X size={11}/></button>
                      <button onClick={()=>{cancelInline();openEdit(r);}} style={{ width:30, height:24, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:5, color:'#60a5fa', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} title="Full edit"><Maximize2 size={10}/></button>
                    </div>
                  </td>
                </tr>
              );
              const days = r.requestDate ? daysSince(r.requestDate) : null;
              const sc = STATUS_WEB[r.currentStatus]; const tlc = TL_COLOR[r.requiredTimeline];
              return (
                <tr key={r.id}>
                  <td style={{ textAlign:'center', color:'#64748b', fontSize:12, position:'sticky', left:0, background:'#FFFFFF', zIndex:1, boxShadow:'1px 0 0 #E5E7EB' }}>{sl}</td>
                  <td style={{ fontSize:13, fontWeight:500, color:'#1e293b', wordBreak:'break-word', overflow:'hidden' }}>{r.itemDescription}</td>
                  <td style={{ fontSize:11, color:'#374151', whiteSpace:'nowrap' }}>{r.requestDate ? fmtDate(r.requestDate) : '—'}</td>
                  <td style={{ textAlign:'center', fontWeight:700, fontSize:13, color: days && days>90 ? '#ef4444' : days && days>30 ? '#f59e0b' : '#64748b' }}>{days !== null && days > 0 ? days : '—'}</td>
                  <td style={{ fontWeight:600, fontSize:12, color: tlc||'#64748b' }}>{r.requiredTimeline||'—'}</td>
                  <td>
                    <select value={r.currentStatus} onChange={e=>updateStatusDirect(r.id,e.target.value)} style={{ width:'100%', padding:'4px 8px', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer', outline:'none', background:sc?.bg||'#F3F4F6', border:`1px solid ${sc?sc.tc+'55':'#D1D5DB'}`, color:sc?.tc||'#6B7280' }}>
                      {STATUSES.map(s=><option key={s} value={s} style={{ background:'#FFFFFF', color:'#374151' }}>{s||'— Not set —'}</option>)}
                    </select>
                  </td>
                  <td style={{ fontSize:12, color:'#60a5fa', fontFamily:'monospace' }}>{r.prNumber||'—'}</td>
                  <td style={{ fontSize:11, color:'#374151', whiteSpace:'nowrap' }}>{r.reqDate ? fmtMonYear(r.reqDate) : '—'}</td>
                  <td style={{ textAlign:'right', fontSize:12, color:'#22c55e', fontWeight:600 }}>{r.budget ? r.budget.toLocaleString() : '—'}</td>
                  <td style={{ fontSize:12, color:'#374151', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textAlign:'center' }} title={r.leadTime}>{r.leadTime||'—'}</td>
                  <td style={{ fontSize:12, color:'#374151', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textAlign:'center' }} title={r.workingTime}>{r.workingTime||'—'}</td>
                  <td style={{ position:'sticky', right:0, background:'#FFFFFF', zIndex:2, boxShadow:'-1px 0 0 #E5E7EB', padding:'4px', textAlign:'center' }}>
                    <button onClick={e=>openMenu(e,r)} style={{ width:30, height:28, borderRadius:6, background:'#F8FAFC', border:'1px solid #E5E7EB', color:'#94a3b8', cursor:'pointer', fontSize:16, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center' }} title="Actions">⋮</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* ── PAYMENT HISTORY TABLE ──────────────────────────────────────────── */}
      {listTab === 'payment' && (() => {
        const payRecs = filtered;
        const iSel: React.CSSProperties = { fontSize:11, padding:'3px 5px', width:'100%' };
        return (
          <div style={{ background:'#FFFFFF', borderRadius:'0 0 18px 18px', border:'1px solid rgba(0,0,0,0.05)', borderTop:'none', boxShadow:'0 20px 60px rgba(15,23,42,0.08)', overflow:'auto' }}>
            <table className="data-table" style={{ minWidth:1100, tableLayout:'fixed', width:'100%' }}>
              <colgroup>
                <col style={{ width:38 }}/><col style={{ width:210 }}/><col style={{ width:110 }}/>
                <col style={{ width:95 }}/><col style={{ width:82 }}/><col style={{ width:58 }}/>
                <col style={{ width:90 }}/><col style={{ width:90 }}/><col style={{ width:155 }}/>
                <col style={{ width:72 }}/>
              </colgroup>
              <thead><tr>
                <th style={{ textAlign:'center' }}>Sl.</th>
                <th>Item Description</th>
                <th>PO Number</th>
                <th style={{ whiteSpace:'nowrap' }}>Received Date</th>
                <th style={{ textAlign:'right', whiteSpace:'nowrap' }}>PO Total</th>
                <th style={{ textAlign:'center', whiteSpace:'nowrap' }}>Due Days</th>
                <th style={{ textAlign:'right', whiteSpace:'nowrap' }}>Total Paid</th>
                <th style={{ textAlign:'right', whiteSpace:'nowrap' }}>Remaining</th>
                <th>Payment Status</th>
                <th style={{ position:'sticky', right:0, zIndex:3, background:'#FFFFFF', boxShadow:'-1px 0 0 #E5E7EB', textAlign:'center' }}>Actions</th>
              </tr></thead>
              <tbody>
                {payRecs.length === 0 && <tr><td colSpan={10} style={{ textAlign:'center', padding:32, color:'#475569' }}>No items in Payment History — set Current Status to "Material Received".</td></tr>}
                {payRecs.map((r, i) => {
                  const isEditing  = inlineId === r.id && inlineRow !== null;
                  const dueDays    = (() => { const d = r.receivedDate||r.requestDate; return d ? daysSince(d) : null; })();
                  const totalPaid  = getTotalPaid(r);
                  const remaining  = getRemaining(r);
                  const pc         = PAYMENT_CFG[r.paymentStatus];
                  const payments   = r.paymentHistory || [];

                  if (isEditing && inlineRow) return (
                    <tr key={r.id} style={{ background:'rgba(59,130,246,0.07)', outline:'1px solid rgba(59,130,246,0.25)', outlineOffset:-1 }}>
                      <td style={{ textAlign:'center', color:'#60a5fa', fontSize:12, fontWeight:700 }}>{i+1}</td>
                      <td style={{ fontSize:12, color:'#94a3b8', fontWeight:500 }}>{r.itemDescription}</td>
                      <td><input className="input-dark" style={{ fontSize:11, padding:'3px 6px', width:'100%' }} value={inlineRow.prNumber} onChange={e=>setIR('prNumber',e.target.value)} placeholder="PO / PR No."/></td>
                      <td><input type="date" className="input-dark" style={{ fontSize:11, padding:'3px 5px', width:'100%' }} value={inlineRow.receivedDate||''} onChange={e=>setIR('receivedDate',e.target.value)}/></td>
                      <td style={{ textAlign:'right', fontSize:12, color:'#22c55e', fontWeight:600 }}>{r.budget ? `AED ${r.budget.toLocaleString()}` : '—'}</td>
                      <td style={{ textAlign:'center', fontWeight:700, color: dueDays && dueDays>60 ? '#ef4444' : dueDays && dueDays>30 ? '#f59e0b' : '#64748b' }}>{dueDays ?? '—'}</td>
                      <td style={{ textAlign:'right', fontSize:12, color:'#a855f7', fontWeight:700 }}>{totalPaid > 0 ? `AED ${totalPaid.toLocaleString()}` : '—'}</td>
                      <td style={{ textAlign:'right', fontSize:12, color:'#f59e0b', fontWeight:700 }}>{remaining > 0 ? `AED ${remaining.toLocaleString()}` : '✓'}</td>
                      <td>
                        <select className="input-dark" style={iSel} value={inlineRow.paymentStatus} onChange={e=>setIR('paymentStatus',e.target.value)}>
                          {PAYMENT_STATUSES.map(s=><option key={s} value={s}>{s||'— Not set —'}</option>)}
                        </select>
                      </td>
                      <td style={{ position:'sticky', right:0, background:'#F0F4FF', zIndex:1, boxShadow:'-1px 0 0 #E5E7EB', padding:'4px', textAlign:'center' }}>
                        <div style={{ display:'flex', flexDirection:'column', gap:3, alignItems:'center' }}>
                          <button onClick={saveInline} style={{ width:30, height:24, background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.45)', borderRadius:5, color:'#22c55e', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} title="Save"><Check size={11}/></button>
                          <button onClick={cancelInline} style={{ width:30, height:24, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:5, color:'#ef4444', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} title="Cancel"><X size={11}/></button>
                        </div>
                      </td>
                    </tr>
                  );

                  return (
                    <React.Fragment key={r.id}>
                      <tr style={{ background: payments.length > 0 ? 'rgba(168,85,247,0.05)' : undefined }}>
                        <td style={{ textAlign:'center', color:'#64748b', fontSize:12 }}>{i+1}</td>
                        <td style={{ fontSize:13, fontWeight:500, color:'#1e293b', wordBreak:'break-word' }}>
                          {r.itemDescription}
                          {payments.length > 0 && <span style={{ fontSize:10, color:'#a855f7', marginLeft:6, fontWeight:600 }}>{payments.length} payment{payments.length>1?'s':''}</span>}
                        </td>
                        <td style={{ fontSize:12, color:'#60a5fa', fontFamily:'monospace' }}>{r.prNumber||'—'}</td>
                        <td style={{ padding:'4px 6px' }}>
                          <input type="date" className="input-dark"
                            style={{ fontSize:11, padding:'3px 5px', width:'100%', background:'transparent', border:'1px solid #E5E7EB', borderRadius:5, color:'#374151' }}
                            value={r.receivedDate||''} onChange={e=>updateFieldDirect(r.id,{receivedDate:e.target.value})}
                          />
                        </td>
                        <td style={{ textAlign:'right', fontSize:12, color:'#22c55e', fontWeight:700 }}>{r.budget ? `AED ${r.budget.toLocaleString()}` : '—'}</td>
                        <td style={{ textAlign:'center', fontWeight:700, fontSize:13, color: dueDays && dueDays>60 ? '#ef4444' : dueDays && dueDays>30 ? '#f59e0b' : '#64748b' }}>{dueDays ?? '—'}</td>
                        <td style={{ textAlign:'right', fontSize:12, fontWeight:700, color: totalPaid>0 ? '#a855f7' : '#475569' }}>
                          {totalPaid > 0 ? `AED ${totalPaid.toLocaleString()}` : '—'}
                        </td>
                        <td style={{ textAlign:'right', fontSize:12, fontWeight:700, color: remaining>0 ? '#f59e0b' : '#22c55e' }}>
                          {remaining > 0 ? `AED ${remaining.toLocaleString()}` : (r.budget ? '✓ Settled' : '—')}
                        </td>
                        <td>
                          <select value={r.paymentStatus} onChange={e=>updatePaymentDirect(r.id,e.target.value)}
                            style={{ width:'100%', padding:'4px 8px', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer', outline:'none', background:pc?.bg||'#F3F4F6', border:`1px solid ${pc?pc.tc+'55':'#D1D5DB'}`, color:pc?.tc||'#6B7280' }}>
                            {PAYMENT_STATUSES.map(s=><option key={s} value={s} style={{ background:'#FFFFFF' }}>{s||'— Not set —'}</option>)}
                          </select>
                        </td>
                        <td style={{ position:'sticky', right:0, background:'#FFFFFF', zIndex:2, boxShadow:'-1px 0 0 #E5E7EB', padding:'4px', textAlign:'center' }}>
                          <div style={{ display:'flex', flexDirection:'column', gap:3, alignItems:'center' }}>
                            <button onClick={()=>openPayModal(r)}
                              style={{ width:30, height:26, borderRadius:5, background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.5)', color:'#22c55e', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}
                              title="Add Payment">+</button>
                            <button onClick={e=>openMenu(e,r)} style={{ width:30, height:26, borderRadius:5, background:'#F8FAFC', border:'1px solid #E5E7EB', color:'#94a3b8', cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center' }} title="More">⋮</button>
                          </div>
                        </td>
                      </tr>
                      {/* Payment installment sub-rows */}
                      {payments.map((px, pi) => {
                        const cumulative = payments.slice(0, pi + 1).reduce((s, p) => s + p.amount, 0);
                        const remAfter   = Math.max(0, (r.budget||0) - cumulative);
                        return (
                          <tr key={px.id} style={{ background:'rgba(168,85,247,0.04)', borderLeft:'3px solid rgba(168,85,247,0.3)' }}>
                            <td style={{ textAlign:'center' }}><span style={{ fontSize:9, color:'#a855f7', fontWeight:700 }}>#{pi+1}</span></td>
                            <td style={{ fontSize:11, color:'#64748b', paddingLeft:24, fontStyle:'italic' }}>{fmtDate(px.date)} — {px.remarks || 'Payment installment'}</td>
                            <td style={{ fontSize:11, color:'#64748b' }}>—</td>
                            <td style={{ fontSize:11, color:'#64748b' }}>{fmtDate(px.date)}</td>
                            <td></td>
                            <td></td>
                            <td style={{ textAlign:'right', fontSize:12, fontWeight:800, color:'#22c55e' }}>AED {px.amount.toLocaleString()}</td>
                            <td style={{ textAlign:'right', fontSize:11, color: remAfter>0 ? '#f59e0b' : '#22c55e' }}>
                              {remAfter > 0 ? `AED ${remAfter.toLocaleString()} left` : '✓ Cleared'}
                            </td>
                            <td></td>
                            <td style={{ position:'sticky', right:0, background:'#FFFFFF', zIndex:2, boxShadow:'-1px 0 0 #E5E7EB', padding:'4px', textAlign:'center' }}>
                              <button onClick={async ()=>{ const rec2=records.find(rr=>rr.id===r.id); if(!rec2) return; const hist=(rec2.paymentHistory||[]).filter(p=>p._id!==px._id&&p.id!==px.id); const paid=hist.reduce((s,p)=>s+p.amount,0); const ps=paid>=(rec2.budget||0)&&paid>0?'Payment Done':hist.length>0?'Partial Payment Done':rec2.paymentStatus; try{ const u=await apiFetch(`/api/purchase-followup/${r.id}`,{method:'PUT',body:JSON.stringify({paymentHistory:hist,paymentStatus:ps})}); setRecords(rs=>rs.map(rr=>rr.id===r.id?u:rr)); }catch(e:any){alert(e.message);} }}
                                style={{ width:26, height:22, borderRadius:4, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', cursor:'pointer', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center' }} title="Remove payment">
                                <Trash2 size={10}/>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* ── COMPLETED TABLE ────────────────────────────────────────────────── */}
      {listTab === 'completed' && (() => {
        const compRecs = filtered;
        type CompRow =
          | { kind: 'po';      rec: FollowupRecord; idx: number }
          | { kind: 'payment'; rec: FollowupRecord; tx: PaymentTransaction; txIdx: number; cumulative: number; remaining: number }
          | { kind: 'rejected'; rec: FollowupRecord; idx: number };

        const rows: CompRow[] = [];
        compRecs.forEach((r, idx) => {
          if (r.currentStatus === 'Rejected') { rows.push({ kind:'rejected', rec:r, idx }); return; }
          rows.push({ kind:'po', rec:r, idx });
          let cum = 0;
          (r.paymentHistory || []).forEach((tx, ti) => {
            cum += tx.amount;
            rows.push({ kind:'payment', rec:r, tx, txIdx:ti, cumulative:cum, remaining:Math.max(0,(r.budget||0)-cum) });
          });
        });

        return (
          <div style={{ background:'#FFFFFF', borderRadius:'0 0 18px 18px', border:'1px solid rgba(0,0,0,0.05)', borderTop:'none', boxShadow:'0 20px 60px rgba(15,23,42,0.08)', overflow:'auto' }}>
            <table className="data-table" style={{ minWidth:1100, tableLayout:'fixed', width:'100%' }}>
              <colgroup>
                <col style={{ width:42 }}/><col style={{ width:215 }}/><col style={{ width:110 }}/>
                <col style={{ width:92 }}/><col style={{ width:88 }}/><col style={{ width:88 }}/>
                <col style={{ width:88 }}/><col style={{ width:145 }}/><col style={{ width:46 }}/>
              </colgroup>
              <thead><tr>
                <th style={{ textAlign:'center' }}>#</th>
                <th>Item Description</th>
                <th>PO Number</th>
                <th style={{ whiteSpace:'nowrap' }}>Received Date</th>
                <th style={{ textAlign:'right', whiteSpace:'nowrap' }}>PO Total</th>
                <th style={{ textAlign:'right', whiteSpace:'nowrap' }}>Paid (This)</th>
                <th style={{ textAlign:'right', whiteSpace:'nowrap' }}>Remaining</th>
                <th>Status / Remarks</th>
                <th style={{ position:'sticky', right:0, zIndex:3, background:'#FFFFFF', boxShadow:'-1px 0 0 #E5E7EB' }}>Act.</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={9} style={{ textAlign:'center', padding:32, color:'#475569' }}>No completed payments yet — add payments via Payment History tab.</td></tr>}
                {rows.map((row, ri) => {
                  if (row.kind === 'rejected') return (
                    <tr key={`rej-${row.rec.id}`} style={{ background:'rgba(71,85,105,0.12)', opacity:0.75 }}>
                      <td style={{ textAlign:'center', color:'#64748b', fontSize:12 }}>{row.idx+1}</td>
                      <td style={{ fontSize:13, fontWeight:500, color:'#94a3b8' }}>{row.rec.itemDescription}</td>
                      <td style={{ fontSize:12, color:'#64748b', fontFamily:'monospace' }}>{row.rec.prNumber||'—'}</td>
                      <td style={{ fontSize:11, color:'#64748b' }}>—</td>
                      <td style={{ textAlign:'right', fontSize:12, color:'#64748b' }}>{row.rec.budget ? `AED ${row.rec.budget.toLocaleString()}` : '—'}</td>
                      <td style={{ textAlign:'right', fontSize:12, color:'#64748b' }}>—</td>
                      <td>—</td>
                      <td><span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:'rgba(71,85,105,0.3)', color:'#94a3b8', border:'1px solid rgba(71,85,105,0.5)' }}>Rejected</span></td>
                      <td style={{ position:'sticky', right:0, background:'#FFFFFF', zIndex:2, boxShadow:'-1px 0 0 #E5E7EB', padding:'4px', textAlign:'center' }}>
                        <button onClick={e=>openMenu(e,row.rec)} style={{ width:30, height:28, borderRadius:6, background:'#F8FAFC', border:'1px solid #E5E7EB', color:'#94a3b8', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>⋮</button>
                      </td>
                    </tr>
                  );
                  if (row.kind === 'po') {
                    const tp = getTotalPaid(row.rec); const rm = getRemaining(row.rec); const full = rm <= 0;
                    return (
                      <tr key={`po-${row.rec.id}`} style={{ background: full ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.05)', borderLeft: full ? '3px solid rgba(34,197,94,0.6)' : '3px solid rgba(245,158,11,0.5)' }}>
                        <td style={{ textAlign:'center', fontSize:12, color:'#64748b', fontWeight:700 }}>{row.idx+1}</td>
                        <td style={{ fontSize:13, fontWeight:700, color:'#1e293b', wordBreak:'break-word' }}>{row.rec.itemDescription}</td>
                        <td style={{ fontSize:12, color:'#60a5fa', fontFamily:'monospace', fontWeight:700 }}>{row.rec.prNumber||'—'}</td>
                        <td style={{ padding:'4px 6px' }}>
                          <input type="date" className="input-dark"
                            style={{ fontSize:11, padding:'3px 5px', width:'100%', background:'transparent', border:'1px solid #E5E7EB', borderRadius:5, color:'#374151' }}
                            value={row.rec.receivedDate||''} onChange={e=>updateFieldDirect(row.rec.id,{receivedDate:e.target.value})}
                          />
                        </td>
                        <td style={{ textAlign:'right', fontSize:12, color:'#374151', fontWeight:700 }}>{row.rec.budget ? `AED ${row.rec.budget.toLocaleString()}` : '—'}</td>
                        <td style={{ textAlign:'right', fontSize:12, color:'#a855f7', fontWeight:700 }}>{tp > 0 ? `AED ${tp.toLocaleString()}` : '—'}</td>
                        <td style={{ textAlign:'right', fontSize:12, fontWeight:700, color: rm>0 ? '#f59e0b' : '#22c55e' }}>{rm > 0 ? `AED ${rm.toLocaleString()}` : '✓ Fully Paid'}</td>
                        <td>
                          <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background: full?'rgba(34,197,94,0.18)':'rgba(245,158,11,0.18)', color: full?'#22c55e':'#f59e0b', border:`1px solid ${full?'rgba(34,197,94,0.4)':'rgba(245,158,11,0.4)'}` }}>
                            {full ? '✓ Payment Done' : `◑ ${(row.rec.paymentHistory||[]).length} payment${(row.rec.paymentHistory||[]).length!==1?'s':''} made`}
                          </span>
                        </td>
                        <td style={{ position:'sticky', right:0, background:'#FFFFFF', zIndex:2, boxShadow:'-1px 0 0 #E5E7EB', padding:'4px', textAlign:'center' }}>
                          <button onClick={e=>openMenu(e,row.rec)} style={{ width:30, height:28, borderRadius:6, background:'#F8FAFC', border:'1px solid #E5E7EB', color:'#94a3b8', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>⋮</button>
                        </td>
                      </tr>
                    );
                  }
                  // payment transaction row
                  const { rec, tx, txIdx, remaining } = row;
                  const isLast = remaining <= 0;
                  return (
                    <tr key={`tx-${tx.id}`} style={{ background: isLast ? 'rgba(34,197,94,0.04)' : 'rgba(168,85,247,0.04)', borderLeft:'3px solid '+(isLast?'rgba(34,197,94,0.3)':'rgba(168,85,247,0.3)') }}>
                      <td style={{ textAlign:'center' }}>
                        <span style={{ fontSize:10, color:isLast?'#22c55e':'#a855f7', fontWeight:700, background:isLast?'rgba(34,197,94,0.15)':'rgba(168,85,247,0.15)', padding:'1px 7px', borderRadius:10 }}>P{txIdx+1}</span>
                      </td>
                      <td style={{ fontSize:11, color:'#94a3b8', paddingLeft:28 }}>{rec.itemDescription}</td>
                      <td style={{ fontSize:11, color:'#64748b', fontFamily:'monospace' }}>{rec.prNumber||'—'}</td>
                      <td style={{ fontSize:12, color:'#374151', fontWeight:600, whiteSpace:'nowrap' }}>{tx.date ? fmtDate(tx.date) : '—'}</td>
                      <td style={{ textAlign:'right', fontSize:11, color:'#475569' }}>{rec.budget ? `AED ${rec.budget.toLocaleString()}` : '—'}</td>
                      <td style={{ textAlign:'right', fontSize:13, fontWeight:800, color:isLast?'#22c55e':'#a855f7' }}>AED {tx.amount.toLocaleString()}</td>
                      <td style={{ textAlign:'right', fontSize:12, fontWeight:700, color:remaining>0?'#f59e0b':'#22c55e' }}>{remaining>0 ? `AED ${remaining.toLocaleString()}` : '✓ Cleared'}</td>
                      <td style={{ fontSize:11, color:'#64748b' }}>{tx.remarks||'—'}</td>
                      <td style={{ position:'sticky', right:0, background:'#FFFFFF', zIndex:2, boxShadow:'-1px 0 0 #E5E7EB', padding:'4px', textAlign:'center' }}></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* ── Add Payment Modal ─────────────────────────────────────────────── */}
      {payModal && (
        <div className="modal-overlay" onClick={()=>setPayModal(null)}>
          <div className="modal-content" style={{ maxWidth:420 }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #E5E7EB', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:'#1e293b' }}>Add Payment</div>
                <div style={{ fontSize:11, color:'#60a5fa', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:340 }}>{payModal.record.itemDescription}</div>
              </div>
              <button onClick={()=>setPayModal(null)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={16}/></button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              {/* Summary */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                {[
                  { label:'PO Total', val:`AED ${(payModal.record.budget||0).toLocaleString()}`, color:'#374151' },
                  { label:'Paid So Far', val:`AED ${getTotalPaid(payModal.record).toLocaleString()}`, color:'#a855f7' },
                  { label:'Remaining', val:`AED ${getRemaining(payModal.record).toLocaleString()}`, color:'#f59e0b' },
                ].map(c=>(
                  <div key={c.label} style={{ background:'#F8FAFC', borderRadius:8, padding:'8px 10px', textAlign:'center', border:'1px solid #E5E7EB' }}>
                    <div style={{ fontSize:10, color:'#64748b', marginBottom:2 }}>{c.label}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:c.color }}>{c.val}</div>
                  </div>
                ))}
              </div>
              <div>
                <label style={{ fontSize:11, color:'#94a3b8', display:'block', marginBottom:4 }}>Payment Date *</label>
                <input type="date" className="input-dark" style={{ width:'100%', padding:'8px 10px', fontSize:13 }}
                  value={payModal.date} onChange={e=>setPayModal(m=>m?{...m,date:e.target.value}:m)}/>
              </div>
              <div>
                <label style={{ fontSize:11, color:'#94a3b8', display:'block', marginBottom:4 }}>Amount Paid (AED) *</label>
                <input type="number" className="input-dark" style={{ width:'100%', padding:'8px 10px', fontSize:13 }}
                  value={payModal.amount} min={0} max={getRemaining(payModal.record)}
                  onChange={e=>setPayModal(m=>m?{...m,amount:e.target.value}:m)} placeholder="e.g. 1500"/>
              </div>
              <div>
                <label style={{ fontSize:11, color:'#94a3b8', display:'block', marginBottom:4 }}>Remarks</label>
                <input className="input-dark" style={{ width:'100%', padding:'8px 10px', fontSize:13 }}
                  value={payModal.remarks} onChange={e=>setPayModal(m=>m?{...m,remarks:e.target.value}:m)} placeholder="e.g. Cheque #12345"/>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <button onClick={savePayment} className="btn-primary" style={{ flex:1, justifyContent:'center' }}>Save Payment</button>
                <button onClick={()=>setPayModal(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Global fixed-position kebab menu (renders above overflow containers) ── */}
      {openMenuId && menuRec && (
        <div onClick={e=>e.stopPropagation()} style={{
          position:'fixed', top:menuPos.top, left:menuPos.left, zIndex:9999,
          background:'#1e293b', border:'1px solid rgba(255,255,255,0.12)',
          borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.55)',
          minWidth:140, padding:'4px 0', display:'flex', flexDirection:'column',
        }}>
          {listTab !== 'completed' && (
            <button onClick={()=>{startInline(menuRec!);setOpenMenuId(null);setMenuRec(null);}} style={{ padding:'8px 14px', background:'none', border:'none', color:'#e2e8f0', cursor:'pointer', textAlign:'left', fontSize:12, display:'flex', alignItems:'center', gap:8 }}>
              <Edit2 size={12}/> Quick Edit
            </button>
          )}
          <button onClick={()=>{openEdit(menuRec!);setOpenMenuId(null);setMenuRec(null);}} style={{ padding:'8px 14px', background:'none', border:'none', color:'#60a5fa', cursor:'pointer', textAlign:'left', fontSize:12, display:'flex', alignItems:'center', gap:8 }}>
            <Maximize2 size={12}/> Full Edit
          </button>
          <div style={{ height:1, background:'#F8FAFC', margin:'3px 0' }}/>
          <button onClick={()=>{del(menuRec!.id);setOpenMenuId(null);setMenuRec(null);}} style={{ padding:'8px 14px', background:'none', border:'none', color:'#ef4444', cursor:'pointer', textAlign:'left', fontSize:12, display:'flex', alignItems:'center', gap:8 }}>
            <Trash2 size={12}/> Delete
          </button>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>{editId ? 'Edit Record' : 'Add PR Follow-up Item'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 24, maxHeight: '78vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div>
                <label style={lbl}>Section (blank = main E&amp;I list)</label>
                <input list="sec-list" className="input-dark" style={inp} value={form.section} onChange={e => setF('section', e.target.value)} placeholder="e.g. Spare Material for Manufacturing Line" />
                <datalist id="sec-list">{sections.map(s => <option key={s} value={s} />)}</datalist>
              </div>

              <div>
                <label style={lbl}>Item Description *</label>
                <input className="input-dark" style={inp} value={form.itemDescription} onChange={e => setF('itemDescription', e.target.value)} placeholder="e.g. RFQ-01(2026) Furnace Heat Up panel." />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={lbl}>Request Date</label>
                  <input type="date" className="input-dark" style={inp} value={form.requestDate} onChange={e => setF('requestDate', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Required Timeline (Priority)</label>
                  <select className="input-dark" style={inp} value={form.requiredTimeline} onChange={e => setF('requiredTimeline', e.target.value)}>
                    {TIMELINES.map(t => <option key={t} value={t}>{t || '— None —'}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Current Status</label>
                  <select className="input-dark" style={inp} value={form.currentStatus} onChange={e => setF('currentStatus', e.target.value)}>
                    {STATUSES.map(s => <option key={s} value={s}>{s || '— None —'}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Payment Status</label>
                  <select className="input-dark" style={inp} value={form.paymentStatus} onChange={e => setF('paymentStatus', e.target.value)}>
                    {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s || '— Not set —'}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>PR / PO / RFQ Number</label>
                  <input className="input-dark" style={inp} value={form.prNumber} onChange={e => setF('prNumber', e.target.value)} placeholder="PR10000031 / RFQ-2026-001" />
                </div>
                <div>
                  <label style={lbl}>Required / Expected Date</label>
                  <input type="date" className="input-dark" style={inp} value={form.reqDate} onChange={e => setF('reqDate', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Budget (AED)</label>
                  <input type="number" className="input-dark" style={inp} value={form.budget || ''} onChange={e => setF('budget', Number(e.target.value))} placeholder="0" min={0} />
                </div>
                <div>
                  <label style={lbl}>Lead Time</label>
                  <input className="input-dark" style={inp} value={form.leadTime} onChange={e => setF('leadTime', e.target.value)} placeholder="e.g. 2 week execution" />
                </div>
                <div>
                  <label style={lbl}>Working Time</label>
                  <input className="input-dark" style={inp} value={form.workingTime} onChange={e => setF('workingTime', e.target.value)} placeholder="e.g. October" />
                </div>
              </div>

              <div>
                <label style={lbl}>Remarks</label>
                <input className="input-dark" style={inp} value={form.remarks} onChange={e => setF('remarks', e.target.value)} placeholder="Follow-up notes…" />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={saveForm} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>{editId ? 'Update' : 'Add Item'}</button>
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}


