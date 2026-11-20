import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { STATUS_FLOW, STATUS_XLS, STATUS_WEB, normaliseStatus, isRejected, statusLabel } from '../config/purchaseStatus';
import { analyse, stageCells, fmt, days, type Rec } from '../components/PurchaseStatusHistory';
import { COMPANY_NAME, COMPANY_LOC, DEPT_NAME } from '../config/dept';

// PDF for the purchase team: Pending Purchase list, then the Pending Purchase
// History (date each step was reached). A4 landscape, company logo on page 1.

export interface ReportRecord extends Rec {
  section?: string; requiredTimeline: string; reqDate: string; budget: number; leadTime: string; workingTime?: string;
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

// Same colours as the Pending Purchase page
const rgba = (c: string): [number, number, number] => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return m ? [+m[1], +m[2], +m[3]] : [100, 116, 139]; };
const TIMELINE_RGB: Record<string, [number, number, number]> = { 'Primary Priority': [249, 115, 22], 'Second Priority': [34, 197, 94] };
const daysRgb = (n: number): [number, number, number] => n > 90 ? [239, 68, 68] : n > 30 ? [245, 158, 11] : [100, 116, 139];
// App date style: "2 Jan 26"
const appDate = (s: string) => {
  if (!s) return NIL;
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
};
const daysSince = (s: string) => (s ? Math.floor((Date.now() - new Date(s).getTime()) / 86400000) : 0);
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

  // ── Section 1: Pending Purchase — same columns, order, grouping and colours as the app page ──
  let y = 27;
  const section = (title: string, sub: string) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(15, 23, 42); doc.text(title, M, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text(sub, M, y + 4.5);
    y += 7;
  };
  // Like the app: sorted by days (highest first); a section heading row whenever the section changes; Sl restarts per section
  type Row = { kind: 'section'; label: string } | { kind: 'data'; p: typeof pending[number]; sl: number };
  const rows: Row[] = [];
  const slOf = new Map<string, number>();
  let curSection: string | undefined, sl = 0;
  for (const p of [...pending].sort((x, y2) => daysSince(y2.r.requestDate) - daysSince(x.r.requestDate))) {
    const sec = p.r.section || '';
    if (sec !== curSection) { if (sec) rows.push({ kind: 'section', label: sec }); curSection = sec; sl = 0; }
    rows.push({ kind: 'data', p, sl: ++sl }); slOf.set(p.r.id, sl);
  }
  const dataRows = rows.filter((r): r is Extract<Row, { kind: 'data' }> => r.kind === 'data');
  pending.sort((x, y2) => dataRows.findIndex(d => d.p === x) - dataRows.findIndex(d => d.p === y2));   // history follows the same order

  section(`1. Pending Purchase (${pending.length})`, 'Same layout as the Pending Purchase page. Days = days since request date.');
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, top: 14, bottom: 14 }, rowPageBreak: 'avoid',   // keep rows whole; leave room for the footer
    head: [['Sl.', 'Item Description', 'Request Date', 'Days', 'Required Timeline', 'Current Status', 'PR Number', 'Req. Date', 'Budget', 'Lead Time', 'Working Time']],
    body: rows.map(row => row.kind === 'section'
      ? [{ content: row.label, colSpan: 11, styles: { fillColor: [226, 232, 240], fontStyle: 'bold', textColor: [30, 41, 59], halign: 'left' } }]
      : (() => {
          const { r, a } = row.p; const n = daysSince(r.requestDate);
          return [
            String(row.sl), or(r.itemDescription), r.requestDate ? appDate(r.requestDate) : NIL,
            r.requestDate && n > 0 ? String(n) : NIL, or(r.requiredTimeline),
            a.current ? statusLabel(a.current) : NIL, or(r.prNumber),
            r.reqDate ? appDate(r.reqDate).replace(/^\d+ /, '') : NIL,      // "Oct 26", as on the page
            r.budget ? r.budget.toLocaleString() : NIL, or(r.leadTime), or(r.workingTime),
          ];
        })()) as any,
    theme: 'grid',
    headStyles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontSize: 7.5, fontStyle: 'bold', valign: 'middle', lineColor: [226, 232, 240] },
    bodyStyles: { fontSize: 8.5, valign: 'middle', textColor: [30, 41, 59], lineColor: [226, 232, 240], minCellHeight: 7.5, cellPadding: 1.4 },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center', textColor: [100, 116, 139] }, 1: { cellWidth: 62 }, 2: { cellWidth: 20 },
      3: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }, 4: { cellWidth: 26, fontStyle: 'bold' },
      5: { cellWidth: 46, fontStyle: 'bold' }, 6: { cellWidth: 30, font: 'courier' }, 7: { cellWidth: 16, halign: 'center' },
      8: { cellWidth: 18, halign: 'right', fontStyle: 'bold' }, 9: { cellWidth: 19, halign: 'center' }, 10: { cellWidth: 19, halign: 'center' },
    },
    didParseCell: d => {
      if (d.section !== 'body') return;
      const row = rows[d.row.index];
      if (!row || row.kind !== 'data') return;
      const { r, a } = row.p;
      if (d.cell.raw === NIL) { d.cell.styles.textColor = [148, 163, 184]; d.cell.styles.fontStyle = 'italic'; return; }
      switch (d.column.index) {
        case 3: d.cell.styles.textColor = daysRgb(daysSince(r.requestDate)); break;
        case 4: d.cell.styles.textColor = TIMELINE_RGB[r.requiredTimeline] ?? [100, 116, 139]; break;
        case 5: if (STATUS_WEB[a.current]) { d.cell.styles.fillColor = rgba(STATUS_WEB[a.current].bg); d.cell.styles.textColor = [255, 255, 255]; } break;
        case 6: d.cell.styles.textColor = [59, 130, 246]; break;
        case 8: d.cell.styles.textColor = [22, 163, 74]; break;
      }
    },
  });

  // ── Summary: pending items at each step — placed at the BOTTOM of a page, just above the footer ──
  const SUMMARY_H = 22;   // title + table height (mm)
  const drawSummary = () => {
    y = ph - 14 - SUMMARY_H;
    section('Summary — pending items at each step', `As of ${fmt(today)}`);
    const steps = STATUS_FLOW.slice(0, -1);   // Material Received is not pending
    const counts = steps.map(st => pending.filter(p => p.a.current === st).length);
    const notSet = pending.filter(p => !p.a.current).length;
    autoTable(doc, {
      startY: y, margin: { left: M, right: M, bottom: 12 }, pageBreak: 'avoid',
      head: [['Total pending', ...steps.map((_, i) => `${i + 1}. ${SHORT[i]}`), 'No status']],
      body: [[String(pending.length), ...counts.map(String), String(notSet)]],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5, halign: 'center', valign: 'middle' },
      bodyStyles: { fontSize: 11, fontStyle: 'bold', halign: 'center', textColor: [15, 23, 42] },
      didParseCell: d => {
        const st = steps[d.column.index - 1];
        if (d.section === 'head' && st) d.cell.styles.fillColor = hex(STATUS_XLS[st]);
      },
    });
  };
  // Room under the Pending Purchase table on its last page? Put the summary there; otherwise at the bottom of the last page.
  const afterPending = (doc as any).lastAutoTable.finalY as number;
  const summaryOnPendingPage = afterPending + 6 < ph - 14 - SUMMARY_H;
  if (summaryOnPendingPage) drawSummary();

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
      String(slOf.get(r.id) ?? i + 1), `${or(r.itemDescription)}\n${or(r.prNumber)}`,
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

  if (!summaryOnPendingPage) {
    if ((doc as any).lastAutoTable.finalY + 6 >= ph - 14 - SUMMARY_H) doc.addPage();
    drawSummary();
  }

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
