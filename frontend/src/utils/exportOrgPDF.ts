import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface OrgPos {
  posId: string; parentId: string | null;
  role: string; team: string;
  personName: string; urgent: boolean; sortOrder: number;
  roleCategory: string; recruitmentStatus: string;
}

// ── Layout constants (mm) ─────────────────────────────────────────────────────
const NODE_W = 50;   // card width
const NODE_H = 20;   // card height — fits 7 tree levels in landscape A4
const H_GAP  = 3;    // horizontal gap between subtrees
const V_GAP  = 26;   // vertical distance parent-top → child-top (CONN_H = 6mm)
const CONN_H = V_GAP - NODE_H; // 6mm connector space

// ── Layout tree ───────────────────────────────────────────────────────────────
interface LNode {
  pos: OrgPos;
  children: LNode[];
  width: number;
  x: number;   // absolute left edge (includes startX offset from assignCoords)
  y: number;   // absolute top edge
}

function buildLTree(positions: OrgPos[]): LNode[] {
  const map = new Map<string, LNode>();
  positions.forEach(p => map.set(p.posId, { pos: p, children: [], width: 0, x: 0, y: 0 }));
  const roots: LNode[] = [];
  positions.forEach(p => {
    if (!p.parentId || !map.has(p.parentId)) roots.push(map.get(p.posId)!);
    else map.get(p.parentId)!.children.push(map.get(p.posId)!);
  });
  map.forEach(n => n.children.sort((a, b) => a.pos.sortOrder - b.pos.sortOrder));

  function calcWidth(n: LNode): number {
    if (!n.children.length) { n.width = NODE_W; return NODE_W; }
    const total = n.children.reduce((s, c) => s + calcWidth(c), 0) + (n.children.length - 1) * H_GAP;
    n.width = Math.max(NODE_W, total);
    return n.width;
  }
  roots.forEach(calcWidth);
  return roots;
}

// Assigns absolute coordinates. blockX is already the offset (startX).
// n.x values returned are absolute — do NOT add startX again in draw calls.
function assignCoords(nodes: LNode[], blockX: number, y: number): void {
  let x = blockX;
  nodes.forEach(node => {
    if (!node.children.length) {
      node.x = x;
    } else {
      const childBlock = node.children.reduce((s, c) => s + c.width, 0) + (node.children.length - 1) * H_GAP;
      node.x = x + (childBlock - NODE_W) / 2;
    }
    node.y = y;
    if (node.children.length) assignCoords(node.children, x, y + V_GAP);
    x += node.width + H_GAP;
  });
}

function collectAll(nodes: LNode[]): LNode[] {
  const all: LNode[] = [];
  function walk(n: LNode) { all.push(n); n.children.forEach(walk); }
  nodes.forEach(walk);
  return all;
}

// ── Color helpers ─────────────────────────────────────────────────────────────
type RGB = [number, number, number];

function cardColors(pos: OrgPos): { bg: RGB; accent: RGB } {
  if (pos.personName.trim()) return { bg: [220,252,231], accent: [22,163,74]   };
  if (pos.urgent)             return { bg: [255,247,237], accent: [234,88,12]   };
  return                             { bg: [241,245,249], accent: [148,163,184] };
}

function statusColor(rs: string): RGB {
  switch (rs) {
    case 'joined':        return [22,163,74];
    case 'ready_to_join': return [37,99,235];
    case 'hr_process':    return [124,58,237];
    default:              return [220,38,38];
  }
}

// ── Glass Technology logo in the navy header bar (top-right corner) ───────────
function drawLogo(pdf: jsPDF): void {
  const PW = pdf.internal.pageSize.getWidth();
  const x  = PW - 66;   // logo left edge (66mm from right edge)
  const y  = 1.8;       // within 15mm header
  const iS = 11;        // icon square size (mm)
  const ft = 3.1;       // frame thickness (mm)

  // Colored rectangular frame (approximates the faceted geometric square)
  pdf.setFillColor(216,112,60);  pdf.rect(x,       y,       iS, ft, 'F');      // top bar
  pdf.setFillColor(204,104,56);  pdf.rect(x,       y,       ft, iS, 'F');      // left bar
  pdf.setFillColor(176,88,48);   pdf.rect(x+iS-ft, y,       ft, iS, 'F');      // right bar
  pdf.setFillColor(160,72,40);   pdf.rect(x,       y+iS-ft, iS, ft, 'F');      // bottom bar
  pdf.setFillColor(255,255,255); pdf.rect(x+ft,    y+ft, iS-2*ft, iS-2*ft, 'F'); // inner white

  // "Glass Technology" text — readable on navy background
  const tx = x + iS + 2.5;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(240, 150, 90);  // warm orange on navy
  pdf.text('Glass', tx, y + 5.8);
  const gw = pdf.getTextWidth('Glass');
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(255, 255, 255);
  pdf.text(' Technology', tx + gw, y + 5.8);

  // Tagline
  pdf.setFontSize(5.5);
  pdf.setTextColor(155, 185, 215);
  pdf.text('The glass of tomorrow, today', tx, y + 9.8);
}

