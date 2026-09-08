import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PDFTeamMember { empId: string; empName: string; role: string; }
type Entries = Record<string, Record<number, string>>;
type Remarks = Record<string, Record<number, string>>;
interface OTRecord {
  empId: string; empName: string; year: number; month: number; day: number;
  startTime: string; endTime: string; totalHours: number;
  reason: string; approvedBy: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DOW        = 'SMTWTFS';
const WORK_CODES = new Set(['PR','WH','SD','OD','A','B','C','RP']);
const SUMMARY_COLS = ['PR','WO','WH','SD','PL','AL','CO','OD','RP','A','B','C','SL','NH'];

const CODE_BG: Record<string, [number,number,number]> = {
  PR:[187,247,208], WO:[254,240,138], WH:[186,230,253], SD:[254,215,170],
  CO:[254,202,202], PL:[233,213,255], AL:[251,207,232], OD:[110,231,183],
  RP:[254,249,195], SL:[221,214,254], NH:[224,231,255],
  A:[209,250,229],  B:[254,243,199],  C:[199,210,254],
};
const CODE_TEXT: Record<string, [number,number,number]> = {
  PR:[20,83,45],   WO:[113,63,18],  WH:[12,74,110],  SD:[124,45,18],
  CO:[127,29,29],  PL:[76,29,149],  AL:[131,24,67],  OD:[6,78,59],
  RP:[133,77,14],  SL:[59,7,100],   NH:[30,27,75],
  A:[6,95,70],     B:[120,53,15],   C:[49,46,129],
};

const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
const fmtHrs = (h: number) => `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;

// ── Layout constants (landscape A4) ──────────────────────────────────────────
const PW     = 297;  // page width  mm
const PH     = 210;  // page height mm
const ML     = 17;   // left margin  (80% width: (297×0.80)=237mm usable, 17mm margins each side)
const MR     = 17;
const UW     = PW - ML - MR;   // 263 mm usable width
const HEAD_H = 36;              // header block height mm
const FOOT_Y = PH - 10;        // footer top y

// ── Logo loader (extracts icon portion only — square crop from SVG) ───────────
export async function loadLogo(): Promise<string | null> {
  try {
    const res  = await fetch('/logo.svg');
    const text = await res.text();
    const blob = new Blob([text], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        // Render full SVG at native resolution
        const full = document.createElement('canvas');
        full.width = 270; full.height = 54;
        full.getContext('2d')!.drawImage(img, 0, 0, 270, 54);

        // Crop to icon portion (left ~57 of 270 units) → 96×96 canvas
        const ic = document.createElement('canvas');
        ic.width = 96; ic.height = 96;
        const ctx = ic.getContext('2d')!;
        ctx.clearRect(0, 0, 96, 96);
        // source: x=0,y=0,w=57,h=54  →  dest: x=3,y=3,w=90,h=90
        ctx.drawImage(full, 0, 0, 57, 54, 3, 3, 90, 90);
        URL.revokeObjectURL(url);
        resolve(ic.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  } catch { return null; }
}

// ── Header ────────────────────────────────────────────────────────────────────
function drawHeader(
  doc: jsPDF,
  logo: string | null,
  reportTitle: string,
  period: string,
) {
  const hY = 6;
  const hH = HEAD_H - 2;           // header rect height = 34mm
  const hBottom = hY + hH;         // 40mm

  // Light orange background
  doc.setFillColor(255, 237, 213);  // #FFEDD5  orange-100
  doc.roundedRect(ML, hY, UW, hH, 2, 2, 'F');

  // Orange border
  doc.setDrawColor(251, 146, 60);   // orange-400
  doc.setLineWidth(0.35);
  doc.roundedRect(ML, hY, UW, hH, 2, 2, 'S');

  // Left accent stripe (solid orange)
  doc.setFillColor(234, 88, 12);    // #EA580C  orange-600
  doc.rect(ML, hY, 5, hH, 'F');

  // ── Logo (square icon, full header height) ──
  if (logo) {
    const logoSz = hH - 4;           // 30mm — fills nearly the entire header height
    const logoX  = ML + 7;
    const logoY  = hY + 2;           // 2mm top gap
    try { doc.addImage(logo, 'PNG', logoX, logoY, logoSz, logoSz); } catch {}
  }

  // ── Company name  —  horizontally centred across full header ──
  const centerX = ML + UW / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);               // original 12 + 2
  doc.setTextColor(124, 45, 18);     // #7C2D12  orange-900
  doc.text('Glass Technology', centerX, hY + 13, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);               // original 8 + 2
  doc.setTextColor(154, 52, 18);     // #9A3412  orange-800
  doc.text('E & I Department  —  Attendance Management System', centerX, hY + 21, { align: 'center' });

  // ── Report title  —  right-aligned ──
  const rX = ML + UW - 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138);     // blue-900
  doc.text(reportTitle, rX, hY + 10, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(67, 56, 202);     // indigo-700
  doc.text(period, rX, hY + 18, { align: 'right' });

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, rX, hY + 25, { align: 'right' });

  // Separator line below header
  doc.setDrawColor(234, 88, 12);
  doc.setLineWidth(0.5);
  doc.line(ML, hBottom + 4, ML + UW, hBottom + 4);
}

// ── Footer ────────────────────────────────────────────────────────────────────
function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  doc.setFillColor(255, 247, 237);   // orange-50
  doc.rect(ML, FOOT_Y, UW, 7, 'F');
  doc.setDrawColor(251, 146, 60);
  doc.setLineWidth(0.3);
  doc.line(ML, FOOT_Y, ML + UW, FOOT_Y);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(154, 52, 18);
  doc.text('Glass Technology — E & I MMS  |  Confidential', ML + 2, FOOT_Y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Page ${pageNum} of ${totalPages}`, ML + UW - 2, FOOT_Y + 4.5, { align: 'right' });
}

