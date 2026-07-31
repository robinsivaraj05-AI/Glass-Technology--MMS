import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BarChart2, Edit2, ChevronDown, ChevronRight,
  Users, CheckCircle2, Clock, AlertCircle, RefreshCw, Download,
} from 'lucide-react';
import { exportOrgChartPDF } from '../utils/exportOrgPDF';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OrgPos {
  _id: string; posId: string; parentId: string | null;
  role: string; team: string; department: string;
  personName: string; linkedEmpId: string;
  urgent: boolean; sortOrder: number;
  roleCategory: string; recruitmentStatus: string;
}

interface StatRow {
  category: string; qty: number;
  joined: number; readyToJoin: number; hrProcess: number; pending: number;
  positions: OrgPos[];
}

// ── API ───────────────────────────────────────────────────────────────────────
const API = '/api/org-positions';
async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Role order — covers both roleCategory and role fallback values ────────────
const ROLE_ORDER = [
  'Manager',
  'E & I Manager',
  'Dy Manager',
  'E & I Deputy Manager',
  'General Shift Engineer',
  'Automation Engineer',
  'Shift Engineer',
  'Reliving Shift Engineer',
  'Junior Engineer',
  'Technician',
  'IT Engineer',
];

const RS_OPTIONS = [
  { val: 'joined',        label: 'Joined',        color: '#16a34a', bg: '#dcfce7', lightBg: '#f0fdf4', border: '#86efac' },
  { val: 'ready_to_join', label: 'Ready to Join',  color: '#2563eb', bg: '#dbeafe', lightBg: '#eff6ff', border: '#93c5fd' },
  { val: 'hr_process',    label: 'HR Process',     color: '#7c3aed', bg: '#ede9fe', lightBg: '#f5f3ff', border: '#c4b5fd' },
  { val: 'pending',       label: 'Pending',        color: '#dc2626', bg: '#fee2e2', lightBg: '#fef2f2', border: '#fca5a5' },
];

function getRS(pos: OrgPos) {
  return pos.recruitmentStatus || (pos.personName.trim() ? 'joined' : 'pending');
}

