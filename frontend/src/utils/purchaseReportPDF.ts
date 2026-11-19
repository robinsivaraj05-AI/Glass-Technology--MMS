import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { STATUS_FLOW, STATUS_XLS, normaliseStatus, isRejected, statusLabel } from '../config/purchaseStatus';
import { analyse, stageCells, fmt, days, type Rec } from '../components/PurchaseStatusHistory';
import { COMPANY_NAME, COMPANY_LOC, DEPT_NAME } from '../config/dept';

// PDF for the purchase team: Pending Purchase list, then the Pending Purchase
// History (date each step was reached). A4 landscape, company logo on page 1.

export interface ReportRecord extends Rec {
  requiredTimeline: string; reqDate: string; budget: number; leadTime: string; workingTime?: string;
}

const NIL = 'Nil';
const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const SHORT = ['Request / RFQ Created', 'Quotation Received', 'Tech. Review In Progress', 'Tech. Review Done', 'PO Done', 'Partially Received', 'Material Received'];

// Logo is 270×54 (5:1); render at that ratio on white
async function logoPng(): Promise<string | null> {
  try {
    const svg = await (await fetch('/logo.svg')).text();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    return await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = 1000; c.height = 200;
        const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1000, 200);
        ctx.drawImage(img, 0, 0, 1000, 200); URL.revokeObjectURL(url); resolve(c.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  } catch { return null; }
}

const fmtDay = (s: string) => {
  if (!s) return NIL;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
  return isNaN(d.getTime()) ? s : fmt(d);
};
const fmtMonth = (s: string) => {
  if (!s) return NIL;
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};
const or = (v: unknown) => (v === undefined || v === null || String(v).trim() === '' ? NIL : String(v));

