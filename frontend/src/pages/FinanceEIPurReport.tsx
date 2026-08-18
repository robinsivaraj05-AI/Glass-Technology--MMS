// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { Download, RefreshCw, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PaymentTransaction {
  id: string;
  date: string;
  amount: number;
  remarks: string;
}

interface FollowupRecord {
  id: string;
  itemDescription: string;
  requestDate: string;
  receivedDate: string;
  currentStatus: string;
  paymentStatus: string;
  budget: number;
  prNumber: string;
  section: string;
  leadTime: string;
  paymentHistory: PaymentTransaction[];
}

// A single payment transaction entry for the report
interface PaymentEntry {
  rec: FollowupRecord;
  tx: PaymentTransaction | null;
  amount: number;
  date: string;
  isFull: boolean;
}

type Period = 'monthly' | 'quarterly' | 'yearly';

const FULL_PAYMENT    = 'Payment Done';
const PARTIAL_PAYMENT = 'Partial Payment Done';
const PAID_STATUSES   = new Set([FULL_PAYMENT, PARTIAL_PAYMENT]);

// loadRecords replaced by API

function fmtAED(n: number) {
  return n.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function periodKey(iso: string, period: Period): string {
  if (!iso) return '__none__';
  const d = new Date(iso);
  const y = d.getFullYear();
  if (period === 'yearly')    return String(y);
  if (period === 'quarterly') return `${y}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
  return `${y}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const Q_LABELS: Record<string, string> = {
  Q1: 'Q1  (Jan – Mar)', Q2: 'Q2  (Apr – Jun)',
  Q3: 'Q3  (Jul – Sep)', Q4: 'Q4  (Oct – Dec)',
};

function periodLabel(key: string, period: Period): string {
  if (key === '__none__') return 'No Date';
  if (period === 'yearly') return key;
  if (period === 'quarterly') {
    const [y, q] = key.split('-');
    return `${Q_LABELS[q] || q}  ${y}`;
  }
  const [y, m] = key.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
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

interface PeriodGroup {
  key: string;
  label: string;
  fullEntries:    PaymentEntry[];
  partialEntries: PaymentEntry[];
  fullAmt:    number;
  partialAmt: number;
  totalAmt:   number;
}

export default function FinanceEIPurReport() {
  const [records,    setRecords]    = useState<FollowupRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [period,     setPeriod]     = useState<Period>('monthly');

  const fetchRecords = async () => {
    setLoading(true);
    try {
      await fetch('/api/health');
      const data = await fetch('/api/purchase-followup').then(r => r.json());
      setRecords(data);
    } catch (e) { console.error('Failed to load finance report data', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRecords(); }, []);

  // Flatten all payment transactions from paid records
  const allEntries = useMemo<PaymentEntry[]>(() => {
    const result: PaymentEntry[] = [];
    records.forEach(r => {
      if (!PAID_STATUSES.has(r.paymentStatus)) return;
      const isFull = r.paymentStatus === FULL_PAYMENT;
      const hist   = r.paymentHistory || [];
      if (hist.length > 0) {
        hist.forEach(tx => result.push({ rec: r, tx, amount: tx.amount, date: tx.date, isFull }));
      } else {
        // No transaction history — fall back to budget as amount, use receivedDate or requestDate
        const d = r.receivedDate || r.requestDate || '';
        result.push({ rec: r, tx: null, amount: r.budget || 0, date: d, isFull });
      }
    });
    return result;
  }, [records]);

  const years = useMemo(() => {
    const s = new Set<string>();
    allEntries.forEach(e => { if (e.date) s.add(new Date(e.date).getFullYear().toString()); });
    return Array.from(s).sort().reverse();
  }, [allEntries]);

  const groups = useMemo<PeriodGroup[]>(() => {
    const map = new Map<string, PaymentEntry[]>();
    allEntries.forEach(e => {
      if (yearFilter !== 'all' && e.date) {
        if (new Date(e.date).getFullYear().toString() !== yearFilter) return;
      }
      const k = periodKey(e.date, period);
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    });
    return Array.from(map.keys()).sort().reverse().map(k => {
      const entries      = map.get(k)!;
      const fullEntries    = entries.filter(e => e.isFull);
      const partialEntries = entries.filter(e => !e.isFull);
      const fullAmt    = fullEntries.reduce((s, e)    => s + e.amount, 0);
      const partialAmt = partialEntries.reduce((s, e) => s + e.amount, 0);
      return { key: k, label: periodLabel(k, period), fullEntries, partialEntries, fullAmt, partialAmt, totalAmt: fullAmt + partialAmt };
    });
  }, [allEntries, yearFilter, period]);

  const grandFull    = groups.reduce((s, g) => s + g.fullAmt,    0);
  const grandPartial = groups.reduce((s, g) => s + g.partialAmt, 0);
  const grandTotal   = grandFull + grandPartial;
  const grandFullCount    = groups.reduce((s, g) => s + g.fullEntries.length,    0);
  const grandPartialCount = groups.reduce((s, g) => s + g.partialEntries.length, 0);

  const currentMonthYear = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const periodCaption = period === 'monthly' ? 'Monthly' : period === 'quarterly' ? 'Quarterly' : 'Yearly';
  const reportTitle   = `GT-E&I-Purchase Report - ${currentMonthYear}`;

  const generatePDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw  = doc.internal.pageSize.getWidth();

    const logoUrl = await getLogoDataUrl();
    if (logoUrl) doc.addImage(logoUrl, 'PNG', 10, 6, 48, 12);
    else {
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 64, 175);
      doc.text('GLASS TECHNOLOGY', 12, 14);
    }

    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
    doc.text(reportTitle, pw / 2, 12, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
    doc.text(`E&I Payment History — ${periodCaption} Report   |   Generated: ${fmtDate(new Date().toISOString())}`, pw / 2, 18, { align: 'center' });
    doc.setDrawColor(203, 213, 225);
    doc.line(10, 21, pw - 10, 21);

    // Summary
    autoTable(doc, {
      startY: 25, margin: { left: 10, right: 10 },
      head: [['Payment Type', 'No. of POs', 'Total Value (AED)']],
      body: [
        ['Full Payment Done',    String(grandFullCount),    `AED ${fmtAED(grandFull)}`],
        ['Partial Payment Done', String(grandPartialCount), `AED ${fmtAED(grandPartial)}`],
        ['GRAND TOTAL PAID',     String(grandFullCount + grandPartialCount), `AED ${fmtAED(grandTotal)}`],
      ],
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30, halign: 'center' as const },
        2: { cellWidth: 50, halign: 'right' as const, fontStyle: 'bold' as const },
      },
      didParseCell: (data) => {
        if (data.row.index === 2) {
          data.cell.styles.fillColor = [15, 23, 42];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    // Period sections
    groups.forEach(g => {
      if (g.fullEntries.length === 0 && g.partialEntries.length === 0) return;
      const allEntries = [...g.fullEntries, ...g.partialEntries];
      const startY     = ((doc as any).lastAutoTable?.finalY ?? 40) + 6;

      autoTable(doc, {
        startY, margin: { left: 10, right: 10 },
        head: [[
          { content: `${g.label}   —   Total Paid: AED ${fmtAED(g.totalAmt)}   (Full: AED ${fmtAED(g.fullAmt)}  |  Partial: AED ${fmtAED(g.partialAmt)})`,
            colSpan: 5, styles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 10 } },
        ], ['Sl', 'Item Description', 'PO / PR Number', 'Payment Date', 'Amount Paid (AED)', 'Type']],
        body: allEntries.map((e, i) => [
          String(i + 1),
          e.rec.itemDescription || '—',
          e.rec.prNumber || '—',
          e.date ? fmtDate(e.date) : '—',
          `AED ${fmtAED(e.amount)}`,
          e.isFull ? 'Full Payment' : 'Partial Payment',
        ]),
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8.5 },
        bodyStyles: { fontSize: 8.5 },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' as const },
          1: { cellWidth: 'auto' as const },
          2: { cellWidth: 40 },
          3: { cellWidth: 28 },
          4: { cellWidth: 36, halign: 'right' as const, fontStyle: 'bold' as const },
          5: { cellWidth: 35 },
        },
        didParseCell: (data) => {
          if (data.column.index === 5 && data.section === 'body') {
            const val = data.cell.raw as string;
            data.cell.styles.textColor = val === 'Full Payment' ? [22, 163, 74] : [168, 85, 247];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        foot: [['', 'Sub-total', '', '', `AED ${fmtAED(g.totalAmt)}`, '']],
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 9 },
      });
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${i} of ${pageCount}   |   ${reportTitle}   |   CONFIDENTIAL`,
        pw / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' }
      );
    }
    doc.save(`GT-EI-Payment-Report-${new Date().toISOString().slice(0, 7)}.pdf`);
  };

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
    background: active ? 'rgba(59,130,246,0.85)' : 'transparent',
    color:      active ? '#fff' : '#64748b',
  });

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, flexDirection:'column', gap:16 }}>
      <div style={{ width:40, height:40, border:'3px solid rgba(59,130,246,0.3)', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <div style={{ color:'#64748b', fontSize:14 }}>Loading finance report…</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div className="glass-card" style={{ padding: '11px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>E &amp; I Purchase Report — Finance</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Payment history · {reportTitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 3, border: '1px solid rgba(255,255,255,0.1)' }}>
            {(['monthly', 'quarterly', 'yearly'] as Period[]).map(p => (
              <button key={p} onClick={() => { setPeriod(p); setExpanded(null); }} style={pillStyle(period === p)}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            className="input-dark" style={{ fontSize: 11, width: 100 }}>
            <option value="all">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={fetchRecords} className="btn-secondary"
            style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={12} /> Refresh
          </button>
          <button onClick={generatePDF} className="btn-primary"
            style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Download size={12} /> Download PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <div style={{ padding: '13px 16px', borderRadius: 12, background: 'rgba(34,197,94,0.08)', border: '1.5px solid rgba(34,197,94,0.28)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <CheckCircle size={16} color="#22c55e" />
            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>Full Payment Done</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>AED {fmtAED(grandFull)}</div>
          <div style={{ fontSize: 10, color: '#22c55e', opacity: 0.7, marginTop: 3 }}>{grandFullCount} PO{grandFullCount !== 1 ? 's' : ''} fully paid</div>
        </div>
        <div style={{ padding: '13px 16px', borderRadius: 12, background: 'rgba(168,85,247,0.08)', border: '1.5px solid rgba(168,85,247,0.28)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <AlertCircle size={16} color="#a855f7" />
            <span style={{ fontSize: 11, color: '#a855f7', fontWeight: 600 }}>Partial Payment Done</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#a855f7' }}>AED {fmtAED(grandPartial)}</div>
          <div style={{ fontSize: 10, color: '#a855f7', opacity: 0.7, marginTop: 3 }}>{grandPartialCount} PO{grandPartialCount !== 1 ? 's' : ''} partially paid</div>
        </div>
        <div style={{ padding: '13px 16px', borderRadius: 12, background: 'rgba(59,130,246,0.08)', border: '1.5px solid rgba(59,130,246,0.28)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <TrendingUp size={16} color="#60a5fa" />
            <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>Total Payment Made</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#60a5fa' }}>AED {fmtAED(grandTotal)}</div>
          <div style={{ fontSize: 10, color: '#60a5fa', opacity: 0.7, marginTop: 3 }}>
            {grandFullCount + grandPartialCount} total payments
          </div>
        </div>
      </div>

      {/* Period sections */}
      {groups.length === 0 && (
        <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
          No payment records found. Update payment status in E&amp;I Purchase Status to "Payment Done" or "Partial Payment Done".
        </div>
      )}

      {groups.map(g => (
        <div key={g.key} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>

          {/* Period header — click to expand */}
          <div
            onClick={() => setExpanded(expanded === g.key ? null : g.key)}
            style={{ padding: '13px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
              background: 'rgba(255,255,255,0.03)', borderBottom: expanded === g.key ? '1px solid rgba(255,255,255,0.07)' : 'none',
              transition: 'background 0.15s' }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', flex: 1 }}>{g.label}</div>

            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              {g.fullAmt > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>Full Payment</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>AED {fmtAED(g.fullAmt)}</div>
                </div>
              )}
              {g.partialAmt > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#a855f7', fontWeight: 600 }}>Partial Payment</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#a855f7' }}>AED {fmtAED(g.partialAmt)}</div>
                </div>
              )}
              <div style={{ textAlign: 'right', minWidth: 110 }}>
                <div style={{ fontSize: 10, color: '#60a5fa', fontWeight: 600 }}>Total Paid</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#60a5fa' }}>AED {fmtAED(g.totalAmt)}</div>
              </div>
              <div style={{ fontSize: 11, color: expanded === g.key ? '#60a5fa' : '#475569', width: 52, textAlign: 'center' }}>
                {expanded === g.key ? '▲ Hide' : '▼ Show'}
              </div>
            </div>
          </div>

          {/* Detail table */}
          {expanded === g.key && (
            <div style={{ overflow: 'auto' }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>Sl.</th>
                    <th>Item Description</th>
                    <th>PO / PR Number</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Payment Date</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Amount Paid</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>PO Total</th>
                    <th>Type</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {[...g.fullEntries, ...g.partialEntries].map((e, i) => (
                    <tr key={`${e.rec.id}-${e.tx?.id ?? 'nohist'}-${i}`}>
                      <td style={{ textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                      <td style={{ fontWeight: 500, color: '#374151' }}>{e.rec.itemDescription || '—'}</td>
                      <td style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: 11 }}>{e.rec.prNumber || '—'}</td>
                      <td style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{e.date ? fmtDate(e.date) : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 13,
                        color: e.isFull ? '#22c55e' : '#a855f7' }}>
                        AED {fmtAED(e.amount)}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 11, color: '#64748b' }}>
                        {e.rec.budget ? `AED ${fmtAED(e.rec.budget)}` : '—'}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: e.isFull ? 'rgba(34,197,94,0.15)' : 'rgba(168,85,247,0.15)',
                          border: `1px solid ${e.isFull ? 'rgba(34,197,94,0.4)' : 'rgba(168,85,247,0.4)'}`,
                          color: e.isFull ? '#22c55e' : '#a855f7',
                        }}>
                          {e.isFull ? '✓ Full' : '◑ Partial'}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: '#64748b' }}>{e.tx?.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, color: '#94a3b8', padding: '9px 14px' }}>
                      Period Total ({g.fullEntries.length + g.partialEntries.length} transaction{g.fullEntries.length + g.partialEntries.length !== 1 ? 's' : ''})
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#60a5fa', padding: '9px 14px' }}>
                      AED {fmtAED(g.totalAmt)}
                    </td>
                    <td colSpan={3} style={{ padding: '9px 14px' }}>
                      <span style={{ fontSize: 10, color: '#64748b' }}>
                        {g.fullEntries.length > 0 && `${g.fullEntries.length} full`}
                        {g.fullEntries.length > 0 && g.partialEntries.length > 0 && '  ·  '}
                        {g.partialEntries.length > 0 && `${g.partialEntries.length} partial`}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* Grand Total */}
      {groups.length > 0 && (
        <div style={{
          padding: '16px 24px', borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(30,64,175,0.06))',
          border: '1.5px solid rgba(59,130,246,0.3)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <TrendingUp size={20} color="#60a5fa" />
            <div>
              <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: 14 }}>
                Grand Total — {periodCaption} Payment Summary
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>AED {fmtAED(grandFull)} full</span>
                {'  ·  '}
                <span style={{ color: '#a855f7', fontWeight: 600 }}>AED {fmtAED(grandPartial)} partial</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#60a5fa', letterSpacing: -1 }}>
            AED {fmtAED(grandTotal)}
          </div>
        </div>
      )}

    </div>
  );
}

