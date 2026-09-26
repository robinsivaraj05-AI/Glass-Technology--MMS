// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, CheckCircle2, Truck, TrendingUp, Package, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FollowupRecord {
  id: string;
  _id: string;
  section: string;
  itemDescription: string;
  requestDate: string;
  currentStatus: string;
  paymentStatus: string;
  budget: number;
  prNumber: string;
  leadTime: string;
  requiredTimeline: string;
}

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

// statuses that mean a PO has been raised (includes Payment Done — fully completed items)
const PO_DONE_STATUSES = new Set(['PO done', 'Partially Received', 'Material Received', 'Payment Done']);
// statuses that mean material has actually been received (cost used)
const RECEIVED_STATUSES = new Set(['Material Received', 'Payment Done']);

function fmtAED(n: number) {
  return (n || 0).toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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

export default function PurchaseCosting() {
  const now = new Date();
  const [records, setRecords]     = useState<FollowupRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selMonth, setSelMonth]   = useState(now.getMonth() + 1);
  const [selYear, setSelYear]     = useState(now.getFullYear());
  const [viewMode, setViewMode]   = useState<'monthly' | 'yearly'>('monthly');
  const [exporting, setExporting] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await fetch('/api/purchase-followup').then(r => r.json());
      setRecords(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Failed to load data', e); setRecords([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRecords(); }, []);

  // Materials RECEIVED in selected month (Material Received OR Payment Done — both mean material arrived)
  const receivedThisMonth = useMemo(() =>
    records.filter(r => RECEIVED_STATUSES.has(r.currentStatus) && inMonth(r.requestDate, selYear, selMonth)),
    [records, selYear, selMonth]
  );

  // PO raised in selected month (PO done + in-transit + received)
  const poThisMonth = useMemo(() =>
    records.filter(r => PO_DONE_STATUSES.has(r.currentStatus) && inMonth(r.requestDate, selYear, selMonth)),
    [records, selYear, selMonth]
  );

  // Still in transit (PO done but material not received yet)
  const inTransit = useMemo(() =>
    records.filter(r =>
      (r.currentStatus === 'PO done' || r.currentStatus === 'Partially Received') &&
      inMonth(r.requestDate, selYear, selMonth)
    ),
    [records, selYear, selMonth]
  );

  // All received this year — YTD (Material Received OR Payment Done)
  const receivedYTD = useMemo(() =>
    records.filter(r =>
      RECEIVED_STATUSES.has(r.currentStatus) &&
      new Date(r.requestDate).getFullYear() === selYear
    ),
    [records, selYear]
  );

  const costReceived  = receivedThisMonth.reduce((s, r) => s + (r.budget || 0), 0);
  const costPO        = poThisMonth.reduce((s, r) => s + (r.budget || 0), 0);
  const costInTransit = inTransit.reduce((s, r) => s + (r.budget || 0), 0);
  const costYTD       = receivedYTD.reduce((s, r) => s + (r.budget || 0), 0);

  // Total budget across ALL records (any status, any date) — matches Purchase Followup total
  const totalBudgetAll = useMemo(() =>
    records.reduce((s, r) => s + (r.budget || 0), 0),
    [records]
  );

  // Carry-over: items from BEFORE selYear that are still not received
  const carryOver = useMemo(() =>
    records.filter(r => {
      if (!r.requestDate) return false;
      return new Date(r.requestDate).getFullYear() < selYear && !RECEIVED_STATUSES.has(r.currentStatus);
    }),
    [records, selYear]
  );
  const carryOverBudg  = carryOver.reduce((s, r) => s + (r.budget || 0), 0);
  const carryOverPO    = carryOver.filter(r => PO_DONE_STATUSES.has(r.currentStatus));
  const carryOverTran  = carryOver.filter(r => r.currentStatus === 'PO done' || r.currentStatus === 'Partially Received');
  const prevYear       = selYear - 1;

  // Yearly breakdown — one row per month
  const yearlyRows = useMemo(() =>
    MONTHS.map((name, i) => {
      const m = i + 1;
      const recv = records.filter(r => RECEIVED_STATUSES.has(r.currentStatus) && inMonth(r.requestDate, selYear, m));
      const po   = records.filter(r => PO_DONE_STATUSES.has(r.currentStatus) && inMonth(r.requestDate, selYear, m));
      const tran = records.filter(r => (r.currentStatus === 'PO done' || r.currentStatus === 'Partially Received') && inMonth(r.requestDate, selYear, m));
      const budg = records.filter(r => inMonth(r.requestDate, selYear, m) && (r.budget || 0) > 0);
      return {
        month: name,
        recvCount: recv.length,
        recvCost:  recv.reduce((s, r) => s + (r.budget || 0), 0),
        poCount:   po.length,
        poCost:    po.reduce((s, r) => s + (r.budget || 0), 0),
        tranCount: tran.length,
        tranCost:  tran.reduce((s, r) => s + (r.budget || 0), 0),
        budgCount: budg.length,
        budgCost:  budg.reduce((s, r) => s + (r.budget || 0), 0),
      };
    }),
    [records, selYear]
  );

  const monthLabel = `${MONTHS[selMonth - 1]} ${selYear}`;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  // ── PDF ───────────────────────────────────────────────────────────────────────
  const generatePDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pw = doc.internal.pageSize.getWidth();

      // Header band
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pw, 30, 'F');
      doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(241, 245, 249);
      doc.text('E & I Material Cost Report', pw / 2, 12, { align: 'center' });
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
      doc.text(`${monthLabel}   ·   E & I Maintenance Department   ·   Generated: ${fmtDate(new Date().toISOString())}`, pw / 2, 20, { align: 'center' });

      // Summary strip
      autoTable(doc, {
        startY: 34,
        margin: { left: 10, right: 10 },
        head: [['Materials Received (Cost Used)', 'POs Raised This Month', 'In Transit / Pending', 'Total Received YTD']],
        body: [[
          `AED ${fmtAED(costReceived)}\n${receivedThisMonth.length} item${receivedThisMonth.length !== 1 ? 's' : ''}`,
          `AED ${fmtAED(costPO)}\n${poThisMonth.length} item${poThisMonth.length !== 1 ? 's' : ''}`,
          `AED ${fmtAED(costInTransit)}\n${inTransit.length} item${inTransit.length !== 1 ? 's' : ''}`,
          `AED ${fmtAED(costYTD)}\n${receivedYTD.length} items`,
        ]],
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8.5, halign: 'center' },
        bodyStyles: { fontSize: 10, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { textColor: [34, 197, 94] }, 1: { textColor: [59, 130, 246] },
          2: { textColor: [245, 158, 11] }, 3: { textColor: [139, 92, 246] },
        },
      });

      const cols = ['Sl', 'Item Description', 'PR / PO Number', 'Request Date', 'Status', 'Budget (AED)'];
      const colStyles = {
        0: { cellWidth: 8, halign: 'center' as const },
        1: { cellWidth: 'auto' as const },
        2: { cellWidth: 36 },
        3: { cellWidth: 26, halign: 'center' as const },
        4: { cellWidth: 36 },
        5: { cellWidth: 32, halign: 'right' as const, fontStyle: 'bold' as const },
      };

      const addSection = (title: string, items: FollowupRecord[], rgb: [number,number,number]) => {
        const y = (doc as any).lastAutoTable.finalY + 6;
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.setTextColor(...rgb);
        doc.text(title, 10, y + 6);
        if (!items.length) {
          doc.setFontSize(8.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(148, 163, 184);
          doc.text('No items for this period.', 10, y + 13);
          return;
        }
        autoTable(doc, {
          startY: y + 9,
          margin: { left: 10, right: 10 },
          head: [cols],
          body: items.map((r, i) => [
            i + 1,
            r.itemDescription || '—',
            r.prNumber || '—',
            fmtDate(r.requestDate),
            r.currentStatus || '—',
            r.budget ? `AED ${fmtAED(r.budget)}` : '—',
          ]),
          foot: [['', 'Total', '', '', '', `AED ${fmtAED(items.reduce((s, r) => s + (r.budget || 0), 0))}`]],
          headStyles: { fillColor: rgb, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
          bodyStyles: { fontSize: 8.5 },
          footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 9 },
          columnStyles: colStyles,
        });
      };

      addSection(`1.  Materials Received — ${monthLabel}  (Cost Used)`, receivedThisMonth, [20, 120, 60]);
      addSection(`2.  POs Raised — ${monthLabel}  (All PO issued this month)`,  poThisMonth,        [30, 64,  175]);

      // Page numbers
      const pages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pages}   ·   E & I Material Cost Report — ${monthLabel}`, pw / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
      }

      doc.save(`EI-Material-Cost-${selYear}-${String(selMonth).padStart(2, '0')}.pdf`);
    } finally { setExporting(false); }
  };

  // ── Sub-components ────────────────────────────────────────────────────────────
  const SummaryCard = ({ label, sub, value, count, color, bg, border, icon }: any) => (
    <div style={{ padding: '16px 20px', borderRadius: 14, background: bg, border: `1.5px solid ${border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
          <div style={{ fontSize: 10, color, opacity: 0.6, marginTop: 2 }}>{sub}</div>
        </div>
        <div style={{ color, opacity: 0.7 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: -0.5 }}>AED {fmtAED(value)}</div>
      <div style={{ fontSize: 11, color, opacity: 0.6, marginTop: 4 }}>{count} item{count !== 1 ? 's' : ''}</div>
    </div>
  );

  const ItemTable = ({ items, emptyMsg, received }: { items: FollowupRecord[]; emptyMsg: string; received: boolean }) => (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ width: 36, textAlign: 'center' }}>Sl.</th>
            <th>Item Description</th>
            <th style={{ width: 130 }}>PR / PO Number</th>
            <th style={{ width: 110 }}>Request Date</th>
            <th style={{ width: 150 }}>Status</th>
            <th style={{ width: 140, textAlign: 'right' }}>Budget (AED)</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: '#475569', fontStyle: 'italic' }}>{emptyMsg}</td></tr>
          )}
          {items.map((r, i) => (
            <tr key={r.id || r._id}>
              <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
              <td style={{ fontWeight: 500, color: '#374151' }}>{r.itemDescription || '—'}</td>
              <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>{r.prNumber || '—'}</td>
              <td style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtDate(r.requestDate)}</td>
              <td>
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                  background: received ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                  color: received ? '#22c55e' : '#f59e0b',
                  border: `1px solid ${received ? 'rgba(34,197,94,0.4)' : 'rgba(245,158,11,0.4)'}`,
                }}>
                  {r.currentStatus || '—'}
                </span>
              </td>
              <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 13, color: received ? '#22c55e' : '#f1f5f9' }}>
                {r.budget ? `AED ${fmtAED(r.budget)}` : '—'}
              </td>
            </tr>
          ))}
          {items.length > 0 && (
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, color: '#374151', fontSize: 12 }}>Sub-total:</td>
              <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 14, color: received ? '#22c55e' : '#3b82f6' }}>
                AED {fmtAED(items.reduce((s, r) => s + (r.budget || 0), 0))}
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
      <div style={{ color: '#64748b', fontSize: 14 }}>Loading cost data…</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div className="glass-card" style={{ padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>E &amp; I Material Cost Report</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Cost of materials received &amp; POs raised — {monthLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Monthly / Yearly toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3, gap: 2 }}>
            {(['monthly', 'yearly'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)} style={{
                padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: viewMode === v ? '#3b82f6' : 'transparent',
                color: viewMode === v ? '#fff' : '#64748b',
                transition: 'all 0.15s',
              }}>
                {v === 'monthly' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
          {viewMode === 'monthly' && (
            <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
              className="input-dark" style={{ width: 130, fontSize: 13 }}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          )}
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
            className="input-dark" style={{ width: 90, fontSize: 13 }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchRecords} disabled={loading} className="btn-secondary"
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} /> Refresh
          </button>
          <button onClick={generatePDF} disabled={exporting} className="btn-primary"
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileDown size={13} /> {exporting ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <SummaryCard
          label="Materials Received" sub={`Cost used — ${monthLabel}`}
          value={costReceived} count={receivedThisMonth.length}
          color="#22c55e" bg="rgba(34,197,94,0.08)" border="rgba(34,197,94,0.3)"
          icon={<CheckCircle2 size={20} />}
        />
        <SummaryCard
          label="POs Raised This Month" sub="Total value ordered"
          value={costPO} count={poThisMonth.length}
          color="#3b82f6" bg="rgba(59,130,246,0.08)" border="rgba(59,130,246,0.3)"
          icon={<Package size={20} />}
        />
        <SummaryCard
          label="In Transit / Pending" sub="PO done, not yet received"
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

      {/* ── YEARLY VIEW ── */}
      {viewMode === 'yearly' && (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <TrendingUp size={17} color="#a78bfa" />
            <span style={{ fontWeight: 700, color: '#a78bfa', fontSize: 14 }}>Year Overview — {selYear}</span>
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>Monthly cost breakdown for all 12 months</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 28, alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 1 }}>Total Budget (All Items)</div>
                <div style={{ fontWeight: 800, color: '#f59e0b', fontSize: 15 }}>AED {fmtAED(totalBudgetAll)}</div>
              </div>
              <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 1 }}>YTD Received</div>
                <div style={{ fontWeight: 800, color: '#22c55e', fontSize: 15 }}>AED {fmtAED(costYTD)}</div>
              </div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: 'center' }}>Sl.</th>
                  <th style={{ width: 130 }}>Month</th>
                  <th style={{ textAlign: 'center', width: 70 }}>Items</th>
                  <th style={{ textAlign: 'right', width: 150, color: '#fbbf24' }}>Budget (AED)</th>
                  <th style={{ textAlign: 'center', width: 70 }}>Recv.</th>
                  <th style={{ textAlign: 'right', width: 150 }}>Cost Used (AED)</th>
                  <th style={{ textAlign: 'center', width: 70 }}>PO Items</th>
                  <th style={{ textAlign: 'right', width: 150 }}>PO Value (AED)</th>
                  <th style={{ textAlign: 'center', width: 70 }}>Transit</th>
                  <th style={{ textAlign: 'right', width: 150 }}>Transit Value (AED)</th>
                </tr>
              </thead>
              <tbody>
                {/* Carry-over row — pending POs from previous year(s) */}
                {carryOver.length > 0 && (
                  <tr style={{ background: 'rgba(251,191,36,0.07)', borderBottom: '2px solid rgba(251,191,36,0.25)' }}>
                    <td style={{ textAlign: 'center', color: '#fbbf24', fontWeight: 800 }}>↩</td>
                    <td style={{ fontWeight: 800, color: '#fbbf24', fontSize: 12 }}>
                      Carry Over
                      <span style={{ fontSize: 9, marginLeft: 6, background: 'rgba(251,191,36,0.2)', color: '#fbbf24', borderRadius: 4, padding: '1px 6px' }}>
                        Pending from ≤{prevYear}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#fbbf24' }}>{carryOver.length}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 13, color: '#fbbf24' }}>
                      AED {fmtAED(carryOverBudg)}
                    </td>
                    <td style={{ textAlign: 'center', color: '#475569' }}>—</td>
                    <td style={{ textAlign: 'right', color: '#475569' }}>—</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: carryOverPO.length > 0 ? '#3b82f6' : '#475569' }}>
                      {carryOverPO.length > 0 ? carryOverPO.length : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 13, color: carryOverPO.length > 0 ? '#3b82f6' : '#475569' }}>
                      {carryOverPO.length > 0 ? `AED ${fmtAED(carryOverPO.reduce((s, r) => s + (r.budget || 0), 0))}` : '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: carryOverTran.length > 0 ? '#f59e0b' : '#475569' }}>
                      {carryOverTran.length > 0 ? carryOverTran.length : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 13, color: carryOverTran.length > 0 ? '#f59e0b' : '#475569' }}>
                      {carryOverTran.length > 0 ? `AED ${fmtAED(carryOverTran.reduce((s, r) => s + (r.budget || 0), 0))}` : '—'}
                    </td>
                  </tr>
                )}
                {yearlyRows.map((row, i) => {
                  const isCurrentMonth = i + 1 === now.getMonth() + 1 && selYear === now.getFullYear();
                  const hasData = row.recvCount > 0 || row.poCount > 0;
                  return (
                    <tr key={row.month} style={{ background: isCurrentMonth ? 'rgba(59,130,246,0.08)' : undefined }}>
                      <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                      <td style={{ fontWeight: 700, color: isCurrentMonth ? '#60a5fa' : '#e2e8f0' }}>
                        {row.month}
                        {isCurrentMonth && <span style={{ fontSize: 9, color: '#60a5fa', marginLeft: 6, background: 'rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 5px' }}>Current</span>}
                      </td>
                      <td style={{ textAlign: 'center', color: row.budgCount > 0 ? '#fbbf24' : '#475569', fontWeight: row.budgCount > 0 ? 700 : 400 }}>
                        {row.budgCount > 0 ? row.budgCount : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: row.budgCost > 0 ? 800 : 400, fontSize: row.budgCost > 0 ? 13 : 12, color: row.budgCost > 0 ? '#fbbf24' : '#475569' }}>
                        {row.budgCost > 0 ? `AED ${fmtAED(row.budgCost)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'center', color: row.recvCount > 0 ? '#22c55e' : '#475569', fontWeight: row.recvCount > 0 ? 700 : 400 }}>
                        {row.recvCount > 0 ? row.recvCount : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: row.recvCost > 0 ? 800 : 400, fontSize: row.recvCost > 0 ? 13 : 12, color: row.recvCost > 0 ? '#22c55e' : '#475569' }}>
                        {row.recvCost > 0 ? `AED ${fmtAED(row.recvCost)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'center', color: row.poCount > 0 ? '#3b82f6' : '#475569', fontWeight: row.poCount > 0 ? 700 : 400 }}>
                        {row.poCount > 0 ? row.poCount : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: row.poCost > 0 ? 800 : 400, fontSize: row.poCost > 0 ? 13 : 12, color: row.poCost > 0 ? '#3b82f6' : '#475569' }}>
                        {row.poCost > 0 ? `AED ${fmtAED(row.poCost)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'center', color: row.tranCount > 0 ? '#f59e0b' : '#475569', fontWeight: row.tranCount > 0 ? 700 : 400 }}>
                        {row.tranCount > 0 ? row.tranCount : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: row.tranCost > 0 ? 800 : 400, fontSize: row.tranCost > 0 ? 13 : 12, color: row.tranCost > 0 ? '#f59e0b' : '#475569' }}>
                        {row.tranCost > 0 ? `AED ${fmtAED(row.tranCost)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700, color: '#374151', fontSize: 12, padding: '10px 14px' }}>
                    Year Total {selYear}:
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#fbbf24' }}>
                    {yearlyRows.reduce((s, r) => s + r.budgCount, 0) + carryOver.length}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#fbbf24', padding: '10px 14px' }}>
                    AED {fmtAED(yearlyRows.reduce((s, r) => s + r.budgCost, 0) + carryOverBudg)}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#22c55e' }}>
                    {yearlyRows.reduce((s, r) => s + r.recvCount, 0)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#22c55e', padding: '10px 14px' }}>
                    AED {fmtAED(yearlyRows.reduce((s, r) => s + r.recvCost, 0))}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#3b82f6' }}>
                    {yearlyRows.reduce((s, r) => s + r.poCount, 0) + carryOverPO.length}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#3b82f6', padding: '10px 14px' }}>
                    AED {fmtAED(yearlyRows.reduce((s, r) => s + r.poCost, 0) + carryOverPO.reduce((s, r) => s + (r.budget || 0), 0))}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#f59e0b' }}>
                    {yearlyRows.reduce((s, r) => s + r.tranCount, 0) + carryOverTran.length}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#f59e0b', padding: '10px 14px' }}>
                    AED {fmtAED(yearlyRows.reduce((s, r) => s + r.tranCost, 0) + carryOverTran.reduce((s, r) => s + (r.budget || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── MONTHLY VIEW ── */}
      {viewMode === 'monthly' && <>

      {/* Section 1 — Materials Received */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle2 size={17} color="#22c55e" />
          <div>
            <span style={{ fontWeight: 700, color: '#22c55e', fontSize: 14 }}>Materials Received — {monthLabel}</span>
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>Cost actually used this month</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>{receivedThisMonth.length} item{receivedThisMonth.length !== 1 ? 's' : ''}</span>
            <span style={{ fontWeight: 800, color: '#22c55e', fontSize: 16 }}>AED {fmtAED(costReceived)}</span>
          </div>
        </div>
        <ItemTable items={receivedThisMonth} emptyMsg={`No materials received in ${monthLabel}.`} received={true} />
      </div>

      {/* Section 2 — POs Raised */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Package size={17} color="#3b82f6" />
          <div>
            <span style={{ fontWeight: 700, color: '#3b82f6', fontSize: 14 }}>POs Raised — {monthLabel}</span>
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>All purchase orders issued this month</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>{poThisMonth.length} item{poThisMonth.length !== 1 ? 's' : ''}</span>
            <span style={{ fontWeight: 800, color: '#3b82f6', fontSize: 16 }}>AED {fmtAED(costPO)}</span>
          </div>
        </div>
        <ItemTable items={poThisMonth} emptyMsg={`No POs raised in ${monthLabel}.`} received={false} />
      </div>

      {/* end monthly */}
      </>}

      {/* Cost Summary Banner */}
      <div style={{
        padding: '20px 28px', borderRadius: 14,
        background: 'linear-gradient(135deg, rgba(34,197,94,0.10), rgba(59,130,246,0.06))',
        border: '1.5px solid rgba(34,197,94,0.3)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14,
      }}>
        <div>
          <div style={{ fontWeight: 700, color: '#22c55e', fontSize: 15 }}>Total Cost Used — {monthLabel}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>Materials received and accepted this month</div>
        </div>
        <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
          {[
            { label: 'Received', value: costReceived, color: '#22c55e' },
            { label: 'In Transit', value: costInTransit, color: '#f59e0b' },
            { label: `YTD ${selYear}`, value: costYTD, color: '#a78bfa' },
          ].map((item, i, arr) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>AED {fmtAED(item.value)}</div>
              </div>
              {i < arr.length - 1 && <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.1)' }} />}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

