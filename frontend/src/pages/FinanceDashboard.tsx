// @ts-nocheck
import { useState, useCallback } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { DollarSign, Briefcase, Truck, Fuel, TrendingUp, RefreshCw, Filter, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';
import { apiFetch } from '../utils/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OutEntry  { workDate: string; totalCost: number; contractName: string; contractorCompany: string; }
interface EqEntry   { workDate: string; totalCost: number; equipmentName: string; vendorCompany: string; rateType: string; }
interface AccEntry  { entryDate: string; totalCost: number; equipmentName: string; items: { category: string; totalCost: number }[]; }

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt    = (n: number) => n.toLocaleString('en-AE');
const fmtK   = (n: number) => n >= 1000 ? `AED ${(n/1000).toFixed(1)}K` : `AED ${fmt(n)}`;
const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];


function quarterRange(q: number, year: number): [string, string] {
  const s = [[1,1],[4,1],[7,1],[10,1]];
  const e = [[3,31],[6,30],[9,30],[12,31]];
  const p = (n: number) => String(n).padStart(2,'0');
  return [`${year}-${p(s[q-1][0])}-${p(s[q-1][1])}`, `${year}-${p(e[q-1][0])}-${p(e[q-1][1])}`];
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch('/logo.svg');
    if (!res.ok) return null;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    return await new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = 540; cv.height = 108;
        const ctx = cv.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        resolve(cv.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  } catch { return null; }
}

const PIE_COLORS = ['#7c3aed', '#0f766e', '#d97706'];

// ── PDF colours ───────────────────────────────────────────────────────────────
const C_DARK   = [15,  23,  42]  as [number,number,number];
const C_GREEN  = [120, 180, 110]  as [number,number,number];  // header band — mild green
const C_YELLOW = [255, 243, 176]  as [number,number,number];  // total rows — mild yellow
const C_TEAL   = [15, 118, 110]  as [number,number,number];
const C_PURPLE = [124, 58, 237]  as [number,number,number];
const C_AMBER  = [217,119,  6]   as [number,number,number];
const C_RED    = [220, 38,  38]  as [number,number,number];
const C_WHITE  = [255,255,255]   as [number,number,number];
const C_LIGHT  = [248,250,252]   as [number,number,number];