// ── Draw a single card — centered layout, compact for 7-level deep trees ──────
function drawCard(pdf: jsPDF, n: LNode, ox: number, oy: number): void {
  const { pos } = n;
  const x  = ox + n.x;
  const y  = oy + n.y;
  const cx = x + NODE_W / 2;
  const { bg, accent } = cardColors(pos);

  // Card background + border
  pdf.setFillColor(...bg);
  pdf.setDrawColor(...accent);
  pdf.setLineWidth(0.35);
  pdf.rect(x, y, NODE_W, NODE_H, 'FD');

  // Top accent bar
  pdf.setFillColor(...accent);
  pdf.rect(x, y, NODE_W, 2.5, 'F');

  // Status dot — on accent bar (top-right), avoids overlapping the person name
  const rs = pos.recruitmentStatus || (pos.personName.trim() ? 'joined' : 'pending');
  pdf.setFillColor(...statusColor(rs));
  pdf.circle(x + NODE_W - 2, y + 1.25, 1.25, 'F');

  // Start below accent bar: cap-height of 7.5pt ≈ 1.85mm, accent bar = 2.5mm
  // so baseline must be ≥ 2.5 + 1.85 = 4.35mm → shifted to 5.8mm for visual breathing room
  let ty = y + 5.8;

  // Team label — 7.5pt bold centered (web: 13px uppercase)
  if (pos.team) {
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...accent);
    pdf.text(pos.team.toUpperCase(), cx, ty, { align: 'center' });
    ty += 3.8;  // enough gap so role cap-height clears team descender
  } else {
    ty += 0.5;
  }

  // Role name — 8pt bold, dark, centered
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  const rl = (pdf.splitTextToSize(pos.role, NODE_W - 5) as string[]).slice(0, 2);
  pdf.text(rl, cx, ty, { align: 'center' });
  ty += rl.length * 3.2;

  // Separator line
  pdf.setDrawColor(210, 215, 225);
  pdf.setLineWidth(0.15);
  pdf.line(x + 2.5, ty + 0.3, x + NODE_W - 2.5, ty + 0.3);
  ty += 1.6;

  const filled = pos.personName.trim() !== '';

  if (filled) {
    // Horizontal layout matching web app: [avatar] [name]  — no vertical stacking, no overlap
    const initials = pos.personName.trim().split(' ')
      .map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
    const r   = 1.5;
    const gap = 1.8;  // gap between avatar right edge and name text
    const rowMidY = ty + r; // vertical centre of the person row

    // Measure name width at 7.5pt to centre the avatar+name block
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    const nameText = pos.personName.trim();
    const nW       = Math.min(pdf.getTextWidth(nameText), NODE_W - r * 2 - gap - 8);
    const blockW   = r * 2 + gap + nW;
    const blockX   = cx - blockW / 2; // left edge of block, centred in card
    const avatarCx = blockX + r;
    const nameX    = blockX + r * 2 + gap;

    // Avatar circle
    pdf.setFillColor(...bg);
    pdf.setDrawColor(...accent);
    pdf.setLineWidth(0.5);
    pdf.circle(avatarCx, rowMidY, r, 'FD');

    // Initials inside circle
    pdf.setFontSize(4.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...accent);
    pdf.text(initials, avatarCx, rowMidY + 0.5, { align: 'center' });

    // Name text — vertically centred with avatar, left-aligned from nameX
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text(nameText, nameX, rowMidY + 0.5);

    ty += r * 2 + 1.0; // advance past person row
  } else {
    // Vacant — 7pt italic, centered, muted
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(148, 163, 184);
    pdf.text(pos.urgent ? '! Position Vacant' : '— Not Yet Filled —', cx, ty + 1.0, { align: 'center' });
  }
}

