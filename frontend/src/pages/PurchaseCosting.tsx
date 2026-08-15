// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Package, TrendingUp, CheckCircle2, Truck, FileDown, BoxIcon } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface POItem {
  slNo: number;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

interface PO {
  id: string;
  _id: string;
  poNo: string;
  poDate: string;
  vendor: string;
  department: string;
  requestedBy: string;
  estimatedDelivery: string;
  actualDelivery: string;
  items: POItem[];
  totalValue: number;
  currency: string;
  status: string;
  remarks: string;
}

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const STATUS_LABEL: Record<string, string> = {
  ordered: 'Ordered', acknowledged: 'Acknowledged', 'in-transit': 'In Transit',
  'partially-received': 'Partially Received', received: 'Received',
  delayed: 'Delayed', cancelled: 'Cancelled',
};
const STATUS_COLOR: Record<string, string> = {
  ordered: '#3b82f6', acknowledged: '#8b5cf6', 'in-transit': '#f59e0b',
  'partially-received': '#f97316', received: '#22c55e',
  delayed: '#ef4444', cancelled: '#94a3b8',
};

function fmtAED(n: number) {
  return n.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}
function inMonth(dateStr: string, year: number, month: number) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}
function itemSummary(items: POItem[]) {
  if (!items?.length) return '—';
  const desc = items[0]?.description || '';
  return items.length === 1 ? desc : `${desc} + ${items.length - 1} more`;
}

