import { useState, useCallback, useEffect } from 'react';
import { FileSpreadsheet, FileDown, Filter, RefreshCw, Truck, DollarSign, FileText, ChevronDown, ChevronRight, Fuel, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../utils/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface EquipOption { _id: string; equipmentName: string; vendorCompany: string; equipmentType: string; }

interface EquipEntry {
  _id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentType: string;
  vendorCompany: string;
  workDate: string;
  poNumber: string;
  department: string;
  area: string;
  operatorName: string;
  workingHours: number;
  overtimeHours: number;
  otRatePercent: number;
  workDescription: string;
  maintenanceType: string;
  rateType: 'Daily' | 'Hourly' | 'Monthly';
  rate: number;
  regularCost: number;
  otCost: number;
  totalCost: number;
  completionStatus: string;
  approvedBy: string;
  remarks: string;
}

interface AccessItem { itemName: string; category: string; unit: string; quantity: number; unitRate: number; totalCost: number; }

interface AccessEntry {
  _id: string;
  entryDate: string;
  equipmentName: string;
  poNumber: string;
  department: string;
  area: string;
  items: AccessItem[];
  totalCost: number;
  approvedBy: string;
  remarks: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt   = (n: number) => n.toLocaleString('en-AE');
const fmtD  = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtS  = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });


function quarterRange(q: number, year: number): [string, string] {
  const s = [[1,1],[4,1],[7,1],[10,1]];
  const e = [[3,31],[6,30],[9,30],[12,31]];
  const p = (n: number) => String(n).padStart(2,'0');
  return [`${year}-${p(s[q-1][0])}-${p(s[q-1][1])}`, `${year}-${p(e[q-1][0])}-${p(e[q-1][1])}`];
}

