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
  { id: 'management', label: 'Monthly Management Report',    icon: '📑', color: '#0ea5e9', desc: 'Spares · Attendance · Outsource · Rental · E&I Purchase · PO · Cost — single PDF for management' },
];

const kpiData = [
  { name: 'OEE',            value: mockKPIs.oee,                    target: 90,  unit: '%', color: '#3b82f6' },
  { name: 'MTBF',           value: mockKPIs.mtbf,                   target: 160, unit: 'h', color: '#22c55e' },
  { name: 'MTTR',           value: mockKPIs.mttr,                   target: 3,   unit: 'h', color: '#f59e0b' },
  { name: 'PM Compliance',  value: mockKPIs.pmCompliance,           target: 95,  unit: '%', color: '#22c55e' },
  { name: 'Power Factor',   value: mockKPIs.powerFactor * 100,      target: 95,  unit: '',  color: '#06b6d4' },
  { name: 'El. Availability',value: mockKPIs.electricalAvailability,target: 99,  unit: '%', color: '#8b5cf6' },
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

function fmt(n: number) { return (n || 0).toLocaleString('en-AE'); }
function fmtAED(n: number) {
  const v = n || 0;
  if (v >= 1000000) return `AED ${(v / 1000000).toFixed(2)}M`;
  if (v >= 1000)    return `AED ${(v / 1000).toFixed(1)}K`;
  return `AED ${fmt(v)}`;
}

async function generateManagementReport(dateFrom: string, dateTo: string) {
  const from  = new Date(dateFrom);
  const year  = from.getFullYear();
  const month = from.getMonth() + 1;
  const monthLabel = from.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // ── Fetch all data sources in parallel ──
  const [spareParts, empRes, attRes, outsourceRes, rentalRes, followupRes, poRes] = await Promise.all([
    fetch('/api/spare-parts').then(r => r.json()).catch(() => []),
    fetch('/api/employees').then(r => r.json()).catch(() => []),
    fetch(`/api/attendance?year=${year}&month=${month}`).then(r => r.json()).catch(() => []),
    fetch(`/api/outsource?from=${dateFrom}&to=${dateTo}&limit=500`).then(r => r.json()).catch(() => ({ entries: [] })),
    fetch(`/api/equipment-entries?from=${dateFrom}&to=${dateTo}&limit=500`).then(r => r.json()).catch(() => ({ entries: [] })),
    fetch('/api/purchase-followup').then(r => r.json()).catch(() => []),
    fetch('/api/purchase-po').then(r => r.json()).catch(() => []),
  ]);

  const employees      = Array.isArray(empRes) ? empRes : (empRes.employees || []);
  const attRecords     = Array.isArray(attRes) ? attRes : [];
  const outsourceEntries = outsourceRes?.entries || [];
  const rentalEntries  = rentalRes?.entries || [];
  const followupRecords = Array.isArray(followupRes) ? followupRes : [];
  const allPOs         = Array.isArray(poRes) ? poRes : [];

  // Filter POs by date range
  const receivedPOs = allPOs.filter(po => {
    if (!po.actualDelivery && !po.poDate) return false;
    const d = new Date(po.actualDelivery || po.poDate);
    return d >= new Date(dateFrom) && d <= new Date(dateTo);
  });

  // ── Spare parts summary ──
  const inStockSpares = (Array.isArray(spareParts) ? spareParts : []).filter(s => (s.currentStock || 0) > 0);
  const storeGroups: Record<string, { count: number; value: number }> = {};
  inStockSpares.forEach(s => {
    const store = s.storeName || 'Other';
    if (!storeGroups[store]) storeGroups[store] = { count: 0, value: 0 };
    storeGroups[store].count++;
    storeGroups[store].value += s.totalValue || 0;
  });
  const totalSpareValue = Object.values(storeGroups).reduce((s, g) => s + g.value, 0);

  // ── Attendance summary ──
  const daysInMonth = new Date(year, month, 0).getDate();
  const presentCode = (c: string) => ['P', 'WO', 'PH'].includes(c);
  const attSummary = attRecords.map((rec: any) => {
    const present = (rec.entries || []).filter((e: any) => presentCode(e.code)).length;
    const absent  = (rec.entries || []).filter((e: any) => e.code === 'A').length;
    return { name: rec.empName || rec.empId, present, absent, total: (rec.entries || []).length };
  });

  // ── Outsource summary ──
  const outsourceCost = outsourceEntries.reduce((s: number, e: any) => s + (e.totalCost || 0), 0);

  // ── Rental (equipment entries) summary ──
  const rentalCost = rentalEntries.reduce((s: number, e: any) => s + (e.totalCost || 0), 0);

  // ── Purchase followup pending summary ──
  const pendingPurchase = followupRecords.filter((r: any) =>
    r.currentStatus !== 'Material Received' && r.currentStatus !== 'Rejected'
  );

  // ── PO summary ──
  const totalPOValue = receivedPOs.reduce((s: number, p: any) => s + (p.totalValue || 0), 0);

  // ── Build PDF ──
  const jsPDFmod  = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDFmod({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210; // A4 width
  let y = 0;

  const BLUE   = [37, 99, 235];
  const GREY   = [100, 116, 139];
  const DARK   = [30, 41, 59];
  const WHITE  = [255, 255, 255];
  const LIGHT  = [241, 245, 249];
  const GREEN  = [22, 163, 74];
  const ORANGE = [234, 88, 12];
  const PURPLE = [109, 40, 217];
  const TEAL   = [14, 165, 233];

  // ─── COVER PAGE ────────────────────────────────────────────────────────
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, W, 80, 'F');

  doc.setFillColor(255, 255, 255, 0.08);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.circle(180, 20, 40, 'S');
  doc.circle(10, 70, 30, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...WHITE);
  doc.text('Monthly Management Report', W / 2, 30, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(monthLabel, W / 2, 42, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(200, 220, 255);
  doc.text(`Report Period: ${dateFrom} to ${dateTo}`, W / 2, 52, { align: 'center' });
  doc.text(`Generated: ${today}`, W / 2, 60, { align: 'center' });
  doc.text('E&I Department — Glass Technology', W / 2, 68, { align: 'center' });

  // Summary KPI boxes on cover
  const boxes = [
    { label: 'Spare Items (In Stock)', value: fmt(inStockSpares.length), color: TEAL },
    { label: 'Spare Stock Value',      value: fmtAED(totalSpareValue),   color: GREEN },
    { label: 'Pending Purchase Items', value: fmt(pendingPurchase.length),color: ORANGE },
    { label: 'POs Received',           value: fmt(receivedPOs.length),   color: PURPLE },
    { label: 'PO Value (AED)',          value: fmtAED(totalPOValue),      color: [220,38,38] },
    { label: 'Outsource Cost',         value: fmtAED(outsourceCost),     color: [5,150,105] },
  ];
  const bW = 58, bH = 22, bGap = 8, bStartX = 15, bStartY = 90;
  boxes.forEach((b, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx = bStartX + col * (bW + bGap);
    const by = bStartY + row * (bH + 6);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, by, bW, bH, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...b.color);
    doc.text(b.value, bx + bW / 2, by + 10, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(b.label, bx + bW / 2, by + 17, { align: 'center' });
  });

  y = bStartY + 2 * (bH + 6) + 14;

  // Table of Contents
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text('Contents', 15, y); y += 6;

  const sections = [
    '1. Spare Parts Stock Summary',
    '2. Employee Attendance Summary',
    '3. Outsource Work Details',
    '4. Rental Equipment Details',
    '5. E&I Purchase Status',
    '6. Monthly Received Purchase Orders',
    '7. Purchase Cost Summary',
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  sections.forEach(s => { doc.text(`  ${s}`, 15, y); y += 5; });

  const sectionHeader = (title: string, subtitle = '') => {
    doc.addPage();
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, W, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...WHITE);
    doc.text(title, 10, 11);
    if (subtitle) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(subtitle, W - 10, 11, { align: 'right' });
    }
    return 26;
  };

  const subHeader = (doc: any, y: number, text: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(text, 10, y);
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.4);
    doc.line(10, y + 1.5, W - 10, y + 1.5);
    return y + 7;
  };

  // ─── SECTION 1: SPARE PARTS ───────────────────────────────────────────
  y = sectionHeader('1. Spare Parts Stock Summary', `As of ${today}`);

  // Store summary table
  y = subHeader(doc, y, 'Store-wise Inventory Summary');
  autoTable(doc, {
    startY: y,
    head: [['Store', 'Items (In Stock)', 'Total Stock Value (AED)']],
    body: [
      ...Object.entries(storeGroups).map(([store, g]) => [store, fmt(g.count), fmtAED(g.value)]),
      ['TOTAL', fmt(inStockSpares.length), fmtAED(totalSpareValue)],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold' },
    footStyles: { fillColor: LIGHT },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data: any) => {
      if (data.row.index === Object.keys(storeGroups).length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [219, 234, 254];
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Top 10 items by value
  const top10 = [...inStockSpares].sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0)).slice(0, 10);
  if (top10.length) {
    y = subHeader(doc, y, 'Top 10 Items by Stock Value');
    autoTable(doc, {
      startY: y,
      head: [['#', 'Item Name', 'Category', 'Store', 'Stock', 'Unit Price', 'Total Value']],
      body: top10.map((s, i) => [
        i + 1,
        s.itemName,
        s.category || '—',
        s.storeName || '—',
        `${fmt(s.currentStock)} ${s.unit || ''}`,
        fmtAED(s.unitPrice),
        fmtAED(s.totalValue),
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 4: { halign: 'center' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }

  // ─── SECTION 2: ATTENDANCE ────────────────────────────────────────────
  y = sectionHeader('2. Employee Attendance Summary', monthLabel);

  const totalEmp     = attSummary.length || employees.length;
  const avgPresent   = attSummary.length ? Math.round(attSummary.reduce((s, r) => s + r.present, 0) / attSummary.length) : 0;
  const attPct       = daysInMonth > 0 ? ((avgPresent / daysInMonth) * 100).toFixed(1) : '0';

  // KPI row
  const attKPIs = [
    { label: 'Total Employees', value: fmt(totalEmp),   color: BLUE },
    { label: 'Avg Present Days', value: fmt(avgPresent), color: GREEN },
    { label: 'Avg Attendance %', value: `${attPct}%`,   color: attPct >= 90 ? GREEN : ORANGE },
    { label: 'Working Days',     value: fmt(daysInMonth),color: GREY },
  ];
  const kW = 42, kH = 16, kGap = 5, kStartX = 10;
  attKPIs.forEach((k, i) => {
    const kx = kStartX + i * (kW + kGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(kx, y, kW, kH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...k.color);
    doc.text(k.value, kx + kW / 2, y + 8, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(k.label, kx + kW / 2, y + 13.5, { align: 'center' });
  });
  y += kH + 8;

  if (attSummary.length > 0) {
    y = subHeader(doc, y, 'Employee-wise Attendance');
    autoTable(doc, {
      startY: y,
      head: [['#', 'Employee', 'Present Days', 'Absent Days', 'Attendance %']],
      body: attSummary.map((r, i) => [
        i + 1,
        r.name,
        r.present,
        r.absent,
        r.total > 0 ? `${((r.present / r.total) * 100).toFixed(1)}%` : '—',
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text(`No attendance records found for ${monthLabel}.`, 10, y + 6);
  }

  // ─── SECTION 3: OUTSOURCE ─────────────────────────────────────────────
  y = sectionHeader('3. Outsource Work Details', `${dateFrom} – ${dateTo}`);

  const outsourceSummaryMap: Record<string, { jobs: number; hours: number; cost: number }> = {};
  outsourceEntries.forEach((e: any) => {
    const k = e.vendorCompany || 'Unknown Vendor';
    if (!outsourceSummaryMap[k]) outsourceSummaryMap[k] = { jobs: 0, hours: 0, cost: 0 };
    outsourceSummaryMap[k].jobs++;
    outsourceSummaryMap[k].hours += e.workingHours || 0;
    outsourceSummaryMap[k].cost  += e.totalCost || 0;
  });

  const outsourceSummary = Object.entries(outsourceSummaryMap)
    .map(([vendor, d]) => [vendor, fmt(d.jobs), `${d.hours.toFixed(1)} hrs`, fmtAED(d.cost)])
    .sort((a, b) => parseFloat(b[3] as string) - parseFloat(a[3] as string));

  if (outsourceSummary.length) {
    y = subHeader(doc, y, 'Vendor-wise Outsource Summary');
    autoTable(doc, {
      startY: y,
      head: [['Vendor / Company', 'Jobs', 'Total Hours', 'Total Cost (AED)']],
      body: [
        ...outsourceSummary,
        ['TOTAL', fmt(outsourceEntries.length), `${outsourceEntries.reduce((s: number, e: any) => s + (e.workingHours || 0), 0).toFixed(1)} hrs`, fmtAED(outsourceCost)],
      ],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'right' } },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data: any) => {
        if (data.row.index === outsourceSummary.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [219, 234, 254];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Detail table
    if (outsourceEntries.length <= 30) {
      y = subHeader(doc, y, 'Outsource Work Log');
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Vendor', 'Description', 'Hours', 'Cost (AED)', 'Status']],
        body: outsourceEntries.map((e: any) => [
          e.workDate ? new Date(e.workDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—',
          e.vendorCompany || '—',
          (e.workDescription || '—').substring(0, 40),
          e.workingHours || 0,
          fmtAED(e.totalCost),
          e.completionStatus || '—',
        ]),
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold' },
        columnStyles: { 3: { halign: 'center' }, 4: { halign: 'right' } },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
    }
  } else {
    doc.setFontSize(9); doc.setTextColor(...GREY);
    doc.text('No outsource entries found for this period.', 10, y + 6);
  }

  // ─── SECTION 4: RENTAL ────────────────────────────────────────────────
  y = sectionHeader('4. Rental Equipment Details', `${dateFrom} – ${dateTo}`);

  const rentalMap: Record<string, { days: number; hours: number; cost: number }> = {};
  rentalEntries.forEach((e: any) => {
    const k = e.equipmentName || 'Unknown Equipment';
    if (!rentalMap[k]) rentalMap[k] = { days: 0, hours: 0, cost: 0 };
    rentalMap[k].days++;
    rentalMap[k].hours += e.workingHours || 0;
    rentalMap[k].cost  += e.totalCost || 0;
  });

  if (Object.keys(rentalMap).length) {
    y = subHeader(doc, y, 'Equipment-wise Rental Summary');
    const rentalSummaryRows = Object.entries(rentalMap).map(([eq, d]) => [eq, fmt(d.days), `${d.hours.toFixed(1)} hrs`, fmtAED(d.cost)]);
    autoTable(doc, {
      startY: y,
      head: [['Equipment', 'Days Used', 'Total Hours', 'Total Cost (AED)']],
      body: [
        ...rentalSummaryRows,
        ['TOTAL', fmt(rentalEntries.length), `${rentalEntries.reduce((s: number, e: any) => s + (e.workingHours || 0), 0).toFixed(1)} hrs`, fmtAED(rentalCost)],
      ],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'right' } },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data: any) => {
        if (data.row.index === rentalSummaryRows.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [219, 234, 254];
        }
      },
    });
  } else {
    doc.setFontSize(9); doc.setTextColor(...GREY);
    doc.text('No rental equipment entries found for this period.', 10, y + 6);
  }

  // ─── SECTION 5: E&I PURCHASE STATUS ─────────────────────────────────
  y = sectionHeader('5. E&I Purchase Status', `As of ${today}`);

  const STATUS_ORDER = ['RFQ created', 'Technical Review', 'Quotation Received', 'PO done', 'Material Not Delivered', 'Material Received', 'Rejected', ''];
  const statusGroups: Record<string, number> = {};
  followupRecords.forEach((r: any) => {
    const k = r.currentStatus || 'No Status';
    statusGroups[k] = (statusGroups[k] || 0) + 1;
  });

  const statusSummaryRows = Object.entries(statusGroups).map(([s, c]) => [s || 'No Status', fmt(c)]);
  y = subHeader(doc, y, 'Status Summary');
  autoTable(doc, {
    startY: y,
    head: [['Current Status', 'Count']],
    body: [...statusSummaryRows, ['TOTAL', fmt(followupRecords.length)]],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'center' } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    tableWidth: 80,
    didParseCell: (data: any) => {
      if (data.row.index === statusSummaryRows.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [219, 234, 254];
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Pending items detail
  const pendingRows = pendingPurchase.map((r: any, i: number) => [
    i + 1,
    (r.itemDescription || '—').substring(0, 45),
    r.requestDate ? new Date(r.requestDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—',
    r.requiredTimeline || '—',
    r.currentStatus || 'No Status',
    r.prNumber || '—',
    r.budget ? fmtAED(r.budget) : '—',
  ]);
  if (pendingRows.length) {
    y = subHeader(doc, y, 'Pending Purchase Items');
    autoTable(doc, {
      startY: y,
      head: [['#', 'Item Description', 'Req. Date', 'Priority', 'Status', 'PR No.', 'Budget']],
      body: pendingRows,
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 6: { halign: 'right' } },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }

  // ─── SECTION 6: RECEIVED POs ──────────────────────────────────────────
  y = sectionHeader('6. Monthly Received Purchase Orders', `${dateFrom} – ${dateTo}`);

  if (receivedPOs.length) {
    y = subHeader(doc, y, 'Purchase Orders Received / Created in Period');
    autoTable(doc, {
      startY: y,
      head: [['PO No.', 'Date', 'Vendor', 'Department', 'Items', 'Total Value (AED)', 'Status']],
      body: receivedPOs.map((po: any) => [
        po.poNo || '—',
        po.poDate || '—',
        (po.vendor || '—').substring(0, 20),
        po.department || '—',
        (po.items || []).length,
        fmtAED(po.totalValue),
        po.status || '—',
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold' },
      columnStyles: { 4: { halign: 'center' }, 5: { halign: 'right' } },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BLUE);
    doc.text(`Total PO Value for Period: ${fmtAED(totalPOValue)}`, W - 10, y, { align: 'right' });
  } else {
    doc.setFontSize(9); doc.setTextColor(...GREY);
    doc.text('No purchase orders found for this period.', 10, y + 6);
  }

  // ─── SECTION 7: PURCHASE COST SUMMARY ────────────────────────────────
  y = sectionHeader('7. Purchase Cost Summary', monthLabel);

  const allPOTotal   = allPOs.reduce((s: number, p: any) => s + (p.totalValue || 0), 0);
  const pendingBudget = pendingPurchase.reduce((s: number, r: any) => s + (r.budget || 0), 0);
  const outsourceTotalAllTime = outsourceCost; // already filtered by date

  const costRows = [
    ['POs Received (Period)',      fmtAED(totalPOValue),       receivedPOs.length + ' POs'],
    ['All POs (All Time)',         fmtAED(allPOTotal),          allPOs.length + ' POs'],
    ['Outsource Cost (Period)',    fmtAED(outsourceCost),       outsourceEntries.length + ' jobs'],
    ['Rental Cost (Period)',       fmtAED(rentalCost),          rentalEntries.length + ' entries'],
    ['Pending Purchase Budget',   fmtAED(pendingBudget),       pendingPurchase.length + ' items'],
    ['Spare Parts Stock Value',   fmtAED(totalSpareValue),     inStockSpares.length + ' items'],
  ];

  y = subHeader(doc, y, 'Cost Breakdown');
  autoTable(doc, {
    startY: y,
    head: [['Category', 'Amount (AED)', 'Remarks']],
    body: costRows,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'center', textColor: GREY } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Total spend box
  const totalSpend = totalPOValue + outsourceCost + rentalCost;
  doc.setFillColor(219, 234, 254);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.5);
  doc.roundedRect(10, y, W - 20, 16, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BLUE);
  doc.text(`Total Expenditure for Period: ${fmtAED(totalSpend)}`, W / 2, y + 10, { align: 'center' });

  // ─── FOOTER ON ALL PAGES ──────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 285, W, 12, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text('E&I Department — Glass Technology | Confidential', 10, 292);
    doc.text(`Page ${i} of ${totalPages}`, W - 10, 292, { align: 'right' });
    doc.text(today, W / 2, 292, { align: 'center' });
  }

  // ─── SAVE ─────────────────────────────────────────────────────────────
  const dd = String(from.getDate()).padStart(2, '0');
  const mm = String(from.getMonth() + 1).padStart(2, '0');
  const yyyy = from.getFullYear();
  doc.save(`Monthly_Management_Report_${yyyy}-${mm}.pdf`);
}

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [format, setFormat] = useState<'pdf' | 'excel' | 'word'>('pdf');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!selectedReport) return;
    if (selectedReport === 'management') {
      setGenerating(true);
      try {
        await generateManagementReport(dateFrom, dateTo);
      } catch (e) {
        console.error('Report generation failed', e);
        alert('Failed to generate report. Please check console for details.');
      } finally {
        setGenerating(false);
      }
    }
    // other report types: placeholder for now
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Reports & Analytics</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Generate, download and share maintenance reports</div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {kpiData.map(k => {
          const aboveTarget = k.name === 'MTTR' ? k.value <= k.target : k.value >= k.target;
          return (
            <div key={k.name} className="glass-card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>{k.name}</span>
                <span style={{ fontSize: 10, color: aboveTarget ? '#22c55e' : '#ef4444', background: aboveTarget ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '1px 8px', borderRadius: 10 }}>
                  {aboveTarget ? 'On Target' : 'Below Target'}
                </span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}{k.unit}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Target: {k.target}{k.unit}</div>
              <div className="progress-bar" style={{ marginTop: 8 }}>
                <div className="progress-fill" style={{ width: `${Math.min((k.name === 'MTTR' ? (k.target / k.value) : (k.value / k.target)) * 100, 100)}%`, background: aboveTarget ? '#22c55e' : '#ef4444' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {REPORT_TYPES.map(r => (
            <div
              key={r.id}
              onClick={() => setSelectedReport(r.id)}
              style={{
                padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                background: selectedReport === r.id ? `${r.color}15` : '#FAFAFA',
                border: `1px solid ${selectedReport === r.id ? r.color + '50' : '#E5E7EB'}`,
                transition: 'all 0.2s',
                ...(r.id === 'management' ? { gridColumn: '1 / -1', background: selectedReport === 'management' ? '#EFF6FF' : '#F0F9FF', border: `2px solid ${selectedReport === 'management' ? '#2563EB' : '#BAE6FD'}` } : {}),
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: r.id === 'management' ? 6 : 0 }}>
                <span style={{ fontSize: r.id === 'management' ? 24 : 20 }}>{r.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: r.id === 'management' ? '#1e40af' : '#374151' }}>{r.label}</div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{r.desc}</div>
                </div>
                {r.id === 'management' && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#1e40af', background: '#DBEAFE', padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                    Manager PDF
                  </span>
                )}
              </div>
              {r.id === 'management' && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {['📦 Spare Stock', '👥 Attendance', '🔧 Outsource', '🚜 Rental', '🛒 E&I Purchase', '📄 Received POs', '💰 Purchase Cost'].map(tag => (
                    <span key={tag} style={{ fontSize: 9, color: '#1d4ed8', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '2px 8px', borderRadius: 10 }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {selectedReport && (
          <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              className="btn-primary"
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, opacity: generating ? 0.7 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}
              onClick={handleGenerate}
              disabled={generating}
            >
              <Download size={13} />
              {generating ? 'Generating PDF…' : `Generate ${selectedReport === 'management' ? 'Management PDF' : format.toUpperCase() + ' Report'}`}
            </button>
            <button className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={13} /> Schedule Auto Report
            </button>
            {generating && (
              <span style={{ fontSize: 11, color: '#64748b' }}>Fetching live data from all modules…</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