// ── Connector lines ───────────────────────────────────────────────────────────
function drawConnectors(pdf: jsPDF, nodes: LNode[], ox: number, oy: number): void {
  pdf.setDrawColor(140, 170, 220);
  pdf.setLineWidth(0.3);

  function draw(n: LNode) {
    if (!n.children.length) return;
    const px   = ox + n.x + NODE_W / 2;
    const py   = oy + n.y + NODE_H;
    const midY = py + CONN_H / 2;

    pdf.line(px, py, px, midY);

    if (n.children.length === 1) {
      const cx = ox + n.children[0].x + NODE_W / 2;
      pdf.line(cx, midY, cx, oy + n.children[0].y);
    } else {
      const firstCx = ox + n.children[0].x + NODE_W / 2;
      const lastCx  = ox + n.children[n.children.length - 1].x + NODE_W / 2;
      pdf.line(firstCx, midY, lastCx, midY);
      n.children.forEach(c => {
        const cx = ox + c.x + NODE_W / 2;
        pdf.line(cx, midY, cx, oy + c.y);
      });
    }
    n.children.forEach(draw);
  }
  nodes.forEach(draw);
}

// ── Org chart page (landscape A4) ────────────────────────────────────────────
function drawOrgPage(pdf: jsPDF, positions: OrgPos[]): void {
  const PW  = pdf.internal.pageSize.getWidth();   // 297mm
  const PH  = pdf.internal.pageSize.getHeight();  // 210mm
  const now = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

  // Ash background
  pdf.setFillColor(229, 231, 235);
  pdf.rect(0, 0, PW, PH, 'F');

  // Navy header
  pdf.setFillColor(30, 58, 138);
  pdf.rect(0, 0, PW, 15, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('E&I Department — Organization Chart', PW / 2, 8, { align: 'center' });
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Confidential — For Plant Director Use', 8, 11.5);
  pdf.text(`Generated: ${now}`, PW - 70, 11.5, { align: 'right' });

  drawLogo(pdf);

  // ── Tree layout ─────────────────────────────────────────────────────────
  const roots = buildLTree(positions);
  if (!roots.length) return;

  const treeW  = roots.reduce((s, r) => s + r.width, 0) + (roots.length - 1) * H_GAP;
  const startX = Math.max(8, (PW - treeW) / 2);
  const startY = 19;

  assignCoords(roots, startX, startY);
  const all = collectAll(roots);

  // White card canvas — use direct n.x values (already absolute, no double-offset)
  const minX = Math.min(...all.map(n => n.x));
  const maxX = Math.max(...all.map(n => n.x + NODE_W));
  const maxY = Math.max(...all.map(n => n.y + NODE_H));
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(220, 225, 235);
  pdf.setLineWidth(0.2);
  pdf.rect(minX - 4, startY - 2, (maxX - minX) + 8, (maxY - startY) + 6, 'FD');

  // Draw with ox=0 — n.x is already absolute (includes startX)
  drawConnectors(pdf, roots, 0, 0);
  all.forEach(n => drawCard(pdf, n, 0, 0));

  // ── Legend ──────────────────────────────────────────────────────────────
  const legendY = PH - 9;
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'normal');
  const legendItems: Array<{ label: string; color: RGB }> = [
    { label: 'Joined / Filled',  color: [22,163,74]   },
    { label: 'Urgent Vacancy',   color: [234,88,12]   },
    { label: 'Pending / Vacant', color: [148,163,184] },
    { label: 'Ready to Join',    color: [37,99,235]   },
    { label: 'HR Process',       color: [124,58,237]  },
  ];
  let lx = 8;
  legendItems.forEach(item => {
    pdf.setFillColor(...item.color);
    pdf.circle(lx + 1.8, legendY, 1.8, 'F');
    pdf.setTextColor(50, 50, 50);
    pdf.text(item.label, lx + 4.5, legendY + 0.6);
    lx += pdf.getTextWidth(item.label) + 10;
  });

  // Footer
  pdf.setDrawColor(200, 205, 215);
  pdf.setLineWidth(0.2);
  pdf.line(8, PH - 5, PW - 8, PH - 5);
  pdf.setFontSize(5.5);
  pdf.setTextColor(130, 130, 150);
  pdf.text('E&I Department | Internal Document | Page 1 of 2', PW / 2, PH - 2.5, { align: 'center' });
}

// ── Stats helpers ─────────────────────────────────────────────────────────────
const ROLE_ORDER = [
  'Manager', 'Dy Manager', 'General Shift Engineer', 'Shift Engineer',
  'Junior Engineer', 'Technician', 'Automation Engineer', 'IT Engineer',
];

interface StatRow {
  category: string; qty: number;
  joined: number; readyToJoin: number; hrProcess: number; pending: number;
}

