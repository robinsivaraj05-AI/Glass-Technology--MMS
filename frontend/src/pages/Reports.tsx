// @ts-nocheck
import { useState } from 'react';
import { Download, Calendar } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { monthlyBreakdowns, pmComplianceData, mockKPIs, departmentEnergyData } from '../data/mockData';

const REPORT_TYPES = [
  { id: 'monthly',    label: 'Monthly Maintenance Report',   icon: '📋', color: '#3b82f6', desc: 'Complete maintenance summary for the month' },
  { id: 'breakdown',  label: 'Breakdown Analysis Report',    icon: '⚠️', color: '#ef4444', desc: 'Detailed breakdown statistics and RCA' },
  { id: 'pm',         label: 'PM Compliance Report',         icon: '✅', color: '#22c55e', desc: 'Preventive maintenance completion report' },
  { id: 'energy',     label: 'Energy Consumption Report',    icon: '⚡', color: '#f59e0b', desc: 'Electricity, DG, and utility usage report' },
  { id: 'kpi',        label: 'KPI Dashboard Report',         icon: '📊', color: '#8b5cf6', desc: 'Key performance indicators and trends' },
  { id: 'cost',       label: 'Maintenance Cost Report',      icon: '💰', color: '#06b6d4', desc: 'Cost analysis by machine, department' },
  { id: 'spare',      label: 'Spare Parts Report',           icon: '🔩', color: '#f59e0b', desc: 'Inventory, consumption, and purchase report' },
  { id: 'calibration',label: 'Calibration Status Report',   icon: '🔬', color: '#22c55e', desc: 'Instrument calibration compliance report' },
  { id: 'safety',     label: 'Safety & Incident Report',     icon: '🦺', color: '#ef4444', desc: 'Incidents, near misses, and LOTO report' },
  { id: 'yearly',     label: 'Annual Performance Report',    icon: '📅', color: '#6366f1', desc: 'Complete yearly performance summary' },
  { id: 'management', label: 'Monthly Management Report',    icon: '📑', color: '#0ea5e9', desc: 'Combined management report — select sections below' },
];

const MGMT_SECTIONS = [
  { key: 'spares',    label: '📦 Spare Parts Store Summary' },
  { key: 'attendance',label: '👥 Employee Attendance' },
  { key: 'outsource', label: '🔧 Outsource Details' },
  { key: 'rental',    label: '🚜 Rental Equipment' },
  { key: 'purchase',  label: '🛒 E&I Purchase Status' },
  { key: 'po',        label: '📄 Received POs' },
  { key: 'cost',      label: '💰 Purchase Cost Summary' },
  { key: 'projects',  label: '🏗️ Projects' },
  { key: 'costing',   label: '📊 E&I Costing Report' },
  { key: 'payment',   label: '💳 E&I Purchase Payment' },
];

const OEM_STORES = ['Main Store - OEM Spare', 'Electrical Store - OEM Spare'];
const STORE_COLORS: Record<string, any> = {
  'Main Store':                   [59, 130, 246],
  'E&I Store':                    [139, 92, 246],
  'IT Store':                     [34, 197, 94],
  'Other Stores':                 [245, 158, 11],
  'Main Store - OEM Spare':       [20, 184, 166],
  'Electrical Store - OEM Spare': [236, 72, 153],
};

function effectiveStore(s: any): string {
  const po = (s.poNumber || '').toLowerCase();
  if (po.includes('oem')) {
    if (s.storeName === 'Main Store') return 'Main Store - OEM Spare';
    if (s.storeName === 'E&I Store')  return 'Electrical Store - OEM Spare';
  }
  return s.storeName;
}

function fmt(n: number) { return (n || 0).toLocaleString('en-AE'); }
function fmtAED(n: number) {
  const v = n || 0;
  if (v >= 1000000) return `AED ${(v / 1000000).toFixed(2)}M`;
  if (v >= 1000)    return `AED ${(v / 1000).toFixed(1)}K`;
  return `AED ${fmt(v)}`;
}

