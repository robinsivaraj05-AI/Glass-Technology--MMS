import { useState, useCallback, useEffect } from 'react';
import { FileSpreadsheet, FileDown, Filter, RefreshCw, Users, DollarSign, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
interface WorkerItem {
  name: string; age: number; designation: string;
  workingHours: number; overtimeHours: number; rate: number; cost: number;
}

interface ReportEntry {
  _id: string;
  workDate: string;
  contractId: string;
  contractName: string;
  contractorCompany: string;
  poNumber: string;
  department: string;
  area: string;
  workDescription: string;
  maintenanceType: string;
  shift: string;
  workers: WorkerItem[];
  numberOfPersons: number;
  costType: 'daily' | 'package';
  packageCost: number;
  totalCost: number;
  supervisorName: string;
  approvedBy: string;
  completionStatus: string;
  remarks: string;
}

interface Contract { _id: string; contractName: string; contractorCompany: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────
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

async function apiFetch(url: string) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const fmt  = (n: number) => n.toLocaleString('en-AE');
const fmtD = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtShort = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

function quarterRange(q: number, year: number): [string, string] {
  const s = [[1,1],[4,1],[7,1],[10,1]];
  const e = [[3,31],[6,30],[9,30],[12,31]];
  const p = (n: number) => String(n).padStart(2,'0');
  return [`${year}-${p(s[q-1][0])}-${p(s[q-1][1])}`, `${year}-${p(e[q-1][0])}-${p(e[q-1][1])}`];
}

// Expand workers from an entry; fall back to legacy fields
function expandWorkers(entry: ReportEntry): WorkerItem[] {
  if (entry.workers?.length > 0) return entry.workers;
  return [{ name: (entry as any).workerName ?? 'Unknown', age: (entry as any).workerAge ?? 0, designation: (entry as any).designation ?? '—', workingHours: (entry as any).workingHours ?? 8, overtimeHours: 0, rate: (entry as any).costPerPerson ?? 0, cost: entry.totalCost }];
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function OutsourceReport() {
  const [periodType, setPeriodType] = useState<'monthly'|'quarterly'|'yearly'|'custom'>('monthly');
  const [month,    setMonth]    = useState(() => new Date().toISOString().slice(0,7));
  const [quarter,  setQuarter]  = useState('1');
  const [year,     setYear]     = useState(new Date().getFullYear());
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');

  const [contracts,  setContracts]  = useState<Contract[]>([]);
  const [selectedId, setSelectedId] = useState('');   // '' = all

  const [rows,      setRows]      = useState<ReportEntry[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [generated, setGenerated] = useState(false);
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch('/api/contracts/active').then(setContracts).catch(() => {});
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

  const selectedContract = contracts.find(c => c._id === selectedId);

  const handleGenerate = async () => {
    const [from, to] = getRange();
    if (!from || !to) { toast.error('Select a valid period'); return; }
    setLoading(true);
    try {
      const p = new URLSearchParams({ from, to, limit: '1000' });
      if (selectedId) p.set('contractId', selectedId);
      const data = await apiFetch(`/api/outsource?${p}`);
      const entries: ReportEntry[] = data.entries ?? [];
      setRows(entries);
      setGenerated(true);
      setExpanded(new Set());
      if (entries.length === 0) toast('No records for this period', { icon: 'ℹ️' });
      else toast.success(`${entries.length} entries loaded`);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  // ── Computed data ─────────────────────────────────────────────────────────
  // All individual worker rows (expanded)
  const allWorkerRows = rows.flatMap(r =>
    expandWorkers(r).map(w => ({ ...w, contractName: r.contractName, contractorCompany: r.contractorCompany, workDate: r.workDate, entryId: r._id }))
  );

  // Unique workers aggregated
  const workerSummary = (() => {
    const map: Record<string, { name: string; age: number; desig: string; company: string; days: number; totalCost: number }> = {};
    allWorkerRows.forEach(w => {
      const k = `${w.name}__${w.designation}`;
      if (!map[k]) map[k] = { name: w.name, age: w.age, desig: w.designation, company: w.contractorCompany, days: 0, totalCost: 0 };
      map[k].days  += 1;
      map[k].totalCost += w.cost;
    });
    return Object.values(map).sort((a,b) => b.totalCost - a.totalCost);
  })();

  // Contract-wise breakdown (when all contracts shown)
  const contractGroups = (() => {
    const map: Record<string, { name: string; company: string; entries: ReportEntry[]; total: number }> = {};
    rows.forEach(r => {
      if (!map[r.contractId]) map[r.contractId] = { name: r.contractName, company: r.contractorCompany, entries: [], total: 0 };
      map[r.contractId].entries.push(r);
      map[r.contractId].total += r.totalCost;
    });
    return Object.entries(map).sort((a,b) => b[1].total - a[1].total);
  })();

  const grandTotal    = rows.reduce((s,r) => s + r.totalCost, 0);
  const totalPersons  = allWorkerRows.length;

  const toggleExpand = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Export Excel ──────────────────────────────────────────────────────────
  const exportExcel = async () => {
    const xlsx = await import('xlsx');
    const label = periodLabel();
    const contractLabel = selectedContract ? `${selectedContract.contractName} — ${selectedContract.contractorCompany}` : 'All Contracts';
    const wb = xlsx.utils.book_new();

    // Summary
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([
      ['E&I DEPARTMENT — OUTSOURCE COST REPORT'],
      ['Contract:', contractLabel],
      ['Period:', label],
      ['Generated:', new Date().toLocaleString('en-GB')],
      [],
      ['SUMMARY'],
      ['Total Work Entries', rows.length],
      ['Total Workers (man-days)', totalPersons],
      ['Total Cost (AED)', grandTotal],
      [],
      ...(!selectedId ? [['CONTRACT-WISE BREAKDOWN'], ['Contract', 'Contractor', 'Entries', 'Cost (AED)'],
        ...contractGroups.map(([,g]) => [g.name, g.company, g.entries.length, g.total])] : []),
    ]), 'Summary');

    // Manpower list
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([
      ['Worker Name', 'Age', 'Designation', 'Contractor', 'Days Worked', 'Total Cost (AED)'],
      ...workerSummary.map(w => [w.name, w.age, w.desig, w.company, w.days, w.totalCost]),
      [],
      ['TOTAL', '', '', '', workerSummary.reduce((s,w)=>s+w.days,0), grandTotal],
    ]), 'Manpower List');

    // Work details — expanded with workers
    const detailRows: any[][] = [];
    rows.forEach(r => {
      const workers = expandWorkers(r);
      workers.forEach((w,i) => {
        detailRows.push([
          i === 0 ? fmtD(r.workDate) : '',
          i === 0 ? r.contractName : '',
          i === 0 ? r.contractorCompany : '',
          i === 0 ? (r.poNumber || '') : '',
          i === 0 ? r.maintenanceType : '',
          w.name, w.age, w.designation, w.workingHours, w.overtimeHours,
          r.costType === 'package' ? 'Package' : 'Per Day',
          r.costType === 'package' ? '' : w.rate,
          w.cost,
          i === 0 ? r.totalCost : '',
        ]);
      });
    });
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([
      ['Date','Contract','Contractor','PO No.','Work Type','Worker Name','Age','Designation','Hrs/Day','OT Hrs','Cost Type','Rate/Day','Worker Cost (AED)','Entry Total (AED)'],
      ...detailRows,
    ]), 'Work Details');

    xlsx.writeFile(wb, `Outsource_Report_${contractLabel.replace(/[^a-zA-Z0-9]/g,'_')}_${label.replace(/\s+/g,'_')}.xlsx`);
    toast.success('Excel exported');
  };

  // ── Export PDF ────────────────────────────────────────────────────────────
  const exportPDF = async () => {
    const jsPDF   = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
    const logoB64 = await loadLogoBase64();
    const label         = periodLabel();
    const contractLabel = selectedContract ? selectedContract.contractName : 'All Contracts';
    const companyLabel  = selectedContract ? selectedContract.contractorCompany : '(Multiple Contractors)';
    const today         = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();

    const drawHeader = (title: string, sub: string) => {
      doc.setFillColor(15, 118, 110);
      doc.rect(0, 0, W, 36, 'F');
      if (logoB64) {
        doc.setFillColor(255, 255, 255);
        doc.rect(W - 76, 2, 74, 32, 'F');
        doc.addImage(logoB64, 'PNG', W - 74, 5, 70, 14, undefined, 'FAST');
      }
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text(title, 14, 14);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(sub, 14, 21);
      doc.text(`Generated: ${today}`, 14, 28);
    };

    // ── Page 1: Cover + Manpower Summary ──────────────────────────────────
    drawHeader('OUTSOURCE WORK COST REPORT', 'E&I Department — Finance Submission');

    // Info block
    doc.setTextColor(30, 41, 59);
    doc.setFillColor(240, 253, 250);
    doc.rect(0, 36, W, 22, 'F');
    doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.text('CONTRACT:', 14, 45);
    doc.text('CONTRACTOR:', 14, 52);
    doc.setFont('helvetica','normal');
    doc.text(contractLabel, 48, 45);
    doc.text(companyLabel,  48, 52);
    doc.setFont('helvetica','bold');
    doc.text('PERIOD:', W/2, 45);
    doc.text('TOTAL COST:', W/2, 52);
    doc.setFont('helvetica','normal');
    doc.text(label, W/2 + 28, 45);
    doc.setTextColor(15,118,110);
    doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(`AED ${fmt(grandTotal)}`, W/2 + 28, 52);

    // Summary figures
    doc.setFontSize(8); doc.setTextColor(100,116,139); doc.setFont('helvetica','normal');
    doc.text(`Work Entries: ${rows.length}   |   Total Man-Days: ${totalPersons}   |   Workers: ${workerSummary.length}`, 14, 63);

    // Contract-wise breakdown (if all contracts)
    let startY = 68;
    if (!selectedId && contractGroups.length > 1) {
      autoTable(doc, {
        startY,
        head: [['Contract', 'Contractor Company', 'Entries', 'Total Cost (AED)']],
        body: contractGroups.map(([,g]) => [g.name, g.company, g.entries.length, `AED ${fmt(g.total)}`]),
        foot: [['GRAND TOTAL', '', rows.length, `AED ${fmt(grandTotal)}`]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 41, 59] },
        footStyles: { fillColor: [240,253,250], textColor: [15,118,110], fontStyle: 'bold' },
        margin: { left: 14, right: 14 }, theme: 'grid',
      });
      startY = (doc as any).lastAutoTable.finalY + 8;
    }

    // Manpower summary table
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(15,118,110);
    doc.text('MANPOWER LIST', 14, startY);
    startY += 4;

    autoTable(doc, {
      startY,
      head: [['#', 'Worker Name', 'Age', 'Designation', 'Contractor', 'Days Worked', 'Total Cost (AED)']],
      body: workerSummary.map((w,i) => [i+1, w.name, w.age || '—', w.desig, w.company, w.days, `AED ${fmt(w.totalCost)}`]),
      foot: [['', 'TOTAL', '', '', '', workerSummary.reduce((s,w)=>s+w.days,0), `AED ${fmt(grandTotal)}`]],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15,118,110] },
      footStyles: { fillColor: [240,253,250], textColor: [15,118,110], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248,250,252] },
      margin: { left: 14, right: 14 }, theme: 'grid',
    });

    // Signature block on page 1
    const sigY = (doc as any).lastAutoTable.finalY + 16;
    if (sigY < doc.internal.pageSize.getHeight() - 30) {
      doc.setDrawColor(203,213,225); doc.setLineWidth(0.3);
      doc.line(14, sigY, 90, sigY);
      doc.line(W-90, sigY, W-14, sigY);
      doc.setFontSize(8); doc.setTextColor(100,116,139); doc.setFont('helvetica','normal');
      doc.text('Prepared by (E&I Dept.)', 14, sigY+5);
      doc.text('Approved by (Finance)', W-90, sigY+5);
    }

    // ── Page 2: Detailed Work Records ─────────────────────────────────────
    doc.addPage();
    drawHeader('DETAILED WORK RECORDS', `${contractLabel} — ${label}`);

    // Build detail rows (each worker on its own row)
    const detailBody: (string|number)[][] = [];
    rows.forEach(r => {
      const workers = expandWorkers(r);
      workers.forEach((w, i) => {
        detailBody.push([
          i === 0 ? fmtShort(r.workDate) : '',
          i === 0 ? r.contractName : '',
          i === 0 ? (r.poNumber || '—') : '',
          i === 0 ? r.maintenanceType : '',
          w.name,
          w.age || '—',
          w.designation,
          w.workingHours,
          r.costType === 'package' ? 'Pkg' : `AED ${w.rate}/day`,
          `AED ${fmt(w.cost)}`,
          i === 0 ? r.completionStatus : '',
        ]);
      });
    });

    autoTable(doc, {
      startY: 42,
      head: [['Date','Contract','PO No.','Work Type','Worker Name','Age','Designation','Hrs','Rate','Cost (AED)','Status']],
      body: detailBody,
      foot: [['','','','',`${totalPersons} man-days`,'','','','TOTAL','AED '+fmt(grandTotal),'']],
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [30,41,59] },
      footStyles: { fillColor: [240,253,250], textColor: [15,118,110], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248,250,252] },
      columnStyles: { 9: { fontStyle: 'bold', textColor: [15,118,110] } },
      margin: { left: 14, right: 14 }, theme: 'grid',
    });

    // Page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(148,163,184); doc.setFont('helvetica','normal');
      doc.text(`Page ${i} of ${pageCount}  —  E&I Dept. Outsource Report  —  ${label}`, W/2, doc.internal.pageSize.getHeight()-5, { align: 'center' });
    }

    const filename = `Outsource_${contractLabel.replace(/[^a-zA-Z0-9]/g,'_')}_${label.replace(/\s+/g,'_')}.pdf`;
    doc.save(filename);
    toast.success('PDF saved — ready to send to Finance');
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = { height: 34, padding: '0 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, color: '#1e293b', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 4 };
  const ptBtn = (t: typeof periodType) => ({ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: periodType===t ? 'none' : '1px solid #e2e8f0', background: periodType===t ? '#0f766e' : '#f8fafc', color: periodType===t ? '#fff' : '#64748b' });
  const years = Array.from({ length: 6 }, (_,i) => new Date().getFullYear() - i);
  const statusBg: Record<string,string> = { Completed: '#dcfce7', 'In Progress': '#dbeafe', Pending: '#fef9c3' };
  const statusClr: Record<string,string> = { Completed: '#15803d', 'In Progress': '#1d4ed8', Pending: '#a16207' };

  return (
    <div style={{ padding: '20px 24px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#0f766e,#14b8a6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={20} color="#fff"/>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Finance Report</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Generate contract cost report for finance team submission</p>
        </div>
        {generated && rows.length > 0 && (
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

      {/* ── Filter Panel ── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: '#0f766e', fontWeight: 700, fontSize: 13 }}>
          <Filter size={14}/> Report Filters
        </div>

        {/* Contract selector — prominent */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ ...lbl, color: '#0f766e', fontSize: 12 }}>Select Contract</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedId('')}
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: selectedId==='' ? 'none' : '1px solid #e2e8f0', background: selectedId==='' ? '#0f172a' : '#f8fafc', color: selectedId==='' ? '#fff' : '#64748b' }}>
              All Contracts
            </button>
            {contracts.map(c => (
              <button key={c._id}
                onClick={() => setSelectedId(c._id)}
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: selectedId===c._id ? 700 : 500, cursor: 'pointer', border: selectedId===c._id ? 'none' : '1px solid #e2e8f0', background: selectedId===c._id ? '#0f766e' : '#f8fafc', color: selectedId===c._id ? '#fff' : '#475569', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={`${c.contractName} — ${c.contractorCompany}`}>
                {c.contractName}
                {selectedId===c._id && <span style={{ fontSize: 10, opacity: 0.8 }}> ({c.contractorCompany})</span>}
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

            <button onClick={handleGenerate} disabled={loading} style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 22px', background:'#0f766e', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor: loading ? 'default':'pointer', opacity: loading ? 0.7:1 }}>
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}/> Generate Report
            </button>
          </div>
        </div>
      </div>

      {/* ── Output ── */}
      {!generated ? (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:60, textAlign:'center' }}>
          <FileText size={48} color="#e2e8f0" style={{ marginBottom:12 }}/>
          <div style={{ color:'#94a3b8', fontSize:14, marginBottom:6 }}>Select a contract and period, then click Generate Report</div>
          <div style={{ color:'#cbd5e1', fontSize:12 }}>You can filter by a single contract or include all contracts</div>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:60, textAlign:'center', color:'#94a3b8' }}>No entries found for this period.</div>
      ) : (
        <>
          {/* KPI strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
            {[
              { icon:<FileText size={16} color="#0f766e"/>, label:'Work Entries',  value: rows.length,          color:'#0f766e' },
              { icon:<Users size={16} color="#2563eb"/>,    label:'Man-Days',      value: totalPersons,          color:'#2563eb' },
              { icon:<Users size={16} color="#7c3aed"/>,    label:'Unique Workers',value: workerSummary.length,  color:'#7c3aed' },
              { icon:<DollarSign size={16} color="#dc2626"/>,label:'Total Cost',   value:`AED ${fmt(grandTotal)}`,color:'#dc2626' },
            ].map(k => (
              <div key={k.label} style={{ background:'#fff', borderRadius:10, border:'1px solid #e2e8f0', padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center' }}>{k.icon}</div>
                <div>
                  <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:0.7 }}>{k.label}</div>
                  <div style={{ fontSize:17, fontWeight:800, color:k.color }}>{k.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Period + Contract header */}
          <div style={{ background:'#f0fdfa', border:'1px solid #99f6e4', borderRadius:10, padding:'10px 16px', marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#0f766e' }}>
              {selectedContract ? `${selectedContract.contractName} — ${selectedContract.contractorCompany}` : `All Contracts (${contractGroups.length})`}
            </div>
            <div style={{ fontSize:12, color:'#475569', fontWeight:600 }}>Period: {periodLabel()}</div>
          </div>

          {/* Contract-wise breakdown (when showing all) */}
          {!selectedId && contractGroups.length > 1 && (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', marginBottom:14, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9', fontSize:13, fontWeight:700, color:'#1e293b' }}>Contract-wise Cost Breakdown</div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#1e293b' }}>
                  {['Contract','Contractor Company','Work Entries','Workers','Total Cost (AED)'].map(h=>(
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#f1f5f9', textTransform:'uppercase', letterSpacing:0.6 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {contractGroups.map(([id,g],i)=>(
                    <tr key={id} style={{ borderBottom:'1px solid #e2e8f0', background: i%2===0?'#fff':'#f1f5f9' }}>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#0f172a', fontSize:13 }}>{g.name}</td>
                      <td style={{ padding:'10px 14px', fontSize:12, fontWeight:600, color:'#374151' }}>{g.company}</td>
                      <td style={{ padding:'10px 14px', fontSize:14, fontWeight:800, textAlign:'center', color:'#0f172a' }}>{g.entries.length}</td>
                      <td style={{ padding:'10px 14px', fontSize:14, fontWeight:800, textAlign:'center', color:'#0f172a' }}>{g.entries.reduce((s,e)=>s+(e.workers?.length||1),0)}</td>
                      <td style={{ padding:'10px 14px', fontSize:14, fontWeight:800, color:'#0f766e' }}>AED {fmt(g.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ background:'#f0fdfa', borderTop:'2px solid #0f766e' }}>
                  <td colSpan={4} style={{ padding:'10px 14px', fontWeight:700, color:'#0f766e', fontSize:12 }}>GRAND TOTAL</td>
                  <td style={{ padding:'10px 14px', fontWeight:800, color:'#0f766e', fontSize:15 }}>AED {fmt(grandTotal)}</td>
                </tr></tfoot>
              </table>
            </div>
          )}

          {/* Manpower Summary */}
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', marginBottom:14, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9', fontSize:13, fontWeight:700, color:'#1e293b', display:'flex', alignItems:'center', gap:6 }}>
              <Users size={14} color="#0f766e"/> Manpower Summary — {workerSummary.length} workers, {totalPersons} man-days
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#1e293b' }}>
                  {['#','Worker Name','Age','Designation','Contractor','Days Worked','Total Cost (AED)'].map(h=>(
                    <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#f1f5f9', textTransform:'uppercase', letterSpacing:0.6 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {workerSummary.map((w,i)=>(
                    <tr key={`${w.name}_${w.desig}`} style={{ borderBottom:'1px solid #e2e8f0', background:i%2===0?'#fff':'#f1f5f9' }}>
                      <td style={{ padding:'10px 12px', fontSize:12, fontWeight:600, color:'#64748b' }}>{i+1}</td>
                      <td style={{ padding:'10px 12px', fontSize:14, fontWeight:700, color:'#0f172a' }}>{w.name}</td>
                      <td style={{ padding:'10px 12px', fontSize:13, fontWeight:600, color:'#374151' }}>{w.age||'—'}</td>
                      <td style={{ padding:'10px 12px' }}><span style={{ fontSize:12, fontWeight:700, color:'#1e40af', background:'#dbeafe', padding:'3px 10px', borderRadius:12 }}>{w.desig}</span></td>
                      <td style={{ padding:'10px 12px', fontSize:13, fontWeight:600, color:'#374151' }}>{w.company}</td>
                      <td style={{ padding:'10px 12px', fontSize:15, fontWeight:800, color:'#0f172a', textAlign:'center' }}>{w.days}</td>
                      <td style={{ padding:'10px 12px', fontSize:14, fontWeight:800, color:'#0f766e' }}>AED {fmt(w.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ background:'#f0fdfa', borderTop:'2px solid #0f766e' }}>
                  <td colSpan={5} style={{ padding:'10px 12px', fontWeight:700, color:'#0f766e', fontSize:12 }}>TOTAL</td>
                  <td style={{ padding:'10px 12px', fontWeight:800, color:'#0f766e', fontSize:14, textAlign:'center' }}>{totalPersons}</td>
                  <td style={{ padding:'10px 12px', fontWeight:800, color:'#0f766e', fontSize:14 }}>AED {fmt(grandTotal)}</td>
                </tr></tfoot>
              </table>
            </div>
          </div>

          {/* Detailed Work Records — collapsible by date */}
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9', fontSize:13, fontWeight:700, color:'#1e293b', display:'flex', alignItems:'center', gap:6 }}>
              <FileText size={14} color="#0f766e"/> Work Records — {rows.length} entries
              <span style={{ marginLeft:'auto', fontSize:11, color:'#94a3b8', fontWeight:400 }}>Click a row to expand workers</span>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#1e293b' }}>
                  {['','Date','Contract','PO No.','Work Type','Workers','Persons','Cost Type','Total (AED)','Status'].map(h=>(
                    <th key={h} style={{ padding:'10px 10px', textAlign:'left', fontSize:11, fontWeight:700, color:'#f1f5f9', textTransform:'uppercase', letterSpacing:0.6, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {rows.map((r,i)=>{
                    const isOpen = expanded.has(r._id);
                    const workers = expandWorkers(r);
                    const st = statusBg[r.completionStatus]||'#e2e8f0';
                    const stc = statusClr[r.completionStatus]||'#374151';
                    return (
                      <>
                        <tr key={r._id} onClick={()=>toggleExpand(r._id)} style={{ borderBottom: isOpen ? 'none':'1px solid #e2e8f0', background:i%2===0?'#fff':'#f1f5f9', cursor:'pointer' }}>
                          <td style={{ padding:'10px 10px', color:'#374151' }}>{isOpen?<ChevronDown size={13}/>:<ChevronRight size={13}/>}</td>
                          <td style={{ padding:'10px 10px', fontSize:12, fontWeight:600, color:'#334155', whiteSpace:'nowrap' }}>{fmtShort(r.workDate)}</td>
                          <td style={{ padding:'10px 10px' }}>
                            <div style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>{r.contractName}</div>
                            <div style={{ fontSize:11, color:'#64748b' }}>{r.contractorCompany}</div>
                          </td>
                          <td style={{ padding:'10px 10px', fontSize:12, fontWeight:600, color:'#374151', fontFamily:'monospace' }}>{r.poNumber||'—'}</td>
                          <td style={{ padding:'10px 10px', fontSize:13, fontWeight:600, color:'#374151' }}>{r.maintenanceType}</td>
                          <td style={{ padding:'10px 10px', fontSize:12, fontWeight:600, color:'#1e293b' }}>{workers.map(w=>w.name).join(', ').slice(0,40)}{workers.map(w=>w.name).join(', ').length>40?'…':''}</td>
                          <td style={{ padding:'10px 10px', fontSize:15, fontWeight:800, color:'#0f172a', textAlign:'center' }}>{workers.length}</td>
                          <td style={{ padding:'10px 10px' }}><span style={{ fontSize:11, fontWeight:700, color:r.costType==='package'?'#6d28d9':'#065f46', background:r.costType==='package'?'#ddd6fe':'#d1fae5', padding:'3px 10px', borderRadius:10 }}>{r.costType==='package'?'Package':'Per Day'}</span></td>
                          <td style={{ padding:'10px 10px', fontSize:14, fontWeight:800, color:'#0f766e', whiteSpace:'nowrap' }}>AED {fmt(r.totalCost)}</td>
                          <td style={{ padding:'10px 10px' }}><span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:10, background:st, color:stc }}>{r.completionStatus}</span></td>
                        </tr>
                        {isOpen && (
                          <tr key={`${r._id}_exp`} style={{ background:'#f0fdfa', borderBottom:'2px solid #99f6e4' }}>
                            <td colSpan={10} style={{ padding:'0 10px 12px 40px' }}>
                              <div style={{ fontSize:11, color:'#0f766e', fontWeight:700, marginBottom:6, marginTop:8 }}>Worker Details:</div>
                              <table style={{ width:'auto', borderCollapse:'collapse' }}>
                                <thead><tr style={{ background:'#334155' }}>
                                  {['Worker Name','Age','Designation','Hrs/Day','OT Hrs','Rate','Worker Cost'].map(h=>(
                                    <th key={h} style={{ padding:'7px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#f1f5f9', textTransform:'uppercase', letterSpacing:0.5 }}>{h}</th>
                                  ))}
                                </tr></thead>
                                <tbody>
                                  {workers.map((w,wi)=>(
                                    <tr key={wi} style={{ borderBottom:'1px solid #e2e8f0', background: wi%2===0?'#fff':'#f8fafc' }}>
                                      <td style={{ padding:'7px 12px', fontWeight:700, fontSize:13, color:'#0f172a' }}>{w.name}</td>
                                      <td style={{ padding:'7px 12px', fontSize:13, fontWeight:600, color:'#374151' }}>{w.age||'—'}</td>
                                      <td style={{ padding:'7px 12px' }}><span style={{ fontSize:12, fontWeight:700, color:'#1e40af', background:'#dbeafe', padding:'2px 10px', borderRadius:10 }}>{w.designation}</span></td>
                                      <td style={{ padding:'7px 12px', fontSize:13, fontWeight:600, color:'#1e293b', textAlign:'center' }}>{w.workingHours}</td>
                                      <td style={{ padding:'7px 12px', fontSize:13, fontWeight:600, color:w.overtimeHours>0?'#dc2626':'#94a3b8', textAlign:'center' }}>{w.overtimeHours||'—'}</td>
                                      <td style={{ padding:'7px 12px', fontSize:13, fontWeight:600, color:'#374151' }}>{r.costType==='package'?'Package':`AED ${w.rate}/day`}</td>
                                      <td style={{ padding:'7px 12px', fontSize:14, fontWeight:800, color:'#0f766e' }}>AED {fmt(w.cost)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {r.workDescription && <div style={{ marginTop:8, fontSize:11, color:'#64748b' }}><strong>Work:</strong> {r.workDescription}</div>}
                              {/* OT Details block */}
                              {(r as any).otStartTime && (
                                <div style={{ marginTop:10, background:'#fef3c7', border:'1px solid #fde68a', borderRadius:8, padding:'10px 14px' }}>
                                  <div style={{ fontSize:11, fontWeight:800, color:'#92400e', textTransform:'uppercase', letterSpacing:0.7, marginBottom:6 }}>⏱ Overtime Authorization Details</div>
                                  <div style={{ display:'flex', gap:24, flexWrap:'wrap', fontSize:12, color:'#92400e' }}>
                                    <span><strong>Time:</strong> {(r as any).otStartTime} → {(r as any).otEndTime}</span>
                                    {(r as any).otReason && <span><strong>Reason:</strong> {(r as any).otReason}</span>}
                                    {(r as any).otReasonDetails && <span><strong>Details:</strong> {(r as any).otReasonDetails}</span>}
                                    {(r as any).otApprovedBy && <span><strong>Approved By:</strong> {(r as any).otApprovedBy}</span>}
                                    {(r as any).otApprovalRef && <span><strong>Ref:</strong> {(r as any).otApprovalRef}</span>}
                                    {(r as any).otRatePercent && <span><strong>OT Rate:</strong> {(r as any).otRatePercent}%</span>}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
                <tfoot><tr style={{ background:'#f0fdfa', borderTop:'2px solid #0f766e' }}>
                  <td colSpan={8} style={{ padding:'10px 10px', fontWeight:700, color:'#0f766e', fontSize:12 }}>PERIOD TOTAL</td>
                  <td style={{ padding:'10px 10px', fontWeight:800, color:'#0f766e', fontSize:15, whiteSpace:'nowrap' }}>AED {fmt(grandTotal)}</td>
                  <td/>
                </tr></tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