// ── Section title band ────────────────────────────────────────────────────────
function drawSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFillColor(255, 215, 170);   // orange-200
  doc.rect(ML, y, UW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(124, 45, 18);
  doc.text(title.toUpperCase(), ML + 3, y + 5);
}

// ── Page 1: Attendance Sheet ──────────────────────────────────────────────────
export function addAttendanceSheet(
  doc: jsPDF,
  logo: string | null,
  team: PDFTeamMember[],
  entries: Entries,
  year: number,
  month: number,
  remarks?: Remarks,
) {
  const totalDays = daysInMonth(year, month);
  const days      = Array.from({ length: totalDays }, (_, i) => i + 1);

  drawHeader(doc, logo, 'Attendance Sheet', `${MONTHS[month - 1]} ${year}`);

  const tableStartY = HEAD_H + 7;

  // Dynamic row height — fill page leaving room for legend + footer
  const legendBlockH  = 21;  // 15mm box + 6mm gap above it
  const headerBlockH  = 11;  // 2 header rows
  const availBodyH    = FOOT_Y - tableStartY - legendBlockH - headerBlockH;
  const targetRowH    = Math.max(6, Math.min(22, availBodyH / team.length));
  const rowPad        = Math.max(1.5, (targetRowH - 5) / 2);

  // Column widths
  const slW   = 8;
  const nameW = 52;
  const idW   = 18;
  const dayW  = parseFloat(((UW - slW - nameW - idW) / totalDays).toFixed(2));

  const headRow1 = ['SL', 'Employee Name', 'Emp ID', ...days.map(d => String(d))];
  const headRow2 = ['',   '',              '',       ...days.map(d => DOW[new Date(year, month - 1, d).getDay()])];

  const bodyRows = team.map((m, idx) => [
    idx + 1,
    m.empName,
    m.empId,
    ...days.map(d => entries[m.empId]?.[d] ?? ''),
  ]);

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: ML, right: MR },
    head: [headRow1, headRow2],
    body: bodyRows,
    columnStyles: {
      // SL — match Page 2 size (9pt)
      0: { cellWidth: slW,   halign: 'center', valign: 'middle', fontSize: 9, textColor: [100, 116, 139] },
      // Employee Name — match Page 2 size (9pt), left aligned
      1: { cellWidth: nameW, halign: 'left',   valign: 'middle', fontSize: 9, textColor: [71, 85, 105]  },
      // Emp ID — match Page 2 size (9pt)
      2: { cellWidth: idW,   halign: 'center', valign: 'middle', fontSize: 9, textColor: [96, 165, 250], fontStyle: 'bold' },
      // Day cells — kept small so 2-char codes (WO, WH…) fit on one line
      ...Object.fromEntries(days.map((_, i) => [
        i + 3,
        { cellWidth: dayW, halign: 'center', fontSize: 6.5, cellPadding: 0.5 },
      ])),
    },
    headStyles: {
      fillColor:   [234, 88, 12],
      textColor:   [255, 237, 213],
      fontSize:    7,
      fontStyle:   'bold',
      halign:      'center',
      valign:      'middle',
      cellPadding: { top: 1.5, bottom: 1.5, left: 0.5, right: 0.5 },
    },
    bodyStyles: {
      fontSize:    8,
      valign:      'middle',
      cellPadding: { top: rowPad, bottom: rowPad, left: 1, right: 1 },
      lineColor:   [226, 232, 240],
      lineWidth:   0.15,
      textColor:   [30, 41, 59],
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const colIdx = data.column.index;
      const rowIdx = data.row.index;
      const altBg: [number,number,number] = rowIdx % 2 === 0 ? [255,255,255] : [255,247,237];

      if (colIdx >= 3) {
        const code = String(data.cell.raw ?? '');
        const day  = colIdx - 2;   // col 3 → day 1
        const dow  = new Date(year, month - 1, day).getDay();
        const isSun = dow === 0;

        if (code && CODE_BG[code]) {
          // Coloured attendance code cell
          data.cell.styles.fillColor = CODE_BG[code];
          data.cell.styles.textColor = CODE_TEXT[code];
          data.cell.styles.fontStyle = 'bold';
        } else if (isSun) {
          // Sunday with no code — light red tint like web UI
          data.cell.styles.fillColor = [254, 242, 242];
          data.cell.styles.textColor = [203, 213, 225];
        } else {
          data.cell.styles.fillColor = altBg;
          data.cell.styles.textColor = [203, 213, 225];
        }
      } else {
        // SL / Name / ID columns — alternating row bg
        data.cell.styles.fillColor = altBg;
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index < 3) return;
      const rowIdx = data.row.index;
      if (rowIdx >= team.length) return;
      const empId = team[rowIdx].empId;
      const day   = data.column.index - 2;   // col 3 → day 1
      if (remarks?.[empId]?.[day]) {
        // Amber dot in top-right corner — signals a remark exists
        doc.setFillColor(245, 158, 11);
        doc.circle(data.cell.x + data.cell.width - 1.4, data.cell.y + 1.4, 0.9, 'F');
      }
    },
    showHead:      'everyPage',
    tableLineColor:[203, 213, 225],
    tableLineWidth: 0.2,
  });


  // Legend — pinned just above footer
  const legendY = FOOT_Y - 19;
  {
    doc.setFillColor(255, 247, 237);
    doc.roundedRect(ML, legendY, UW, 15, 1.5, 1.5, 'F');
    doc.setDrawColor(251, 146, 60);
    doc.setLineWidth(0.2);
    doc.roundedRect(ML, legendY, UW, 15, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(124, 45, 18);
    doc.text('LEGEND:', ML + 3, legendY + 6);

    const items = [
      ['PR','Present'],['WO','Weekly Off'],['WH','WFH'],['SD','Special Duty'],
      ['CO','Comp Off'],['PL','Planned Leave'],['AL','Annual Leave'],['OD','On Duty'],
      ['RP','Req. Perm.'],['A','First Shift'],['B','Second Shift'],['C','Night Shift'],
      ['SL','Sp. Leave'],['NH','Nat. Holiday'],
    ];
    let lx = ML + 20;
    const iW = (UW - 20) / items.length;
    items.forEach(([code, label]) => {
      const bg  = CODE_BG[code]   || [229, 231, 235];
      const txt = CODE_TEXT[code] || [30, 41, 59];
      doc.setFillColor(...bg);
      doc.roundedRect(lx, legendY + 2, 7, 5, 0.6, 0.6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...txt);
      doc.text(code, lx + 3.5, legendY + 5.6, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(100, 116, 139);
      doc.text(label, lx + 3.5, legendY + 11.5, { align: 'center' });
      lx += iW;
    });
  }
}

// ── Page 2: Work Summary ──────────────────────────────────────────────────────
export function addWorkSummary(
  doc: jsPDF,
  logo: string | null,
  team: PDFTeamMember[],
  entries: Entries,
  year: number,
  month: number,
) {
  const totalDays = daysInMonth(year, month);
  drawHeader(doc, logo, 'Work Summary', `${MONTHS[month - 1]} ${year}  ·  ${totalDays} days`);

  const tableStartY = HEAD_H + 7;

  // Dynamic row height to fill the page — leave ~26mm for the stats box + footer gap
  const statsBoxH   = 26;
  const availableH  = FOOT_Y - statsBoxH - tableStartY;
  const rowCount    = team.length + 1; // data rows + totals row
  const headerH     = 11;
  const targetRowH  = Math.max(7, Math.min(16, (availableH - headerH) / rowCount));
  const rowPad      = Math.max(2, (targetRowH - 5.5) / 2);

  // Column widths: SL=7 + Name=54 + ID=15 + 14×code=11 + WD=18 + WP=16 = 264 ≈ UW ✓
  const colStyles: Record<number, object> = {
    0: { cellWidth: 7,  halign: 'center', fontSize: 9 },
    1: { cellWidth: 54, halign: 'left',   fontSize: 9 },
    2: { cellWidth: 15, halign: 'center', fontSize: 9, fontStyle: 'bold', textColor: [96,165,250] },
    ...Object.fromEntries(SUMMARY_COLS.map((_, i) => [i + 3, { cellWidth: 11, halign: 'center', fontSize: 9 }])),
    [3 + SUMMARY_COLS.length]:     { cellWidth: 18, halign: 'center', fontSize: 9.5, fontStyle: 'bold' },
    [3 + SUMMARY_COLS.length + 1]: { cellWidth: 16, halign: 'center', fontSize: 9.5, fontStyle: 'bold' },
  };

  const bodyRows = team.map((m, idx) => {
    const vals     = Object.values(entries[m.empId] ?? {});
    const workDays = vals.filter(c => WORK_CODES.has(c)).length;
    const pct      = totalDays > 0 ? ((workDays / totalDays) * 100).toFixed(1) : '0.0';
    return [
      idx + 1,
      m.empName,
      m.empId,
      ...SUMMARY_COLS.map(c => { const n = vals.filter(v => v === c).length; return n > 0 ? n : 'Nil'; }),
      workDays,
      `${pct}%`,
    ];
  });

  const totalsRow = [
    '', 'TOTAL', '',
    ...SUMMARY_COLS.map(c =>
      team.reduce((s, m) => s + Object.values(entries[m.empId] ?? {}).filter(v => v === c).length, 0)),
    team.reduce((s, m) =>
      s + Object.values(entries[m.empId] ?? {}).filter(c => WORK_CODES.has(c)).length, 0),
    '',
  ];

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: ML, right: MR },
    head: [['SL','Employee Name','Emp ID',...SUMMARY_COLS,'Work Days','Work %']],
    body: [...bodyRows, totalsRow],
    columnStyles: colStyles,
    headStyles: {
      fillColor:   [234, 88, 12],
      textColor:   [255, 237, 213],
      fontSize:    9,
      fontStyle:   'bold',
      halign:      'center',
      valign:      'middle',
      cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
    },
    bodyStyles: {
      fontSize:    8,
      valign:      'middle',
      cellPadding: { top: rowPad, bottom: rowPad, left: 1, right: 1 },
      lineColor:   [226, 232, 240],
      lineWidth:   0.15,
      textColor:   [30, 41, 59],
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;

      const rowIdx = data.row.index;
      const colIdx = data.column.index;
      const raw    = data.cell.raw;

      // ── Totals row (last row) ──
      if (rowIdx === team.length) {
        data.cell.styles.fillColor = [124, 45, 18];
        data.cell.styles.textColor = [255, 237, 213];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize  = 9.5;
        return;
      }

      // Alternating row base
      const altBg: [number,number,number] = rowIdx % 2 === 0 ? [255,255,255] : [255,247,237];

      // ── Code count columns ──
      if (colIdx >= 3 && colIdx < 3 + SUMMARY_COLS.length) {
        const code = SUMMARY_COLS[colIdx - 3];
        if (raw === 'Nil') {
          data.cell.styles.fillColor = altBg;
          data.cell.styles.textColor = [210, 214, 220];   // faded shadow — barely visible
          data.cell.styles.fontSize  = 6.5;
          data.cell.styles.fontStyle = 'normal';
        } else if (raw && CODE_BG[code]) {
          data.cell.styles.fillColor = CODE_BG[code];
          data.cell.styles.textColor = CODE_TEXT[code];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize  = 9;
        } else {
          data.cell.styles.fillColor = altBg;
        }
        return;
      }

      // ── Work % colour band ──
      if (colIdx === 3 + SUMMARY_COLS.length + 1) {
        const pct = parseFloat(String(raw || ''));
        if (!isNaN(pct)) {
          data.cell.styles.fillColor = pct >= 90 ? [187,247,208] : pct >= 70 ? [254,249,195] : [254,202,202];
          data.cell.styles.textColor = pct >= 90 ? [20,83,45]    : pct >= 70 ? [133,77,14]   : [127,29,29];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.fillColor = altBg;
        }
        return;
      }

      // ── Default cells — apply alternating background ──
      data.cell.styles.fillColor = altBg;
    },
    showHead:       'everyPage',
    tableLineColor: [203, 213, 225],
    tableLineWidth:  0.2,
  });

  // Summary stats box
  const afterY = (doc as any).lastAutoTable.finalY + 5;
  if (afterY < FOOT_Y - 28) {
    doc.setFillColor(255, 247, 237);
    doc.roundedRect(ML, afterY, UW, 16, 2, 2, 'F');
    doc.setDrawColor(251, 146, 60);
    doc.setLineWidth(0.25);
    doc.roundedRect(ML, afterY, UW, 16, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(124, 45, 18);
    doc.text('MONTHLY OVERVIEW', ML + 4, afterY + 6.5);

    const totalWork   = team.reduce((s,m) =>
      s + Object.values(entries[m.empId] ?? {}).filter(c => WORK_CODES.has(c)).length, 0);
    const avgPct      = team.length > 0
      ? ((totalWork / (team.length * totalDays)) * 100).toFixed(1) : '0.0';
    const presentCnt  = team.reduce((s,m) =>
      s + Object.values(entries[m.empId] ?? {}).filter(c => c === 'PR').length, 0);
    const leaveCnt    = team.reduce((s,m) =>
      s + Object.values(entries[m.empId] ?? {}).filter(c => ['PL','AL','CO','SL'].includes(c)).length, 0);

    const stats = [
      ['Team Strength', String(team.length)],
      ['Working Days',  String(totalDays)],
      ['Total Present', String(presentCnt)],
      ['Total Leave',   String(leaveCnt)],
      ['Avg Attendance',`${avgPct}%`],
    ];
    let sx = ML + 52;
    stats.forEach(([lbl, val]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(lbl, sx, afterY + 6.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(234, 88, 12);
      doc.text(val, sx, afterY + 13);
      sx += 44;
    });
  }
}

// ── Page 3: Overtime Report ───────────────────────────────────────────────────
export function addOvertimeSheet(
  doc: jsPDF,
  logo: string | null,
  otRecords: OTRecord[],
  year: number,
  month: number,
) {
  drawHeader(doc, logo, 'Overtime Report', `${MONTHS[month - 1]} ${year}`);

  const tableStartY = HEAD_H + 7;
  drawSectionTitle(doc, `OT Entries  —  ${otRecords.length} records`, tableStartY);

  const bodyRows = otRecords.map((r, idx) => [
    idx + 1, r.empName, r.empId, r.day, r.startTime, r.endTime,
    fmtHrs(r.totalHours), r.reason || '—', r.approvedBy || 'Pending',
  ]);
  const totalHrs  = otRecords.reduce((s,r) => s + r.totalHours, 0);
  const totalsRow = ['','TOTAL','','','','',fmtHrs(totalHrs),'',''];

  // Widths: 8+58+17+12+16+16+22+70+44 = 263 ✓
  autoTable(doc, {
    startY: tableStartY + 7,
    margin: { left: ML, right: MR },
    head:  [['SL','Employee Name','Emp ID','Day','Start','End','OT Hours','Reason','Approved By']],
    body:  [...bodyRows, totalsRow],
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center', fontSize: 9 },
      1: { cellWidth: 58, halign: 'left',   fontSize: 9 },
      2: { cellWidth: 17, halign: 'center', fontSize: 9, fontStyle:'bold', textColor:[96,165,250] },
      3: { cellWidth: 12, halign: 'center', fontSize: 9 },
      4: { cellWidth: 16, halign: 'center', fontSize: 9 },
      5: { cellWidth: 16, halign: 'center', fontSize: 9 },
      6: { cellWidth: 22, halign: 'center', fontSize: 9.5, fontStyle:'bold', textColor:[30,58,138] },
      7: { cellWidth: 70, halign: 'left',   fontSize: 9 },
      8: { cellWidth: 44, halign: 'left',   fontSize: 9, textColor:[21,128,61], fontStyle:'bold' },
    },
    headStyles: {
      fillColor:   [234, 88, 12],
      textColor:   [255, 237, 213],
      fontSize:    9,
      fontStyle:   'bold',
      halign:      'center',
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
    },
    bodyStyles: {
      fontSize:    9.5,
      valign:      'middle',
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      lineColor:   [226, 232, 240],
      lineWidth:   0.15,
      textColor:   [30, 41, 59],
    },
    alternateRowStyles: { fillColor: [255, 247, 237] },
    willDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 6 && data.row.index !== bodyRows.length) {
        data.cell.styles.fillColor = [239, 246, 255];
      }
      if (data.section === 'body' && data.row.index === bodyRows.length) {
        data.cell.styles.fillColor = [124, 45, 18];
        data.cell.styles.textColor = [255, 237, 213];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize  = 10;
      }
    },
    showHead:       'everyPage',
    tableLineColor: [203, 213, 225],
    tableLineWidth:  0.2,
  });

  // Per-employee OT summary
  const afterY     = (doc as any).lastAutoTable.finalY + 5;
  const empGroups: Record<string,{name:string;days:number;hours:number}> = {};
  otRecords.forEach(r => {
    if (!empGroups[r.empId]) empGroups[r.empId] = { name:r.empName, days:0, hours:0 };
    empGroups[r.empId].days  += 1;
    empGroups[r.empId].hours += r.totalHours;
  });

  if (afterY < FOOT_Y - 30 && Object.keys(empGroups).length > 0) {
    drawSectionTitle(doc, 'Per-Employee OT Summary', afterY);
    autoTable(doc, {
      startY: afterY + 7,
      margin: { left: ML, right: MR },
      head: [['Employee Name','Emp ID','OT Days','Total OT Hrs','Avg per OT Day']],
      body: Object.entries(empGroups).map(([empId,d]) => [
        d.name, empId, d.days, fmtHrs(d.hours), d.days > 0 ? fmtHrs(d.hours/d.days) : '—',
      ]),
      columnStyles: {
        0: { cellWidth: 65, fontSize:9 },
        1: { cellWidth: 22, halign:'center', fontStyle:'bold', textColor:[96,165,250], fontSize:9 },
        2: { cellWidth: 20, halign:'center', fontSize:9 },
        3: { cellWidth: 30, halign:'center', fontStyle:'bold', textColor:[30,58,138], fontSize:9.5 },
        4: { cellWidth: 30, halign:'center', fontSize:9 },
      },
      headStyles: {
        fillColor:   [124, 45, 18],
        textColor:   [255, 237, 213],
        fontSize:    9,
        fontStyle:   'bold',
        halign:      'center',
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      },
      bodyStyles: {
        fontSize:    9.5,
        textColor:   [30, 41, 59],
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
        lineColor:   [226, 232, 240],
        lineWidth:   0.15,
      },
      alternateRowStyles: { fillColor: [255, 247, 237] },
      tableLineColor: [203, 213, 225],
      tableLineWidth:  0.2,
    });
  }
}

