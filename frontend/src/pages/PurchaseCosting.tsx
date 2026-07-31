// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { Download, RefreshCw, FileText, AlertCircle, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FollowupRecord {
  id: string;
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

const RFQ_STATUSES  = new Set(['RFQ created', 'Technical Review', 'Quotation Received']);
const PO_STATUSES   = new Set(['PO done', 'Material Not Delivered']);

function fmtAED(n: number) {
  return n.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

async function getLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/logo.svg');
    if (!res.ok) throw new Error();
    const svgText = await res.text();
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    return await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 400; c.height = 100;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 400, 100);
        ctx.drawImage(img, 0, 0, 400, 100);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  } catch { return null; }
}

export default function PurchaseCosting() {
  const [records, setRecords] = useState<FollowupRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecords = async () => {
    try {
      await fetch('/api/health');
      const data = await fetch('/api/purchase-followup').then(r => r.json());
      setRecords(data);
    } catch (e) { console.error('Failed to load costing data', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRecords(); }, []);

  const rfqItems  = useMemo(() => records.filter(r => RFQ_STATUSES.has(r.currentStatus)), [records]);
  const poItems   = useMemo(() => records.filter(r => PO_STATUSES.has(r.currentStatus)), [records]);
  const payItems  = useMemo(() => records.filter(r => r.currentStatus === 'Material Received' && r.paymentStatus !== 'Payment Done'), [records]);

  const rfqTotal   = rfqItems.reduce((s, r) => s + (r.budget || 0), 0);
  const poTotal    = poItems.reduce((s,  r) => s + (r.budget || 0), 0);
  const payTotal   = payItems.reduce((s, r) => s + (r.budget || 0), 0);
  const grandTotal = rfqTotal + poTotal + payTotal;

  const currentMonthYear = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const reportTitle = `GT-E&I-Purchase Report - ${currentMonthYear}`;

  const generatePDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();

    // ── Logo ────────────────────────────────────────────────────────────────
    const logoUrl = await getLogoDataUrl();
    if (logoUrl) {
      doc.addImage(logoUrl, 'PNG', 10, 6, 48, 12);
    } else {
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('GLASS TECHNOLOGY', 12, 14);
    }

    // ── Title ────────────────────────────────────────────────────────────────
    doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(reportTitle, pw / 2, 12, { align: 'center' });

    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Generated: ${fmtDate(new Date().toISOString())}   |   E & I Maintenance Department`,
      pw / 2, 18, { align: 'center' }
    );

    // ── Divider ──────────────────────────────────────────────────────────────
    doc.setDrawColor(203, 213, 225);
    doc.line(10, 21, pw - 10, 21);

    // ── Summary Table ────────────────────────────────────────────────────────
    autoTable(doc, {
      startY: 25,
      margin: { left: 10, right: 10 },
      head: [['#', 'Category', 'Items', 'Estimated Value (AED)']],
      body: [
        ['1', 'RFQ Cost Pending  (Approx. based on Quotation — RFQ Created / Under Review / Quotation Received)', String(rfqItems.length), `AED ${fmtAED(rfqTotal)}`],
        ['2', 'PO Cost Pending  (Purchase Order Placed — Material Not Yet Received)', String(poItems.length), `AED ${fmtAED(poTotal)}`],
        ['3', 'Final PO Payment Pending  (Material Received — Payment Not Yet Done)', String(payItems.length), `AED ${fmtAED(payTotal)}`],
        ['', 'TOTAL E & I VALUE REQUIRED', String(rfqItems.length + poItems.length + payItems.length), `AED ${fmtAED(grandTotal)}`],
      ],
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.row.index === 3) {
          data.cell.styles.fillColor = [15, 23, 42];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize  = 10;
        }
      },
    });

    const sectionCols = ['Sl', 'Item Description', 'PR / RFQ Number', 'Request Date', 'Current Status', 'Budget (AED)'];
    const sectionColStyles = {
      0: { cellWidth: 10, halign: 'center' as const },
      1: { cellWidth: 'auto' as const },
      2: { cellWidth: 40 },
      3: { cellWidth: 28, halign: 'center' as const },
      4: { cellWidth: 38 },
      5: { cellWidth: 32, halign: 'right' as const, fontStyle: 'bold' as const },
    };

    const addSection = (
      title: string, items: FollowupRecord[], headerRgb: [number,number,number]
    ) => {
      const y = (doc as any).lastAutoTable?.finalY ?? 25;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...headerRgb);
      doc.text(title, 10, y + 8);

      if (items.length === 0) {
        doc.setFontSize(9); doc.setFont('helvetica', 'italic');
        doc.setTextColor(150);
        doc.text('No items in this category.', 10, y + 15);
        return;
      }

      autoTable(doc, {
        startY: y + 10,
        margin: { left: 10, right: 10 },
        head: [sectionCols],
        body: items.map((r, i) => [
          String(i + 1),
          r.itemDescription || '—',
          r.prNumber || '—',
          fmtDate(r.requestDate),
          r.currentStatus || '—',
          r.budget ? `AED ${fmtAED(r.budget)}` : '—',
        ]),
        headStyles: { fillColor: headerRgb, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
        bodyStyles:  { fontSize: 8.5 },
        columnStyles: sectionColStyles,
        foot: [[
          '', 'Sub-total', '', '', '',
          `AED ${fmtAED(items.reduce((s, r) => s + (r.budget || 0), 0))}`,
        ]],
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 9 },
      });
    };

    addSection('1. RFQ / Quotation Phase  (Cost Pending — Approx.)',   rfqItems, [30,  64,  175]);
    addSection('2. PO Pending  (Material Not Yet Received)',             poItems,  [180, 83,  9  ]);
    addSection('3. Payment Pending  (Material Received — Not Yet Paid)', payItems, [185, 28,  28 ]);

    // ── Footer ───────────────────────────────────────────────────────────────
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${i} of ${pageCount}   |   ${reportTitle}   |   CONFIDENTIAL`,
        pw / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' }
      );
    }

    doc.save(`GT-EI-Purchase-Report-${new Date().toISOString().slice(0, 7)}.pdf`);
  };

  const card = (
    label: string, amount: number, count: number,
    color: string, bg: string, border: string, icon: React.ReactNode
  ) => (
    <div style={{ padding: '13px 16px', borderRadius: 12, background: bg, border: `1.5px solid ${border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7 }}>
        <div style={{ fontSize: 10.5, color, fontWeight: 600, maxWidth: '75%', lineHeight: 1.4 }}>{label}</div>
        <div style={{ color, opacity: 0.7 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 21, fontWeight: 800, color, letterSpacing: -0.5 }}>
        AED {fmtAED(amount)}
      </div>
      <div style={{ fontSize: 10, color, opacity: 0.7, marginTop: 3 }}>{count} item{count !== 1 ? 's' : ''}</div>
    </div>
  );

  const ItemTable = ({
    items, headerColor, emptyMsg,
  }: { items: FollowupRecord[]; headerColor: string; emptyMsg: string }) => (
    <div style={{ overflow: 'auto' }}>
      <table className="data-table" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ width: 36, textAlign: 'center' }}>Sl.</th>
            <th>Item Description</th>
            <th>PR / RFQ Number</th>
            <th>Request Date</th>
            <th>Status</th>
            <th>Priority</th>
            <th style={{ textAlign: 'right' }}>Budget (AED)</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#475569', fontStyle: 'italic' }}>{emptyMsg}</td></tr>
          )}
          {items.map((r, i) => (
            <tr key={r.id}>
              <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
              <td style={{ fontWeight: 500 }}>{r.itemDescription || '—'}</td>
              <td style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: 11 }}>{r.prNumber || '—'}</td>
              <td style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtDate(r.requestDate)}</td>
              <td>
                <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                  background: `${headerColor}22`, color: headerColor, border: `1px solid ${headerColor}44` }}>
                  {r.currentStatus || '—'}
                </span>
              </td>
              <td style={{ fontSize: 11, color: '#94a3b8' }}>{r.requiredTimeline || '—'}</td>
              <td style={{ textAlign: 'right', fontWeight: 700,
                color: r.budget ? headerColor : '#475569' }}>
                {r.budget ? `AED ${fmtAED(r.budget)}` : '—'}
              </td>
            </tr>
          ))}
          {items.length > 0 && (
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, color: '#e2e8f0', fontSize: 12 }}>
                Sub-total:
              </td>
              <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 13, color: headerColor }}>
                AED {fmtAED(items.reduce((s, r) => s + (r.budget || 0), 0))}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, flexDirection:'column', gap:16 }}>
      <div style={{ width:40, height:40, border:'3px solid rgba(59,130,246,0.3)', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <div style={{ color:'#64748b', fontSize:14 }}>Loading purchase costing…</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div className="glass-card" style={{ padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Purchase Costing — E &amp; I</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{reportTitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={fetchRecords} className="btn-secondary"
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={generatePDF} className="btn-primary"
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={13} /> Download PDF Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {card(
          'RFQ Cost Pending\n(Approx. based on Quotation)',
          rfqTotal, rfqItems.length,
          '#60a5fa', 'rgba(59,130,246,0.08)', 'rgba(59,130,246,0.25)',
          <FileText size={18} />
        )}
        {card(
          'PO Cost Pending\n(Material Not Received)',
          poTotal, poItems.length,
          '#f59e0b', 'rgba(245,158,11,0.08)', 'rgba(245,158,11,0.25)',
          <Clock size={18} />
        )}
        {card(
          'Payment Pending\n(Material Received, Not Paid)',
          payTotal, payItems.length,
          '#ef4444', 'rgba(239,68,68,0.08)', 'rgba(239,68,68,0.25)',
          <AlertCircle size={18} />
        )}
        {card(
          'Total E & I Value Required',
          grandTotal, rfqItems.length + poItems.length + payItems.length,
          '#22c55e', 'rgba(34,197,94,0.08)', 'rgba(34,197,94,0.3)',
          <TrendingUp size={18} />
        )}
      </div>

      {/* Section 1: RFQ Phase */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '13px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={16} color="#60a5fa" />
          <span style={{ fontWeight: 700, color: '#60a5fa', fontSize: 14 }}>
            1. RFQ / Quotation Phase
          </span>
          <span style={{ fontSize: 11, color: '#64748b' }}>— RFQ Created, Under Technical Review, Quotation Received</span>
          <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#60a5fa', fontSize: 13 }}>
            AED {fmtAED(rfqTotal)}
          </span>
        </div>
        <ItemTable items={rfqItems} headerColor="#60a5fa" emptyMsg="No items in RFQ / Quotation phase." />
      </div>

      {/* Section 2: PO Pending */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '13px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={16} color="#f59e0b" />
          <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: 14 }}>
            2. PO Pending
          </span>
          <span style={{ fontSize: 11, color: '#64748b' }}>— PO Done but Material Not Yet Received</span>
          <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#f59e0b', fontSize: 13 }}>
            AED {fmtAED(poTotal)}
          </span>
        </div>
        <ItemTable items={poItems} headerColor="#f59e0b" emptyMsg="No items pending PO delivery." />
      </div>

      {/* Section 3: Payment Pending */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '13px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={16} color="#ef4444" />
          <span style={{ fontWeight: 700, color: '#ef4444', fontSize: 14 }}>
            3. Payment Pending
          </span>
          <span style={{ fontSize: 11, color: '#64748b' }}>— Material Received, Payment Not Yet Completed</span>
          <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#ef4444', fontSize: 13 }}>
            AED {fmtAED(payTotal)}
          </span>
        </div>
        <ItemTable items={payItems} headerColor="#ef4444" emptyMsg="No items awaiting payment." />
      </div>

      {/* Grand Total Banner */}
      <div style={{
        padding: '18px 26px', borderRadius: 14,
        background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(22,163,74,0.06))',
        border: '1.5px solid rgba(34,197,94,0.35)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CheckCircle size={22} color="#22c55e" />
          <div>
            <div style={{ fontWeight: 700, color: '#22c55e', fontSize: 15 }}>Total E &amp; I Purchase Value Required</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {rfqItems.length + poItems.length + payItems.length} items across all phases
            </div>
          </div>
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: '#22c55e', letterSpacing: -1 }}>
          AED {fmtAED(grandTotal)}
        </div>
      </div>

    </div>
  );
}