// Load logo SVG and convert to PNG base64 via canvas (for PDF embedding)
async function loadLogoBase64(): Promise<string | null> {
  try {
    const resp = await fetch('/logo.svg');
    const svgText = await resp.text();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const blobUrl = URL.createObjectURL(blob);
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 540; canvas.height = 108;
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(blobUrl); resolve(null); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 540, 108);
        ctx.drawImage(img, 0, 0, 540, 108);
        URL.revokeObjectURL(blobUrl);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null); };
      img.src = blobUrl;
    });
  } catch { return null; }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RentalReport() {
  const [periodType, setPeriodType] = useState<'monthly'|'quarterly'|'yearly'|'custom'>('monthly');
  const [month,    setMonth]    = useState(() => new Date().toISOString().slice(0,7));
  const [quarter,  setQuarter]  = useState('1');
  const [year,     setYear]     = useState(new Date().getFullYear());
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');

  const [equipOptions, setEquipOptions] = useState<EquipOption[]>([]);
  const [selectedEquipId, setSelectedEquipId] = useState('');

  const [equipRows,  setEquipRows]  = useState<EquipEntry[]>([]);
  const [accessRows, setAccessRows] = useState<AccessEntry[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [generated,  setGenerated]  = useState(false);
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch('/api/equipment/active').then(setEquipOptions).catch(() => {});
  }, []);

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
    return `${fromDate} to ${toDate}`;
  };

  const selectedEquip = equipOptions.find(e => e._id === selectedEquipId);

  const handleGenerate = async () => {
    const [from, to] = getRange();
    if (!from || !to) { toast.error('Select a valid period'); return; }
    setLoading(true);
    try {
      const p = new URLSearchParams({ from, to, limit: '1000' });
      if (selectedEquipId) p.set('equipmentId', selectedEquipId);
      const [eData, aData] = await Promise.all([
        apiFetch(`/api/equipment-entries?${p}`),
        apiFetch(`/api/accessories?${p}`),
      ]);
      setEquipRows(eData.entries ?? []);
      setAccessRows(aData.entries ?? []);
      setGenerated(true);
      setExpanded(new Set());
      const total = (eData.entries?.length ?? 0) + (aData.entries?.length ?? 0);
      if (total === 0) toast('No records for this period', { icon: 'ℹ️' });
      else toast.success(`${eData.entries?.length ?? 0} equipment entries + ${aData.entries?.length ?? 0} accessory entries loaded`);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  // ── Aggregations ──────────────────────────────────────────────────────────
  const equipCostTotal  = equipRows.reduce((s, r) => s + r.totalCost, 0);
  const accessCostTotal = accessRows.reduce((s, r) => s + r.totalCost, 0);
  const grandTotal      = equipCostTotal + accessCostTotal;
  const totalWorkHours  = equipRows.reduce((s, r) => s + (r.workingHours || 0), 0);
  const totalOTHours    = equipRows.reduce((s, r) => s + (r.overtimeHours || 0), 0);

  // Equipment-wise breakdown
  const equipGroups = (() => {
    const map: Record<string, { name: string; type: string; vendor: string; entries: EquipEntry[]; totalCost: number; totalHours: number; totalOT: number }> = {};
    equipRows.forEach(r => {
      const k = r.equipmentName;
      if (!map[k]) map[k] = { name: r.equipmentName, type: r.equipmentType, vendor: r.vendorCompany, entries: [], totalCost: 0, totalHours: 0, totalOT: 0 };
      map[k].entries.push(r);
      map[k].totalCost  += r.totalCost;
      map[k].totalHours += r.workingHours || 0;
      map[k].totalOT    += r.overtimeHours || 0;
    });
    return Object.values(map).sort((a,b) => b.totalCost - a.totalCost);
  })();

  // Accessory item summary
  const itemSummary = (() => {
    const map: Record<string, { itemName: string; category: string; unit: string; totalQty: number; totalCost: number }> = {};
    accessRows.forEach(r => r.items.forEach(it => {
      const k = `${it.itemName}__${it.unit}`;
      if (!map[k]) map[k] = { itemName: it.itemName, category: it.category, unit: it.unit, totalQty: 0, totalCost: 0 };
      map[k].totalQty  += it.quantity;
      map[k].totalCost += it.totalCost;
    }));
    return Object.values(map).sort((a,b) => b.totalCost - a.totalCost);
  })();

  const toggleExpand = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Export Excel ──────────────────────────────────────────────────────────
  const exportExcel = async () => {
    const xlsx = await import('xlsx');
    const label = periodLabel();
    const equipLabel = selectedEquip ? selectedEquip.equipmentName : 'All Equipment';
    const wb = xlsx.utils.book_new();

    // Summary sheet
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([
      ['E&I DEPARTMENT — RENTAL EQUIPMENT COST REPORT'],
      ['Equipment:', equipLabel],
      ['Period:', label],
      ['Generated:', new Date().toLocaleString('en-GB')],
      [],
      ['SUMMARY'],
      ['Total Equipment Entries', equipRows.length],
      ['Total Working Hours', totalWorkHours],
      ['Total OT Hours', totalOTHours],
      ['Equipment Cost (AED)', equipCostTotal],
      ['Accessories Cost (AED)', accessCostTotal],
      ['GRAND TOTAL (AED)', grandTotal],
      [],
      ['EQUIPMENT-WISE BREAKDOWN'],
      ['Equipment', 'Type', 'Vendor', 'Entries', 'Working Hrs', 'OT Hrs', 'Cost (AED)'],
      ...equipGroups.map(g => [g.name, g.type, g.vendor, g.entries.length, g.totalHours, g.totalOT, g.totalCost]),
      [],
      ['ACCESSORIES SUMMARY'],
      ['Item', 'Category', 'Unit', 'Total Qty', 'Total Cost (AED)'],
      ...itemSummary.map(it => [it.itemName, it.category, it.unit, it.totalQty, it.totalCost]),
    ]), 'Summary');

    // Equipment Entries detail
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([
      ['Date','Equipment','Type','Vendor','Operator','PO No.','Area','Hrs','OT Hrs','Rate Type','Rate (AED)','Regular Cost','OT Cost','Total Cost (AED)','Status'],
      ...equipRows.map(r => [
        fmtD(r.workDate), r.equipmentName, r.equipmentType, r.vendorCompany,
        r.operatorName || '', r.poNumber || '', r.area || '',
        r.workingHours, r.overtimeHours, r.rateType, r.rate,
        r.regularCost, r.otCost, r.totalCost, r.completionStatus,
      ]),
      [],
      ['', '', '', '', '', '', 'TOTAL', totalWorkHours, totalOTHours, '', '', '', '', equipCostTotal, ''],
    ]), 'Equipment Entries');

    // Accessories detail
    const accRows: any[][] = [['Date','Equipment','PO No.','Area','Item','Category','Qty','Unit','Unit Rate (AED)','Item Total (AED)','Entry Total (AED)']];
    accessRows.forEach(r => r.items.forEach((it, i) => {
      accRows.push([
        i === 0 ? fmtD(r.entryDate) : '',
        i === 0 ? (r.equipmentName || '') : '',
        i === 0 ? (r.poNumber || '') : '',
        i === 0 ? (r.area || '') : '',
        it.itemName, it.category, it.quantity, it.unit, it.unitRate, it.totalCost,
        i === 0 ? r.totalCost : '',
      ]);
    }));
    accRows.push([], ['', '', '', '', '', '', '', '', 'TOTAL', '', accessCostTotal]);
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(accRows), 'Accessories');

    xlsx.writeFile(wb, `Rental_Report_${equipLabel.replace(/[^a-zA-Z0-9]/g,'_')}_${label.replace(/\s+/g,'_')}.xlsx`);
    toast.success('Excel exported');
  };

  // ── Export PDF ────────────────────────────────────────────────────────────
  const exportPDF = async () => {
    const jsPDF    = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
    const logoB64  = await loadLogoBase64();
    const label    = periodLabel();
    const equipLabel   = selectedEquip ? selectedEquip.equipmentName : 'All Equipment';
    const vendorLabel  = selectedEquip ? selectedEquip.vendorCompany : '(Multiple Vendors)';
    const today    = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const PURPLE   = [124, 58, 237] as [number, number, number];
    const DARK     = [30,  41,  59] as [number, number, number];
    const LIGHT_P  = [245, 243, 255] as [number, number, number];

    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();

    const drawPageHeader = (title: string, subtitle: string) => {
      // Purple header band
      doc.setFillColor(...PURPLE);
      doc.rect(0, 0, W, 36, 'F');
      // Logo box (white background at right)
      if (logoB64) {
        doc.setFillColor(255, 255, 255);
        doc.rect(W - 76, 2, 74, 32, 'F');
        doc.addImage(logoB64, 'PNG', W - 74, 5, 70, 14, undefined, 'FAST');
      }
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text(title, 14, 14);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(subtitle, 14, 21);
      doc.text(`Generated: ${today}`, 14, 28);
    };

    // ── PAGE 1 ─────────────────────────────────────────────────────────────
    drawPageHeader('RENTAL EQUIPMENT COST REPORT', 'E&I Department — Finance Submission');

    // Info block
    doc.setFillColor(...LIGHT_P);
    doc.rect(0, 36, W, 24, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('EQUIPMENT:', 14, 45);
    doc.text('VENDOR:', 14, 52);
    doc.setFont('helvetica', 'normal');
    doc.text(equipLabel, 50, 45);
    doc.text(vendorLabel, 50, 52);
    doc.setFont('helvetica', 'bold');
    doc.text('PERIOD:', W/2, 45);
    doc.text('TOTAL COST:', W/2, 52);
    doc.setFont('helvetica', 'normal');
    doc.text(label, W/2 + 28, 45);
    doc.setTextColor(...PURPLE);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(`AED ${fmt(grandTotal)}`, W/2 + 28, 52);

    // KPI strip
    doc.setFontSize(8); doc.setTextColor(100,116,139); doc.setFont('helvetica', 'normal');
    doc.text(
      `Equipment Entries: ${equipRows.length}   |   Working Hrs: ${totalWorkHours}h   |   OT Hrs: ${totalOTHours}h   |   Equipment Cost: AED ${fmt(equipCostTotal)}   |   Accessories: AED ${fmt(accessCostTotal)}`,
      14, 66
    );

    // Equipment-wise breakdown
    let startY = 72;
    if (equipGroups.length > 0) {
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...PURPLE);
      doc.text('EQUIPMENT-WISE COST BREAKDOWN', 14, startY);
      startY += 4;
      autoTable(doc, {
        startY,
        head: [['Equipment Name', 'Type', 'Vendor', 'Entries', 'Working Hrs', 'OT Hrs', 'Total Cost (AED)']],
        body: equipGroups.map(g => [g.name, g.type, g.vendor, g.entries.length, `${g.totalHours}h`, g.totalOT > 0 ? `${g.totalOT}h` : '—', `AED ${fmt(g.totalCost)}`]),
        foot: [['TOTAL', '', '', equipRows.length, `${totalWorkHours}h`, `${totalOTHours}h`, `AED ${fmt(equipCostTotal)}`]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: DARK },
        footStyles: { fillColor: LIGHT_P, textColor: PURPLE, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 248, 255] },
        columnStyles: { 6: { fontStyle: 'bold', textColor: PURPLE } },
        margin: { left: 14, right: 14 }, theme: 'grid',
      });
      startY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Accessories summary
    if (itemSummary.length > 0 && startY < doc.internal.pageSize.getHeight() - 50) {
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(217, 119, 6);
      doc.text('ACCESSORIES & CONSUMABLES SUMMARY', 14, startY);
      startY += 4;
      autoTable(doc, {
        startY,
        head: [['Item', 'Category', 'Unit', 'Total Qty', 'Total Cost (AED)']],
        body: itemSummary.map(it => [it.itemName, it.category, it.unit, it.totalQty.toLocaleString('en-AE'), `AED ${fmt(it.totalCost)}`]),
        foot: [['TOTAL', '', '', '', `AED ${fmt(accessCostTotal)}`]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 29, 20] },
        footStyles: { fillColor: [255, 251, 235], textColor: [217,119,6], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 253, 245] },
        columnStyles: { 4: { fontStyle: 'bold', textColor: [217,119,6] } },
        margin: { left: 14, right: 14 }, theme: 'grid',
      });
    }

    // Signature lines on page 1
    const sigY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 16 : startY + 16;
    if (sigY < doc.internal.pageSize.getHeight() - 25) {
      doc.setDrawColor(203,213,225); doc.setLineWidth(0.3);
      doc.line(14, sigY, 90, sigY);
      doc.line(W - 90, sigY, W - 14, sigY);
      doc.setFontSize(8); doc.setTextColor(100,116,139); doc.setFont('helvetica','normal');
      doc.text('Prepared by (E&I Dept.)', 14, sigY + 5);
      doc.text('Approved by (Finance)', W - 90, sigY + 5);
    }

    // ── PAGE 2: Detailed Equipment Entries ────────────────────────────────
    if (equipRows.length > 0) {
      doc.addPage();
      drawPageHeader('DETAILED EQUIPMENT USAGE RECORDS', `${equipLabel} — ${label}`);

      const detailBody: (string|number)[][] = equipRows.map(r => [
        fmtS(r.workDate),
        r.equipmentName,
        r.vendorCompany,
        r.poNumber || '—',
        r.maintenanceType,
        r.operatorName || '—',
        `${r.workingHours}h`,
        r.overtimeHours > 0 ? `${r.overtimeHours}h` : '—',
        r.rateType,
        `AED ${r.rate}/${r.rateType === 'Daily' ? 'day' : r.rateType === 'Hourly' ? 'hr' : 'mo'}`,
        `AED ${fmt(r.totalCost)}`,
        r.completionStatus,
      ]);

      autoTable(doc, {
        startY: 42,
        head: [['Date','Equipment','Vendor','PO No.','Work Type','Operator','Hrs','OT','Rate Type','Rate','Cost (AED)','Status']],
        body: detailBody,
        foot: [['','','','','','',`${totalWorkHours}h`,`${totalOTHours}h`,'','TOTAL',`AED ${fmt(equipCostTotal)}`,'']],
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: DARK },
        footStyles: { fillColor: LIGHT_P, textColor: PURPLE, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 248, 255] },
        columnStyles: { 10: { fontStyle: 'bold', textColor: PURPLE } },
        margin: { left: 14, right: 14 }, theme: 'grid',
      });
    }

    // ── PAGE 3: Accessories Detail ────────────────────────────────────────
    if (accessRows.length > 0) {
      doc.addPage();
      drawPageHeader('ACCESSORIES & CONSUMABLES DETAILS', `${equipLabel} — ${label}`);

      const accBody: (string|number)[][] = [];
      accessRows.forEach(r => r.items.forEach((it, i) => {
        accBody.push([
          i === 0 ? fmtS(r.entryDate) : '',
          i === 0 ? (r.equipmentName || '—') : '',
          i === 0 ? (r.poNumber || '—') : '',
          it.itemName, it.category, it.quantity, it.unit,
          `AED ${it.unitRate}`, `AED ${fmt(it.totalCost)}`,
          i === 0 ? `AED ${fmt(r.totalCost)}` : '',
        ]);
      }));

      autoTable(doc, {
        startY: 42,
        head: [['Date','Equipment','PO No.','Item','Category','Qty','Unit','Rate/Unit','Item Total','Entry Total']],
        body: accBody,
        foot: [['','','','','','','','TOTAL','',`AED ${fmt(accessCostTotal)}`]],
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [80, 60, 10] },
        footStyles: { fillColor: [255, 251, 235], textColor: [217,119,6], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 253, 245] },
        columnStyles: { 9: { fontStyle: 'bold', textColor: [217,119,6] } },
        margin: { left: 14, right: 14 }, theme: 'grid',
      });
    }

    // Page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(148,163,184); doc.setFont('helvetica','normal');
      doc.text(`Page ${i} of ${pageCount}  —  E&I Dept. Rental Equipment Report  —  ${label}`, W/2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
    }

    doc.save(`Rental_Report_${equipLabel.replace(/[^a-zA-Z0-9]/g,'_')}_${label.replace(/\s+/g,'_')}.pdf`);
    toast.success('PDF saved — ready to send to Finance');
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = { height: 34, padding: '0 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, color: '#1e293b', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 4 };
  const ptBtn = (t: typeof periodType) => ({ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: periodType===t ? 'none' : '1px solid #e2e8f0', background: periodType===t ? '#7c3aed' : '#f8fafc', color: periodType===t ? '#fff' : '#64748b' } as React.CSSProperties);
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  const categoryColor: Record<string, { bg: string; color: string }> = {
    Fuel:       { bg: '#fef9c3', color: '#a16207' },
    Lubricant:  { bg: '#dbeafe', color: '#1d4ed8' },
    Electrical: { bg: '#fce7f3', color: '#9d174d' },
    Water:      { bg: '#cffafe', color: '#164e63' },
    Chemical:   { bg: '#f0fdf4', color: '#15803d' },
    Other:      { bg: '#f1f5f9', color: '#475569' },
  };

  return (
    <div style={{ padding: '20px 24px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={20} color="#fff"/>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Rental Equipment Cost Report</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Equipment usage + accessories cost report for finance submission</p>
        </div>
        {generated && (equipRows.length > 0 || accessRows.length > 0) && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={exportExcel} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'#16a34a', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
              <FileSpreadsheet size={14}/> Excel
            </button>
            <button onClick={exportPDF} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px', background:'#dc2626', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
              <FileDown size={14}/> Export PDF
            </button>
          </div>
        )}
      </div>

      {/* Filter Panel */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: '#7c3aed', fontWeight: 700, fontSize: 13 }}>
          <Filter size={14}/> Report Filters
        </div>

        {/* Equipment selector chips */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ ...lbl, color: '#7c3aed', fontSize: 12 }}>Select Equipment</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setSelectedEquipId('')} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: selectedEquipId==='' ? 'none' : '1px solid #e2e8f0', background: selectedEquipId==='' ? '#0f172a' : '#f8fafc', color: selectedEquipId==='' ? '#fff' : '#64748b' }}>
              All Equipment
            </button>
            {equipOptions.map(eq => (
              <button key={eq._id} onClick={() => setSelectedEquipId(eq._id)}
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: selectedEquipId===eq._id ? 700 : 500, cursor: 'pointer', border: selectedEquipId===eq._id ? 'none' : '1px solid #e2e8f0', background: selectedEquipId===eq._id ? '#7c3aed' : '#f8fafc', color: selectedEquipId===eq._id ? '#fff' : '#475569', maxWidth: 220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                title={`${eq.equipmentName} — ${eq.vendorCompany}`}>
                {eq.equipmentName}
                {selectedEquipId===eq._id && <span style={{ fontSize: 10, opacity: 0.8 }}> ({eq.vendorCompany})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Period */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Period</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['monthly','quarterly','yearly','custom'] as const).map(t => (
              <button key={t} onClick={() => setPeriodType(t)} style={ptBtn(t)}>
                {t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {periodType === 'monthly' && (
              <div><label style={lbl}>Month</label><input type="month" style={{ ...inp, width: 160 }} value={month} onChange={e => setMonth(e.target.value)}/></div>
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
            <button onClick={handleGenerate} disabled={loading} style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 22px', background:'#7c3aed', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor: loading ? 'default':'pointer', opacity: loading ? 0.7:1 }}>
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}/> Generate Report
            </button>
          </div>
        </div>
      </div>

      {/* Output */}
      {!generated ? (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:60, textAlign:'center' }}>
          <Truck size={48} color="#e2e8f0" style={{ marginBottom:12 }}/>
          <div style={{ color:'#94a3b8', fontSize:14, marginBottom:6 }}>Select equipment and period, then click Generate Report</div>
          <div style={{ color:'#cbd5e1', fontSize:12 }}>Covers both equipment usage hours and accessories/consumables cost</div>
        </div>
      ) : equipRows.length === 0 && accessRows.length === 0 ? (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:60, textAlign:'center', color:'#94a3b8' }}>No records found for this period.</div>
      ) : (
        <>
          {/* KPI strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, marginBottom:16 }}>
            {[
              { icon:<Truck size={15} color="#7c3aed"/>,        label:'Equipment Entries', value: equipRows.length,              color:'#7c3aed' },
              { icon:<Clock size={15} color="#0f766e"/>,        label:'Working Hours',     value: `${totalWorkHours}h`,          color:'#0f766e' },
              { icon:<Clock size={15} color="#b45309"/>,        label:'OT Hours',          value: `${totalOTHours}h`,            color:'#b45309' },
              { icon:<DollarSign size={15} color="#7c3aed"/>,   label:'Equipment Cost',    value:`AED ${fmt(equipCostTotal)}`,   color:'#7c3aed' },
              { icon:<Fuel size={15} color="#d97706"/>,         label:'Accessories Cost',  value:`AED ${fmt(accessCostTotal)}`,  color:'#d97706' },
              { icon:<DollarSign size={15} color="#dc2626"/>,   label:'Grand Total',       value:`AED ${fmt(grandTotal)}`,       color:'#dc2626' },
            ].map(k => (
              <div key={k.label} style={{ background:'#fff', borderRadius:10, border:'1px solid #e2e8f0', padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{k.icon}</div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:9, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{k.label}</div>
                  <div style={{ fontSize:14, fontWeight:800, color:k.color, whiteSpace:'nowrap' }}>{k.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Period + Equipment header */}
          <div style={{ background:'#f5f3ff', border:'1px solid #c4b5fd', borderRadius:10, padding:'10px 16px', marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#7c3aed' }}>
              {selectedEquip ? `${selectedEquip.equipmentName} — ${selectedEquip.vendorCompany}` : `All Equipment (${equipGroups.length} types)`}
            </div>
            <div style={{ fontSize:12, color:'#475569', fontWeight:600 }}>Period: {periodLabel()}</div>
          </div>

          {/* Equipment-wise breakdown */}
          {equipGroups.length > 0 && (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', marginBottom:14, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9', fontSize:13, fontWeight:700, color:'#1e293b', display:'flex', alignItems:'center', gap:6 }}>
                <Truck size={14} color="#7c3aed"/> Equipment Usage Breakdown
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr style={{ background:'#1e293b' }}>
                    {['Equipment','Type','Vendor','Entries','Working Hrs','OT Hrs','Total Cost (AED)'].map(h=>(
                      <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#f1f5f9', textTransform:'uppercase', letterSpacing:0.5 }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {equipGroups.map((g,i)=>(
                      <tr key={g.name} style={{ borderBottom:'1px solid #e2e8f0', background:i%2===0?'#fff':'#f5f3ff' }}>
                        <td style={{ padding:'10px 12px', fontWeight:700, color:'#0f172a', fontSize:13 }}>{g.name}</td>
                        <td style={{ padding:'10px 12px', fontSize:12, color:'#374151' }}>{g.type}</td>
                        <td style={{ padding:'10px 12px', fontSize:12, color:'#374151' }}>{g.vendor}</td>
                        <td style={{ padding:'10px 12px', fontSize:14, fontWeight:800, textAlign:'center', color:'#0f172a' }}>{g.entries.length}</td>
                        <td style={{ padding:'10px 12px', fontSize:13, fontWeight:600, textAlign:'center', color:'#0f766e' }}>{g.totalHours}h</td>
                        <td style={{ padding:'10px 12px', fontSize:13, fontWeight:600, textAlign:'center', color: g.totalOT>0?'#b45309':'#94a3b8' }}>{g.totalOT>0?`${g.totalOT}h`:'—'}</td>
                        <td style={{ padding:'10px 12px', fontSize:14, fontWeight:800, color:'#7c3aed' }}>AED {fmt(g.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{ background:'#f5f3ff', borderTop:'2px solid #7c3aed' }}>
                    <td colSpan={3} style={{ padding:'10px 12px', fontWeight:700, color:'#7c3aed', fontSize:12 }}>EQUIPMENT TOTAL</td>
                    <td style={{ padding:'10px 12px', fontWeight:800, color:'#7c3aed', fontSize:14, textAlign:'center' }}>{equipRows.length}</td>
                    <td style={{ padding:'10px 12px', fontWeight:800, color:'#7c3aed', fontSize:14, textAlign:'center' }}>{totalWorkHours}h</td>
                    <td style={{ padding:'10px 12px', fontWeight:800, color:'#7c3aed', fontSize:14, textAlign:'center' }}>{totalOTHours>0?`${totalOTHours}h`:'—'}</td>
                    <td style={{ padding:'10px 12px', fontWeight:800, color:'#7c3aed', fontSize:15 }}>AED {fmt(equipCostTotal)}</td>
                  </tr></tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Accessories summary */}
          {itemSummary.length > 0 && (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', marginBottom:14, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9', fontSize:13, fontWeight:700, color:'#1e293b', display:'flex', alignItems:'center', gap:6 }}>
                <Fuel size={14} color="#d97706"/> Accessories & Consumables — {accessRows.length} entries, {itemSummary.length} item types
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr style={{ background:'#1e293b' }}>
                    {['Item','Category','Total Qty','Unit','Total Cost (AED)'].map(h=>(
                      <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#f1f5f9', textTransform:'uppercase', letterSpacing:0.5 }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {itemSummary.map((it,i)=>(
                      <tr key={it.itemName+it.unit} style={{ borderBottom:'1px solid #e2e8f0', background:i%2===0?'#fff':'#fffbeb' }}>
                        <td style={{ padding:'10px 12px', fontWeight:700, color:'#0f172a', fontSize:13 }}>{it.itemName}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:10, ...(categoryColor[it.category]||categoryColor.Other) }}>{it.category}</span>
                        </td>
                        <td style={{ padding:'10px 12px', fontSize:14, fontWeight:700, color:'#0f172a' }}>{it.totalQty.toLocaleString('en-AE')}</td>
                        <td style={{ padding:'10px 12px', fontSize:12, color:'#374151' }}>{it.unit}</td>
                        <td style={{ padding:'10px 12px', fontSize:14, fontWeight:800, color:'#d97706' }}>AED {fmt(it.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{ background:'#fef3c7', borderTop:'2px solid #d97706' }}>
                    <td colSpan={4} style={{ padding:'10px 12px', fontWeight:700, color:'#d97706', fontSize:12 }}>ACCESSORIES TOTAL</td>
                    <td style={{ padding:'10px 12px', fontWeight:800, color:'#d97706', fontSize:15 }}>AED {fmt(accessCostTotal)}</td>
                  </tr></tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Detailed Equipment Entries — collapsible */}
          {equipRows.length > 0 && (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden', marginBottom:14 }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9', fontSize:13, fontWeight:700, color:'#1e293b', display:'flex', alignItems:'center', gap:6 }}>
                <FileText size={14} color="#7c3aed"/> Equipment Work Records — {equipRows.length} entries
                <span style={{ marginLeft:'auto', fontSize:11, color:'#94a3b8', fontWeight:400 }}>Click a row to expand details</span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr style={{ background:'#1e293b' }}>
                    {['','Date','Equipment','Vendor','Operator','Hrs','OT','Rate','Total (AED)','Status'].map(h=>(
                      <th key={h} style={{ padding:'10px 10px', textAlign:'left', fontSize:11, fontWeight:700, color:'#f1f5f9', textTransform:'uppercase', letterSpacing:0.5, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {equipRows.map((r,i)=>{
                      const isOpen = expanded.has(r._id);
                      return (
                        <>
                          <tr key={r._id} onClick={()=>toggleExpand(r._id)} style={{ borderBottom: isOpen?'none':'1px solid #e2e8f0', background:i%2===0?'#fff':'#f5f3ff', cursor:'pointer' }}>
                            <td style={{ padding:'9px 10px', color:'#94a3b8' }}>{isOpen?<ChevronDown size={13}/>:<ChevronRight size={13}/>}</td>
                            <td style={{ padding:'9px 10px', fontSize:12, fontWeight:600, color:'#334155', whiteSpace:'nowrap' }}>{fmtS(r.workDate)}</td>
                            <td style={{ padding:'9px 10px' }}>
                              <div style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>{r.equipmentName}</div>
                              <div style={{ fontSize:10, color:'#7c3aed' }}>{r.equipmentType}</div>
                            </td>
                            <td style={{ padding:'9px 10px', fontSize:12, color:'#374151' }}>{r.vendorCompany}</td>
                            <td style={{ padding:'9px 10px', fontSize:12, color:'#334155' }}>{r.operatorName||'—'}</td>
                            <td style={{ padding:'9px 10px', fontSize:13, fontWeight:600, color:'#0f766e' }}>{r.workingHours}h</td>
                            <td style={{ padding:'9px 10px', fontSize:13, fontWeight:600, color:r.overtimeHours>0?'#b45309':'#94a3b8' }}>{r.overtimeHours>0?`${r.overtimeHours}h OT`:'—'}</td>
                            <td style={{ padding:'9px 10px', fontSize:12, color:'#374151' }}>
                              <span style={{ fontSize:10, fontWeight:600, color:'#7c3aed', background:'#ede9fe', padding:'1px 5px', borderRadius:6 }}>{r.rateType}</span>
                              {' '}AED {r.rate}
                            </td>
                            <td style={{ padding:'9px 10px', fontSize:14, fontWeight:800, color:'#7c3aed', whiteSpace:'nowrap' }}>AED {fmt(r.totalCost)}</td>
                            <td style={{ padding:'9px 10px' }}>
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:10, background: r.completionStatus==='Completed'?'#dcfce7':r.completionStatus==='In Progress'?'#dbeafe':'#fef9c3', color: r.completionStatus==='Completed'?'#15803d':r.completionStatus==='In Progress'?'#1d4ed8':'#a16207' }}>
                                {r.completionStatus}
                              </span>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr key={`${r._id}_exp`} style={{ background:'#f5f3ff', borderBottom:'2px solid #c4b5fd' }}>
                              <td colSpan={10} style={{ padding:'10px 16px 14px 40px' }}>
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px 24px', fontSize:11, color:'#475569' }}>
                                  {r.area && <div><strong>Area:</strong> {r.area}</div>}
                                  {r.poNumber && <div><strong>PO:</strong> {r.poNumber}</div>}
                                  {r.maintenanceType && <div><strong>Work Type:</strong> {r.maintenanceType}</div>}
                                  {r.approvedBy && <div><strong>Approved By:</strong> {r.approvedBy}</div>}
                                  {r.regularCost > 0 && <div><strong>Regular Cost:</strong> AED {fmt(r.regularCost)}</div>}
                                  {r.otCost > 0 && <div><strong>OT Cost:</strong> AED {fmt(r.otCost)} ({r.otRatePercent}%)</div>}
                                </div>
                                {r.workDescription && <div style={{ marginTop:6, fontSize:11, color:'#64748b' }}><strong>Work Description:</strong> {r.workDescription}</div>}
                                {r.remarks && <div style={{ marginTop:4, fontSize:11, color:'#94a3b8' }}><strong>Remarks:</strong> {r.remarks}</div>}
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                  <tfoot><tr style={{ background:'#f5f3ff', borderTop:'2px solid #7c3aed' }}>
                    <td colSpan={8} style={{ padding:'10px 10px', fontWeight:700, color:'#7c3aed', fontSize:12 }}>PERIOD TOTAL</td>
                    <td style={{ padding:'10px 10px', fontWeight:800, color:'#7c3aed', fontSize:15, whiteSpace:'nowrap' }}>AED {fmt(equipCostTotal)}</td>
                    <td/>
                  </tr></tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Grand Total banner */}
          <div style={{ background:'linear-gradient(135deg,#7c3aed,#a855f7)', borderRadius:12, padding:'16px 22px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', fontWeight:600, textTransform:'uppercase', letterSpacing:0.8 }}>Grand Total — Equipment + Accessories</div>
              <div style={{ fontSize:28, fontWeight:900, color:'#fff' }}>AED {fmt(grandTotal)}</div>
            </div>
            <div style={{ textAlign:'right', fontSize:12, color:'rgba(255,255,255,0.8)' }}>
              <div>Equipment: AED {fmt(equipCostTotal)}</div>
              <div>Accessories: AED {fmt(accessCostTotal)}</div>
              <div style={{ marginTop:4, fontWeight:700, color:'#fff' }}>{periodLabel()}</div>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