// ── Component ─────────────────────────────────────────────────────────────────
export default function FinanceDashboard() {
  const [periodType, setPeriodType] = useState<'monthly'|'quarterly'|'yearly'|'custom'>('monthly');
  const [month,    setMonth]    = useState(() => new Date().toISOString().slice(0,7));
  const [quarter,  setQuarter]  = useState('1');
  const [year,     setYear]     = useState(new Date().getFullYear());
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');

  const [outRows, setOutRows] = useState<OutEntry[]>([]);
  const [eqRows,  setEqRows]  = useState<EqEntry[]>([]);
  const [accRows, setAccRows] = useState<AccEntry[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [generated,  setGenerated]  = useState(false);

  const getRange = (): [string, string] => {
    if (periodType === 'monthly') {
      const [y, m] = month.split('-').map(Number);
      const last = new Date(y, m, 0).getDate();
      return [`${month}-01`, `${month}-${String(last).padStart(2,'0')}`];
    }
    if (periodType === 'quarterly') return quarterRange(Number(quarter), year);
    if (periodType === 'yearly')    return [`${year}-01-01`, `${year}-12-31`];
    return [fromDate, toDate];
  };

  const periodLabel = () => {
    if (periodType === 'monthly')   return new Date(month+'-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (periodType === 'quarterly') return `Q${quarter} ${year}`;
    if (periodType === 'yearly')    return `Year ${year}`;
    return `${fromDate} → ${toDate}`;
  };

  const handleGenerate = useCallback(async () => {
    const [from, to] = getRange();
    if (!from || !to) { toast.error('Select a valid period'); return; }
    setLoading(true);
    try {
      const p = new URLSearchParams({ from, to, limit: '2000' });
      const [oData, eData, aData] = await Promise.all([
        apiFetch(`/api/outsource?${p}`),
        apiFetch(`/api/equipment-entries?${p}`),
        apiFetch(`/api/accessories?${p}`),
      ]);
      setOutRows(oData.entries ?? []);
      setEqRows(eData.entries ?? []);
      setAccRows(aData.entries ?? []);
      setGenerated(true);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }, [periodType, month, quarter, year, fromDate, toDate]);

  // ── Aggregations ──────────────────────────────────────────────────────────
  const outsourceCost = outRows.reduce((s, r) => s + r.totalCost, 0);
  const equipmentCost = eqRows.reduce((s,  r) => s + r.totalCost, 0);
  const accessoryCost = accRows.reduce((s,  r) => s + r.totalCost, 0);
  const rentalTotal   = equipmentCost + accessoryCost;
  const grandTotal    = outsourceCost + rentalTotal;

  const pieData = [
    { name: 'Outsource Labour', value: outsourceCost },
    { name: 'Equipment Usage',  value: equipmentCost },
    { name: 'Accessories',      value: accessoryCost },
  ].filter(d => d.value > 0);

  const monthTrend = (() => {
    const map: Record<string, { month: string; outsource: number; equipment: number; accessories: number }> = {};
    const add = (dateStr: string, field: 'outsource'|'equipment'|'accessories', cost: number) => {
      const d   = new Date(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const lbl = `${MONTHS[d.getMonth()+1]} ${String(d.getFullYear()).slice(2)}`;
      if (!map[key]) map[key] = { month: lbl, outsource: 0, equipment: 0, accessories: 0 };
      map[key][field] += cost;
    };
    outRows.forEach(r => add(r.workDate,  'outsource',  r.totalCost));
    eqRows.forEach( r => add(r.workDate,  'equipment',  r.totalCost));
    accRows.forEach(r => add(r.entryDate, 'accessories', r.totalCost));
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);
  })();

  const showTrend = monthTrend.length > 1;

  const topContracts = (() => {
    const map: Record<string, { name: string; company: string; entries: number; cost: number }> = {};
    outRows.forEach(r => {
      const k = r.contractName;
      if (!map[k]) map[k] = { name: r.contractName, company: r.contractorCompany, entries: 0, cost: 0 };
      map[k].entries++;
      map[k].cost += r.totalCost;
    });
    return Object.values(map).sort((a,b) => b.cost - a.cost);
  })();

  const topEquipment = (() => {
    const map: Record<string, { name: string; vendor: string; entries: number; cost: number }> = {};
    eqRows.forEach(r => {
      const k = r.equipmentName;
      if (!map[k]) map[k] = { name: r.equipmentName, vendor: r.vendorCompany, entries: 0, cost: 0 };
      map[k].entries++;
      map[k].cost += r.totalCost;
    });
    return Object.values(map).sort((a,b) => b.cost - a.cost);
  })();

  const accByCategory = (() => {
    const map: Record<string, number> = {};
    accRows.forEach(r => r.items?.forEach((it: any) => {
      map[it.category] = (map[it.category] || 0) + (it.totalCost || 0);
    }));
    return Object.entries(map).sort((a,b) => b[1]-a[1]).map(([cat, cost]) => ({ cat, cost }));
  })();

  // ── PDF Export ──────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!generated) { toast.error('Generate the report first'); return; }
    setPdfLoading(true);
    try {
      const logo   = await loadLogoBase64();
      const doc    = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const W      = doc.internal.pageSize.getWidth();
      const period = periodLabel();
      const genOn  = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

      const pct = (v: number) => grandTotal > 0 ? `${Math.round(v/grandTotal*100)}%` : '—';

      // ── header band helper ────────────────────────────────────────────────
      const drawHeader = (pageTitle: string, subtitle: string) => {
        doc.setFillColor(...C_GREEN);
        doc.rect(0, 0, W, 20, 'F');

        if (logo) {
          doc.setFillColor(...C_WHITE);
          doc.roundedRect(W - 58, 2, 54, 16, 2, 2, 'F');
          doc.addImage(logo, 'PNG', W - 56, 3, 50, 14);
        }

        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...C_WHITE);
        doc.text(pageTitle, 10, 9);
        doc.setFontSize(8); doc.setFont('helvetica','normal');
        doc.text(subtitle, 10, 14);
        doc.setFontSize(7);
        doc.text(`Period: ${period}   |   Generated: ${genOn}`, 10, 19);
        doc.setTextColor(0, 0, 0);
      };

      // ─────────────────────────────────────────────────────────────────────
      // PAGE 1 — Summary
      // ─────────────────────────────────────────────────────────────────────
      drawHeader('E&I Department — Costing Report', 'Outsource Labour · Rental Equipment · Accessories');

      // KPI boxes
      const kpis = [
        { label:'Outsource Labour', value:`AED ${fmt(outsourceCost)}`, pct: pct(outsourceCost), col: C_TEAL   },
        { label:'Equipment Usage',  value:`AED ${fmt(equipmentCost)}`, pct: pct(equipmentCost), col: C_PURPLE },
        { label:'Accessories',      value:`AED ${fmt(accessoryCost)}`, pct: pct(accessoryCost), col: C_AMBER  },
        { label:'Grand Total',      value:`AED ${fmt(grandTotal)}`,    pct: '100%',             col: C_RED    },
      ];
      const bw = (W - 20 - 9) / 4;
      kpis.forEach((k, i) => {
        const x = 10 + i * (bw + 3);
        doc.setFillColor(...C_LIGHT); doc.roundedRect(x, 24, bw, 22, 2, 2, 'F');
        doc.setFillColor(...k.col);   doc.roundedRect(x, 24, bw, 3,  2, 2, 'F');
        doc.setFontSize(7);  doc.setFont('helvetica','bold');  doc.setTextColor(...k.col);
        doc.text(k.label.toUpperCase(), x + 4, 32);
        doc.setFontSize(11); doc.setTextColor(0,0,0);
        doc.text(k.value, x + 4, 39);
        doc.setFontSize(8);  doc.setTextColor(100,116,139);
        doc.text(k.pct + ' of total', x + 4, 44);
      });

      // Cost summary table
      doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0);
      doc.text('COST SUMMARY', 10, 52);
      autoTable(doc, {
        startY: 55,
        head: [['Category', 'No. Entries', 'Total Cost (AED)', 'Share of Total']],
        body: [
          ['Outsource Labour', outRows.length, `AED ${fmt(outsourceCost)}`, pct(outsourceCost)],
          ['Equipment Usage',  eqRows.length,  `AED ${fmt(equipmentCost)}`, pct(equipmentCost)],
          ['Accessories',      accRows.length, `AED ${fmt(accessoryCost)}`, pct(accessoryCost)],
          ['GRAND TOTAL',      outRows.length + eqRows.length + accRows.length, `AED ${fmt(grandTotal)}`, '100%'],
        ],
        headStyles: { fillColor: C_DARK, textColor: C_WHITE, fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 2: { fontStyle: 'bold' }, 3: { fontStyle: 'bold' } },
        alternateRowStyles: { fillColor: C_LIGHT },
        didParseCell: (d) => {
          if (d.row.index === 3) {
            d.cell.styles.fillColor = C_YELLOW;
            d.cell.styles.textColor = C_DARK;
            d.cell.styles.fontStyle = 'bold';
          }
        },
        margin: { left: 10, right: 10 },
      });

      // Monthly trend table (if multi-month)
      if (showTrend) {
        const afterSummary = (doc as any).lastAutoTable.finalY + 8;
        doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0);
        doc.text('MONTHLY TREND', 10, afterSummary);
        autoTable(doc, {
          startY: afterSummary + 3,
          head: [['Month', 'Outsource Labour (AED)', 'Equipment Usage (AED)', 'Accessories (AED)', 'Total (AED)']],
          body: monthTrend.map(r => [
            r.month,
            `AED ${fmt(r.outsource)}`,
            `AED ${fmt(r.equipment)}`,
            `AED ${fmt(r.accessories)}`,
            `AED ${fmt(r.outsource + r.equipment + r.accessories)}`,
          ]),
          foot: [[
            'TOTAL',
            `AED ${fmt(outsourceCost)}`,
            `AED ${fmt(equipmentCost)}`,
            `AED ${fmt(accessoryCost)}`,
            `AED ${fmt(grandTotal)}`,
          ]],
          headStyles:   { fillColor: C_DARK,   textColor: C_WHITE, fontSize: 8, fontStyle: 'bold' },
          footStyles:   { fillColor: C_YELLOW, textColor: C_DARK,  fontSize: 8, fontStyle: 'bold' },
          bodyStyles:   { fontSize: 8 },
          alternateRowStyles: { fillColor: C_LIGHT },
          margin: { left: 10, right: 10 },
        });
      }

      // footer
      doc.setFontSize(7); doc.setTextColor(148,163,184);
      doc.text('E&I Department — Confidential', 10, doc.internal.pageSize.getHeight() - 5);
      doc.text('Page 1', W - 20, doc.internal.pageSize.getHeight() - 5);

      // ─────────────────────────────────────────────────────────────────────
      // PAGE 2 — Outsource by Contract
      // ─────────────────────────────────────────────────────────────────────
      doc.addPage();
      drawHeader('Outsource Labour — Contract Breakdown', `Total: AED ${fmt(outsourceCost)}`);

      if (topContracts.length === 0) {
        doc.setFontSize(10); doc.setTextColor(148,163,184);
        doc.text('No outsource data for this period.', 10, 26);
      } else {
        autoTable(doc, {
          startY: 24,
          head: [['#', 'Contract Name', 'Contractor Company', 'Entries', 'Total Cost (AED)', 'Share']],
          body: topContracts.map((c, i) => [
            i + 1, c.name, c.company, c.entries,
            `AED ${fmt(c.cost)}`,
            outsourceCost > 0 ? `${Math.round(c.cost/outsourceCost*100)}%` : '—',
          ]),
          foot: [['', 'TOTAL', '', outRows.length, `AED ${fmt(outsourceCost)}`, '100%']],
          headStyles:   { fillColor: [15,118,110], textColor: C_WHITE,  fontSize: 9, fontStyle: 'bold' },
          footStyles:   { fillColor: C_YELLOW,    textColor: C_DARK,   fontSize: 9, fontStyle: 'bold' },
          bodyStyles:   { fontSize: 9 },
          columnStyles: { 4: { fontStyle: 'bold', textColor: [15,118,110] as [number,number,number] } },
          alternateRowStyles: { fillColor: [240,253,250] as [number,number,number] },
          margin: { left: 10, right: 10 },
        });
      }

      doc.setFontSize(7); doc.setTextColor(148,163,184);
      doc.text('E&I Department — Confidential', 10, doc.internal.pageSize.getHeight() - 5);
      doc.text('Page 2', W - 20, doc.internal.pageSize.getHeight() - 5);

      // ─────────────────────────────────────────────────────────────────────
      // PAGE 3 — Rental Equipment + Accessories
      // ─────────────────────────────────────────────────────────────────────
      doc.addPage();
      drawHeader('Rental Equipment & Accessories — Breakdown', `Equipment: AED ${fmt(equipmentCost)}   |   Accessories: AED ${fmt(accessoryCost)}`);

      doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0);
      doc.text('EQUIPMENT USAGE BY ASSET', 10, 25);
      if (topEquipment.length === 0) {
        doc.setFontSize(9); doc.setTextColor(148,163,184);
        doc.text('No equipment data for this period.', 10, 31);
      } else {
        autoTable(doc, {
          startY: 28,
          head: [['#', 'Equipment Name', 'Vendor / Company', 'Rate Type', 'Entries', 'Total Cost (AED)', 'Share']],
          body: topEquipment.map((e, i) => [
            i + 1, e.name, e.vendor, e.entries,
            equipmentCost > 0 ? `${Math.round(e.cost/equipmentCost*100)}%` : '—',
            `AED ${fmt(e.cost)}`,
            equipmentCost > 0 ? `${Math.round(e.cost/equipmentCost*100)}%` : '—',
          ]),
          foot: [['', 'TOTAL', '', '', eqRows.length, `AED ${fmt(equipmentCost)}`, '100%']],
          headStyles:   { fillColor: [124,58,237], textColor: C_WHITE, fontSize: 8, fontStyle: 'bold' },
          footStyles:   { fillColor: C_YELLOW,    textColor: C_DARK,  fontSize: 8, fontStyle: 'bold' },
          bodyStyles:   { fontSize: 8 },
          columnStyles: { 5: { fontStyle: 'bold', textColor: [124,58,237] as [number,number,number] } },
          alternateRowStyles: { fillColor: [245,243,255] as [number,number,number] },
          margin: { left: 10, right: 10 },
        });
      }

      const afterEq = (doc as any).lastAutoTable?.finalY ?? 80;
      doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0);
      doc.text('ACCESSORIES BY CATEGORY', 10, afterEq + 10);

      if (accByCategory.length === 0) {
        doc.setFontSize(9); doc.setTextColor(148,163,184);
        doc.text('No accessories data for this period.', 10, afterEq + 18);
      } else {
        autoTable(doc, {
          startY: afterEq + 13,
          head: [['#', 'Category', 'Total Cost (AED)', 'Share of Accessories']],
          body: accByCategory.map((it, i) => [
            i + 1, it.cat,
            `AED ${fmt(it.cost)}`,
            accessoryCost > 0 ? `${Math.round(it.cost/accessoryCost*100)}%` : '—',
          ]),
          foot: [['', 'TOTAL', `AED ${fmt(accessoryCost)}`, '100%']],
          headStyles:   { fillColor: [217,119,6], textColor: C_WHITE, fontSize: 9, fontStyle: 'bold' },
          footStyles:   { fillColor: C_YELLOW,   textColor: C_DARK,  fontSize: 9, fontStyle: 'bold' },
          bodyStyles:   { fontSize: 9 },
          columnStyles: { 2: { fontStyle: 'bold', textColor: [217,119,6] as [number,number,number] } },
          alternateRowStyles: { fillColor: [255,251,235] as [number,number,number] },
          margin: { left: 10, right: 10 },
        });
      }

      // Grand total footer band on page 3
      const finalY = Math.min(((doc as any).lastAutoTable?.finalY ?? 150) + 8, doc.internal.pageSize.getHeight() - 20);
      doc.setFillColor(...C_YELLOW); doc.roundedRect(10, finalY, W - 20, 14, 2, 2, 'F');
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...C_DARK);
      doc.text('GRAND TOTAL — All Categories', 16, finalY + 9);
      doc.text(`AED ${fmt(grandTotal)}`, W - 16, finalY + 9, { align: 'right' });

      doc.setFontSize(7); doc.setTextColor(148,163,184);
      doc.text('E&I Department — Confidential', 10, doc.internal.pageSize.getHeight() - 5);
      doc.text('Page 3', W - 20, doc.internal.pageSize.getHeight() - 5);

      // Save
      const fileName = `EI_Costing_${period.replace(/\s|→/g,'_')}.pdf`;
      doc.save(fileName);
      toast.success('PDF exported successfully');
    } catch (e) {
      console.error(e);
      toast.error('PDF generation failed');
    } finally { setPdfLoading(false); }
  };

  // ── UI helpers ────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = { height: 34, padding: '0 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, color: '#1e293b', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 4 };
  const ptBtn = (t: typeof periodType): React.CSSProperties => ({ padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: periodType===t ? 'none' : '1px solid #e2e8f0', background: periodType===t ? '#1e293b' : '#f8fafc', color: periodType===t ? '#fff' : '#64748b' });
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  const sectionHead = (title: string, icon: React.ReactNode) => (
    <div style={{ padding: '7px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 7 }}>
      {icon} {title}
    </div>
  );
  const card = (style?: React.CSSProperties): React.CSSProperties => ({ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden', ...style });

  const TEAL   = '#0f766e';
  const PURPLE = '#7c3aed';
  const AMBER  = '#d97706';

  return (
    <div style={{ padding: '12px 16px', background: '#f8fafc', minHeight: '100vh' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#1e293b,#334155)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TrendingUp size={16} color="#fff"/>
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>E&amp;I Costing Dashboard</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Department-wide cost overview — Outsource Labour · Rental Equipment · Accessories</p>
        </div>
        {generated && (
          <button
            onClick={handleExportPDF}
            disabled={pdfLoading}
            style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 20px', background:'#dc2626', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor: pdfLoading ? 'default':'pointer', opacity: pdfLoading ? 0.7:1 }}
          >
            <FileDown size={15} style={{ animation: pdfLoading ? 'spin 1s linear infinite':'none' }}/> Export PDF
          </button>
        )}
      </div>

      {/* Period Filter */}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '10px 14px', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#1e293b', fontWeight: 700, fontSize: 13 }}>
          <Filter size={14}/> Report Period
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {(['monthly','quarterly','yearly','custom'] as const).map(t => (
            <button key={t} onClick={() => setPeriodType(t)} style={ptBtn(t)}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {periodType === 'monthly' && (
            <div><label style={lbl}>Month</label>
              <input type="month" style={{ ...inp, width: 160 }} value={month} onChange={e => setMonth(e.target.value)}/>
            </div>
          )}
          {periodType === 'quarterly' && (<>
            <div><label style={lbl}>Quarter</label>
              <select style={{ ...inp, width: 130 }} value={quarter} onChange={e => setQuarter(e.target.value)}>
                <option value="1">Q1 (Jan–Mar)</option><option value="2">Q2 (Apr–Jun)</option>
                <option value="3">Q3 (Jul–Sep)</option><option value="4">Q4 (Oct–Dec)</option>
              </select>
            </div>
            <div><label style={lbl}>Year</label>
              <select style={{ ...inp, width: 100 }} value={year} onChange={e => setYear(Number(e.target.value))}>
                {years.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          </>)}
          {periodType === 'yearly' && (
            <div><label style={lbl}>Year</label>
              <select style={{ ...inp, width: 100 }} value={year} onChange={e => setYear(Number(e.target.value))}>
                {years.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          )}
          {periodType === 'custom' && (<>
            <div><label style={lbl}>From</label><input type="date" style={{ ...inp, width: 150 }} value={fromDate} onChange={e => setFromDate(e.target.value)}/></div>
            <div><label style={lbl}>To</label><input type="date" style={{ ...inp, width: 150 }} value={toDate} onChange={e => setToDate(e.target.value)}/></div>
          </>)}

          <button onClick={handleGenerate} disabled={loading} style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 24px', background:'#1e293b', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor: loading ? 'default':'pointer', opacity: loading ? 0.7:1 }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}/> Generate
          </button>
        </div>
      </div>

      {/* Empty state */}
      {!generated ? (
        <div style={{ background:'#fff', borderRadius:8, border:'1px solid #e2e8f0', padding:32, textAlign:'center' }}>
          <TrendingUp size={32} color="#e2e8f0" style={{ marginBottom:8 }}/>
          <div style={{ color:'#94a3b8', fontSize:14, marginBottom:6 }}>Select a period and click Generate</div>
          <div style={{ color:'#cbd5e1', fontSize:12 }}>Shows combined Outsource + Rental Equipment + Accessories costs</div>
        </div>
      ) : (
        <>
          {/* Period label bar */}
          <div style={{ background:'#1e293b', borderRadius:8, padding:'6px 14px', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#f1f5f9' }}>Period: {periodLabel()}</div>
            <div style={{ fontSize:12, color:'#94a3b8' }}>
              {outRows.length} outsource entries · {eqRows.length} equipment entries · {accRows.length} accessory entries
            </div>
          </div>

          {/* KPI Cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:10 }}>
            {[
              { icon:<Briefcase size={15} color={TEAL}/>,    label:'Outsource Labour', value:`AED ${fmt(outsourceCost)}`, sub:`${outRows.length} entries`,                                      color:TEAL,   bg:'#f0fdfa' },
              { icon:<Truck size={15} color={PURPLE}/>,      label:'Equipment Usage',  value:`AED ${fmt(equipmentCost)}`, sub:`${eqRows.length} entries`,                                       color:PURPLE, bg:'#f5f3ff' },
              { icon:<Fuel size={15} color={AMBER}/>,        label:'Accessories',      value:`AED ${fmt(accessoryCost)}`, sub:`${accRows.length} entries`,                                      color:AMBER,  bg:'#fffbeb' },
              { icon:<DollarSign size={15} color='#dc2626'/>,label:'Grand Total',      value:`AED ${fmt(grandTotal)}`,    sub:`${outRows.length+eqRows.length+accRows.length} total entries`,   color:'#dc2626', bg:'#fef2f2' },
            ].map(k => (
              <div key={k.label} style={{ background:'#fff', borderRadius:8, border:'1px solid #e2e8f0', padding:'10px 12px', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:k.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{k.icon}</div>
                <div>
                  <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:0.6, marginBottom:2 }}>{k.label}</div>
                  <div style={{ fontSize:18, fontWeight:800, color:k.color }}>{k.value}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>{k.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 210px', gap:10, marginBottom:10 }}>

            <div style={card()}>
              {sectionHead(showTrend ? 'Monthly Cost Trend' : 'Cost Breakdown by Category', <TrendingUp size={14} color={TEAL}/>)}
              <div style={{ padding:8, height:170 }}>
                {showTrend ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthTrend} margin={{ top:4, right:16, left:0, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="month" tick={{ fontSize:10, fill:'#94a3b8' }}/>
                      <YAxis tickFormatter={v => fmtK(v).replace('AED ','')} tick={{ fontSize:9, fill:'#94a3b8' }}/>
                      <Tooltip formatter={(v: any) => `AED ${fmt(Number(v ?? 0))}`} contentStyle={{ fontSize:11, borderRadius:8 }}/>
                      <Legend wrapperStyle={{ fontSize:11 }}/>
                      <Bar dataKey="outsource"   name="Outsource Labour" stackId="a" fill={TEAL}   radius={[0,0,0,0]}/>
                      <Bar dataKey="equipment"   name="Equipment Usage"  stackId="a" fill={PURPLE} radius={[0,0,0,0]}/>
                      <Bar dataKey="accessories" name="Accessories"      stackId="a" fill={AMBER}  radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name:'Outsource Labour', cost: outsourceCost },
                      { name:'Equipment Usage',  cost: equipmentCost },
                      { name:'Accessories',       cost: accessoryCost },
                    ]} margin={{ top:4, right:16, left:0, bottom:20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="name" tick={{ fontSize:10, fill:'#94a3b8' }} angle={-15} textAnchor="end" height={50}/>
                      <YAxis tickFormatter={v => fmtK(v).replace('AED ','')} tick={{ fontSize:9, fill:'#94a3b8' }}/>
                      <Tooltip formatter={(v: any) => `AED ${fmt(Number(v ?? 0))}`} contentStyle={{ fontSize:11, borderRadius:8 }}/>
                      <Bar dataKey="cost" name="Cost (AED)" radius={[6,6,0,0]}>
                        {[TEAL, PURPLE, AMBER].map((fill, i) => <Cell key={i} fill={fill}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div style={card()}>
              {sectionHead('Cost Split', <DollarSign size={14} color={PURPLE}/>)}
              <div style={{ padding:8, height:170, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                {grandTotal === 0 ? (
                  <div style={{ color:'#94a3b8', fontSize:13 }}>No cost data</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={120}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={34} outerRadius={54} paddingAngle={3} dataKey="value">
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]}/>)}
                        </Pie>
                        <Tooltip formatter={(v: any) => `AED ${fmt(Number(v ?? 0))}`} contentStyle={{ fontSize:11, borderRadius:8 }}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display:'flex', flexDirection:'column', gap:2, width:'100%' }}>
                      {pieData.map((d, i) => (
                        <div key={d.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:11 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:10, height:10, borderRadius:2, background:PIE_COLORS[i], flexShrink:0 }}/>
                            <span style={{ color:'#475569', fontWeight:600 }}>{d.name}</span>
                          </div>
                          <span style={{ fontWeight:700, color:'#1e293b' }}>{grandTotal > 0 ? `${Math.round(d.value/grandTotal*100)}%` : '—'}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Detail tables */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>

            {/* Outsource by contract */}
            <div style={card()}>
              {sectionHead('Outsource by Contract', <Briefcase size={14} color={TEAL}/>)}
              {topContracts.length === 0 ? (
                <div style={{ padding:24, textAlign:'center', color:'#94a3b8', fontSize:12 }}>No outsource data</div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr style={{ background:'#1e293b' }}>
                    {['Contract','Entries','Cost (AED)'].map(h=>(
                      <th key={h} style={{ padding:'5px 8px', textAlign:'left', fontSize:10, fontWeight:700, color:'#f1f5f9', textTransform:'uppercase', letterSpacing:0.5 }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {topContracts.slice(0,6).map((c,i)=>(
                      <tr key={c.name} style={{ borderBottom:'1px solid #f1f5f9', background:i%2===0?'#fff':'#f0fdfa' }}>
                        <td style={{ padding:'4px 8px' }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#0f172a' }}>{c.name}</div>
                          <div style={{ fontSize:10, color:'#64748b' }}>{c.company}</div>
                        </td>
                        <td style={{ padding:'4px 8px', fontSize:13, fontWeight:700, color:'#0f172a', textAlign:'center' }}>{c.entries}</td>
                        <td style={{ padding:'4px 8px', fontSize:13, fontWeight:800, color:TEAL }}>AED {fmt(c.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{ background:'#f0fdfa', borderTop:'2px solid '+TEAL }}>
                    <td colSpan={2} style={{ padding:'4px 8px', fontWeight:700, color:TEAL, fontSize:11 }}>TOTAL</td>
                    <td style={{ padding:'4px 8px', fontWeight:800, color:TEAL, fontSize:13 }}>AED {fmt(outsourceCost)}</td>
                  </tr></tfoot>
                </table>
              )}
            </div>

            {/* Equipment usage */}
            <div style={card()}>
              {sectionHead('Equipment Usage', <Truck size={14} color={PURPLE}/>)}
              {topEquipment.length === 0 ? (
                <div style={{ padding:24, textAlign:'center', color:'#94a3b8', fontSize:12 }}>No equipment data</div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr style={{ background:'#1e293b' }}>
                    {['Equipment','Entries','Cost (AED)'].map(h=>(
                      <th key={h} style={{ padding:'5px 8px', textAlign:'left', fontSize:10, fontWeight:700, color:'#f1f5f9', textTransform:'uppercase', letterSpacing:0.5 }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {topEquipment.slice(0,6).map((e,i)=>(
                      <tr key={e.name} style={{ borderBottom:'1px solid #f1f5f9', background:i%2===0?'#fff':'#f5f3ff' }}>
                        <td style={{ padding:'4px 8px' }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#0f172a' }}>{e.name}</div>
                          <div style={{ fontSize:10, color:'#64748b' }}>{e.vendor}</div>
                        </td>
                        <td style={{ padding:'4px 8px', fontSize:13, fontWeight:700, color:'#0f172a', textAlign:'center' }}>{e.entries}</td>
                        <td style={{ padding:'4px 8px', fontSize:13, fontWeight:800, color:PURPLE }}>AED {fmt(e.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{ background:'#f5f3ff', borderTop:'2px solid '+PURPLE }}>
                    <td colSpan={2} style={{ padding:'4px 8px', fontWeight:700, color:PURPLE, fontSize:11 }}>TOTAL</td>
                    <td style={{ padding:'4px 8px', fontWeight:800, color:PURPLE, fontSize:13 }}>AED {fmt(equipmentCost)}</td>
                  </tr></tfoot>
                </table>
              )}
            </div>

            {/* Accessories by category */}
            <div style={card()}>
              {sectionHead('Accessories by Category', <Fuel size={14} color={AMBER}/>)}
              {accByCategory.length === 0 ? (
                <div style={{ padding:24, textAlign:'center', color:'#94a3b8', fontSize:12 }}>No accessories data</div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr style={{ background:'#1e293b' }}>
                    {['Category','Cost (AED)','Share'].map(h=>(
                      <th key={h} style={{ padding:'5px 8px', textAlign:'left', fontSize:10, fontWeight:700, color:'#f1f5f9', textTransform:'uppercase', letterSpacing:0.5 }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {accByCategory.map((it,i)=>(
                      <tr key={it.cat} style={{ borderBottom:'1px solid #f1f5f9', background:i%2===0?'#fff':'#fffbeb' }}>
                        <td style={{ padding:'4px 8px', fontSize:12, fontWeight:700, color:'#0f172a' }}>{it.cat}</td>
                        <td style={{ padding:'4px 8px', fontSize:13, fontWeight:800, color:AMBER }}>AED {fmt(it.cost)}</td>
                        <td style={{ padding:'4px 8px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ flex:1, height:6, background:'#f1f5f9', borderRadius:3, overflow:'hidden' }}>
                              <div style={{ height:'100%', background:AMBER, width:`${accessoryCost > 0 ? Math.round(it.cost/accessoryCost*100) : 0}%`, borderRadius:3 }}/>
                            </div>
                            <span style={{ fontSize:10, fontWeight:700, color:'#b45309', minWidth:28 }}>
                              {accessoryCost > 0 ? `${Math.round(it.cost/accessoryCost*100)}%` : '—'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{ background:'#fef3c7', borderTop:'2px solid '+AMBER }}>
                    <td style={{ padding:'4px 8px', fontWeight:700, color:AMBER, fontSize:11 }}>TOTAL</td>
                    <td style={{ padding:'4px 8px', fontWeight:800, color:AMBER, fontSize:13 }}>AED {fmt(accessoryCost)}</td>
                    <td/>
                  </tr></tfoot>
                </table>
              )}
            </div>
          </div>

          {/* Grand total banner */}
          <div style={{ marginTop:8, background:'linear-gradient(135deg,#1e293b,#334155)', borderRadius:8, padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
            <div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', fontWeight:600, textTransform:'uppercase', letterSpacing:1 }}>Grand Total — All Categories Combined</div>
              <div style={{ fontSize:22, fontWeight:900, color:'#fff', marginTop:2 }}>AED {fmt(grandTotal)}</div>
            </div>
            <div style={{ display:'flex', gap:16 }}>
              {[
                { label:'Outsource',   value:outsourceCost, color:'#5eead4' },
                { label:'Equipment',   value:equipmentCost, color:'#a78bfa' },
                { label:'Accessories', value:accessoryCost, color:'#fcd34d' },
              ].map(s => (
                <div key={s.label} style={{ textAlign:'right' }}>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', fontWeight:600, textTransform:'uppercase', letterSpacing:0.6 }}>{s.label}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:s.color }}>AED {fmt(s.value)}</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>
                    {grandTotal > 0 ? `${Math.round(s.value/grandTotal*100)}%` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