export async function exportPurchaseReportPDF(all: ReportRecord[]) {
  const today = new Date();
  const pending = all
    .map(r => ({ ...r, currentStatus: normaliseStatus(r.currentStatus || '') }))
    .filter(r => r.currentStatus !== 'Material Received' && !isRejected(r.currentStatus))
    .map(r => ({ r, a: analyse(r) }))
    .sort((x, y) => (x.a.start?.getTime() ?? Infinity) - (y.a.start?.getTime() ?? Infinity));   // oldest request first

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
  const M = 10;

  // ── Header ──
  const logo = await logoPng();
  if (logo) doc.addImage(logo, 'PNG', M, 7, 55, 11);
  else { doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(176, 88, 48); doc.text(COMPANY_NAME, M, 14); }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(15, 23, 42);
  doc.text(`${DEPT_NAME} Purchase Status Report`, pw / 2, 12, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 116, 139);
  doc.text(`Pending Purchase & Purchase History   |   As of ${fmt(today)}`, pw / 2, 17.5, { align: 'center' });
  doc.setFontSize(8);
  doc.text(`${COMPANY_NAME}`, pw - M, 11, { align: 'right' });
  doc.text(`${COMPANY_LOC}`, pw - M, 15, { align: 'right' });
  doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.4); doc.line(M, 21, pw - M, 21);

  // ── Summary: how many pending items at each step ──
  const steps = STATUS_FLOW.slice(0, -1);   // Material Received is not pending
  const counts = steps.map(st => pending.filter(p => p.a.current === st).length);
  const notSet = pending.filter(p => !p.a.current).length;
  autoTable(doc, {
    startY: 24, margin: { left: M, right: M },
    head: [['Total pending', ...steps.map((st, i) => `${i + 1}. ${SHORT[i]}`), 'No status']],
    body: [[String(pending.length), ...counts.map(String), String(notSet)]],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5, halign: 'center', valign: 'middle' },
    bodyStyles: { fontSize: 11, fontStyle: 'bold', halign: 'center', textColor: [15, 23, 42] },
    didParseCell: d => {
      const st = steps[d.column.index - 1];
      if (d.section === 'head' && st) d.cell.styles.fillColor = hex(STATUS_XLS[st]);
    },
  });

  // ── Section 1: Pending Purchase ──
  let y = (doc as any).lastAutoTable.finalY + 8;
  const section = (title: string, sub: string) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(15, 23, 42); doc.text(title, M, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text(sub, M, y + 4.5);
    y += 7;
  };
  section(`1. Pending Purchase (${pending.length})`, 'Items not yet received, oldest request first. Days = days since request.');
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, top: 14, bottom: 14 }, rowPageBreak: 'avoid',   // keep rows whole; leave room for the footer
    head: [['Sl.', 'Item Description', 'PR / RFQ No.', 'Request Date', 'Days', 'Required Timeline', 'Current Status', 'Req. Date', 'Budget (AED)', 'Lead Time']],
    body: pending.map(({ r, a }, i) => [
      String(i + 1), or(r.itemDescription), or(r.prNumber), fmtDay(r.requestDate),
      a.start ? String(days(a.start, today)) : NIL, or(r.requiredTimeline),
      a.current ? statusLabel(a.current) : NIL, fmtMonth(r.reqDate),
      r.budget ? r.budget.toLocaleString('en-AE') : NIL, or(r.leadTime),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 8, valign: 'middle' },
    bodyStyles: { fontSize: 8, valign: 'middle', textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' }, 1: { cellWidth: 66 }, 2: { cellWidth: 30 }, 3: { cellWidth: 21, halign: 'center' },
      4: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }, 5: { cellWidth: 25 }, 6: { cellWidth: 46, fontStyle: 'bold' },
      7: { cellWidth: 18, halign: 'center' }, 8: { cellWidth: 22, halign: 'right' }, 9: { cellWidth: 28 },
    },
    didParseCell: d => {
      if (d.section !== 'body') return;
      if (d.column.index === 6) {
        const st = pending[d.row.index]?.a.current;
        if (st && STATUS_XLS[st]) { d.cell.styles.fillColor = hex(STATUS_XLS[st]); d.cell.styles.textColor = [255, 255, 255]; }
      }
      if (d.column.index === 4) d.cell.styles.textColor = [220, 38, 38];
      if (d.cell.raw === NIL) { d.cell.styles.textColor = [148, 163, 184]; d.cell.styles.fontStyle = 'italic'; }
    },
  });

  // ── Section 2: Pending Purchase History ──
  doc.addPage();
  y = 16;
  section('2. Pending Purchase History', 'Date each step was reached; "+N d" = days since the previous step. Current = step reached before history tracking started. Nil = not reached yet.');
  const cellText = (c: ReturnType<typeof stageCells>[number]) =>
    c.kind === 'date' ? `${fmt(c.date)}${c.gap !== null ? `\n+${c.gap} d` : ''}` : c.kind === 'current' ? 'Current\n(no date)' : c.kind === 'done' ? 'Done' : NIL;
  const histCells = pending.map(p => stageCells(p.a));
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, top: 14, bottom: 14 }, rowPageBreak: 'avoid',   // keep rows whole; leave room for the footer
    head: [['Sl.', 'Item / PR No.', ...STATUS_FLOW.map((_, i) => `Step ${i + 1}\n${SHORT[i]}`), 'Days Open']],
    body: pending.map(({ r, a }, i) => [
      String(i + 1), `${or(r.itemDescription)}\n${or(r.prNumber)}`,
      ...histCells[i].map(cellText),
      a.start ? `${days(a.start, today)}` : NIL,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 7, halign: 'center', valign: 'middle' },
    bodyStyles: { fontSize: 7.5, halign: 'center', valign: 'middle', textColor: [30, 41, 59], minCellHeight: 9.5, cellPadding: 1.2 },
    columnStyles: { 0: { cellWidth: 9 }, 1: { cellWidth: 62, halign: 'left' }, 9: { cellWidth: 17, fontStyle: 'bold', textColor: [180, 83, 9] } },
    didParseCell: d => {
      const k = d.column.index - 2;           // step index
      if (d.section === 'head' && k >= 0 && k < STATUS_FLOW.length) {
        d.cell.styles.fillColor = hex(STATUS_XLS[STATUS_FLOW[k]]);
      }
      if (d.section !== 'body' || k < 0 || k >= STATUS_FLOW.length) return;
      const c = histCells[d.row.index][k];
      const col = hex(STATUS_XLS[STATUS_FLOW[k]]);
      if ((c.kind === 'date' && c.current) || c.kind === 'current') {
        d.cell.styles.fillColor = col; d.cell.styles.textColor = [255, 255, 255]; d.cell.styles.fontStyle = 'bold';
      } else if (c.kind === 'date') {
        d.cell.styles.textColor = [15, 23, 42]; d.cell.styles.fontStyle = 'bold';
      } else if (c.kind === 'done') {
        d.cell.styles.fillColor = [241, 245, 249]; d.cell.styles.textColor = [100, 116, 139];
      } else {
        d.cell.styles.textColor = [203, 213, 225]; d.cell.styles.fontStyle = 'italic';
      }
    },
  });

  // ── Footer on every page ──
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240); doc.line(M, ph - 9, pw - M, ph - 9);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
    doc.text(`${COMPANY_NAME} · ${DEPT_NAME} Maintenance Management System · Generated ${today.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, M, ph - 5);
    doc.text(`Page ${i} of ${n}`, pw - M, ph - 5, { align: 'right' });
  }

  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  doc.save(`${DEPT_NAME.replace(/[^A-Za-z0-9]/g, '')}_Purchase_Report_${ymd}.pdf`);   // e.g. EI_Purchase_Report_2026-11-19.pdf
}