const kpiData = [
  { name: 'OEE',             value: mockKPIs.oee,                     target: 90,  unit: '%', color: '#3b82f6' },
  { name: 'MTBF',            value: mockKPIs.mtbf,                    target: 160, unit: 'h', color: '#22c55e' },
  { name: 'MTTR',            value: mockKPIs.mttr,                    target: 3,   unit: 'h', color: '#f59e0b' },
  { name: 'PM Compliance',   value: mockKPIs.pmCompliance,            target: 95,  unit: '%', color: '#22c55e' },
  { name: 'Power Factor',    value: mockKPIs.powerFactor * 100,       target: 95,  unit: '',  color: '#06b6d4' },
  { name: 'El. Availability',value: mockKPIs.electricalAvailability,  target: 99,  unit: '%', color: '#8b5cf6' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
      <div style={{ color: '#64748b', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color ?? '#1e293b', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{p.name}:</span><span style={{ fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── PDF GENERATION ────────────────────────────────────────────────────────────
async function generateManagementReport(dateFrom: string, dateTo: string, sections: Record<string, boolean>) {
  const from       = new Date(dateFrom);
  const year       = from.getFullYear();
  const month      = from.getMonth() + 1;
  const monthLabel = from.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const reportTitle = `E&I ${monthLabel} Monthly Report`;
  const today      = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const need = (k: string) => sections[k] !== false;

  // ── Fetch only what's needed ──────────────────────────────────────────
  const [spareParts, empRes, attRes, outsourceRes, rentalRes, followupRes, poRes, projectRes, accessoriesRes] = await Promise.all([
    need('spares')                          ? fetch('/api/spare-parts?limit=5000').then(r => r.json()).catch(() => ({ items: [] })) : { items: [] },
    need('attendance')                      ? fetch('/api/employees').then(r => r.json()).catch(() => []) : [],
    need('attendance')                      ? fetch(`/api/attendance?year=${year}&month=${month}`).then(r => r.json()).catch(() => []) : [],
    (need('outsource') || need('costing'))  ? fetch(`/api/outsource?from=${dateFrom}&to=${dateTo}&limit=2000`).then(r => r.json()).catch(() => ({ entries: [] })) : { entries: [] },
    (need('rental') || need('costing'))     ? fetch(`/api/equipment-entries?from=${dateFrom}&to=${dateTo}&limit=2000`).then(r => r.json()).catch(() => ({ entries: [] })) : { entries: [] },
    (need('purchase') || need('payment'))   ? fetch('/api/purchase-followup').then(r => r.json()).catch(() => []) : [],
    (need('po') || need('cost'))            ? fetch('/api/purchase-po').then(r => r.json()).catch(() => []) : [],
    need('projects')                        ? fetch('/api/projects').then(r => r.json()).catch(() => []) : [],
    need('costing')                         ? fetch(`/api/accessories?from=${dateFrom}&to=${dateTo}&limit=2000`).then(r => r.json()).catch(() => ({ entries: [] })) : { entries: [] },
  ]);

  const allSpares      = spareParts?.items || (Array.isArray(spareParts) ? spareParts : []);
  const inStockSpares  = allSpares.filter(s => (s.currentStock || 0) > 0);
  const attRecords     = Array.isArray(attRes) ? attRes : [];
  const outsourceEntries = outsourceRes?.entries || [];
  const rentalEntries  = rentalRes?.entries || [];
  const followupRecords = Array.isArray(followupRes) ? followupRes : [];
  const allPOs         = Array.isArray(poRes) ? poRes : [];
  const projects       = Array.isArray(projectRes) ? projectRes : [];
  const accEntries     = (accessoriesRes?.entries || []) as any[];

  // Spare parts — store-wise
  const ALL_REGULAR_STORES = ['Main Store', 'E&I Store', 'IT Store', 'Other Stores'];
  const ALL_OEM_STORES     = ['Main Store - OEM Spare', 'Electrical Store - OEM Spare'];
  const storeMap: Record<string, { count: number; value: number }> = {};
  inStockSpares.forEach(s => {
    const store = effectiveStore(s);
    if (!storeMap[store]) storeMap[store] = { count: 0, value: 0 };
    storeMap[store].count++;
    storeMap[store].value += s.totalValue || 0;
  });
  const regularStores = ALL_REGULAR_STORES.map(s => ({ store: s, ...((storeMap[s]) || { count: 0, value: 0 }), isOEM: false }));
  const oemStores     = ALL_OEM_STORES.map(s    => ({ store: s, ...((storeMap[s]) || { count: 0, value: 0 }), isOEM: true  }));
  const regularTotal  = regularStores.reduce((s, r) => s + r.value, 0);
  const regularCount  = regularStores.reduce((s, r) => s + r.count, 0);
  const oemCount      = oemStores.reduce((s, r) => s + r.count, 0);

  // Attendance
  const daysInMonth = new Date(year, month, 0).getDate();
  const presentCode = (c: string) => ['P', 'WO', 'PH'].includes(c);
  const attSummary  = attRecords.map((rec: any) => ({
    name:    rec.empName || rec.empId,
    present: (rec.entries || []).filter((e: any) => presentCode(e.code)).length,
    absent:  (rec.entries || []).filter((e: any) => e.code === 'A').length,
    total:   (rec.entries || []).length,
  }));

  // Costs
  const outsourceCost = outsourceEntries.reduce((s: number, e: any) => s + (e.totalCost || 0), 0);
  const rentalCost    = rentalEntries.reduce((s: number, e: any) => s + (e.totalCost || 0), 0);
  const pendingItems  = followupRecords.filter((r: any) => r.currentStatus !== 'Material Received' && r.currentStatus !== 'Rejected');

  const receivedPOs   = allPOs.filter(po => {
    const d = new Date(po.actualDelivery || po.poDate);
    return d >= new Date(dateFrom) && d <= new Date(dateTo);
  });
  const totalPOValue   = receivedPOs.reduce((s: number, p: any) => s + (p.totalValue || 0), 0);
  const allPOTotal     = allPOs.reduce((s: number, p: any) => s + (p.totalValue || 0), 0);
  const pendingBudget  = pendingItems.reduce((s: number, r: any) => s + (r.budget || 0), 0);

  // ── PDF setup ────────────────────────────────────────────────────────
  const jsPDFmod  = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;
  const attPdf    = await import('../utils/generatePDF');
  const attLogo   = need('attendance') ? await attPdf.loadLogo() : null;
  const doc = new jsPDFmod({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  const H = 210;

  // Design tokens
  const PRIMARY : [number,number,number] = [15,  76,  129];
  const SECOND  : [number,number,number] = [37,  99,  235];
  const BG      : [number,number,number] = [248, 250, 252];
  const SUCCESS : [number,number,number] = [22,  163, 74 ];
  const WARNING : [number,number,number] = [245, 158, 11 ];
  const DANGER  : [number,number,number] = [220, 38,  38 ];
  const NEUTRAL : [number,number,number] = [71,  85,  105];
  const DARK    : [number,number,number] = [15,  23,  42 ];
  const WHITE   : [number,number,number] = [255, 255, 255];
  const NAVY    : [number,number,number] = [30,  58,  138];
  const TEAL    : [number,number,number] = [15,  118, 110];
  const PURPLE  : [number,number,number] = [124, 58,  237];
  const ORANGE  : [number,number,number] = [234, 88,  12 ];
  const ALT_ROW : [number,number,number] = [248, 250, 252];

  const tblHead = { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold' as const, fontSize: 9 };
  const tblAlt  = { fillColor: ALT_ROW };

  // ── KPI card helper ──────────────────────────────────────────────────
  const drawKPICard = (x: number, y: number, w: number, h: number, label: string, value: string, color: [number,number,number]) => {
    doc.setFillColor(210, 218, 226);
    doc.roundedRect(x + 1, y + 1, w, h, 3, 3, 'F');
    doc.setFillColor(...WHITE);
    doc.roundedRect(x, y, w, h, 3, 3, 'F');
    doc.setFillColor(...color);
    doc.roundedRect(x, y, w, 3.5, 2, 2, 'F');
    doc.rect(x, y + 2, w, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...color);
    doc.text(value, x + w / 2, y + h / 2 + 2.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...NEUTRAL);
    doc.text(label, x + w / 2, y + h - 3.5, { align: 'center' });
  };

  // ── Section header helpers ────────────────────────────────────────────
  let y = 0;
  let sectionNum = 0;
  const drawHdrBand = (title: string, subtitle: string, num: number) => {
    doc.setFillColor(...BG);
    doc.rect(0, 0, W, H, 'F');
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, W, 15, 'F');
    doc.setFillColor(...SECOND);
    doc.rect(W * 0.55, 0, W * 0.45, 15, 'F');
    doc.setFillColor(...SECOND);
    doc.rect(0, 15, W, 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...WHITE);
    doc.text(num > 0 ? `${num}. ${title}` : title, 10, 10);
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(186, 230, 253);
      doc.text(subtitle, W - 10, 10, { align: 'right' });
    }
  };
  const sectionHeader = (title: string, subtitle = '') => {
    sectionNum++;
    doc.addPage();
    drawHdrBand(title, subtitle, sectionNum);
    return 23;
  };
  const contHeader = (title: string, subtitle = '') => {
    doc.addPage();
    drawHdrBand(title, subtitle, 0);
    return 23;
  };

  const subHeader = (y: number, text: string) => {
    doc.setFillColor(...SECOND);
    doc.rect(10, y, 2.5, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.text(text, 14.5, y + 4.5);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(14.5, y + 6, W - 10, y + 6);
    return y + 11;
  };

  // ─── COVER PAGE ──────────────────────────────────────────────────────
  doc.setFillColor(...BG);
  doc.rect(0, 0, W, H, 'F');

  // Header: primary left, secondary right
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 58, 'F');
  doc.setFillColor(...SECOND);
  doc.rect(W * 0.5, 0, W * 0.5, 58, 'F');
  doc.setFillColor(...WHITE);
  doc.rect(0, 58, W, 0.8, 'F');

  // Company label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(186, 230, 253);
  doc.text('GLASS TECHNOLOGY — E&I DEPARTMENT', 10, 10);

  // Report title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...WHITE);
  doc.text(reportTitle, 10, 30);

  // Period
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(186, 230, 253);
  doc.text(`Period: ${dateFrom}  –  ${dateTo}     |     Generated: ${today}`, 10, 43);

  // Right side label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...WHITE);
  doc.text('MONTHLY MANAGEMENT REPORT', W - 10, 28, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(186, 230, 253);
  doc.text('Electrical & Instrumentation Division', W - 10, 37, { align: 'right' });

  // KPI cards
  const coverKPIs: Array<{ label: string; value: string; color: [number,number,number] }> = [
    { label: 'Regular Spare Items', value: fmt(regularCount),        color: [14, 165, 233] },
    { label: 'Spare Stock Value',   value: fmtAED(regularTotal),     color: SUCCESS },
    { label: 'OEM Spare Items',     value: fmt(oemCount),            color: PURPLE },
    { label: 'Pending Purchase',    value: fmt(pendingItems.length), color: WARNING },
    { label: 'POs in Period',       value: fmt(receivedPOs.length),  color: SECOND },
    { label: 'Total PO Value',      value: fmtAED(totalPOValue),     color: DANGER },
  ];
  const bW = 42, bH = 34, bX0 = 10, bY0 = 65;
  coverKPIs.forEach((b, i) => drawKPICard(bX0 + i * (bW + 5), bY0, bW, bH, b.label, b.value, b.color));

  // Section list (two columns)
  const cleanLabel = (lbl: string) => lbl.replace(/[^\x20-\x7E]/g, '').trim();
  const activeLabels = MGMT_SECTIONS.filter(s => sections[s.key] !== false).map(s => cleanLabel(s.label));
  if (activeLabels.length > 0) {
    const listY0 = bY0 + bH + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...NEUTRAL);
    doc.text('REPORT CONTENTS:', 10, listY0);
    const half = Math.ceil(activeLabels.length / 2);
    activeLabels.forEach((lbl, i) => {
      const col = i < half ? 0 : 1;
      const row = col === 0 ? i : i - half;
      const lx = 10 + col * 135;
      const ly = listY0 + 8 + row * 6.5;
      doc.setFillColor(...SECOND);
      doc.roundedRect(lx, ly - 2.5, 2, 2, 0.5, 0.5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...DARK);
      doc.text(`${i + 1}. ${lbl}`, lx + 4, ly);
    });
  }

  // ─── 1. SPARE PARTS STORE-WISE SUMMARY ────────────────────────────────
  if (need('spares')) {
    y = sectionHeader('Spare Parts — Store-Wise Cost Summary', `As of ${today}`);
    const allStoreRows = [
      ...regularStores.map(s => ({ store: s.store, count: s.count, value: s.value, isOEM: false, isTotalRow: false })),
      { store: 'Total (Regular Stores)', count: regularCount, value: regularTotal, isOEM: false, isTotalRow: true },
      { store: 'OEM SPARES — COST INCLUDED IN PROJECT', count: null, value: null, isOEM: true, isBanner: true },
      ...oemStores.map(s => ({ store: s.store, count: s.count, value: null, isOEM: true, isTotalRow: false })),
    ];

    autoTable(doc, {
      startY: y,
      head: [['Store', 'Total Items (In Stock)', 'Inventory Value']],
      body: allStoreRows.map(s => {
        if ((s as any).isBanner) return ['', '', ''];
        return [
          s.store,
          s.count !== null ? fmt(s.count) : '',
          s.isOEM ? 'Free of Cost' : (s.value ? fmtAED(s.value) : 'AED 0'),
        ];
      }),
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: tblHead,
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
      tableWidth: 190,
      margin: { left: 10 },
      didParseCell: (data: any) => {
        const row = allStoreRows[data.row.index];
        if (!row) return;
        if ((row as any).isBanner) {
          data.cell.styles.fillColor = [255, 247, 237];
          data.cell.styles.textColor = [180, 60, 10];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 9;
        } else if (row.isTotalRow) {
          data.cell.styles.fillColor = NAVY;
          data.cell.styles.textColor = WHITE;
          data.cell.styles.fontStyle = 'bold';
        } else if (row.isOEM) {
          data.cell.styles.fillColor = [255, 251, 235];
          if (data.column.index === 2) { data.cell.styles.textColor = SUCCESS; data.cell.styles.fontStyle = 'bold'; }
        } else {
          data.cell.styles.fillColor = data.row.index % 2 === 0 ? WHITE : ALT_ROW;
        }
      },
      didDrawCell: (data: any) => {
        // Draw colored square indicator for store rows (column 0 body)
        if (data.section === 'body' && data.column.index === 0) {
          const row = allStoreRows[data.row.index];
          if (!row || (row as any).isBanner || row.isTotalRow) return;
          const storeColor = STORE_COLORS[row.store];
          if (storeColor) {
            doc.setFillColor(...storeColor);
            doc.rect(data.cell.x + 2, data.cell.y + (data.cell.height - 3.5) / 2, 3.5, 3.5, 'F');
          }
        }
        // Banner row: merge-look — print text spanning all columns
        if (data.section === 'body' && data.column.index === 0) {
          const row = allStoreRows[data.row.index];
          if ((row as any).isBanner) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(234, 88, 12);
            doc.text('OEM SPARES — COST INCLUDED IN PROJECT (FREE OF COST)', data.cell.x + 2, data.cell.y + data.cell.height / 2 + 1.5);
          }
        }
      },
    });
  }

  // ─── 2. ATTENDANCE — same format as standalone Attendance PDF ────────
  if (need('attendance')) {
    const empList = Array.isArray(empRes) ? empRes : [];
    const empMap: Record<string, any> = {};
    empList.forEach((e: any) => { empMap[e.empId] = e; });

    const attTeam = attRecords.length > 0
      ? attRecords.map((r: any) => ({
          empId:   r.empId,
          empName: r.empName || empMap[r.empId]?.empName || r.empId,
          role:    empMap[r.empId]?.designation || empMap[r.empId]?.role || '',
        }))
      : empList.map((e: any) => ({
          empId:   e.empId,
          empName: e.empName || e.name || e.empId,
          role:    e.designation || e.role || '',
        }));

    const attEntries: Record<string, Record<number, string>> = {};
    attRecords.forEach((rec: any) => {
      attEntries[rec.empId] = {};
      (rec.entries || []).forEach((e: any) => { attEntries[rec.empId][e.day] = e.code; });
    });

    if (attTeam.length > 0) {
      // Attendance Sheet page (orange header, daily grid with colour-coded codes)
      doc.addPage();
      attPdf.addAttendanceSheet(doc, attLogo, attTeam, attEntries, year, month);

      // Work Summary page (code counts, totals row, monthly overview box)
      doc.addPage();
      attPdf.addWorkSummary(doc, attLogo, attTeam, attEntries, year, month);
    } else {
      y = sectionHeader('Employee Attendance', monthLabel);
      doc.setFontSize(9); doc.setTextColor(...NEUTRAL);
      doc.text(`No attendance records found for ${monthLabel}.`, 10, y + 8);
    }
  }

  // ─── 3. OUTSOURCE ─────────────────────────────────────────────────────
  if (need('outsource')) {
    y = sectionHeader('Outsource Work Details', `${dateFrom} – ${dateTo}`);

    const vendorMap: Record<string, { jobs: number; hours: number; cost: number }> = {};
    outsourceEntries.forEach((e: any) => {
      const k = e.vendorCompany || 'Unknown';
      if (!vendorMap[k]) vendorMap[k] = { jobs: 0, hours: 0, cost: 0 };
      vendorMap[k].jobs++;
      vendorMap[k].hours += e.workingHours || 0;
      vendorMap[k].cost  += e.totalCost || 0;
    });

    if (Object.keys(vendorMap).length) {
      const sumRows = Object.entries(vendorMap).map(([v, d]) => [v, fmt(d.jobs), `${d.hours.toFixed(1)} hrs`, fmtAED(d.cost)]);
      y = subHeader(y, 'Vendor-wise Summary');
      autoTable(doc, {
        startY: y,
        head: [['Vendor / Company', 'Jobs', 'Total Hours', 'Total Cost (AED)']],
        body: [...sumRows, ['TOTAL', fmt(outsourceEntries.length), `${outsourceEntries.reduce((s: number, e: any) => s + (e.workingHours || 0), 0).toFixed(1)} hrs`, fmtAED(outsourceCost)]],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: tblHead,
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'right' } },
        alternateRowStyles: tblAlt,
        didParseCell: (data: any) => { if (data.row.index === sumRows.length) { data.cell.styles.fillColor = NAVY; data.cell.styles.textColor = WHITE; data.cell.styles.fontStyle = 'bold'; } },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
      if (outsourceEntries.length <= 30) {
        y = subHeader(y, 'Work Log');
        autoTable(doc, {
          startY: y,
          head: [['Date', 'Vendor', 'Description', 'Hours', 'Cost (AED)', 'Status']],
          body: outsourceEntries.map((e: any) => [
            e.workDate ? new Date(e.workDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—',
            e.vendorCompany || '—',
            (e.workDescription || '—').substring(0, 38),
            e.workingHours || 0,
            fmtAED(e.totalCost),
            e.completionStatus || '—',
          ]),
          styles: { fontSize: 7.5, cellPadding: 2.5 },
          headStyles: tblHead,
          columnStyles: { 3: { halign: 'center' }, 4: { halign: 'right' } },
          alternateRowStyles: tblAlt,
        });
      }
    } else {
      doc.setFontSize(9); doc.setTextColor(...NEUTRAL);
      doc.text('No outsource entries found for this period.', 10, y + 6);
    }
  }

  // ─── 4. RENTAL ────────────────────────────────────────────────────────
  if (need('rental')) {
    y = sectionHeader('Rental Equipment Details', `${dateFrom} – ${dateTo}`);

    const rentalMap: Record<string, { days: number; hours: number; cost: number }> = {};
    rentalEntries.forEach((e: any) => {
      const k = e.equipmentName || 'Unknown';
      if (!rentalMap[k]) rentalMap[k] = { days: 0, hours: 0, cost: 0 };
      rentalMap[k].days++;
      rentalMap[k].hours += e.workingHours || 0;
      rentalMap[k].cost  += e.totalCost || 0;
    });

    if (Object.keys(rentalMap).length) {
      const sumRows = Object.entries(rentalMap).map(([eq, d]) => [eq, fmt(d.days), `${d.hours.toFixed(1)} hrs`, fmtAED(d.cost)]);
      y = subHeader(y, 'Equipment-wise Summary');
      autoTable(doc, {
        startY: y,
        head: [['Equipment', 'Days Used', 'Total Hours', 'Total Cost (AED)']],
        body: [...sumRows, ['TOTAL', fmt(rentalEntries.length), `${rentalEntries.reduce((s: number, e: any) => s + (e.workingHours || 0), 0).toFixed(1)} hrs`, fmtAED(rentalCost)]],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: tblHead,
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'right' } },
        alternateRowStyles: tblAlt,
        didParseCell: (data: any) => { if (data.row.index === sumRows.length) { data.cell.styles.fillColor = NAVY; data.cell.styles.textColor = WHITE; data.cell.styles.fontStyle = 'bold'; } },
      });
    } else {
      doc.setFontSize(9); doc.setTextColor(...NEUTRAL);
      doc.text('No rental equipment entries found for this period.', 10, y + 6);
    }
  }

  // ─── 5. E&I PURCHASE STATUS ───────────────────────────────────────────
  if (need('purchase')) {
    y = sectionHeader('E&I Purchase Status', `As of ${today}`);

    const statusGroups: Record<string, number> = {};
    followupRecords.forEach((r: any) => { const k = r.currentStatus || 'No Status'; statusGroups[k] = (statusGroups[k] || 0) + 1; });
    const statusRows = Object.entries(statusGroups).map(([s, c]) => [s, fmt(c)]);

    y = subHeader(y, 'Status Summary');
    autoTable(doc, {
      startY: y,
      head: [['Status', 'Count']],
      body: [...statusRows, ['TOTAL', fmt(followupRecords.length)]],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: tblHead,
      columnStyles: { 1: { halign: 'center' } },
      tableWidth: 90,
      alternateRowStyles: tblAlt,
      didParseCell: (data: any) => { if (data.row.index === statusRows.length) { data.cell.styles.fillColor = NAVY; data.cell.styles.textColor = WHITE; data.cell.styles.fontStyle = 'bold'; } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    if (pendingItems.length) {
      y = subHeader(y, 'Pending Purchase Items');
      autoTable(doc, {
        startY: y,
        head: [['SL', 'Item Description', 'Request Date', 'Days', 'Required Timeline', 'Current Status', 'PR Number', 'Req. Date', 'Budget', 'Lead Time', 'Working Time']],
        body: pendingItems.map((r: any, i: number) => {
          const reqDt = r.requestDate ? new Date(r.requestDate) : null;
          const days  = reqDt ? Math.floor((Date.now() - reqDt.getTime()) / 86400000) : '—';
          const fmtD  = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
          return [
            i + 1,
            (r.itemDescription || '—').substring(0, 50),
            fmtD(r.requestDate),
            days,
            r.requiredTimeline || '—',
            r.currentStatus || '—',
            r.prNumber || '—',
            fmtD(r.reqDate),
            r.budget ? fmtAED(r.budget) : '—',
            r.leadTime || '—',
            r.workingTime || '—',
          ];
        }),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { ...tblHead, fontSize: 7 },
        columnStyles: {
          0:  { halign: 'center', cellWidth: 7 },
          1:  { cellWidth: 58 },
          2:  { halign: 'center', cellWidth: 22 },
          3:  { halign: 'center', cellWidth: 12 },
          4:  { halign: 'center', cellWidth: 22 },
          5:  { cellWidth: 28 },
          6:  { halign: 'center', cellWidth: 22 },
          7:  { halign: 'center', cellWidth: 22 },
          8:  { halign: 'right',  cellWidth: 24 },
          9:  { halign: 'center', cellWidth: 20 },
          10: { halign: 'center', cellWidth: 20 },
        },
        alternateRowStyles: tblAlt,
        didParseCell: (data: any) => {
          if (data.column.index === 3 && data.section === 'body') {
            const d = Number(data.cell.text[0]);
            if (!isNaN(d)) {
              if (d > 90)      data.cell.styles.textColor = DANGER;
              else if (d > 30) data.cell.styles.textColor = WARNING;
            }
          }
        },
      });
    }

    // Materials Received This Month
    const receivedThisMonth = followupRecords.filter((r: any) => {
      if (r.currentStatus !== 'Material Received') return false;
      if (!r.receivedDate) return true;
      const d = new Date(r.receivedDate);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });
    y = (doc as any).lastAutoTable?.finalY + 10 || y + 10;
    y = subHeader(y, `Materials Received This Month (${receivedThisMonth.length})`);
    if (receivedThisMonth.length > 0) {
      const fmtDs = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
      autoTable(doc, {
        startY: y,
        head: [['#', 'Item Description', 'PR Number', 'Request Date', 'Received Date', 'Budget (AED)']],
        body: receivedThisMonth.map((r: any, i: number) => [
          i + 1,
          (r.itemDescription || '—').substring(0, 60),
          r.prNumber || '—',
          fmtDs(r.requestDate),
          fmtDs(r.receivedDate),
          r.budget ? fmtAED(r.budget) : '—',
        ]),
        styles: { fontSize: 8.5, cellPadding: 3 },
        headStyles: { fillColor: SUCCESS, textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
        columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 2: { halign: 'center', cellWidth: 30 }, 3: { halign: 'center', cellWidth: 28 }, 4: { halign: 'center', cellWidth: 28 }, 5: { halign: 'right', cellWidth: 28 } },
        alternateRowStyles: { fillColor: [240, 253, 244] },
      });
    } else {
      doc.setFontSize(9); doc.setTextColor(...NEUTRAL);
      doc.text(`No materials received in ${monthLabel}.`, 10, y + 6);
    }
  }

  // ─── 6. RECEIVED POs ──────────────────────────────────────────────────
  if (need('po')) {
    y = sectionHeader('Monthly Received Purchase Orders', `${dateFrom} – ${dateTo}`);

    if (receivedPOs.length) {
      y = subHeader(y, 'Purchase Orders in Period');
      autoTable(doc, {
        startY: y,
        head: [['PO No.', 'Date', 'Vendor', 'Dept.', 'Items', 'Total (AED)', 'Status']],
        body: receivedPOs.map((po: any) => [
          po.poNo || '—',
          po.poDate || '—',
          (po.vendor || '—').substring(0, 18),
          po.department || '—',
          (po.items || []).length,
          fmtAED(po.totalValue),
          po.status || '—',
        ]),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: tblHead,
        columnStyles: { 4: { halign: 'center' }, 5: { halign: 'right' } },
        alternateRowStyles: tblAlt,
      });
      y = (doc as any).lastAutoTable.finalY + 6;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...PRIMARY);
      doc.text(`Total PO Value for Period: ${fmtAED(totalPOValue)}`, W - 10, y, { align: 'right' });
    } else {
      doc.setFontSize(9); doc.setTextColor(...NEUTRAL);
      doc.text('No purchase orders found for this period.', 10, y + 6);
    }
  }

  // ─── 7. PURCHASE COST SUMMARY ─────────────────────────────────────────
  if (need('cost')) {
    y = sectionHeader('Purchase Cost Summary', monthLabel);

    y = subHeader(y, 'Cost Breakdown');
    const costRows = [
      ['POs Received (Period)',        fmtAED(totalPOValue),  `${receivedPOs.length} POs`],
      ['All POs (All Time Total)',     fmtAED(allPOTotal),    `${allPOs.length} POs`],
      ['Outsource Cost (Period)',      fmtAED(outsourceCost), `${outsourceEntries.length} jobs`],
      ['Rental Equipment (Period)',    fmtAED(rentalCost),    `${rentalEntries.length} entries`],
      ['Pending Purchase Budget',      fmtAED(pendingBudget), `${pendingItems.length} pending items`],
      ['Spare Stock Value (Regular)', fmtAED(regularTotal),  `${fmt(regularCount)} items`],
    ];
    autoTable(doc, {
      startY: y,
      head: [['Category', 'Amount (AED)', 'Remarks']],
      body: costRows,
      styles: { fontSize: 9, cellPadding: 3.5 },
      headStyles: tblHead,
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'center', textColor: NEUTRAL } },
      alternateRowStyles: tblAlt,
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    const totalSpend = totalPOValue + outsourceCost + rentalCost;
    doc.setFillColor(...NAVY);
    doc.roundedRect(10, y, W - 20, 14, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.text(`Total Expenditure for Period: ${fmtAED(totalSpend)}`, W / 2, y + 9.5, { align: 'center' });
  }

  // ─── 8. PROJECTS ──────────────────────────────────────────────────────
  if (need('projects')) {
    y = sectionHeader('Projects Summary', `As of ${today}`);

    if (projects.length) {
      const activeProjects  = projects.filter((p: any) => p.status === 'active' || p.status === 'in-progress');
      const totalBudget     = projects.reduce((s: number, p: any) => s + (p.budget || 0), 0);
      const totalSpent      = projects.reduce((s: number, p: any) => s + (p.spent || 0), 0);

      // Project KPI cards
      const pKPIs: Array<{ label: string; value: string; color: [number,number,number] }> = [
        { label: 'Total Projects',   value: fmt(projects.length),       color: PRIMARY },
        { label: 'Active / In-Prog', value: fmt(activeProjects.length), color: SUCCESS },
        { label: 'Total Budget',     value: fmtAED(totalBudget),        color: PURPLE },
        { label: 'Total Spent',      value: fmtAED(totalSpent),         color: WARNING },
      ];
      const pkW = 52, pkH = 28;
      pKPIs.forEach((k, i) => drawKPICard(10 + i * (pkW + 5), y, pkW, pkH, k.label, k.value, k.color));
      y += pkH + 10;

      y = subHeader(y, 'Project Details');
      autoTable(doc, {
        startY: y,
        head: [['#', 'Project No.', 'Name', 'Type', 'Status', 'Progress', 'Budget (AED)', 'Spent (AED)', 'Manager']],
        body: projects.map((p: any, i: number) => [
          i + 1,
          p.projectNo || '—',
          (p.name || '—').substring(0, 25),
          p.type || '—',
          p.status || '—',
          `${p.progress || 0}%`,
          fmtAED(p.budget),
          fmtAED(p.spent),
          (p.projectManager || '—').substring(0, 14),
        ]),
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        headStyles: tblHead,
        columnStyles: {
          0: { halign: 'center', cellWidth: 7 },
          5: { halign: 'center' },
          6: { halign: 'right' },
          7: { halign: 'right' },
        },
        alternateRowStyles: tblAlt,
      });
    } else {
      doc.setFontSize(9); doc.setTextColor(...NEUTRAL);
      doc.text('No projects found.', 10, y + 6);
    }
  }

  // ─── 9. E&I COSTING REPORT ───────────────────────────────────────────
  if (need('costing')) {
    const outsourceCostT = outsourceEntries.reduce((s: number, e: any) => s + (e.totalCost || 0), 0);
    const equipmentCostT = rentalEntries.reduce((s: number,   e: any) => s + (e.totalCost || 0), 0);
    const accessoryCostT = accEntries.reduce((s: number,      e: any) => s + (e.totalCost || 0), 0);
    const grandCostT     = outsourceCostT + equipmentCostT + accessoryCostT;

    // Page 1: Summary
    y = sectionHeader('E&I Costing Report — Summary', `Period: ${monthLabel}`);
    const cbw = (W - 20 - 9) / 4;
    const cKpis: Array<{ label: string; value: string; color: [number,number,number] }> = [
      { label: 'Outsource Labour', value: fmtAED(outsourceCostT), color: TEAL },
      { label: 'Equipment Usage',  value: fmtAED(equipmentCostT), color: PURPLE },
      { label: 'Accessories',      value: fmtAED(accessoryCostT), color: WARNING },
      { label: 'Grand Total',      value: fmtAED(grandCostT),     color: DANGER },
    ];
    cKpis.forEach((k, i) => drawKPICard(10 + i * (cbw + 3), y, cbw, 28, k.label, k.value, k.color));
    y += 36;

    y = subHeader(y, 'Cost Summary');
    autoTable(doc, {
      startY: y, margin: { left: 10, right: 10 },
      head: [['Category', 'No. Entries', 'Total Cost (AED)', 'Share of Total']],
      body: [
        ['Outsource Labour', outsourceEntries.length, fmtAED(outsourceCostT), grandCostT > 0 ? `${Math.round(outsourceCostT / grandCostT * 100)}%` : '—'],
        ['Equipment Usage',  rentalEntries.length,    fmtAED(equipmentCostT), grandCostT > 0 ? `${Math.round(equipmentCostT / grandCostT * 100)}%` : '—'],
        ['Accessories',      accEntries.length,        fmtAED(accessoryCostT), grandCostT > 0 ? `${Math.round(accessoryCostT / grandCostT * 100)}%` : '—'],
        ['GRAND TOTAL',      outsourceEntries.length + rentalEntries.length + accEntries.length, fmtAED(grandCostT), '100%'],
      ],
      headStyles: tblHead,
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'center' }, 2: { fontStyle: 'bold', halign: 'right' }, 3: { fontStyle: 'bold', halign: 'center' } },
      alternateRowStyles: tblAlt,
      didParseCell: (data: any) => {
        if (data.row.index === 3) { data.cell.styles.fillColor = NAVY; data.cell.styles.textColor = WHITE; data.cell.styles.fontStyle = 'bold'; }
      },
    });

    // Page 2: Outsource by Contract
    y = contHeader('E&I Costing — Outsource Labour Breakdown', `Total: ${fmtAED(outsourceCostT)}`);
    const contractMap: Record<string, { company: string; entries: number; cost: number }> = {};
    outsourceEntries.forEach((r: any) => {
      const k = r.contractName || 'Unknown';
      if (!contractMap[k]) contractMap[k] = { company: r.contractorCompany || '—', entries: 0, cost: 0 };
      contractMap[k].entries++; contractMap[k].cost += r.totalCost || 0;
    });
    const contracts = Object.entries(contractMap).sort((a, b) => b[1].cost - a[1].cost);
    autoTable(doc, {
      startY: y, margin: { left: 10, right: 10 },
      head: [['#', 'Contract Name', 'Contractor Company', 'Entries', 'Total Cost (AED)', 'Share']],
      body: contracts.length ? contracts.map(([name, d], i) => [
        i + 1, name, d.company, d.entries, fmtAED(d.cost),
        outsourceCostT > 0 ? `${Math.round(d.cost / outsourceCostT * 100)}%` : '—',
      ]) : [['—', 'No outsource data for this period', '', '', '', '']],
      foot: [['', 'TOTAL', '', outsourceEntries.length, fmtAED(outsourceCostT), '100%']],
      headStyles: { fillColor: TEAL, textColor: WHITE, fontSize: 9, fontStyle: 'bold' },
      footStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 4: { fontStyle: 'bold', textColor: TEAL, halign: 'right' }, 5: { halign: 'center' } },
      alternateRowStyles: { fillColor: [240, 253, 250] },
    });

    // Page 3: Equipment + Accessories
    y = contHeader('E&I Costing — Equipment & Accessories Breakdown', `Equip: ${fmtAED(equipmentCostT)}  |  Acc: ${fmtAED(accessoryCostT)}`);
    const equipMap: Record<string, { vendor: string; entries: number; cost: number }> = {};
    rentalEntries.forEach((r: any) => {
      const k = r.equipmentName || 'Unknown';
      if (!equipMap[k]) equipMap[k] = { vendor: r.vendorCompany || '—', entries: 0, cost: 0 };
      equipMap[k].entries++; equipMap[k].cost += r.totalCost || 0;
    });
    const equipList = Object.entries(equipMap).sort((a, b) => b[1].cost - a[1].cost);
    y = subHeader(y, 'Equipment Usage by Asset');
    autoTable(doc, {
      startY: y, margin: { left: 10, right: 10 },
      head: [['#', 'Equipment Name', 'Vendor / Company', 'Entries', 'Total Cost (AED)', 'Share']],
      body: equipList.length ? equipList.map(([name, d], i) => [
        i + 1, name, d.vendor, d.entries, fmtAED(d.cost),
        equipmentCostT > 0 ? `${Math.round(d.cost / equipmentCostT * 100)}%` : '—',
      ]) : [['—', 'No equipment data for this period', '', '', '', '']],
      foot: [['', 'TOTAL', '', rentalEntries.length, fmtAED(equipmentCostT), '100%']],
      headStyles: { fillColor: PURPLE, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
      footStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 4: { fontStyle: 'bold', textColor: PURPLE, halign: 'right' }, 5: { halign: 'center' } },
      alternateRowStyles: { fillColor: [245, 243, 255] },
    });

    const afterEqY = (doc as any).lastAutoTable?.finalY ?? 80;
    const accCatMap: Record<string, number> = {};
    accEntries.forEach((r: any) => {
      (r.items || []).forEach((it: any) => {
        accCatMap[it.category] = (accCatMap[it.category] || 0) + (it.totalCost || 0);
      });
    });
    const accCats = Object.entries(accCatMap).sort((a, b) => b[1] - a[1]);
    const accSubY = subHeader(afterEqY + 8, 'Accessories by Category');
    autoTable(doc, {
      startY: accSubY, margin: { left: 10, right: 10 },
      head: [['#', 'Category', 'Total Cost (AED)', 'Share of Accessories']],
      body: accCats.length ? accCats.map(([cat, cost], i) => [
        i + 1, cat, fmtAED(cost),
        accessoryCostT > 0 ? `${Math.round(cost / accessoryCostT * 100)}%` : '—',
      ]) : [['—', 'No accessories data for this period', '', '']],
      foot: [['', 'TOTAL', fmtAED(accessoryCostT), '100%']],
      headStyles: { fillColor: WARNING, textColor: WHITE, fontSize: 9, fontStyle: 'bold' },
      footStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 2: { fontStyle: 'bold', textColor: WARNING, halign: 'right' }, 3: { halign: 'center' } },
      alternateRowStyles: { fillColor: [255, 251, 235] },
    });

    const finalCostY = Math.min(((doc as any).lastAutoTable?.finalY ?? 150) + 8, H - 22);
    doc.setFillColor(...NAVY); doc.roundedRect(10, finalCostY, W - 20, 14, 2, 2, 'F');
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
    doc.text('GRAND TOTAL — All Categories', 16, finalCostY + 9.5);
    doc.text(fmtAED(grandCostT), W - 16, finalCostY + 9.5, { align: 'right' });
  }

  // ─── 10. E&I PURCHASE PAYMENT REPORT ─────────────────────────────────
  if (need('payment')) {
    const FULL_PMT    = 'Payment Done';
    const PARTIAL_PMT = 'Partial Payment Done';

    interface PayEntry { desc: string; prNo: string; date: string; amount: number; isFull: boolean; }
    const payEntries: PayEntry[] = [];
    followupRecords.forEach((r: any) => {
      if (r.paymentStatus !== FULL_PMT && r.paymentStatus !== PARTIAL_PMT) return;
      const isFull = r.paymentStatus === FULL_PMT;
      const hist   = r.paymentHistory || [];
      if (hist.length > 0) {
        hist.forEach((tx: any) => {
          if (!tx.date) return;
          const d = new Date(tx.date);
          if (d.getFullYear() !== year || d.getMonth() + 1 !== month) return;
          payEntries.push({ desc: r.itemDescription || '—', prNo: r.prNumber || '—', date: tx.date, amount: tx.amount || 0, isFull });
        });
      } else {
        const d = r.receivedDate || r.requestDate || '';
        if (d) {
          const dt = new Date(d);
          if (dt.getFullYear() !== year || dt.getMonth() + 1 !== month) return;
        }
        payEntries.push({ desc: r.itemDescription || '—', prNo: r.prNumber || '—', date: d, amount: r.budget || 0, isFull });
      }
    });

    const fullEntries    = payEntries.filter(e => e.isFull);
    const partialEntries = payEntries.filter(e => !e.isFull);
    const fullTotal      = fullEntries.reduce((s, e) => s + e.amount, 0);
    const partialTotal   = partialEntries.reduce((s, e) => s + e.amount, 0);
    const payTotal       = fullTotal + partialTotal;
    const fmtD           = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
    const fmtE           = (n: number) => (n || 0).toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    y = sectionHeader('E&I Purchase Payment Report', monthLabel);

    autoTable(doc, {
      startY: y, margin: { left: 10, right: 10 },
      head: [['Payment Type', 'No. of Items', 'Total Value (AED)']],
      body: [
        ['Full Payment Done',    String(fullEntries.length),    `AED ${fmtE(fullTotal)}`],
        ['Partial Payment Done', String(partialEntries.length), `AED ${fmtE(partialTotal)}`],
        ['GRAND TOTAL PAID',     String(payEntries.length),     `AED ${fmtE(payTotal)}`],
      ],
      headStyles: tblHead,
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 30, halign: 'center' }, 2: { cellWidth: 50, halign: 'right', fontStyle: 'bold' } },
      tableWidth: 165,
      alternateRowStyles: tblAlt,
      didParseCell: (data: any) => {
        if (data.row.index === 2) { data.cell.styles.fillColor = NAVY; data.cell.styles.textColor = WHITE; data.cell.styles.fontStyle = 'bold'; }
      },
    });

    if (payEntries.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8, margin: { left: 10, right: 10 },
        head: [[
          { content: `${monthLabel}   —   Total Paid: AED ${fmtE(payTotal)}   (Full: AED ${fmtE(fullTotal)}  |  Partial: AED ${fmtE(partialTotal)})`,
            colSpan: 6, styles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 10 } },
        ], ['SL', 'Item Description', 'PO / PR Number', 'Payment Date', 'Amount Paid (AED)', 'Type']],
        body: payEntries.map((e, i) => [i + 1, e.desc, e.prNo, fmtD(e.date), `AED ${fmtE(e.amount)}`, e.isFull ? 'Full Payment' : 'Partial Payment']),
        headStyles: tblHead,
        bodyStyles: { fontSize: 8.5 },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 40 }, 3: { cellWidth: 28 }, 4: { cellWidth: 36, halign: 'right', fontStyle: 'bold' }, 5: { cellWidth: 35 } },
        alternateRowStyles: tblAlt,
        didParseCell: (data: any) => {
          if (data.column.index === 5 && data.section === 'body') {
            data.cell.styles.textColor = data.cell.raw === 'Full Payment' ? SUCCESS : PURPLE;
            data.cell.styles.fontStyle = 'bold';
          }
        },
        foot: [['', 'Sub-total', '', '', `AED ${fmtE(payTotal)}`, '']],
        footStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
      });
    } else {
      doc.setFontSize(9); doc.setTextColor(...NEUTRAL);
      doc.text(`No payments recorded for ${monthLabel}.`, 10, ((doc as any).lastAutoTable?.finalY || 60) + 10);
    }
  }

  // ─── Footer on all pages ──────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...BG);
    doc.rect(0, H - 10, W, 10, 'F');
    doc.setDrawColor(...PRIMARY);
    doc.setLineWidth(0.4);
    doc.line(0, H - 10, W, H - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...NEUTRAL);
    doc.text('E&I Department | Glass Technology', 10, H - 3.5);
    doc.setFont('helvetica', 'bold');
    doc.text('CONFIDENTIAL', W / 2, H - 3.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} of ${totalPages}`, W - 10, H - 3.5, { align: 'right' });
  }

  // ─── Save ─────────────────────────────────────────────────────────────
  doc.save(`EI_${monthLabel.replace(/\s+/g, '_')}_Monthly_Report.pdf`);
}

// ─── COMPONENT ─────────────────────────────────────────────────────────────────
export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [dateTo,   setDateTo]   = useState(() => new Date().toISOString().slice(0, 10));
  const [format,   setFormat]   = useState<'pdf' | 'excel' | 'word'>('pdf');
  const [generating, setGenerating] = useState(false);
  const [mgmtMonth, setMgmtMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [mgmtSections, setMgmtSections] = useState<Record<string, boolean>>(
    Object.fromEntries(MGMT_SECTIONS.map(s => [s.key, true]))
  );

  const toggleSection = (key: string) =>
    setMgmtSections(prev => ({ ...prev, [key]: !prev[key] }));

  const anySelected = Object.values(mgmtSections).some(Boolean);

  const handleGenerate = async () => {
    if (!selectedReport) return;
    if (selectedReport === 'management') {
      if (!anySelected) { alert('Please select at least one section to include in the report.'); return; }
      setGenerating(true);
      const [my, mm] = mgmtMonth.split('-').map(Number);
      const lastDay  = new Date(my, mm, 0).getDate();
      const mFrom    = `${mgmtMonth}-01`;
      const mTo      = `${mgmtMonth}-${String(lastDay).padStart(2, '0')}`;
      try { await generateManagementReport(mFrom, mTo, mgmtSections); }
      catch (e) { console.error(e); alert('PDF generation failed. Check console.'); }
      finally { setGenerating(false); }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Reports & Analytics</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>Generate, download and share maintenance reports</div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {kpiData.map(k => {
          const above = k.name === 'MTTR' ? k.value <= k.target : k.value >= k.target;
          return (
            <div key={k.name} className="glass-card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>{k.name}</span>
                <span style={{ fontSize: 10, color: above ? '#22c55e' : '#ef4444', background: above ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '1px 8px', borderRadius: 10 }}>
                  {above ? 'On Target' : 'Below Target'}
                </span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}{k.unit}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Target: {k.target}{k.unit}</div>
              <div className="progress-bar" style={{ marginTop: 8 }}>
                <div className="progress-fill" style={{ width: `${Math.min((k.name === 'MTTR' ? (k.target / k.value) : (k.value / k.target)) * 100, 100)}%`, background: above ? '#22c55e' : '#ef4444' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>Breakdowns MTD</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={monthlyBreakdowns}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Breakdowns" fill="#ef4444" radius={[3,3,0,0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>PM Compliance Trend</div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={pmComplianceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis domain={[85, 100]} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="compliance" name="Compliance%" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>Dept Energy Split</div>
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie data={departmentEnergyData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" nameKey="name">
                {departmentEnergyData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Generate Report */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 16 }}>Generate Report</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-dark" style={{ width: 150 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-dark" style={{ width: 150 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Format</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['pdf', 'excel', 'word'] as const).map(f => (
                <button key={f} onClick={() => setFormat(f)} style={{
                  padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                  background: format === f ? '#3b82f6' : '#F1F5F9',
                  color: format === f ? 'white' : '#64748b', textTransform: 'uppercase',
                }}>{f}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Report type cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {REPORT_TYPES.filter(r => r.id !== 'management').map(r => (
            <div key={r.id} onClick={() => setSelectedReport(r.id)} style={{
              padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
              background: selectedReport === r.id ? `${r.color}15` : '#FAFAFA',
              border: `1px solid ${selectedReport === r.id ? r.color + '50' : '#E5E7EB'}`,
              transition: 'all 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{r.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{r.label}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{r.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Monthly Management Report — special full-width card */}
        {(() => {
          const r = REPORT_TYPES.find(x => x.id === 'management')!;
          const isSelected = selectedReport === 'management';
          return (
            <div style={{
              marginTop: 10, padding: '16px 18px', borderRadius: 12,
              background: isSelected ? '#EFF6FF' : '#F0F9FF',
              border: `2px solid ${isSelected ? '#2563EB' : '#BAE6FD'}`,
              cursor: 'pointer', transition: 'all 0.2s',
            }} onClick={() => setSelectedReport('management')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 24 }}>📑</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>Monthly Management Report</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Select the sections to include — only ticked sections will appear in the PDF</div>
                </div>
                {/* Month picker */}
                <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <label style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>Report Month</label>
                  <input
                    type="month"
                    value={mgmtMonth}
                    onChange={e => setMgmtMonth(e.target.value)}
                    style={{
                      padding: '5px 10px', borderRadius: 8, border: '1.5px solid #93C5FD',
                      background: '#EFF6FF', color: '#1e40af', fontSize: 12, fontWeight: 600,
                      outline: 'none', cursor: 'pointer',
                    }}
                  />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#1e40af', background: '#DBEAFE', padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                  Manager PDF
                </span>
              </div>

              {/* Section checkboxes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {MGMT_SECTIONS.map(s => (
                  <label key={s.key}
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                      padding: '6px 10px', borderRadius: 8,
                      background: mgmtSections[s.key] ? '#DBEAFE' : '#F8FAFC',
                      border: `1px solid ${mgmtSections[s.key] ? '#93C5FD' : '#E5E7EB'}`,
                      userSelect: 'none', transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={mgmtSections[s.key]}
                      onChange={() => toggleSection(s.key)}
                      style={{ width: 14, height: 14, accentColor: '#2563EB', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 10, fontWeight: 600, color: mgmtSections[s.key] ? '#1e40af' : '#64748b' }}>
                      {s.label}
                    </span>
                  </label>
                ))}
              </div>

              {/* Select all / clear shortcuts */}
              <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
                <button onClick={e => { e.stopPropagation(); setMgmtSections(Object.fromEntries(MGMT_SECTIONS.map(s => [s.key, true]))); }}
                  style={{ fontSize: 10, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  Select All
                </button>
                <button onClick={e => { e.stopPropagation(); setMgmtSections(Object.fromEntries(MGMT_SECTIONS.map(s => [s.key, false]))); }}
                  style={{ fontSize: 10, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  Clear All
                </button>
                <span style={{ fontSize: 10, color: '#64748b', marginLeft: 'auto' }}>
                  {Object.values(mgmtSections).filter(Boolean).length} of {MGMT_SECTIONS.length} sections selected
                </span>
              </div>
            </div>
          );
        })()}

        {/* Generate button */}
        {selectedReport && (
          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              className="btn-primary"
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, opacity: generating ? 0.7 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}
              onClick={handleGenerate}
              disabled={generating || (selectedReport === 'management' && !anySelected)}
            >
              <Download size={13} />
              {generating ? 'Generating PDF…' : selectedReport === 'management' ? 'Generate Management PDF' : `Generate ${format.toUpperCase()} Report`}
            </button>
            <button className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={13} /> Schedule Auto Report
            </button>
            {generating && <span style={{ fontSize: 11, color: '#64748b' }}>Fetching live data from all modules…</span>}
          </div>
        )}
      </div>
    </div>
  );
}