function calcStats(positions: OrgPos[]): StatRow[] {
  const map = new Map<string, StatRow>();
  positions.forEach(p => {
    const cat = (p.roleCategory || p.role).trim();
    if (!map.has(cat)) map.set(cat, { category: cat, qty: 0, joined: 0, readyToJoin: 0, hrProcess: 0, pending: 0, positions: [] });
    const row = map.get(cat)!;
    row.qty++;
    row.positions.push(p);
    const rs = getRS(p);
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

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, bg, border }: {
  icon: React.ReactNode; label: string; value: number; sub?: string;
  color: string; bg: string; border: string;
}) {
  return (
    <div style={{ flex:1, minWidth:140, background:bg, border:`1.5px solid ${border}`, borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ width:42, height:42, borderRadius:10, background:color+'20', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize:25, fontWeight:900, color, lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:11, fontWeight:600, color:'#374151', marginTop:3 }}>{label}</div>
        {sub && <div style={{ fontSize:10, color:'#9ca3af', marginTop:1 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── OrgChartSummary page ──────────────────────────────────────────────────────
export default function OrgChartSummary() {
  const navigate = useNavigate();
  const [positions,    setPositions]    = useState<OrgPos[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [expandedCats,  setExpandedCats]  = useState<Set<string>>(new Set());
  const [savingPosId,   setSavingPosId]   = useState<string | null>(null);
  const [pdfExporting,  setPdfExporting]  = useState(false);

  const fetchPositions = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      let data: OrgPos[] = await apiFetch(API);
      if (!data.length) { await apiFetch(`${API}/seed`, { method: 'POST' }); data = await apiFetch(API); }
      setPositions(data);
    } catch { /**/ } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchPositions(); }, [fetchPositions]);

  const rows  = useMemo(() => calcStats(positions), [positions]);
  const total = useMemo(() => rows.reduce(
    (a, r) => ({ qty: a.qty+r.qty, joined: a.joined+r.joined, readyToJoin: a.readyToJoin+r.readyToJoin, hrProcess: a.hrProcess+r.hrProcess, pending: a.pending+r.pending }),
    { qty: 0, joined: 0, readyToJoin: 0, hrProcess: 0, pending: 0 }
  ), [rows]);

  const pct = (n: number) => total.qty ? Math.round(n / total.qty * 100) + '%' : '0%';

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });
  };
  const expandAll   = () => setExpandedCats(new Set(rows.map(r => r.category)));
  const collapseAll = () => setExpandedCats(new Set());

  const handleStatusChange = async (posId: string, rs: string) => {
    setSavingPosId(posId);
    try {
      const updated: OrgPos = await apiFetch(`${API}/${posId}`, { method: 'PATCH', body: JSON.stringify({ recruitmentStatus: rs }) });
      setPositions(prev => prev.map(p => p.posId === posId ? { ...p, ...updated } : p));
    } catch { /**/ } finally { setSavingPosId(null); }
  };

  // ── Table cell helpers ───────────────────────────────────────────────────
  const th: React.CSSProperties = {
    padding: '13px 16px', fontSize: 11, fontWeight: 700, color: '#374151',
    textAlign: 'center', background: '#f1f5f9', borderBottom: '2px solid #e2e8f0',
    whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1,
  };
  const countCell = (val: number, opt: typeof RS_OPTIONS[0]): React.CSSProperties => ({
    padding: '14px 16px', textAlign: 'center', fontSize: 17, fontWeight: 900,
    color: val === 0 ? '#d1d5db' : opt.color,
    background: val > 0 ? opt.lightBg : 'transparent',
    borderBottom: '1px solid #f1f5f9',
  });

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:400, flexDirection:'column', gap:12 }}>
      <div style={{ width:36, height:36, border:'3px solid #bfdbfe', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <div style={{ color:'#94a3b8', fontSize:12 }}>Loading summary…</div>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 110px)', background:'#e5e7eb', overflow:'hidden' }}>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div style={{ padding:'12px 20px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, marginBottom:12, display:'flex', alignItems:'center', gap:12, flexShrink:0, boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
        <button onClick={() => navigate('/org-chart')}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, fontSize:11, fontWeight:600, color:'#374151', cursor:'pointer' }}>
          <ArrowLeft size={14}/> Org Chart
        </button>
        <div style={{ width:1, height:24, background:'#e2e8f0' }}/>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <BarChart2 size={17} color="#2563eb"/>
          <span style={{ fontSize:14, fontWeight:700, color:'#1e293b' }}>E&I Team Summary</span>
          <span style={{ fontSize:11, color:'#94a3b8', fontWeight:400 }}>— E&I Department</span>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button onClick={expandAll}
            style={{ padding:'6px 12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:7, fontSize:10, fontWeight:600, color:'#374151', cursor:'pointer' }}>
            Expand All
          </button>
          <button onClick={collapseAll}
            style={{ padding:'6px 12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:7, fontSize:10, fontWeight:600, color:'#374151', cursor:'pointer' }}>
            Collapse All
          </button>
          <button onClick={() => fetchPositions(true)} disabled={refreshing}
            style={{ padding:'6px 12px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:7, fontSize:10, fontWeight:600, color:'#2563eb', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
            <RefreshCw size={12} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}/> Refresh
          </button>
          <button disabled={pdfExporting} onClick={async () => { setPdfExporting(true); await exportOrgChartPDF(positions); setPdfExporting(false); }}
            style={{ padding:'6px 14px', background: pdfExporting ? '#f8fafc' : '#fef2f2', border:'1px solid #fecaca', borderRadius:7, fontSize:10, fontWeight:700, color:'#dc2626', cursor: pdfExporting ? 'default' : 'pointer', display:'flex', alignItems:'center', gap:5, opacity: pdfExporting ? 0.7 : 1 }}>
            <Download size={12}/> {pdfExporting ? 'Generating PDF…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* ── Summary stat cards ──────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:10, marginBottom:12, flexShrink:0, flexWrap:'wrap' }}>
        <StatCard icon={<Users size={20} color="#2563eb"/>}        label="Total Positions" value={total.qty}         color="#2563eb" bg="#eff6ff" border="#bfdbfe"/>
        <StatCard icon={<CheckCircle2 size={20} color="#16a34a"/>} label="Joined"          value={total.joined}      sub={pct(total.joined)}       color="#16a34a" bg="#f0fdf4" border="#86efac"/>
        <StatCard icon={<Clock size={20} color="#2563eb"/>}        label="Ready to Join"   value={total.readyToJoin} sub={pct(total.readyToJoin)}  color="#2563eb" bg="#eff6ff" border="#93c5fd"/>
        <StatCard icon={<Clock size={20} color="#7c3aed"/>}        label="HR Process"      value={total.hrProcess}   sub={pct(total.hrProcess)}    color="#7c3aed" bg="#f5f3ff" border="#c4b5fd"/>
        <StatCard icon={<AlertCircle size={20} color="#dc2626"/>}  label="Pending"         value={total.pending}     sub={pct(total.pending)}      color="#dc2626" bg="#fef2f2" border="#fca5a5"/>
      </div>

      {/* ── Main table ─────────────────────────────────────────────────────── */}
      <div style={{ flex:1, overflow:'hidden', background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 4px rgba(0,0,0,0.05)', display:'flex', flexDirection:'column' }}>

        {/* Table scroll container */}
        <div style={{ flex:1, overflowY:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
            <colgroup>
              <col style={{ width:'32%' }}/>
              <col style={{ width:'9%' }}/>
              <col style={{ width:'14%' }}/>
              <col style={{ width:'16%' }}/>
              <col style={{ width:'14%' }}/>
              <col style={{ width:'14%' }}/>
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...th, textAlign:'left', paddingLeft:20 }}>Position / Role</th>
                <th style={{ ...th }}>Qty</th>
                <th style={{ ...th, color: RS_OPTIONS[0].color }}>Joined</th>
                <th style={{ ...th, color: RS_OPTIONS[1].color }}>Ready to Join</th>
                <th style={{ ...th, color: RS_OPTIONS[2].color }}>HR Process</th>
                <th style={{ ...th, color: RS_OPTIONS[3].color }}>Pending</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const isExpanded = expandedCats.has(row.category);
                const rowBg = ri % 2 === 0 ? '#fff' : '#fafafa';
                return (
                  <>
                    {/* Category summary row */}
                    <tr key={row.category} style={{ background: isExpanded ? '#f0f9ff' : rowBg, cursor:'pointer', transition:'background 0.12s' }}
                      onClick={() => toggleCat(row.category)}>
                      <td style={{ padding:'14px 16px 14px 20px', borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9', borderLeft:`4px solid ${isExpanded ? '#2563eb' : '#e2e8f0'}` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ color:'#94a3b8', flexShrink:0 }}>
                            {isExpanded ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                          </div>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color: isExpanded ? '#1e3a8a' : '#1e293b' }}>{row.category}</div>
                            <div style={{ fontSize:10, color:'#94a3b8', marginTop:1 }}>{row.qty} position{row.qty !== 1 ? 's' : ''} — click to {isExpanded ? 'collapse' : 'expand & edit'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:'14px 16px', textAlign:'center', fontSize:19, fontWeight:900, color:'#d97706', background:'#fefce8', borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9' }}>{row.qty}</td>
                      <td style={countCell(row.joined,       RS_OPTIONS[0])}>{row.joined}</td>
                      <td style={countCell(row.readyToJoin,  RS_OPTIONS[1])}>{row.readyToJoin}</td>
                      <td style={countCell(row.hrProcess,    RS_OPTIONS[2])}>{row.hrProcess}</td>
                      <td style={countCell(row.pending,      RS_OPTIONS[3])}>{row.pending}</td>
                    </tr>

                    {/* Expanded individual positions */}
                    {isExpanded && row.positions
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((p, pi) => {
                        const rs  = getRS(p);
                        const opt = RS_OPTIONS.find(o => o.val === rs) ?? RS_OPTIONS[3];
                        const isLast = pi === row.positions.length - 1;
                        return (
                          <tr key={p.posId} style={{ background:'#f8fbff' }}>
                            <td style={{ padding:'10px 16px 10px 44px', borderBottom: isLast ? '2px solid #bfdbfe' : '1px solid #e0f2fe', borderLeft:'4px solid #bfdbfe' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div style={{ width:7, height:7, borderRadius:'50%', background:opt.color, flexShrink:0 }}/>
                                <div>
                                  <div style={{ fontSize:12, fontWeight:600, color: p.personName.trim() ? '#1e293b' : '#94a3b8', fontStyle: p.personName.trim() ? 'normal' : 'italic' }}>
                                    {p.personName.trim() || '— Position Vacant —'}
                                  </div>
                                  <div style={{ fontSize:10, color:'#94a3b8', marginTop:1 }}>
                                    {p.role}{p.team ? ` · ${p.team}` : ''}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ borderBottom: isLast ? '2px solid #bfdbfe' : '1px solid #e0f2fe', background:'#f0f9ff', textAlign:'center' }}>
                              <span style={{ fontSize:10, fontWeight:700, color:'#94a3b8' }}>—</span>
                            </td>
                            {/* Status pill buttons spanning remaining columns */}
                            <td colSpan={4} style={{ padding:'10px 16px', borderBottom: isLast ? '2px solid #bfdbfe' : '1px solid #e0f2fe' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                                {RS_OPTIONS.map(o => {
                                  const isActive  = rs === o.val;
                                  const isSaving  = savingPosId === p.posId;
                                  return (
                                    <button key={o.val}
                                      disabled={isSaving}
                                      onClick={() => !isActive && handleStatusChange(p.posId, o.val)}
                                      style={{
                                        padding: isActive ? '6px 14px' : '5px 12px',
                                        fontSize: isActive ? 11 : 10,
                                        fontWeight: isActive ? 700 : 500,
                                        borderRadius: 20,
                                        cursor: isActive ? 'default' : 'pointer',
                                        border: `1.5px solid ${isActive ? o.color : o.border}`,
                                        background: isActive ? o.bg : '#fff',
                                        color: isActive ? o.color : '#94a3b8',
                                        transition: 'all 0.12s',
                                        opacity: isSaving ? 0.5 : 1,
                                        display:'flex', alignItems:'center', gap:4,
                                      }}>
                                      {isActive && isSaving ? '…' : (
                                        <>
                                          {isActive && <Edit2 size={9}/>}
                                          {o.label}
                                        </>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </>
                );
              })}
            </tbody>

            {/* Footer */}
            <tfoot>
              <tr style={{ background:'#1e3a8a', position:'sticky', bottom:0 }}>
                <td style={{ padding:'14px 16px 14px 20px' }}>
                  <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Total</div>
                </td>
                <td style={{ padding:'14px 16px', textAlign:'center', fontSize:19, fontWeight:900, color:'#fde68a' }}>{total.qty}</td>
                <td style={{ padding:'14px 16px', textAlign:'center', fontSize:17, fontWeight:900, color:'#86efac' }}>{total.joined}</td>
                <td style={{ padding:'14px 16px', textAlign:'center', fontSize:17, fontWeight:900, color:'#93c5fd' }}>{total.readyToJoin}</td>
                <td style={{ padding:'14px 16px', textAlign:'center', fontSize:17, fontWeight:900, color:'#c4b5fd' }}>{total.hrProcess}</td>
                <td style={{ padding:'14px 16px', textAlign:'center', fontSize:17, fontWeight:900, color:'#fca5a5' }}>{total.pending}</td>
              </tr>
              <tr style={{ background:'#1e40af', position:'sticky', bottom:0 }}>
                <td style={{ padding:'10px 16px 10px 20px', fontSize:11, color:'#93c5fd', fontStyle:'italic' }}>% of E&I Headcount</td>
                <td style={{ padding:'10px 16px', textAlign:'center', fontSize:12, fontWeight:700, color:'#fde68a' }}>100%</td>
                <td style={{ padding:'10px 16px', textAlign:'center', fontSize:12, fontWeight:700, color:'#86efac' }}>{pct(total.joined)}</td>
                <td style={{ padding:'10px 16px', textAlign:'center', fontSize:12, fontWeight:700, color:'#93c5fd' }}>{pct(total.readyToJoin)}</td>
                <td style={{ padding:'10px 16px', textAlign:'center', fontSize:12, fontWeight:700, color:'#c4b5fd' }}>{pct(total.hrProcess)}</td>
                <td style={{ padding:'10px 16px', textAlign:'center', fontSize:12, fontWeight:700, color:'#fca5a5' }}>{pct(total.pending)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── Legend bar ───────────────────────────────────────────────────── */}
        <div style={{ padding:'10px 20px', borderTop:'1px solid #e2e8f0', display:'flex', gap:20, alignItems:'center', flexShrink:0, background:'#f8fafc', flexWrap:'wrap' }}>
          {RS_OPTIONS.map(o => (
            <div key={o.val} style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, color:'#374151', fontWeight:500 }}>
              <div style={{ width:11, height:11, borderRadius:'50%', background:o.color }}/>
              {o.label}
            </div>
          ))}
          <div style={{ marginLeft:'auto', fontSize:10, color:'#94a3b8', fontStyle:'italic' }}>
            Click a row to expand · Click a status pill to change it instantly
          </div>
        </div>
      </div>
    </div>
  );
}