function calcStats(positions: OrgPos[]): StatRow[] {
  const map = new Map<string, StatRow>();
  positions.forEach(p => {
    const cat = (p.roleCategory || p.role).trim();
    if (!map.has(cat)) map.set(cat, { category: cat, qty: 0, joined: 0, readyToJoin: 0, hrProcess: 0, pending: 0 });
    const row = map.get(cat)!;
    row.qty++;
    const rs = p.recruitmentStatus || (p.personName.trim() ? 'joined' : 'pending');
    if      (rs === 'joined')        row.joined++;
    else if (rs === 'ready_to_join') row.readyToJoin++;
    else if (rs === 'hr_process')    row.hrProcess++;
    else                             row.pending++;
  });
  const ordered: StatRow[] = [];
  ROLE_ORDER.forEach(r => { if (map.has(r)) { ordered.push(map.get(r)!); map.delete(r); } });
  map.forEach(v => ordered.push(v));
  return ordered;
}

// ── Position summary page (landscape A4) — matches page 1 ────────────────────
function drawSummaryPage(pdf: jsPDF, positions: OrgPos[]): void {
  const PW  = pdf.internal.pageSize.getWidth();   // 297mm
  const PH  = pdf.internal.pageSize.getHeight();  // 210mm
  const now = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

  // Ash background
  pdf.setFillColor(229, 231, 235);
  pdf.rect(0, 0, PW, PH, 'F');

  // Navy header
  pdf.setFillColor(30, 58, 138);
  pdf.rect(0, 0, PW, 15, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('E&I Department — Position Summary', PW / 2, 8, { align: 'center' });
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Confidential — For Plant Director Use', 8, 11.5);
  pdf.text(`Generated: ${now}`, PW - 70, 11.5, { align: 'right' });

  drawLogo(pdf);

  const rows  = calcStats(positions);
  const total = rows.reduce(
    (a, r) => ({
      qty: a.qty + r.qty, joined: a.joined + r.joined,
      readyToJoin: a.readyToJoin + r.readyToJoin,
      hrProcess: a.hrProcess + r.hrProcess, pending: a.pending + r.pending,
    }),
    { qty: 0, joined: 0, readyToJoin: 0, hrProcess: 0, pending: 0 }
  );
  const pct = (n: number) => total.qty ? `${Math.round(n / total.qty * 100)}%` : '0%';

  // Category rows only (collapsed / summary view) — no individual sub-rows
  // Column widths: 103+28+37×4 = 279mm = page 297mm − 2×9mm margins
  const bodyRows: string[][] = rows.map(r => [
    r.category,
    String(r.qty),
    String(r.joined),
    String(r.readyToJoin),
    String(r.hrProcess),
    String(r.pending),
  ]);

  autoTable(pdf, {
    startY: 19,
    head: [[
      { content: 'Position / Role',  styles: { halign: 'left'   } },
      { content: 'Total',            styles: { halign: 'center' } },
      { content: 'Joined',           styles: { halign: 'center', textColor: [22,163,74]  as [number,number,number] } },
      { content: 'Ready to Join',    styles: { halign: 'center', textColor: [37,99,235]  as [number,number,number] } },
      { content: 'HR Process',       styles: { halign: 'center', textColor: [124,58,237] as [number,number,number] } },
      { content: 'Pending',          styles: { halign: 'center', textColor: [220,38,38]  as [number,number,number] } },
    ]],
    body: bodyRows,
    foot: [
      ['Total Positions', String(total.qty), String(total.joined), String(total.readyToJoin), String(total.hrProcess), String(total.pending)],
      ['E&I Strength %',  '100%',            pct(total.joined),    pct(total.readyToJoin),    pct(total.hrProcess),    pct(total.pending)   ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 11,
      cellPadding: { top: 2, bottom: 2, left: 5, right: 5 },
      minCellHeight: 12,
      valign: 'middle',
      font: 'helvetica',
      lineColor: [210, 215, 225] as [number,number,number],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [30, 58, 138] as [number,number,number],
      textColor: [255, 255, 255] as [number,number,number],
      fontStyle: 'bold',
      fontSize: 11,
      minCellHeight: 10,
      halign: 'center',
    },
    footStyles: {
      fillColor: [30, 58, 138] as [number,number,number],
      textColor: [255, 255, 255] as [number,number,number],
      fontStyle: 'bold',
      fontSize: 11,
      minCellHeight: 10,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 103, halign: 'left'   },
      1: { cellWidth: 28,  halign: 'center' },
      2: { cellWidth: 37,  halign: 'center' },
      3: { cellWidth: 37,  halign: 'center' },
      4: { cellWidth: 37,  halign: 'center' },
      5: { cellWidth: 37,  halign: 'center' },
    },
    willDrawCell: (data) => {
      if (data.section === 'body') {
        if (data.column.index === 0) {
          data.cell.styles.fillColor  = [239, 246, 255];
          data.cell.styles.fontStyle  = 'bold';
          data.cell.styles.textColor  = [30, 58, 138];
        }
        if (data.column.index === 2 && Number(data.cell.raw) > 0) data.cell.styles.textColor = [22,163,74];
        if (data.column.index === 3 && Number(data.cell.raw) > 0) data.cell.styles.textColor = [37,99,235];
        if (data.column.index === 4 && Number(data.cell.raw) > 0) data.cell.styles.textColor = [124,58,237];
        if (data.column.index === 5 && Number(data.cell.raw) > 0) data.cell.styles.textColor = [220,38,38];
      }
    },
    margin: { left: 9, right: 9 },
  });

  // ── Stat boxes filling the remaining space below the table ────────────────
  const tableEndY: number = (pdf as any).lastAutoTable?.finalY ?? 150;
  const footerTop = PH - 14;
  const available = footerTop - tableEndY - 4;

  if (available >= 20) {
    const boxH = Math.min(available - 6, 48);
    const boxY = tableEndY + (available - boxH) / 2 + 2;
    const statItems: Array<{ label: string; value: number; pct: string; color: RGB; bg: RGB }> = [
      { label: 'Total Positions', value: total.qty,         pct: '100%',               color: [37,99,235]  as RGB, bg: [239,246,255] as RGB },
      { label: 'Joined',          value: total.joined,      pct: pct(total.joined),    color: [22,163,74]  as RGB, bg: [220,252,231] as RGB },
      { label: 'Ready to Join',   value: total.readyToJoin, pct: pct(total.readyToJoin), color: [37,99,235] as RGB, bg: [239,246,255] as RGB },
      { label: 'HR Process',      value: total.hrProcess,   pct: pct(total.hrProcess), color: [124,58,237] as RGB, bg: [245,243,255] as RGB },
      { label: 'Pending',         value: total.pending,     pct: pct(total.pending),   color: [220,38,38]  as RGB, bg: [254,242,242] as RGB },
    ];
    const boxW = (PW - 18) / statItems.length;

    statItems.forEach((item, i) => {
      const bx = 9 + i * boxW;
      // Card background
      pdf.setFillColor(...item.bg);
      pdf.setDrawColor(...item.color);
      pdf.setLineWidth(0.4);
      pdf.rect(bx, boxY, boxW - 1.5, boxH, 'FD');
      // Top accent strip
      pdf.setFillColor(...item.color);
      pdf.rect(bx, boxY, boxW - 1.5, 3, 'F');
      // Big number
      pdf.setFontSize(boxH > 30 ? 20 : 14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...item.color);
      pdf.text(String(item.value), bx + (boxW - 1.5) / 2, boxY + boxH * 0.50, { align: 'center' });
      // Label
      pdf.setFontSize(7.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(55, 65, 81);
      pdf.text(item.label, bx + (boxW - 1.5) / 2, boxY + boxH * 0.68, { align: 'center' });
      // Percentage
      pdf.setFontSize(7);
      pdf.setTextColor(...item.color);
      pdf.text(item.pct, bx + (boxW - 1.5) / 2, boxY + boxH * 0.84, { align: 'center' });
    });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  pdf.setDrawColor(200, 205, 215);
  pdf.setLineWidth(0.2);
  pdf.line(8, PH - 9, PW - 8, PH - 9);
  pdf.setFontSize(6);
  pdf.setTextColor(130, 130, 150);
  pdf.text('E&I Department | Internal Document | Page 2 of 2', PW / 2, PH - 5.5, { align: 'center' });
  pdf.setTextColor(160, 100, 50);
  pdf.text('Glass Technology — Confidential', PW / 2, PH - 2.2, { align: 'center' });
}

// ── Main export function ──────────────────────────────────────────────────────
export async function exportOrgChartPDF(positions: OrgPos[]): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  drawOrgPage(pdf, positions);

  pdf.addPage('a4', 'landscape');
  drawSummaryPage(pdf, positions);

  const dateStr = new Date().toISOString().slice(0, 10);
  pdf.save(`EI_OrgChart_${dateStr}.pdf`);
}