// ── Attendance Remarks Page ───────────────────────────────────────────────────
export function addAttendanceRemarksPage(
  doc: jsPDF,
  logo: string | null,
  team: PDFTeamMember[],
  entries: Entries,
  remarks: Remarks,
  year: number,
  month: number,
) {
  const DOW_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  // Build flat list of all remarks sorted by day → employee
  const remarksList: Array<{ day: number; dow: string; empName: string; empId: string; code: string; remark: string }> = [];
  team.forEach(m => {
    Object.entries(remarks[m.empId] ?? {}).forEach(([dayStr, note]) => {
      if (note?.trim()) {
        const day = Number(dayStr);
        const dow = DOW_FULL[new Date(year, month - 1, day).getDay()];
        remarksList.push({ day, dow, empName: m.empName, empId: m.empId, code: entries[m.empId]?.[day] ?? '—', remark: note.trim() });
      }
    });
  });
  remarksList.sort((a, b) => a.day - b.day || a.empName.localeCompare(b.empName));

  drawHeader(doc, logo, 'Attendance Remarks', `${MONTHS[month - 1]} ${year}  ·  ${remarksList.length} entr${remarksList.length !== 1 ? 'ies' : 'y'}`);

  const tableStartY = HEAD_H + 7;

  if (remarksList.length === 0) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(160, 160, 160);
    doc.text('No attendance remarks recorded for this period.', ML + 4, tableStartY + 10);
    return;
  }

  drawSectionTitle(doc, `Remarks / Notes  —  ${MONTHS[month - 1]} ${year}`, tableStartY);

  autoTable(doc, {
    startY: tableStartY + 7,
    margin: { left: ML, right: MR },
    head: [['#', 'Day', 'Weekday', 'Employee Name', 'Emp ID', 'Status', 'Remark / Note']],
    body: remarksList.map((r, i) => [i + 1, r.day, r.dow, r.empName, r.empId, r.code, r.remark]),
    columnStyles: {
      0: { cellWidth: 8,   halign: 'center', fontSize: 8, textColor: [156, 163, 175] },
      1: { cellWidth: 12,  halign: 'center', fontSize: 9, fontStyle: 'bold', textColor: [234, 88, 12] },
      2: { cellWidth: 24,  halign: 'center', fontSize: 8, textColor: [100, 116, 139] },
      3: { cellWidth: 55,  halign: 'left',   fontSize: 9, fontStyle: 'bold' },
      4: { cellWidth: 20,  halign: 'center', fontSize: 9, fontStyle: 'bold', textColor: [96, 165, 250] },
      5: { cellWidth: 18,  halign: 'center', fontSize: 9, fontStyle: 'bold' },
      6: { cellWidth: 126, halign: 'left',   fontSize: 9 },
    },
    headStyles: {
      fillColor:   [234, 88, 12],
      textColor:   [255, 237, 213],
      fontSize:    9, fontStyle: 'bold', halign: 'center',
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
    },
    bodyStyles: {
      fontSize: 8.5, valign: 'middle',
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      lineColor: [226, 232, 240], lineWidth: 0.15,
      textColor: [30, 41, 59],
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const altBg: [number,number,number] = data.row.index % 2 === 0 ? [255,255,255] : [255,251,235];
      data.cell.styles.fillColor = altBg;
      if (data.column.index === 5) {
        const code = String(data.cell.raw || '');
        if (CODE_BG[code]) { data.cell.styles.fillColor = CODE_BG[code]; data.cell.styles.textColor = CODE_TEXT[code]; }
      }
    },
    tableLineColor: [203, 213, 225], tableLineWidth: 0.2,
  });
}

// ── Main export entry point ───────────────────────────────────────────────────
export async function exportAttendancePDF(
  team: PDFTeamMember[],
  entries: Entries,
  year: number,
  month: number,
  remarks?: Remarks,
) {
  const logo = await loadLogo();

  let otRecords: OTRecord[] = [];
  try {
    const r = await fetch(`/api/overtime?year=${year}&month=${month}`);
    if (r.ok) otRecords = await r.json();
  } catch {}

  const doc = new jsPDF({
    orientation: 'landscape', unit: 'mm', format: 'a4',
    encryption: {
      userPassword:    'GT@2026',
      ownerPassword:   'GT@2026',
      userPermissions: ['print'],
    },
  });

  addAttendanceSheet(doc, logo, team, entries, year, month, remarks);

  doc.addPage('a4', 'landscape');
  addWorkSummary(doc, logo, team, entries, year, month);

  if (otRecords.length > 0) {
    doc.addPage('a4', 'landscape');
    addOvertimeSheet(doc, logo, otRecords, year, month);
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, i, total);
  }

  doc.save(`GT-E&I-ATD-${MONTHS[month - 1]}-${year}.pdf`);
}