export default function PurchaseCosting() {
  const now = new Date();
  const [pos, setPos]             = useState<PO[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selMonth, setSelMonth]   = useState(now.getMonth() + 1);
  const [selYear, setSelYear]     = useState(now.getFullYear());
  const [exporting, setExporting] = useState(false);

  const fetchPOs = async () => {
    setLoading(true);
    try {
      const data = await fetch('/api/purchase-po').then(r => r.json());
      setPos(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Failed to load POs', e); setPos([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPOs(); }, []);

  // Materials RECEIVED in selected month (by actualDelivery date)
  const receivedThisMonth = useMemo(() =>
    pos.filter(p => p.status === 'received' && inMonth(p.actualDelivery || p.poDate, selYear, selMonth)),
    [pos, selYear, selMonth]
  );

  // All POs RAISED in selected month (by poDate)
  const raisedThisMonth = useMemo(() =>
    pos.filter(p => inMonth(p.poDate, selYear, selMonth)),
    [pos, selYear, selMonth]
  );

  // In transit = raised this month but not yet received
  const inTransit = useMemo(() =>
    raisedThisMonth.filter(p => p.status !== 'received' && p.status !== 'cancelled'),
    [raisedThisMonth]
  );

  // All received across all time for YTD context
  const receivedYTD = useMemo(() =>
    pos.filter(p => p.status === 'received' && new Date(p.actualDelivery || p.poDate).getFullYear() === selYear),
    [pos, selYear]
  );

  const costReceived  = receivedThisMonth.reduce((s, p) => s + (p.totalValue || 0), 0);
  const costRaised    = raisedThisMonth.reduce((s, p) => s + (p.totalValue || 0), 0);
  const costInTransit = inTransit.reduce((s, p) => s + (p.totalValue || 0), 0);
  const costYTD       = receivedYTD.reduce((s, p) => s + (p.totalValue || 0), 0);

  const monthLabel = `${MONTHS[selMonth - 1]} ${selYear}`;
  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 1 + i);

  // ── PDF ───────────────────────────────────────────────────────────────────────
  const generatePDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pw = doc.internal.pageSize.getWidth();

      // Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pw, 28, 'F');
      doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(241, 245, 249);
      doc.text('E & I Material Cost Report', pw / 2, 11, { align: 'center' });
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
      doc.text(`${monthLabel}   ·   E & I Maintenance Department   ·   Generated: ${fmtDate(new Date().toISOString())}`, pw / 2, 18, { align: 'center' });

      // Summary strip
      autoTable(doc, {
        startY: 32,
        margin: { left: 10, right: 10 },
        head: [['Materials Received (Cost Used)', 'POs Raised This Month', 'In Transit', 'Received YTD']],
        body: [[
          `AED ${fmtAED(costReceived)} (${receivedThisMonth.length} PO${receivedThisMonth.length !== 1 ? 's' : ''})`,
          `AED ${fmtAED(costRaised)} (${raisedThisMonth.length} PO${raisedThisMonth.length !== 1 ? 's' : ''})`,
          `AED ${fmtAED(costInTransit)} (${inTransit.length} PO${inTransit.length !== 1 ? 's' : ''})`,
          `AED ${fmtAED(costYTD)}`,
        ]],
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 10, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { textColor: [34, 197, 94] },
          1: { textColor: [59, 130, 246] },
          2: { textColor: [245, 158, 11] },
          3: { textColor: [139, 92, 246] },
        },
      });

      // Section 1 — Received
      const y1 = (doc as any).lastAutoTable.finalY + 6;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(34, 197, 94);
      doc.text(`1. Materials Received — ${monthLabel}  (Cost Used)`, 10, y1 + 5);

      autoTable(doc, {
        startY: y1 + 8,
        margin: { left: 10, right: 10 },
        head: [['Sl', 'PO Number', 'Vendor', 'Items', 'PO Date', 'Received On', 'Total Value (AED)']],
        body: receivedThisMonth.length ? receivedThisMonth.map((p, i) => [
          i + 1, p.poNo || '—', p.vendor || '—', itemSummary(p.items),
          fmtDate(p.poDate), fmtDate(p.actualDelivery),
          `AED ${fmtAED(p.totalValue || 0)}`,
        ]) : [['', 'No materials received this month', '', '', '', '', '']],
        foot: receivedThisMonth.length ? [['', '', '', '', '', 'Total Cost Used:', `AED ${fmtAED(costReceived)}`]] : undefined,
        headStyles: { fillColor: [20, 83, 45], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8.5 },
        footStyles: { fillColor: [240, 253, 244], textColor: [20, 83, 45], fontStyle: 'bold', fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 30 },
          2: { cellWidth: 40 }, 3: { cellWidth: 'auto' },
          4: { cellWidth: 24, halign: 'center' }, 5: { cellWidth: 24, halign: 'center' },
          6: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
        },
      });

      // Section 2 — POs raised
      const y2 = (doc as any).lastAutoTable.finalY + 6;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(59, 130, 246);
      doc.text(`2. POs Raised — ${monthLabel}`, 10, y2 + 5);

      autoTable(doc, {
        startY: y2 + 8,
        margin: { left: 10, right: 10 },
        head: [['Sl', 'PO Number', 'Vendor', 'Items', 'PO Date', 'Est. Delivery', 'Status', 'Value (AED)']],
        body: raisedThisMonth.length ? raisedThisMonth.map((p, i) => [
          i + 1, p.poNo || '—', p.vendor || '—', itemSummary(p.items),
          fmtDate(p.poDate), fmtDate(p.estimatedDelivery),
          STATUS_LABEL[p.status] || p.status || '—',
          `AED ${fmtAED(p.totalValue || 0)}`,
        ]) : [['', 'No POs raised this month', '', '', '', '', '', '']],
        foot: raisedThisMonth.length ? [['', '', '', '', '', '', 'Total Raised:', `AED ${fmtAED(costRaised)}`]] : undefined,
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8.5 },
        footStyles: { fillColor: [239, 246, 255], textColor: [30, 64, 175], fontStyle: 'bold', fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 28 },
          2: { cellWidth: 36 }, 3: { cellWidth: 'auto' },
          4: { cellWidth: 22, halign: 'center' }, 5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 28 }, 7: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
        },
      });

      // Page footer
      const pages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pages}   ·   E & I Material Cost Report — ${monthLabel}`, pw / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
      }

      doc.save(`EI-Material-Cost-${selYear}-${String(selMonth).padStart(2,'0')}.pdf`);
    } finally { setExporting(false); }
  };

  // ── UI helpers ────────────────────────────────────────────────────────────────
  const SummaryCard = ({ label, sub, value, count, color, bg, border, icon }: any) => (
    <div style={{ padding: '16px 20px', borderRadius: 14, background: bg, border: `1.5px solid ${border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
          <div style={{ fontSize: 10, color, opacity: 0.6, marginTop: 2 }}>{sub}</div>
        </div>
        <div style={{ color, opacity: 0.7 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color, letterSpacing: -0.5 }}>
        AED {fmtAED(value)}
      </div>
      <div style={{ fontSize: 11, color, opacity: 0.6, marginTop: 4 }}>
        {count} PO{count !== 1 ? 's' : ''}
      </div>
    </div>
  );

  const POTable = ({ items, emptyMsg, showDelivery }: { items: PO[]; emptyMsg: string; showDelivery: boolean }) => (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ width: 36, textAlign: 'center' }}>Sl.</th>
            <th style={{ width: 110 }}>PO Number</th>
            <th>Vendor</th>
            <th>Items</th>
            <th style={{ width: 95 }}>PO Date</th>
            <th style={{ width: 110 }}>{showDelivery ? 'Received On' : 'Est. Delivery'}</th>
            {!showDelivery && <th style={{ width: 130 }}>Status</th>}
            <th style={{ width: 130, textAlign: 'right' }}>Value (AED)</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={showDelivery ? 7 : 8} style={{ textAlign: 'center', padding: 28, color: '#475569', fontStyle: 'italic' }}>{emptyMsg}</td></tr>
          )}
          {items.map((p, i) => (
            <tr key={p.id || p._id}>
              <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
              <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>{p.poNo || '—'}</td>
              <td style={{ fontWeight: 500, color: '#e2e8f0' }}>{p.vendor || '—'}</td>
              <td style={{ color: '#94a3b8', fontSize: 11 }}>{itemSummary(p.items)}</td>
              <td style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtDate(p.poDate)}</td>
              <td style={{ color: showDelivery ? '#22c55e' : '#f59e0b', whiteSpace: 'nowrap', fontWeight: 600 }}>
                {showDelivery ? fmtDate(p.actualDelivery) : fmtDate(p.estimatedDelivery)}
              </td>
              {!showDelivery && (
                <td>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                    background: `${STATUS_COLOR[p.status] || '#64748b'}22`,
                    color: STATUS_COLOR[p.status] || '#64748b',
                    border: `1px solid ${STATUS_COLOR[p.status] || '#64748b'}44`,
                  }}>
                    {STATUS_LABEL[p.status] || p.status || '—'}
                  </span>
                </td>
              )}
              <td style={{ textAlign: 'right', fontWeight: 800, color: '#22c55e', fontSize: 13 }}>
                {p.totalValue ? `AED ${fmtAED(p.totalValue)}` : '—'}
              </td>
            </tr>
          ))}
          {items.length > 0 && (
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              <td colSpan={showDelivery ? 6 : 7} style={{ textAlign: 'right', fontWeight: 700, color: '#e2e8f0', fontSize: 12 }}>
                Sub-total:
              </td>
              <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#22c55e' }}>
                AED {fmtAED(items.reduce((s, p) => s + (p.totalValue || 0), 0))}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(59,130,246,0.3)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ color: '#64748b', fontSize: 14 }}>Loading purchase data…</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Header ── */}
      <div className="glass-card" style={{ padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>E &amp; I Material Cost Report</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
            Cost of materials received &amp; POs raised — {monthLabel}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Month selector */}
          <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
            className="input-dark" style={{ width: 130, fontSize: 13 }}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          {/* Year selector */}
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
            className="input-dark" style={{ width: 90, fontSize: 13 }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchPOs} disabled={loading}
            className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} /> Refresh
          </button>
          <button onClick={generatePDF} disabled={exporting}
            className="btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileDown size={13} /> {exporting ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <SummaryCard
          label="Materials Received" sub={`Cost used — ${monthLabel}`}
          value={costReceived} count={receivedThisMonth.length}
          color="#22c55e" bg="rgba(34,197,94,0.08)" border="rgba(34,197,94,0.3)"
          icon={<CheckCircle2 size={20} />}
        />
        <SummaryCard
          label="POs Raised This Month" sub="Total value ordered"
          value={costRaised} count={raisedThisMonth.length}
          color="#3b82f6" bg="rgba(59,130,246,0.08)" border="rgba(59,130,246,0.3)"
          icon={<Package size={20} />}
        />
        <SummaryCard
          label="In Transit / Pending" sub="POs not yet received"
          value={costInTransit} count={inTransit.length}
          color="#f59e0b" bg="rgba(245,158,11,0.08)" border="rgba(245,158,11,0.3)"
          icon={<Truck size={20} />}
        />
        <SummaryCard
          label="Total Received YTD" sub={`Full year ${selYear}`}
          value={costYTD} count={receivedYTD.length}
          color="#a78bfa" bg="rgba(139,92,246,0.08)" border="rgba(139,92,246,0.3)"
          icon={<TrendingUp size={20} />}
        />
      </div>

      {/* ── Section 1: Materials Received ── */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle2 size={17} color="#22c55e" />
          <div>
            <span style={{ fontWeight: 700, color: '#22c55e', fontSize: 14 }}>
              Materials Received — {monthLabel}
            </span>
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
              Cost actually used this month
            </span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>{receivedThisMonth.length} PO{receivedThisMonth.length !== 1 ? 's' : ''}</span>
            <span style={{ fontWeight: 800, color: '#22c55e', fontSize: 15 }}>AED {fmtAED(costReceived)}</span>
          </div>
        </div>
        <POTable items={receivedThisMonth} emptyMsg={`No materials received in ${monthLabel}.`} showDelivery={true} />
      </div>

      {/* ── Section 2: POs Raised ── */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 10 }}>
          <Package size={17} color="#3b82f6" />
          <div>
            <span style={{ fontWeight: 700, color: '#3b82f6', fontSize: 14 }}>
              POs Raised — {monthLabel}
            </span>
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
              All purchase orders issued this month
            </span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>{raisedThisMonth.length} PO{raisedThisMonth.length !== 1 ? 's' : ''}</span>
            <span style={{ fontWeight: 800, color: '#3b82f6', fontSize: 15 }}>AED {fmtAED(costRaised)}</span>
          </div>
        </div>
        <POTable items={raisedThisMonth} emptyMsg={`No POs raised in ${monthLabel}.`} showDelivery={false} />
      </div>

      {/* ── Monthly Cost Summary Banner ── */}
      <div style={{
        padding: '20px 28px', borderRadius: 14,
        background: 'linear-gradient(135deg, rgba(34,197,94,0.10), rgba(59,130,246,0.06))',
        border: '1.5px solid rgba(34,197,94,0.3)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14,
      }}>
        <div>
          <div style={{ fontWeight: 700, color: '#22c55e', fontSize: 15 }}>
            Total Cost Used — {monthLabel}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
            Materials received and accepted this month
          </div>
        </div>
        <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Received</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#22c55e' }}>AED {fmtAED(costReceived)}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', alignSelf: 'stretch' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>In Transit</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#f59e0b' }}>AED {fmtAED(costInTransit)}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', alignSelf: 'stretch' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>YTD {selYear}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#a78bfa' }}>AED {fmtAED(costYTD)}</div>
          </div>
        </div>
      </div>

    </div>
  );
}
