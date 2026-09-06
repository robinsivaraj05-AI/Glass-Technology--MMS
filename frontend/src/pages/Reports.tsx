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
  { id: 'spare',      label: 'Spare Parts Report',           icon: '🔧', color: '#f59e0b', desc: 'Inventory, consumption, and purchase report' },
  { id: 'calibration',label: 'Calibration Status Report',   icon: '🔬', color: '#22c55e', desc: 'Instrument calibration compliance report' },
  { id: 'safety',     label: 'Safety & Incident Report',     icon: '🦺', color: '#ef4444', desc: 'Incidents, near misses, and LOTO report' },
  { id: 'yearly',     label: 'Annual Performance Report',    icon: '📅', color: '#6366f1', desc: 'Complete yearly performance summary' },
  { id: 'management', label: 'Monthly Management Report',    icon: '📑', color: '#0ea5e9', desc: 'Combined management report - select sections below' },
];

const MGMT_SECTIONS = [
  { key: 'attendance',label: '👥 Employee Attendance' },
  { key: 'purchase',  label: '🛒 E&I Purchase Status' },
  { key: 'cost',      label: '💰 Purchase Cost Summary' },
  { key: 'costing',   label: '📊 E&I Costing Report' },
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

// â”€â”€â”€ PDF GENERATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function generateManagementReport(dateFrom: string, dateTo: string, sections: Record<string, boolean>) {
  const from       = new Date(dateFrom);
  const year       = from.getFullYear();
  const month      = from.getMonth() + 1;
  const monthLabel = from.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const reportTitle = `E&I ${monthLabel} Monthly Report`;
  const today      = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const need = (k: string) => sections[k] === true;

  // â”€â”€ Fetch only what's needed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [spareParts, empRes, attRes, outsourceRes, rentalRes, followupRes, poRes, projectRes, accessoriesRes] = await Promise.all([
    need('spares')                          ? fetch('/api/spare-parts?limit=5000').then(r => r.json()).catch(() => ({ items: [] })) : { items: [] },
    need('attendance')                      ? fetch('/api/employees').then(r => r.json()).catch(() => []) : [],
    need('attendance')                      ? fetch(`/api/attendance?year=${year}&month=${month}`).then(r => r.json()).catch(() => []) : [],
    (need('outsource') || need('costing'))  ? fetch(`/api/outsource?from=${dateFrom}&to=${dateTo}&limit=2000`).then(r => r.json()).catch(() => ({ entries: [] })) : { entries: [] },
    (need('rental') || need('costing'))     ? fetch(`/api/equipment-entries?from=${dateFrom}&to=${dateTo}&limit=2000`).then(r => r.json()).catch(() => ({ entries: [] })) : { entries: [] },
    (need('purchase') || need('payment'))   ? fetch('/api/purchase-followup').then(r => r.json()).catch(() => []) : [],
    (need('po') || need('cost'))            ? fetch('/api/purchase-po').then(r => r.json()).catch(() => []) : [],
    need('projects')                        ? fetch('/api/projects').then(r => r.json()).catch(() => []) : [],
    (need('costing') || need('cost'))       ? fetch(`/api/accessories?from=${dateFrom}&to=${dateTo}&limit=2000`).then(r => r.json()).catch(() => ({ entries: [] })) : { entries: [] },
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

  // Spare parts  -  store-wise
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

  // â”€â”€ PDF setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const jsPDFmod  = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;
  const attPdf    = await import('../utils/generatePDF');
  const attLogo   = await attPdf.loadLogo().catch(() => null);
  const doc = new jsPDFmod({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  const H = 210;

  // Design tokens
  const PRIMARY : [number,number,number] = [11,  92,  173];  // #0B5CAD - corporate blue
  const SECOND  : [number,number,number] = [31,  41,  55];   // #1F2937 - dark charcoal
  const BG      : [number,number,number] = [248, 250, 252];  // #F8FAFC
  const SUCCESS : [number,number,number] = [16,  185, 129];  // #10B981
  const WARNING : [number,number,number] = [245, 158, 11];   // #F59E0B
  const DANGER  : [number,number,number] = [220, 38,  38];
  const NEUTRAL : [number,number,number] = [100, 116, 139];  // #64748B
  const DARK    : [number,number,number] = [17,  24,  39];   // #111827
  const WHITE   : [number,number,number] = [255, 255, 255];
  const NAVY    : [number,number,number] = [11,  92,  173];  // same as PRIMARY
  const TEAL    : [number,number,number] = [15,  118, 110];
  const PURPLE  : [number,number,number] = [124, 58,  237];
  const ORANGE  : [number,number,number] = [245, 158, 11];
  const ALT_ROW : [number,number,number] = [248, 250, 252];
  const BORDER  : [number,number,number] = [209, 213, 219];  // #D1D5DB

  const tblHead = { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold' as const, fontSize: 9.5, cellPadding: 3.5 };
  const tblAlt  = { fillColor: [248, 250, 252] as [number, number, number] };
  const tblLine = { lineColor: BORDER as [number, number, number], lineWidth: 0.2 };

  // â”€â”€ Layout constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const HDR_H  = 13;   // header band height (mm)
  const FOOT_H = 12;   // footer strip height
  const ML     = 10;   // left margin
  const USABLE = H - FOOT_H - 4; // 210 - 12 - 4 = 194

  // â”€â”€ KPI card helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const drawKPICard = (x: number, ky: number, w: number, h: number, label: string, value: string, color: [number,number,number], sub = '') => {
    // Drop shadow
    doc.setFillColor(215, 225, 240);
    doc.roundedRect(x + 1.5, ky + 1.5, w, h, 3, 3, 'F');
    // White card
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, ky, w, h, 3, 3, 'FD');
    // Color top bar
    doc.setFillColor(...color);
    doc.roundedRect(x, ky, w, 4, 3, 3, 'F');
    doc.rect(x, ky + 2, w, 2, 'F');
    // Color left accent
    doc.setFillColor(...color);
    doc.roundedRect(x, ky + 4, 3, h - 4, 0.5, 0.5, 'F');
    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...color);
    doc.text(value, x + w / 2, ky + h / 2 + 3, { align: 'center' });
    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...NEUTRAL);
    doc.text(label.toUpperCase(), x + w / 2, ky + h - 3.5, { align: 'center' });
    // Sub text if any
    if (sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(180, 195, 215);
      doc.text(sub, x + w / 2, ky + 13, { align: 'center' });
    }
  };

  // Background grid texture helper
  const drawPageBg = () => {
    doc.setDrawColor(232, 238, 248);
    doc.setLineWidth(0.08);
    for (let gx = 20; gx < W; gx += 20) doc.line(gx, 0, gx, H - FOOT_H);
    for (let gy = 20; gy < H - FOOT_H; gy += 20) doc.line(0, gy, W, gy);
    // Corner accent marks
    doc.setDrawColor(200, 215, 235);
    doc.setLineWidth(0.3);
    const cm = 6;
    doc.line(0, 0, cm, 0); doc.line(0, 0, 0, cm);
    doc.line(W - cm, 0, W, 0); doc.line(W, 0, W, cm);
    doc.line(0, H - FOOT_H - cm, 0, H - FOOT_H); doc.line(0, H - FOOT_H, cm, H - FOOT_H);
    doc.line(W - cm, H - FOOT_H, W, H - FOOT_H); doc.line(W, H - FOOT_H - cm, W, H - FOOT_H);
  };

  // â”€â”€ Section header helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let y = 0;

  // Draw compact header band at any vertical position
  const drawHdrBand = (title: string, subtitle: string, atY: number) => {
    // Dark charcoal base
    doc.setFillColor(...SECOND);
    doc.rect(0, atY, W, HDR_H, 'F');
    // Left primary blue panel
    doc.setFillColor(...PRIMARY);
    doc.rect(0, atY, W * 0.55, HDR_H, 'F');
    // Left amber accent stripe
    doc.setFillColor(...ORANGE);
    doc.rect(0, atY, 4, HDR_H, 'F');
    // Bottom accent line
    doc.setFillColor(...ORANGE);
    doc.rect(0, atY + HDR_H, W, 0.8, 'F');
    // Section indicator dots
    doc.setFillColor(255, 255, 255);
    doc.circle(W * 0.55 + 4, atY + HDR_H / 2, 0.8, 'F');
    doc.circle(W * 0.55 + 8, atY + HDR_H / 2, 0.8, 'F');
    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.text(title, ML + 3, atY + 9);
    // Subtitle
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(180, 195, 215);
      doc.text(subtitle, W - ML, atY + 9, { align: 'right' });
    }
  };

  const getLastY = () => { const v = (doc as any).lastAutoTable?.finalY; return v != null ? v : y; };

  // Smart section header: only adds a new page when not enough space remains
  const sectionHeader = (title: string, subtitle = '', minH = 50) => {
    const curY = Math.max(getLastY(), y);
    let headerY: number;
    if (curY + 8 + HDR_H + minH > USABLE) {
      doc.addPage();
      headerY = 0;
    } else {
      headerY = curY + 8;
    }
    drawHdrBand(title, subtitle, headerY);
    return headerY + HDR_H + 3;
  };

  // Continuation header for costing sub-sections
  const contHeader = (title: string, subtitle = '', minH = 50) => {
    const curY = getLastY();
    let headerY: number;
    if (curY + 8 + HDR_H + minH > USABLE) {
      doc.addPage();
      headerY = 0;
    } else {
      headerY = curY + 8;
    }
    drawHdrBand(title, subtitle, headerY);
    return headerY + HDR_H + 3;
  };

  const subHeader = (sy: number, text: string) => {
    // Primary blue accent bar
    doc.setFillColor(...PRIMARY);
    doc.roundedRect(ML, sy, 3.5, 6, 1, 1, 'F');
    // Very subtle bg behind text
    doc.setFillColor(240, 246, 255);
    doc.rect(ML + 3.5, sy, W - ML * 2 - 3.5, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(text, ML + 7, sy + 4.3);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(ML, sy + 6.5, W - ML, sy + 6.5);
    return sy + 9;
  };

  // ── FIRST PAGE COVER HEADER ────────────────────────────────────────────────
  const cvH = 32;
  // Background
  drawPageBg();
  // Navy left panel (65% width)
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W * 0.65, cvH, 'F');
  // Dark right panel (35% width)
  doc.setFillColor(...SECOND);
  doc.rect(W * 0.65, 0, W * 0.35, cvH, 'F');
  // Left amber stripe
  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, 5, cvH, 'F');
  // Bottom accent line
  doc.setFillColor(...ORANGE);
  doc.rect(0, cvH, W, 1.5, 'F');

  // Logo
  if (attLogo) {
    doc.addImage(attLogo, 'PNG', 10, 5, 22, 22);
  } else {
    doc.setFillColor(...WHITE); doc.roundedRect(10, 5, 22, 22, 3, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...PRIMARY);
    doc.text('GT', 21, 18, { align: 'center' });
  }

  // Company name
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...WHITE);
  doc.text('Glass Technology', 37, 13);
  // Department subtitle
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(186, 230, 253);
  doc.text('Electrical & Instrumentation Department  —  Maintenance Management System', 37, 21);
  // Report type badge
  doc.setFillColor(...ORANGE);
  doc.roundedRect(37, 24, 78, 6.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...SECOND);
  doc.text('MONTHLY MANAGEMENT REPORT  •  PLANT DIRECTOR COPY', 76, 28.5, { align: 'center' });

  // Right panel — period info
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(160, 180, 210);
  doc.text('REPORT PERIOD', W - 8, 10, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...WHITE);
  doc.text(monthLabel, W - 8, 21, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(160, 180, 210);
  doc.text(`Prepared by: E&I Dept.  |  Generated: ${today}`, W - 8, 29, { align: 'right' });

  y = cvH + 5;

  // â”€â”€â”€ 1. SPARE PARTS STORE-WISE SUMMARY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (need('spares')) {
    y = sectionHeader('Spare Parts  -  Store-Wise Cost Summary', `As of ${today}`);
    const allStoreRows = [
      ...regularStores.map(s => ({ store: s.store, count: s.count, value: s.value, isOEM: false, isTotalRow: false })),
      { store: 'Total (Regular Stores)', count: regularCount, value: regularTotal, isOEM: false, isTotalRow: true },
      { store: 'OEM SPARES  -  COST INCLUDED IN PROJECT', count: null, value: null, isOEM: true, isBanner: true },
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
      styles: { fontSize: 9, cellPadding: 3, ...tblLine },
      headStyles: tblHead,
      columnStyles: {
        0: { cellPadding: { top: 3, right: 3, bottom: 3, left: 9 } },
        1: { halign: 'center' },
        2: { halign: 'right' },
      },
      tableWidth: 190,
      margin: { left: ML },
      tableLineColor: BORDER, tableLineWidth: 0.4,
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
        // Banner row: merge-look  -  print text spanning all columns
        if (data.section === 'body' && data.column.index === 0) {
          const row = allStoreRows[data.row.index];
          if ((row as any).isBanner) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(234, 88, 12);
            doc.text('OEM SPARES  -  COST INCLUDED IN PROJECT (FREE OF COST)', data.cell.x + 2, data.cell.y + data.cell.height / 2 + 1.5);
          }
        }
      },
    });
  }

  // Attendance data prepared here for later rendering

  // â”€â”€â”€ 3. OUTSOURCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (need('outsource')) {
    y = sectionHeader('Outsource Work Details', `${dateFrom} â€“ ${dateTo}`);

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
        styles: { fontSize: 9, cellPadding: 3, ...tblLine },
        headStyles: tblHead,
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'right' } },
        alternateRowStyles: tblAlt,
        tableLineColor: BORDER, tableLineWidth: 0.4,
        didParseCell: (data: any) => { if (data.row.index === sumRows.length) { data.cell.styles.fillColor = NAVY; data.cell.styles.textColor = WHITE; data.cell.styles.fontStyle = 'bold'; } },
      });
      y = (doc as any).lastAutoTable.finalY + 5;
      if (outsourceEntries.length <= 30) {
        y = subHeader(y, 'Work Log');
        autoTable(doc, {
          startY: y,
          head: [['Date', 'Vendor', 'Description', 'Hours', 'Cost (AED)', 'Status']],
          body: outsourceEntries.map((e: any) => [
            e.workDate ? new Date(e.workDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ' - ',
            e.vendorCompany || ' - ',
            (e.workDescription || ' - ').substring(0, 38),
            e.workingHours || 0,
            fmtAED(e.totalCost),
            e.completionStatus || ' - ',
          ]),
          styles: { fontSize: 7.5, cellPadding: 2.5, ...tblLine },
          headStyles: tblHead,
          columnStyles: { 3: { halign: 'center' }, 4: { halign: 'right' } },
          alternateRowStyles: tblAlt,
          tableLineColor: BORDER, tableLineWidth: 0.4,
        });
      }
    } else {
      doc.setFontSize(9); doc.setTextColor(...NEUTRAL);
      doc.text('No outsource entries found for this period.', 10, y + 6);
    }
  }

  // â”€â”€â”€ 4. RENTAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (need('rental')) {
    y = sectionHeader('Rental Equipment Details', `${dateFrom} â€“ ${dateTo}`);

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
        styles: { fontSize: 9, cellPadding: 3, ...tblLine },
        headStyles: tblHead,
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'right' } },
        alternateRowStyles: tblAlt,
        tableLineColor: BORDER, tableLineWidth: 0.4,
        didParseCell: (data: any) => { if (data.row.index === sumRows.length) { data.cell.styles.fillColor = NAVY; data.cell.styles.textColor = WHITE; data.cell.styles.fontStyle = 'bold'; } },
      });
    } else {
      doc.setFontSize(9); doc.setTextColor(...NEUTRAL);
      doc.text('No rental equipment entries found for this period.', 10, y + 6);
    }
  }

  // Shared page-2 dynamic row padding (computed in purchase block, reused in cost block)
  let rPad: number = 3;
  let tBoxC: [number,number,number] = [200, 210, 225];

  // â”€â”€â”€ 5. E&I PURCHASE STATUS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (need('purchase')) {
    // Page 1 continues from cover header — no extra sectionHeader needed
    if (pendingItems.length) {
      y = subHeader(y, 'E&I Pending Purchase Items');
      // Dynamic row height to fill remaining page 1 space
      const availH   = USABLE - y - 2;
      const totalRows = pendingItems.length + 1; // +1 for footer row
      const hdrRowH  = 10;
      const bodyRowH = Math.max(7, Math.min(22, (availH - hdrRowH) / totalRows));
      const rowPad   = Math.max(2, (bodyRowH - 5.5) / 2);
      autoTable(doc, {
        startY: y,
        head: [['SL', 'Item Description', 'Request Date', 'Days', 'Required Timeline', 'Current Status', 'PR Number', 'Req. Date', 'Budget', 'Lead Time', 'Working Time']],
        body: pendingItems.map((r: any, i: number) => {
          const reqDt = r.requestDate ? new Date(r.requestDate) : null;
          const days  = reqDt ? Math.floor((Date.now() - reqDt.getTime()) / 86400000) : ' - ';
          const fmtD  = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : ' - ';
          return [
            i + 1,
            (r.itemDescription || ' - ').substring(0, 50),
            fmtD(r.requestDate),
            days,
            r.requiredTimeline || ' - ',
            r.currentStatus || ' - ',
            r.prNumber || ' - ',
            fmtD(r.reqDate),
            r.budget ? fmtAED(r.budget) : ' - ',
            r.leadTime || ' - ',
            r.workingTime || ' - ',
          ];
        }),
        foot: [[
          { content: 'TOTAL BUDGET', colSpan: 8, styles: { halign: 'right', fontStyle: 'bold', fillColor: NAVY, textColor: WHITE, fontSize: 7 } },
          { content: fmtAED(pendingBudget), styles: { halign: 'right', fontStyle: 'bold', fillColor: NAVY, textColor: WHITE, fontSize: 7 } },
          { content: '', styles: { fillColor: NAVY } },
          { content: '', styles: { fillColor: NAVY } },
        ]],
        showFoot: 'lastPage',
        styles: { fontSize: 7, cellPadding: { top: rowPad, bottom: rowPad, left: 2, right: 2 }, lineColor: [210, 215, 225], lineWidth: 0.15 },
        headStyles: { ...tblHead, fontSize: 7, cellPadding: { top: 3, bottom: 3, left: 2, right: 2 } },
        tableLineColor: [180, 190, 205],
        tableLineWidth: 0.3,
        margin: { left: ML, right: ML },
        tableWidth: W - ML * 2,
        columnStyles: {
          0:  { halign: 'center', cellWidth: 7 },
          1:  { halign: 'left',   cellWidth: 'auto' },
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

    // PAGE 2: Materials Received + Cost Summary
    const receivedThisMonth = followupRecords.filter((r: any) => {
      if (r.currentStatus !== 'Material Received') return false;
      if (!r.receivedDate) return true;
      const d = new Date(r.receivedDate);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });
    doc.addPage();
    drawPageBg();
    drawHdrBand('Materials Received & Cost Summary', monthLabel, 0);
    y = HDR_H + 5;

    // Calculate dynamic row padding to fill page 2 fully
    // Fixed overhead: header(15) + subH1(9) + subH2(13) + totalExpBar(17) + gaps(6)
    const p2Overhead  = HDR_H + 5 + 9 + 13 + 17 + 6;
    const p2Available = USABLE - p2Overhead;
    const n1 = receivedThisMonth.length || 1;
    const n2 = 6; // costRows count
    const hH = 10; // header row height estimate
    const bodySpace = Math.max(60, p2Available - hH * 2);
    const rowH  = Math.max(7, Math.min(18, bodySpace / (n1 + n2)));
    rPad  = Math.max(2.5, (rowH - 5) / 2);
    tBoxC = [200, 210, 225];

    y = subHeader(y, `Materials Received This Month (${receivedThisMonth.length})`);
    if (receivedThisMonth.length > 0) {
      const fmtDs = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : ' - ';
      autoTable(doc, {
        startY: y,
        head: [['#', 'Item Description', 'PR Number', 'Request Date', 'Received Date', 'Budget (AED)']],
        body: receivedThisMonth.map((r: any, i: number) => [
          i + 1,
          (r.itemDescription || ' - ').substring(0, 60),
          r.prNumber || ' - ',
          fmtDs(r.requestDate),
          fmtDs(r.receivedDate),
          r.budget ? fmtAED(r.budget) : ' - ',
        ]),
        margin: { left: ML, right: ML },
        tableWidth: W - ML * 2,
        styles: { fontSize: 8.5, cellPadding: { top: rPad, bottom: rPad, left: 3, right: 3 }, lineColor: [160, 195, 170], lineWidth: 0.2 },
        headStyles: { fillColor: SUCCESS, textColor: WHITE, fontStyle: 'bold', fontSize: 9, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 } },
        columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 1: { halign: 'left' }, 2: { halign: 'center', cellWidth: 32 }, 3: { halign: 'center', cellWidth: 28 }, 4: { halign: 'center', cellWidth: 28 }, 5: { halign: 'right', cellWidth: 30 } },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        tableLineColor: [100, 160, 120], tableLineWidth: 0.5,
      });
    } else {
      doc.setFontSize(9); doc.setTextColor(...NEUTRAL);
      doc.text(`No materials received in ${monthLabel}.`, ML, y + 6);
      y = y + 14;
    }
    if ((doc as any).lastAutoTable) y = Math.max(y, (doc as any).lastAutoTable.finalY + 6);
  }

  // â”€â”€â”€ 6. RECEIVED POs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (need('po')) {
    y = sectionHeader('Monthly Received Purchase Orders', `${dateFrom} â€“ ${dateTo}`);

    if (receivedPOs.length) {
      y = subHeader(y, 'Purchase Orders in Period');
      autoTable(doc, {
        startY: y,
        head: [['PO No.', 'Date', 'Vendor', 'Dept.', 'Items', 'Total (AED)', 'Status']],
        body: receivedPOs.map((po: any) => [
          po.poNo || ' - ',
          po.poDate || ' - ',
          (po.vendor || ' - ').substring(0, 18),
          po.department || ' - ',
          (po.items || []).length,
          fmtAED(po.totalValue),
          po.status || ' - ',
        ]),
        styles: { fontSize: 8, cellPadding: 2.5, ...tblLine },
        headStyles: tblHead,
        columnStyles: { 4: { halign: 'center' }, 5: { halign: 'right' } },
        alternateRowStyles: tblAlt,
        tableLineColor: BORDER, tableLineWidth: 0.4,
      });
      y = (doc as any).lastAutoTable.finalY + 4;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...PRIMARY);
      doc.text(`Total PO Value for Period: ${fmtAED(totalPOValue)}`, W - ML, y, { align: 'right' });
    } else {
      doc.setFontSize(9); doc.setTextColor(...NEUTRAL);
      doc.text('No purchase orders found for this period.', 10, y + 6);
      y = y + 12;
      if ((doc as any).lastAutoTable) (doc as any).lastAutoTable.finalY = y;
    }
  }

  // â”€â”€â”€ 7. PURCHASE COST SUMMARY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (need('cost')) {
    // Continues on page 2 after Materials Received
    y = subHeader(y + 4, 'COST Summary');
    const accEntryTotal = (e: any) =>
      e.totalCost || (e.items || []).reduce((is: number, it: any) => is + (it.totalCost || 0), 0);
    const accCostTotal = accEntries.reduce((s: number, e: any) => s + accEntryTotal(e), 0);
    const costRows = [
      ['POs Received (Period)',         fmtAED(totalPOValue),  `${receivedPOs.length} POs`],
      ['All POs (All Time Total)',      fmtAED(allPOTotal),    `${allPOs.length} POs`],
      ['Outsource Cost (Period)',       fmtAED(outsourceCost), `${outsourceEntries.length} jobs`],
      ['Rental Equipment (Period)',     fmtAED(rentalCost),    `${rentalEntries.length} entries`],
      ['Accessories by Category Cost', fmtAED(accCostTotal),  `${accEntries.length} entries`],
      ['Pending Purchase Budget',       fmtAED(pendingBudget), `${pendingItems.length} pending items`],
    ];
    autoTable(doc, {
      startY: y,
      head: [['Category', 'Amount (AED)', 'Remarks']],
      body: costRows,
      margin: { left: ML, right: ML },
      tableWidth: W - ML * 2,
      styles: { fontSize: 9, cellPadding: { top: rPad, bottom: rPad, left: 3, right: 3 }, lineColor: [160, 180, 210], lineWidth: 0.2 },
      headStyles: { ...tblHead, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 } },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'right', fontStyle: 'bold', cellWidth: 50 },
        2: { halign: 'left',  textColor: NEUTRAL, cellWidth: 60 },
      },
      alternateRowStyles: tblAlt,
      tableLineColor: [120, 150, 190], tableLineWidth: 0.5,
    });
    y = (doc as any).lastAutoTable.finalY + 5;

    const totalSpend = totalPOValue + outsourceCost + rentalCost + accCostTotal;
    doc.setFillColor(...NAVY);
    doc.roundedRect(ML, y, W - ML * 2, 14, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.text(`Total Expenditure for Period: ${fmtAED(totalSpend)}`, W / 2, y + 9.5, { align: 'center' });
  }

  // â”€â”€â”€ 8. PROJECTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      const pkW = 52, pkH = 24;
      pKPIs.forEach((k, i) => drawKPICard(ML + i * (pkW + 4), y, pkW, pkH, k.label, k.value, k.color));
      y += pkH + 6;

      y = subHeader(y, 'Project Details');
      autoTable(doc, {
        startY: y,
        head: [['#', 'Project No.', 'Name', 'Type', 'Status', 'Progress', 'Budget (AED)', 'Spent (AED)', 'Manager']],
        body: projects.map((p: any, i: number) => [
          i + 1,
          p.projectNo || ' - ',
          (p.name || ' - ').substring(0, 25),
          p.type || ' - ',
          p.status || ' - ',
          `${p.progress || 0}%`,
          fmtAED(p.budget),
          fmtAED(p.spent),
          (p.projectManager || ' - ').substring(0, 14),
        ]),
        styles: { fontSize: 7.5, cellPadding: 2.5, ...tblLine },
        headStyles: tblHead,
        columnStyles: {
          0: { halign: 'center', cellWidth: 7 },
          5: { halign: 'center' },
          6: { halign: 'right' },
          7: { halign: 'right' },
        },
        alternateRowStyles: tblAlt,
        tableLineColor: BORDER, tableLineWidth: 0.4,
      });
    } else {
      doc.setFontSize(9); doc.setTextColor(...NEUTRAL);
      doc.text('No projects found.', 10, y + 6);
    }
  }

  // --- 9. E&I COSTING REPORT -------------------------------------------
  if (need('costing')) {
    const outsourceCostT = outsourceEntries.reduce((s: number, e: any) => s + (e.totalCost || 0), 0);
    const equipmentCostT = rentalEntries.reduce((s: number,   e: any) => s + (e.totalCost || 0), 0);
    const calcAccTotal   = (e: any) => e.totalCost || (e.items || []).reduce((is: number, it: any) => is + (it.totalCost || 0), 0);
    const accessoryCostT = accEntries.reduce((s: number,      e: any) => s + calcAccTotal(e), 0);
    const grandCostT     = outsourceCostT + equipmentCostT + accessoryCostT;

    // Pre-build breakdowns
    const contractMap: Record<string, { company: string; entries: number; cost: number }> = {};
    outsourceEntries.forEach((r: any) => {
      const k = r.contractName || 'Unknown';
      if (!contractMap[k]) contractMap[k] = { company: r.contractorCompany || '-', entries: 0, cost: 0 };
      contractMap[k].entries++; contractMap[k].cost += r.totalCost || 0;
    });
    const contractList = Object.entries(contractMap).sort((a, b) => b[1].cost - a[1].cost);

    const equipMap: Record<string, { vendor: string; entries: number; cost: number }> = {};
    rentalEntries.forEach((r: any) => {
      const k = r.equipmentName || 'Unknown';
      if (!equipMap[k]) equipMap[k] = { vendor: r.vendorCompany || '-', entries: 0, cost: 0 };
      equipMap[k].entries++; equipMap[k].cost += r.totalCost || 0;
    });
    const equipList = Object.entries(equipMap).sort((a, b) => b[1].cost - a[1].cost);

    const accCatMap: Record<string, number> = {};
    accEntries.forEach((r: any) => {
      (r.items || []).forEach((it: any) => {
        accCatMap[it.category] = (accCatMap[it.category] || 0) + (it.totalCost || 0);
      });
    });
    const accCats = Object.entries(accCatMap).sort((a, b) => b[1] - a[1]);

    // Draw a pie slice as a filled polygon (arc approximation)
    const drawPieSlice = (cx: number, cy: number, r: number, startDeg: number, endDeg: number, color: [number, number, number]) => {
      const toRad = (d: number) => (d - 90) * Math.PI / 180;
      const s = toRad(startDeg);
      const e = toRad(endDeg);
      const steps = Math.max(6, Math.ceil(Math.abs(endDeg - startDeg) / 10));
      const arcPts: [number, number][] = [];
      for (let si = 0; si <= steps; si++) {
        const a = s + (e - s) * (si / steps);
        arcPts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      const lines: [number, number][] = [[arcPts[0][0] - cx, arcPts[0][1] - cy]];
      for (let si = 1; si < arcPts.length; si++) {
        lines.push([arcPts[si][0] - arcPts[si - 1][0], arcPts[si][1] - arcPts[si - 1][1]]);
      }
      doc.setFillColor(...color);
      doc.lines(lines, cx, cy, [1, 1], 'F', true);
    };

    // ── PAGE 3: E&I COSTING DASHBOARD ─────────────────────────────────────
    doc.addPage();
    drawPageBg();
    drawHdrBand('E&I Costing Report', `Period: ${monthLabel}`, 0);
    y = HDR_H + 4;

    // Subtitle info bar
    doc.setFillColor(248, 250, 252);
    doc.rect(ML, y, W - ML * 2, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...PRIMARY);
    doc.text(`Period: ${monthLabel}`, ML + 4, y + 4.5);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...NEUTRAL);
    doc.text(
      `${outsourceEntries.length} outsource entries  |  ${rentalEntries.length} equipment entries  |  ${accEntries.length} accessory entries`,
      W - ML - 4, y + 4.5, { align: 'right' }
    );
    y += 9;

    // KPI cards (4 across)
    const kpiCBW = (W - ML * 2 - 9) / 4;
    const kpiH = 26;
    const kpiDefs = [
      { label: 'OUTSOURCE LABOUR', icon: 'O', value: fmtAED(outsourceCostT), sub: `${outsourceEntries.length} entries`, color: TEAL as [number, number, number] },
      { label: 'EQUIPMENT USAGE',  icon: 'E', value: fmtAED(equipmentCostT), sub: `${rentalEntries.length} entries`,   color: PURPLE as [number, number, number] },
      { label: 'ACCESSORIES',      icon: 'A', value: fmtAED(accessoryCostT), sub: `${accEntries.length} entries`,      color: WARNING as [number, number, number] },
      { label: 'GRAND TOTAL',      icon: '$', value: fmtAED(grandCostT),     sub: `${outsourceEntries.length + rentalEntries.length + accEntries.length} total entries`, color: DANGER as [number, number, number] },
    ];
    kpiDefs.forEach((k, i) => {
      const kx = ML + i * (kpiCBW + 3);
      // Shadow + white card
      doc.setFillColor(210, 218, 226); doc.roundedRect(kx + 1, y + 1, kpiCBW, kpiH, 2, 2, 'F');
      doc.setFillColor(...WHITE); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
      doc.roundedRect(kx, y, kpiCBW, kpiH, 2, 2, 'FD');
      // Icon badge (top-left)
      doc.setFillColor(...k.color); doc.roundedRect(kx + 4, y + 4.5, 7, 7, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...WHITE);
      doc.text(k.icon, kx + 4 + 3.5, y + 9.5, { align: 'center' });
      // Small label (top, beside icon)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...NEUTRAL);
      doc.text(k.label, kx + 13.5, y + 9.5);
      // Large value (center)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...k.color);
      doc.text(k.value, kx + kpiCBW / 2, y + kpiH / 2 + 5, { align: 'center' });
      // Sub text (bottom)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(170, 188, 208);
      doc.text(k.sub, kx + kpiCBW / 2, y + kpiH - 3, { align: 'center' });
    });
    y += kpiH + 5;

    // Charts row
    const chartY  = y;
    const chartH  = 56;
    const barPanW = 185;
    const dnutX   = ML + barPanW + 5;
    const dnutW   = W - ML - dnutX;

    // Bar chart panel
    doc.setFillColor(...WHITE); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3);
    doc.roundedRect(ML, chartY, barPanW, chartH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...DARK);
    doc.text('Cost Breakdown by Category', ML + barPanW / 2, chartY + 6, { align: 'center' });

    const bPlot = { x: ML + 20, y: chartY + 12, w: barPanW - 28, h: chartH - 23 };
    const barsD = [
      { val: outsourceCostT, color: TEAL as [number, number, number],    label: 'Outsource Labour' },
      { val: equipmentCostT, color: PURPLE as [number, number, number],  label: 'Equipment Usage' },
      { val: accessoryCostT, color: WARNING as [number, number, number], label: 'Accessories' },
    ];
    const maxBV  = Math.max(...barsD.map(b => b.val), 1);
    const barW   = Math.floor(bPlot.w / 5);
    const bSpace = (bPlot.w - barW * 3) / 4;

    // Grid + axes
    doc.setDrawColor(240, 244, 248); doc.setLineWidth(0.15);
    for (let gi = 1; gi <= 4; gi++) {
      const gy = bPlot.y + bPlot.h - (gi / 4) * bPlot.h;
      doc.line(bPlot.x, gy, bPlot.x + bPlot.w, gy);
      const gv = (gi / 4) * maxBV;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(4.5); doc.setTextColor(...NEUTRAL);
      doc.text(gv >= 1000 ? `${Math.round(gv / 1000)}k` : String(Math.round(gv)), bPlot.x - 1, gy + 1.5, { align: 'right' });
    }
    doc.setDrawColor(210, 218, 226); doc.setLineWidth(0.2);
    doc.line(bPlot.x, bPlot.y, bPlot.x, bPlot.y + bPlot.h);
    doc.line(bPlot.x, bPlot.y + bPlot.h, bPlot.x + bPlot.w, bPlot.y + bPlot.h);

    barsD.forEach((bar, i) => {
      const bx = bPlot.x + bSpace + i * (barW + bSpace);
      const bh = (bar.val / maxBV) * bPlot.h;
      const by = bPlot.y + bPlot.h - bh;
      doc.setFillColor(...bar.color);
      if (bh > 0) doc.roundedRect(bx, by, barW, bh, 1, 1, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(...NEUTRAL);
      const words = bar.label.split(' ');
      words.forEach((word, wi) => doc.text(word, bx + barW / 2, bPlot.y + bPlot.h + 4 + wi * 3.5, { align: 'center' }));
    });

    // Donut chart panel
    doc.setFillColor(...WHITE); doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3);
    doc.roundedRect(dnutX, chartY, dnutW, chartH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...DARK);
    doc.text('Cost Split', dnutX + dnutW * 0.38, chartY + 6, { align: 'center' });

    const dCx = dnutX + Math.round(dnutW * 0.35);
    const dCy = chartY + Math.round(chartH / 2) + 5;
    const dR  = 17;
    const dIR = 10;
    const dSegs = [
      { val: outsourceCostT, color: PURPLE as [number, number, number], label: 'Outsource Labour' },
      { val: equipmentCostT, color: TEAL   as [number, number, number], label: 'Equipment Usage' },
      { val: accessoryCostT, color: WARNING as [number, number, number], label: 'Accessories' },
    ];

    doc.setFillColor(238, 242, 246); doc.circle(dCx, dCy, dR, 'F');
    let dAngle = 0;
    dSegs.forEach(seg => {
      if (grandCostT > 0 && seg.val > 0) {
        const sweep = (seg.val / grandCostT) * 360;
        drawPieSlice(dCx, dCy, dR, dAngle, dAngle + sweep, seg.color);
        dAngle += sweep;
      }
    });
    doc.setFillColor(...WHITE); doc.circle(dCx, dCy, dIR, 'F');

    const lgX = dnutX + Math.round(dnutW * 0.6);
    dSegs.forEach((seg, i) => {
      const ly = chartY + 15 + i * 14;
      doc.setFillColor(...seg.color); doc.roundedRect(lgX, ly, 3.5, 3.5, 0.8, 0.8, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...DARK);
      doc.text(seg.label, lgX + 5.5, ly + 3);
      const pct = grandCostT > 0 ? Math.round(seg.val / grandCostT * 100) : 0;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...seg.color);
      doc.text(`${pct}%`, dnutX + dnutW - 3, ly + 3, { align: 'right' });
    });

    y = chartY + chartH + 5;

    // 3 side-by-side summary tables
    const tGap = 4;
    const tW1  = 89;
    const tW2  = 89;
    const tW3  = W - ML - (ML + tW1 + tGap + tW2 + tGap);
    const t1X  = ML;
    const t2X  = t1X + tW1 + tGap;
    const t3X  = t2X + tW2 + tGap;
    const tLblY = y + 3;
    const tStartY = y + 7;
    let maxTFY = tStartY;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    doc.setTextColor(...TEAL);   doc.text('Outsource by Contract',   t1X + 2, tLblY);
    doc.setTextColor(...PURPLE); doc.text('Equipment Usage',          t2X + 2, tLblY);
    doc.setTextColor(...WARNING); doc.text('Accessories by Category', t3X + 2, tLblY);

    const tBoxLine: [number,number,number] = [200, 210, 225];
    autoTable(doc, {
      startY: tStartY, margin: { left: t1X, right: W - (t1X + tW1) },
      head: [['Contract', 'Entries', 'Cost (AED)']],
      body: contractList.length
        ? contractList.map(([name, d]) => [name, d.entries, fmtAED(d.cost)])
        : [['No data', '-', '-']],
      foot: [['TOTAL', outsourceEntries.length, fmtAED(outsourceCostT)]],
      headStyles: { fillColor: TEAL, textColor: WHITE, fontSize: 7.5, fontStyle: 'bold', cellPadding: 2 },
      footStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 7.5, fontStyle: 'bold', cellPadding: 2, halign: 'left' as const },
      bodyStyles: { fontSize: 7.5, cellPadding: 2, lineColor: tBoxLine, lineWidth: 0.15 },
      columnStyles: { 0: { halign: 'left' as const }, 1: { halign: 'center' as const }, 2: { halign: 'right' as const, fontStyle: 'bold' as const } },
      alternateRowStyles: { fillColor: [240, 253, 250] },
      tableWidth: tW1, tableLineColor: tBoxLine, tableLineWidth: 0.4,
    });
    maxTFY = Math.max(maxTFY, (doc as any).lastAutoTable?.finalY ?? tStartY);

    autoTable(doc, {
      startY: tStartY, margin: { left: t2X, right: W - (t2X + tW2) },
      head: [['Equipment', 'Entries', 'Cost (AED)']],
      body: equipList.length
        ? equipList.map(([name, d]) => [`${name}\n${d.vendor}`, d.entries, fmtAED(d.cost)])
        : [['No data', '-', '-']],
      foot: [['TOTAL', rentalEntries.length, fmtAED(equipmentCostT)]],
      headStyles: { fillColor: PURPLE, textColor: WHITE, fontSize: 7.5, fontStyle: 'bold', cellPadding: 2 },
      footStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 7.5, fontStyle: 'bold', cellPadding: 2, halign: 'left' as const },
      bodyStyles: { fontSize: 7.5, cellPadding: 2, lineColor: tBoxLine, lineWidth: 0.15 },
      columnStyles: { 0: { halign: 'left' as const }, 1: { halign: 'center' as const }, 2: { halign: 'right' as const, fontStyle: 'bold' as const } },
      alternateRowStyles: { fillColor: [245, 243, 255] },
      tableWidth: tW2, tableLineColor: tBoxLine, tableLineWidth: 0.4,
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 0 && data.row.index % 2 === 0) {
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    maxTFY = Math.max(maxTFY, (doc as any).lastAutoTable?.finalY ?? tStartY);

    autoTable(doc, {
      startY: tStartY, margin: { left: t3X, right: ML },
      head: [['Category', 'Cost (AED)', 'Share']],
      body: accCats.length
        ? accCats.map(([cat, cost]) => [cat, fmtAED(cost as number), ''])
        : [['No data', '-', '']],
      foot: [['TOTAL', fmtAED(accessoryCostT), '100%']],
      headStyles: { fillColor: WARNING, textColor: WHITE, fontSize: 7.5, fontStyle: 'bold', cellPadding: 2 },
      footStyles: { fillColor: [255, 251, 225], textColor: NAVY, fontSize: 7.5, fontStyle: 'bold', cellPadding: 2, halign: 'left' as const },
      bodyStyles: { fontSize: 7.5, cellPadding: 2, lineColor: tBoxLine, lineWidth: 0.15 },
      columnStyles: { 0: { halign: 'left' as const }, 1: { halign: 'right' as const, fontStyle: 'bold' as const }, 2: { cellWidth: 22 } },
      alternateRowStyles: { fillColor: [255, 251, 235] },
      tableWidth: tW3, tableLineColor: tBoxLine, tableLineWidth: 0.4,
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 2 && accCats[data.row.index]) {
          const cost = accCats[data.row.index][1] as number;
          const pct  = accessoryCostT > 0 ? cost / accessoryCostT : 0;
          const cell = data.cell;
          const barMaxW = cell.width - 10;
          const barH = 2.5;
          const barY = cell.y + (cell.height - barH) / 2;
          doc.setFillColor(235, 228, 210);
          doc.roundedRect(cell.x + 2, barY, barMaxW - 6, barH, 0.6, 0.6, 'F');
          if (pct > 0) {
            doc.setFillColor(...WARNING);
            doc.roundedRect(cell.x + 2, barY, (barMaxW - 6) * pct, barH, 0.6, 0.6, 'F');
          }
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...WARNING);
          doc.text(`${Math.round(pct * 100)}%`, cell.x + cell.width - 1.5, cell.y + cell.height / 2 + 1.5, { align: 'right' });
        }
      },
    });
    maxTFY = Math.max(maxTFY, (doc as any).lastAutoTable?.finalY ?? tStartY);

    // Grand total footer bar
    const gtH    = 26;
    const gtBarY = Math.min(maxTFY + 5, USABLE - gtH - 2);
    // Navy-blue bar
    doc.setFillColor(18, 52, 110); doc.roundedRect(ML, gtBarY, W - ML * 2, gtH, 2, 2, 'F');
    doc.setFillColor(26, 68, 140); doc.rect(ML, gtBarY + 2, W - ML * 2, gtH - 4, 'F');
    doc.setFillColor(18, 52, 110); doc.roundedRect(ML, gtBarY, W - ML * 2, gtH, 2, 2, 'D');
    // Left: label + grand total value
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(160, 190, 230);
    doc.text('GRAND TOTAL  -  ALL CATEGORIES COMBINED', ML + 5, gtBarY + 8);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...WHITE);
    doc.text(fmtAED(grandCostT), ML + 5, gtBarY + 21);
    // Vertical divider
    doc.setDrawColor(60, 100, 170); doc.setLineWidth(0.3);
    doc.line(W - ML - 190, gtBarY + 3, W - ML - 190, gtBarY + gtH - 3);
    // Right: 3 category columns — label on top, amount + % on same line below
    const gtCols = [
      { label: 'OUTSOURCE',   val: outsourceCostT, color: [80, 220, 200]  as [number, number, number], cx: W - ML - 178 },
      { label: 'EQUIPMENT',   val: equipmentCostT, color: [180, 140, 255] as [number, number, number], cx: W - ML - 112 },
      { label: 'ACCESSORIES', val: accessoryCostT, color: [255, 200, 80]  as [number, number, number], cx: W - ML - 28 },
    ];
    gtCols.forEach(c => {
      const pct = grandCostT > 0 ? Math.round(c.val / grandCostT * 100) : 0;
      // Label
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(160, 190, 230);
      doc.text(c.label, c.cx, gtBarY + 8, { align: 'center' });
      // Amount + % on same line
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...c.color);
      doc.text(fmtAED(c.val), c.cx - 5, gtBarY + 20, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(160, 190, 230);
      doc.text(`${pct}%`, c.cx + 16, gtBarY + 20, { align: 'center' });
    });

    // ── PAGE 2: COMBINED DETAILED BREAKDOWN (single page) ───────────────────
    doc.addPage();
    drawPageBg();
    drawHdrBand('E&I Costing - Detailed Breakdown', `${monthLabel}  |  Outsource + Equipment + Accessories`, 0);
    y = HDR_H + 4;

    // Outsource labour detail
    y = subHeader(y, 'Outsource Labour by Contract');
    autoTable(doc, {
      startY: y, margin: { left: ML, right: ML },
      head: [['#', 'Contract Name', 'Contractor Company', 'Entries', 'Total Cost (AED)', 'Share']],
      body: contractList.length ? contractList.map(([name, d], i) => [
        i + 1, name, d.company, d.entries, fmtAED(d.cost),
        outsourceCostT > 0 ? `${Math.round(d.cost / outsourceCostT * 100)}%` : '-',
      ]) : [['-', 'No outsource data for this period', '', '', '', '']],
      foot: [['', 'TOTAL', '', outsourceEntries.length, fmtAED(outsourceCostT), '100%']],
      headStyles: { fillColor: TEAL, textColor: WHITE, fontSize: 9, fontStyle: 'bold' },
      footStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, ...tblLine },
      columnStyles: { 4: { fontStyle: 'bold', textColor: TEAL, halign: 'right' as const }, 5: { halign: 'center' as const } },
      alternateRowStyles: { fillColor: [240, 253, 250] },
      tableLineColor: BORDER, tableLineWidth: 0.4,
    });

    // Equipment breakdown (same page)
    y = subHeader(((doc as any).lastAutoTable?.finalY ?? y) + 7, 'Equipment Usage by Asset');
    autoTable(doc, {
      startY: y, margin: { left: ML, right: ML },
      head: [['#', 'Equipment Name', 'Vendor / Company', 'Entries', 'Total Cost (AED)', 'Share']],
      body: equipList.length ? equipList.map(([name, d], i) => [
        i + 1, name, d.vendor, d.entries, fmtAED(d.cost),
        equipmentCostT > 0 ? `${Math.round(d.cost / equipmentCostT * 100)}%` : '-',
      ]) : [['-', 'No equipment data for this period', '', '', '', '']],
      foot: [['', 'TOTAL', '', rentalEntries.length, fmtAED(equipmentCostT), '100%']],
      headStyles: { fillColor: PURPLE, textColor: WHITE, fontSize: 9, fontStyle: 'bold' },
      footStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, ...tblLine },
      columnStyles: { 4: { fontStyle: 'bold', textColor: PURPLE, halign: 'right' as const }, 5: { halign: 'center' as const } },
      alternateRowStyles: { fillColor: [245, 243, 255] },
      tableLineColor: BORDER, tableLineWidth: 0.4,
    });

    // Accessories breakdown (same page)
    y = subHeader(((doc as any).lastAutoTable?.finalY ?? y) + 7, 'Accessories by Category');
    autoTable(doc, {
      startY: y, margin: { left: ML, right: ML },
      head: [['#', 'Category', 'Total Cost (AED)', 'Share of Accessories']],
      body: accCats.length ? accCats.map(([cat, cost], i) => [
        i + 1, cat, fmtAED(cost as number),
        accessoryCostT > 0 ? `${Math.round((cost as number) / accessoryCostT * 100)}%` : '-',
      ]) : [['-', 'No accessories data for this period', '', '']],
      foot: [['', 'TOTAL', fmtAED(accessoryCostT), '100%']],
      headStyles: { fillColor: WARNING, textColor: WHITE, fontSize: 9, fontStyle: 'bold' },
      footStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, ...tblLine },
      columnStyles: { 2: { fontStyle: 'bold', textColor: WARNING, halign: 'right' as const }, 3: { halign: 'center' as const } },
      alternateRowStyles: { fillColor: [255, 251, 235] },
      tableLineColor: BORDER, tableLineWidth: 0.4,
    });

    const finalCostY = Math.min(((doc as any).lastAutoTable?.finalY ?? 150) + 5, USABLE - 14);
    doc.setFillColor(...NAVY); doc.roundedRect(ML, finalCostY, W - ML * 2, 12, 2, 2, 'F');
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...WHITE);
    doc.text('GRAND TOTAL  -  All Categories Combined', ML + 6, finalCostY + 8);
    doc.text(fmtAED(grandCostT), W - ML - 6, finalCostY + 8, { align: 'right' });
  }

  // â”€â”€â”€ 10. E&I PURCHASE PAYMENT REPORT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          payEntries.push({ desc: r.itemDescription || ' - ', prNo: r.prNumber || ' - ', date: tx.date, amount: tx.amount || 0, isFull });
        });
      } else {
        const d = r.receivedDate || r.requestDate || '';
        if (d) {
          const dt = new Date(d);
          if (dt.getFullYear() !== year || dt.getMonth() + 1 !== month) return;
        }
        payEntries.push({ desc: r.itemDescription || ' - ', prNo: r.prNumber || ' - ', date: d, amount: r.budget || 0, isFull });
      }
    });

    const fullEntries    = payEntries.filter(e => e.isFull);
    const partialEntries = payEntries.filter(e => !e.isFull);
    const fullTotal      = fullEntries.reduce((s, e) => s + e.amount, 0);
    const partialTotal   = partialEntries.reduce((s, e) => s + e.amount, 0);
    const payTotal       = fullTotal + partialTotal;
    const fmtD           = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : ' - ';
    const fmtE           = (n: number) => (n || 0).toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    y = sectionHeader('E&I Purchase Payment Report', monthLabel);

    autoTable(doc, {
      startY: y, margin: { left: ML, right: ML },
      head: [['Payment Type', 'No. of Items', 'Total Value (AED)']],
      body: [
        ['Full Payment Done',    String(fullEntries.length),    `AED ${fmtE(fullTotal)}`],
        ['Partial Payment Done', String(partialEntries.length), `AED ${fmtE(partialTotal)}`],
        ['GRAND TOTAL PAID',     String(payEntries.length),     `AED ${fmtE(payTotal)}`],
      ],
      headStyles: tblHead,
      bodyStyles: { fontSize: 9, ...tblLine },
      columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 30, halign: 'center' }, 2: { cellWidth: 50, halign: 'right', fontStyle: 'bold' } },
      tableWidth: 165,
      alternateRowStyles: tblAlt,
      tableLineColor: BORDER, tableLineWidth: 0.4,
      didParseCell: (data: any) => {
        if (data.row.index === 2) { data.cell.styles.fillColor = NAVY; data.cell.styles.textColor = WHITE; data.cell.styles.fontStyle = 'bold'; }
      },
    });

    if (payEntries.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 5, margin: { left: ML, right: ML },
        head: [[
          { content: `${monthLabel}    -    Total Paid: AED ${fmtE(payTotal)}   (Full: AED ${fmtE(fullTotal)}  |  Partial: AED ${fmtE(partialTotal)})`,
            colSpan: 6, styles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 10 } },
        ], ['SL', 'Item Description', 'PO / PR Number', 'Payment Date', 'Amount Paid (AED)', 'Type']],
        body: payEntries.map((e, i) => [i + 1, e.desc, e.prNo, fmtD(e.date), `AED ${fmtE(e.amount)}`, e.isFull ? 'Full Payment' : 'Partial Payment']),
        headStyles: tblHead,
        bodyStyles: { fontSize: 8.5, ...tblLine },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 40 }, 3: { cellWidth: 28 }, 4: { cellWidth: 36, halign: 'right', fontStyle: 'bold' }, 5: { cellWidth: 35 } },
        alternateRowStyles: tblAlt,
        tableLineColor: BORDER, tableLineWidth: 0.4,
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
      doc.text(`No payments recorded for ${monthLabel}.`, ML, ((doc as any).lastAutoTable?.finalY || 60) + 6);
    }
  }

  // --- Attendance (rendered last so other sections flow together) -----------
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
      doc.addPage();
      attPdf.addAttendanceSheet(doc, attLogo, attTeam, attEntries, year, month);
      doc.addPage();
      attPdf.addWorkSummary(doc, attLogo, attTeam, attEntries, year, month);
    } else {
      y = sectionHeader('Employee Attendance', monthLabel);
      doc.setFontSize(9); doc.setTextColor(...NEUTRAL);
      doc.text(`No attendance records found for ${monthLabel}.`, ML, y + 6);
    }
  }

  // --- Footer on all pages -------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footY = H - FOOT_H;
    // Dark footer background
    doc.setFillColor(...SECOND);
    doc.rect(0, footY, W, FOOT_H, 'F');
    // Top accent line (amber)
    doc.setFillColor(...ORANGE);
    doc.rect(0, footY, W, 1, 'F');
    // Left accent stripe
    doc.setFillColor(...PRIMARY);
    doc.rect(0, footY + 1, 4, FOOT_H - 1, 'F');
    // Left: company
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(160, 180, 210);
    doc.text('Glass Technology  |  E&I Department  |  Maintenance Management System', 7, H - 3.8);
    // Center: CONFIDENTIAL badge
    doc.setFillColor(...ORANGE);
    doc.roundedRect(W / 2 - 20, footY + 3, 40, 6.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...SECOND);
    doc.text('CONFIDENTIAL', W / 2, H - 3.5, { align: 'center' });
    // Right: page number
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(255, 200, 100);
    doc.text(`${i}`, W - ML - 18, H - 3.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(160, 180, 210);
    doc.text(` / ${totalPages}  PAGE`, W - ML - 15, H - 3.5);
  }

  // â”€â”€â”€ Save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  doc.save(`EI_${monthLabel.replace(/\s+/g, '_')}_Monthly_Report.pdf`);
}

// â”€â”€â”€ COMPONENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        {/* Monthly Management Report  -  special full-width card */}
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
                  <div style={{ fontSize: 10, color: '#64748b' }}>Select the sections to include  -  only ticked sections will appear in the PDF</div>
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
              {generating ? 'Generating PDFâ€¦' : selectedReport === 'management' ? 'Generate Management PDF' : `Generate ${format.toUpperCase()} Report`}
            </button>
            <button className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={13} /> Schedule Auto Report
            </button>
            {generating && <span style={{ fontSize: 11, color: '#64748b' }}>Fetching live data from all modulesâ€¦</span>}
          </div>
        )}
      </div>
    </div>
  );
}
