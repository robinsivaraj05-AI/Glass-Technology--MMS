import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ZoomIn, ZoomOut, X, Phone, Mail, MapPin, ExternalLink, Search,
  Maximize2, Minimize2, Network, User, Edit2, Plus, Trash2, Save,
  BarChart2, Download, RotateCcw,
} from 'lucide-react';
import { type FullEmployee } from '../data/employeeData';
import { useEmployees } from '../context/EmployeeContext';
import { exportOrgChartPDF } from '../utils/exportOrgPDF';
import { apiFetch } from '../utils/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OrgPos {
  _id: string; posId: string; parentId: string | null;
  role: string; team: string; department: string;
  personName: string; linkedEmpId: string;
  urgent: boolean; sortOrder: number;
  roleCategory: string; recruitmentStatus: string;
}
interface OrgNode { pos: OrgPos; emp: FullEmployee | null; children: OrgNode[]; }

const RS_LABEL: Record<string, string> = {
  joined: 'Joined', ready_to_join: 'Ready to Join', hr_process: 'HR Process', pending: 'Pending',
};

// ── API ───────────────────────────────────────────────────────────────────────
const API = '/api/org-positions';

// ── Tree builder ──────────────────────────────────────────────────────────────
function buildPosTree(positions: OrgPos[], employees: FullEmployee[]): OrgNode[] {
  if (!positions.length) return [];
  const empByEmpId = new Map(employees.map(e => [e.empId, e]));
  const empById    = new Map(employees.map(e => [e.id,    e]));
  const roots      = positions.filter(p => !p.parentId);
  function makeNode(pos: OrgPos): OrgNode {
    const emp = pos.linkedEmpId
      ? (empByEmpId.get(pos.linkedEmpId) ?? empById.get(pos.linkedEmpId) ?? null) : null;
    const children = positions.filter(p => p.parentId === pos.posId)
      .sort((a, b) => a.sortOrder - b.sortOrder).map(makeNode);
    return { pos, emp, children };
  }
  return roots.sort((a, b) => a.sortOrder - b.sortOrder).map(makeNode);
}

function collectParentPosIds(nodes: OrgNode[]): string[] {
  const ids: string[] = [];
  const walk = (n: OrgNode) => { if (n.children.length) { ids.push(n.pos.posId); n.children.forEach(walk); } };
  nodes.forEach(walk);
  return ids;
}

// ── Layout constants ──────────────────────────────────────────────────────────
const CARD_W  = 160;   // card width px
const CARD_H  = 90;    // estimated card height (for layout math)
const LEVEL_H = 148;   // vertical distance between card tops at adjacent levels
const MIN_SEP = 20;    // minimum horizontal gap between adjacent card EDGES
const PAD_X   = 48;    // left/right padding inside canvas
const LINE_C  = 'rgba(59,120,210,0.45)';
const LINE_W  = 2;
const BTN_H   = 22;    // toggle button height
const BTN_MT  = 5;     // margin-top of toggle button below card
// connector starts below the toggle button:
const CONN_Y  = CARD_H + BTN_MT + BTN_H + 3;  // ≈ 120px from card top

// ── Layout engine ─────────────────────────────────────────────────────────────
// Natural widths → min-separation → equal sibling gaps → re-center parents.
// "Equal sibling gaps" means every pair of adjacent siblings under the SAME
// parent gets the same centre-to-centre distance (= the largest natural gap
// among those siblings).  Parent nodes are re-centred above their children
// after each shift so connectors stay correct.

interface LPos { cx: number; y: number; }

function natW(node: OrgNode, colIds: Set<string>): number {
  if (colIds.has(node.pos.posId) || !node.children.length) return CARD_W + MIN_SEP;
  return node.children.reduce((s, c) => s + natW(c, colIds), 0);
}

function buildInitialLayout(tree: OrgNode[], colIds: Set<string>, map: Map<string, LPos>): void {
  function place(node: OrgNode, leftX: number, level: number) {
    const w = natW(node, colIds);
    map.set(node.pos.posId, { cx: leftX + w / 2, y: level * LEVEL_H });
    if (!colIds.has(node.pos.posId)) {
      let x = leftX;
      for (const c of node.children) { place(c, x, level + 1); x += natW(c, colIds); }
    }
  }
  let x = 0;
  for (const root of tree) { place(root, x, 0); x += natW(root, colIds); }
}

function shiftSubtree(node: OrgNode, dx: number, colIds: Set<string>, map: Map<string, LPos>) {
  const p = map.get(node.pos.posId);
  if (p) map.set(node.pos.posId, { cx: p.cx + dx, y: p.y });
  if (!colIds.has(node.pos.posId)) node.children.forEach(c => shiftSubtree(c, dx, colIds, map));
}

function enforceSep(tree: OrgNode[], colIds: Set<string>, map: Map<string, LPos>) {
  const byLevel = new Map<number, OrgNode[]>();
  function collect(n: OrgNode, lv: number) {
    const arr = byLevel.get(lv) ?? []; arr.push(n); byLevel.set(lv, arr);
    if (!colIds.has(n.pos.posId)) n.children.forEach(c => collect(c, lv + 1));
  }
  tree.forEach(r => collect(r, 0));
  byLevel.forEach(nodes => {
    nodes.sort((a, b) => (map.get(a.pos.posId)?.cx ?? 0) - (map.get(b.pos.posId)?.cx ?? 0));
    for (let i = 1; i < nodes.length; i++) {
      const prevCx = map.get(nodes[i - 1].pos.posId)!.cx;
      const cur    = map.get(nodes[i].pos.posId)!;
      const need   = prevCx + CARD_W + MIN_SEP;
      if (cur.cx < need) shiftSubtree(nodes[i], need - cur.cx, colIds, map);
    }
  });
}

// Make every pair of adjacent siblings under the same parent have the same
// centre-to-centre gap (= the widest natural gap among those siblings).
function equalizeGaps(tree: OrgNode[], colIds: Set<string>, map: Map<string, LPos>) {
  function process(node: OrgNode) {
    if (colIds.has(node.pos.posId) || node.children.length < 2) {
      if (!colIds.has(node.pos.posId)) node.children.forEach(c => process(c));
      return;
    }
    const kids = [...node.children].sort(
      (a, b) => (map.get(a.pos.posId)?.cx ?? 0) - (map.get(b.pos.posId)?.cx ?? 0));
    const cxs = kids.map(c => map.get(c.pos.posId)!.cx);
    let maxGap = 0;
    for (let i = 1; i < cxs.length; i++) maxGap = Math.max(maxGap, cxs[i] - cxs[i - 1]);
    let cur = cxs[0];
    for (let i = 1; i < kids.length; i++) {
      const target = cur + maxGap;
      const actual = map.get(kids[i].pos.posId)!.cx;
      if (target > actual) shiftSubtree(kids[i], target - actual, colIds, map);
      cur = map.get(kids[i].pos.posId)!.cx;
    }
    kids.forEach(c => process(c));
  }
  tree.forEach(r => process(r));
}

function recenterParents(node: OrgNode, colIds: Set<string>, map: Map<string, LPos>) {
  if (!colIds.has(node.pos.posId) && node.children.length) {
    node.children.forEach(c => recenterParents(c, colIds, map));
    const cxs = node.children.map(c => map.get(c.pos.posId)!.cx);
    map.set(node.pos.posId, { ...map.get(node.pos.posId)!, cx: (Math.min(...cxs) + Math.max(...cxs)) / 2 });
  }
}

function computeLayout(tree: OrgNode[], colIds: Set<string>): {
  map: Map<string, LPos>; totalW: number; totalH: number;
} {
  const map = new Map<string, LPos>();
  buildInitialLayout(tree, colIds, map);
  enforceSep(tree, colIds, map);
  equalizeGaps(tree, colIds, map);               // equal card-edge gaps between siblings
  tree.forEach(r => recenterParents(r, colIds, map));  // re-center parents after shifts
  // Normalize: shift leftmost card edge to PAD_X
  const vals = Array.from(map.values());
  const minCx = Math.min(...vals.map(p => p.cx)) - CARD_W / 2;
  if (minCx < PAD_X) {
    const shift = PAD_X - minCx;
    map.forEach((p, k) => map.set(k, { cx: p.cx + shift, y: p.y }));
  }
  const maxCx = Math.max(...Array.from(map.values()).map(p => p.cx)) + CARD_W / 2;
  const maxY  = Math.max(...Array.from(map.values()).map(p => p.y));
  return { map, totalW: maxCx + PAD_X, totalH: maxY + LEVEL_H + 40 };
}


function isFilled(pos: OrgPos) { return pos.personName.trim() !== ''; }
function cardAccent(pos: OrgPos) {
  if (isFilled(pos)) return '#16a34a';
  if (pos.urgent)    return '#ea580c';
  return '#94a3b8';
}
function cardBg(pos: OrgPos) {
  if (isFilled(pos)) return '#f0fdf4';
  if (pos.urgent)    return '#fff7ed';
  return '#f8fafc';
}
function cardBorder(pos: OrgPos) {
  if (isFilled(pos)) return '#86efac';
  if (pos.urgent)    return '#fdba74';
  return '#cbd5e1';
}

// ── PosCard ───────────────────────────────────────────────────────────────────
function PosCard({ node, selected, searchMatch, onSelect, onEdit }: {
  node: OrgNode; selected: boolean; searchMatch: boolean;
  onSelect: () => void; onEdit: (e: React.MouseEvent) => void;
}) {
  const { pos, emp } = node;
  const accent   = cardAccent(pos);
  const filled   = isFilled(pos);
  const initials = filled ? pos.personName.trim().split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : '';

  return (
    <div onClick={onSelect} style={{
      width: CARD_W, borderRadius: 10, boxSizing: 'border-box',
      background: selected ? '#eff6ff' : cardBg(pos),
      border: `1.5px solid ${selected ? '#3b82f6' : searchMatch ? accent : cardBorder(pos)}`,
      borderTop: `4px solid ${selected ? '#3b82f6' : accent}`,
      padding: '11px 12px 10px', cursor: 'pointer', transition: 'all 0.18s', userSelect: 'none',
      boxShadow: selected ? '0 0 0 3px rgba(59,130,246,0.15),0 4px 16px rgba(59,130,246,0.12)' : '0 2px 8px rgba(0,0,0,0.08)',
      position: 'relative',
    }}>
      <button onClick={onEdit} title="Edit position" style={{
        position: 'absolute', top: 7, right: 7, width: 22, height: 22, borderRadius: 6,
        background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.09)',
        color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
      }}><Edit2 size={11}/></button>

      {pos.team && (
        <div style={{ fontSize: 13, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 4, textAlign: 'center' }}>
          {pos.team}
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', lineHeight: 1.35, marginBottom: 7, paddingRight: 24, wordBreak: 'break-word', textAlign: 'center' }}>
        {pos.role}
      </div>

      {filled ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          {emp?.photo ? (
            <img src={emp.photo} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${accent}70`, flexShrink: 0 }} alt=""/>
          ) : (
            <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: accent+'22', border: `1.5px solid ${accent}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: accent }}>
              {initials}
            </div>
          )}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', lineHeight: 1.3 }}>{pos.personName}</div>
            {emp && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{emp.empId}</div>}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: accent, fontStyle: 'italic', fontWeight: pos.urgent ? 700 : 400, textAlign: 'center' }}>
          {pos.urgent ? '⚠ Position Vacant' : '— Not Yet Filled —'}
        </div>
      )}
    </div>
  );
}


// ── Edit Modal ────────────────────────────────────────────────────────────────
const RS_OPTIONS = [
  { val:'joined',        label:'Joined',        color:'#16a34a' },
  { val:'ready_to_join', label:'Ready to Join',  color:'#2563eb' },
  { val:'hr_process',    label:'HR Process',     color:'#7c3aed' },
  { val:'pending',       label:'Pending',        color:'#dc2626' },
];

function EditModal({ node, employees, onSave, onDelete, onAddChild, onClose }: {
  node: OrgNode; employees: FullEmployee[];
  onSave: (posId: string, patch: Partial<OrgPos>) => Promise<void>;
  onDelete: (posId: string) => Promise<void>;
  onAddChild: (parentPosId: string, sortOrder: number) => void;
  onClose: () => void;
}) {
  const { pos } = node;
  const [personName,        setPersonName]        = useState(pos.personName);
  const [linkedEmpId,       setLinkedEmpId]       = useState(pos.linkedEmpId);
  const [urgent,            setUrgent]            = useState(pos.urgent);
  const [recruitmentStatus, setRecruitmentStatus] = useState(pos.recruitmentStatus || (pos.personName ? 'joined' : 'pending'));
  const [roleCategory,      setRoleCategory]      = useState(pos.roleCategory || pos.role);
  const [saving,  setSaving]  = useState(false);
  const [delConf, setDelConf] = useState(false);

  const handleNameChange = (v: string) => {
    setPersonName(v);
    if (v.trim() && recruitmentStatus === 'pending')  setRecruitmentStatus('joined');
    if (!v.trim() && recruitmentStatus === 'joined')  setRecruitmentStatus('pending');
  };
  const handleEmpPick = (empId: string) => {
    setLinkedEmpId(empId);
    if (empId) {
      const emp = employees.find(e => e.empId === empId || e.id === empId);
      if (emp) { setPersonName(emp.name); setRecruitmentStatus('joined'); }
    }
  };
  const handleSave = async () => {
    setSaving(true);
    await onSave(pos.posId, { personName: personName.trim(), linkedEmpId, urgent, recruitmentStatus, roleCategory: roleCategory.trim() || pos.role });
    setSaving(false); onClose();
  };
  const handleClear = async () => {
    setSaving(true);
    await onSave(pos.posId, { personName: '', linkedEmpId: '', recruitmentStatus: 'pending' });
    setSaving(false); onClose();
  };
  const handleDelete = async () => {
    setSaving(true); await onDelete(pos.posId); setSaving(false); onClose();
  };

  const filled = personName.trim() !== '';

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:460, borderRadius:16, background:'#fff', border:'1px solid #e2e8f0', boxShadow:'0 24px 80px rgba(0,0,0,0.18)', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px 14px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'flex-start', justifyContent:'space-between', background:'#f8fafc' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>Edit Position</div>
            <div style={{ fontSize:11, color: filled ? '#16a34a' : pos.urgent ? '#ea580c' : '#64748b', marginTop:3, fontWeight:600 }}>
              {pos.team ? `${pos.team} · ` : ''}{pos.role}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', padding:4 }}><X size={16}/></button>
        </div>

        <div style={{ padding:18, display:'flex', flexDirection:'column', gap:13 }}>
          <div>
            <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:5, fontWeight:600, textTransform:'uppercase', letterSpacing:0.8 }}>Person Name</label>
            <input value={personName} onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. Mr. John Smith" autoFocus
              style={{ width:'100%', boxSizing:'border-box', height:40, padding:'0 12px', borderRadius:8, border:'1.5px solid #e2e8f0', fontSize:13, color:'#1e293b', background:'#f8fafc', outline:'none' }}/>
          </div>

          <div>
            <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:7, fontWeight:600, textTransform:'uppercase', letterSpacing:0.8 }}>Recruitment Status</label>
            <div style={{ display:'flex', gap:6 }}>
              {RS_OPTIONS.map(o => (
                <button key={o.val} onClick={() => setRecruitmentStatus(o.val)} style={{
                  flex:1, padding:'8px 4px', fontSize:11, fontWeight:600, borderRadius:8, cursor:'pointer',
                  background: recruitmentStatus === o.val ? o.color+'18' : '#f8fafc',
                  border: `1.5px solid ${recruitmentStatus === o.val ? o.color : '#e2e8f0'}`,
                  color: recruitmentStatus === o.val ? o.color : '#94a3b8',
                  transition:'all 0.12s',
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:5, fontWeight:600, textTransform:'uppercase', letterSpacing:0.8 }}>Link to Employee Record (Optional)</label>
            <select value={linkedEmpId} onChange={e => handleEmpPick(e.target.value)}
              style={{ width:'100%', height:36, padding:'0 10px', borderRadius:8, border:'1.5px solid #e2e8f0', fontSize:12, color:'#1e293b', background:'#f8fafc', outline:'none' }}>
              <option value="">— Not linked —</option>
              {employees.filter(e => e.status !== 'resigned').sort((a,b) => a.name.localeCompare(b.name)).map(e => (
                <option key={e.id} value={e.empId}>{e.name} · {e.empId}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:5, fontWeight:600, textTransform:'uppercase', letterSpacing:0.8 }}>
              Stats Group <span style={{ fontSize:10, fontWeight:400, textTransform:'none', color:'#94a3b8' }}>(Summary table row)</span>
            </label>
            <input value={roleCategory} onChange={e => setRoleCategory(e.target.value)} placeholder={pos.role}
              style={{ width:'100%', boxSizing:'border-box', height:36, padding:'0 12px', borderRadius:8, border:'1.5px solid #e2e8f0', fontSize:12, color:'#1e293b', background:'#f8fafc', outline:'none' }}/>
          </div>

          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', background:'#fff7ed', border:'1px solid #fdba74', borderRadius:9, padding:'9px 13px' }}>
            <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} style={{ accentColor:'#ea580c', width:15, height:15 }}/>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:'#ea580c' }}>Mark as Urgent Vacancy</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>Card shows in orange on the org chart</div>
            </div>
          </label>
        </div>

        <div style={{ padding:'12px 18px', borderTop:'1px solid #f1f5f9', display:'flex', gap:8, alignItems:'center', background:'#f8fafc' }}>
          <button onClick={() => { onClose(); onAddChild(pos.posId, node.children.length); }}
            style={{ padding:'7px 11px', fontSize:11, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, color:'#2563eb', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
            <Plus size={12}/> Add Sub-Position
          </button>
          <div style={{ flex:1 }}/>
          {!delConf ? (
            <button onClick={() => setDelConf(true)}
              style={{ padding:'7px 11px', fontSize:11, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, color:'#dc2626', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
              <Trash2 size={12}/> Delete
            </button>
          ) : (
            <button onClick={handleDelete} disabled={saving}
              style={{ padding:'7px 12px', fontSize:11, background:'#dc2626', border:'none', borderRadius:8, color:'#fff', cursor:'pointer', fontWeight:700 }}>
              Confirm Delete
            </button>
          )}
          {filled && (
            <button onClick={handleClear} disabled={saving}
              style={{ padding:'7px 11px', fontSize:11, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, color:'#64748b', cursor:'pointer' }}>
              Clear Person
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            style={{ padding:'7px 18px', fontSize:12, background:'#2563eb', border:'none', borderRadius:8, color:'#fff', cursor:'pointer', fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
            <Save size={13}/> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Modal ─────────────────────────────────────────────────────────────────
function AddModal({ parentPosId, defaultSortOrder, onSave, onClose }: {
  parentPosId: string; defaultSortOrder: number;
  onSave: (data: Partial<OrgPos>) => Promise<void>;
  onClose: () => void;
}) {
  const [role, setRole] = useState('');
  const [team, setTeam] = useState('');
  const [cat,  setCat]  = useState('');
  const [urgent, setUrgent] = useState(false);
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    if (!role.trim()) return;
    setSaving(true);
    await onSave({ parentId: parentPosId, role: role.trim(), team: team.trim(), urgent, sortOrder: defaultSortOrder, personName: '', linkedEmpId: '', roleCategory: cat.trim() || role.trim(), recruitmentStatus: 'pending' });
    setSaving(false); onClose();
  };

  const inp: React.CSSProperties = { width:'100%', boxSizing:'border-box', height:38, padding:'0 12px', borderRadius:8, border:'1.5px solid #e2e8f0', fontSize:13, color:'#1e293b', background:'#f8fafc', outline:'none' };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1001, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:380, borderRadius:14, background:'#fff', border:'1px solid #e2e8f0', boxShadow:'0 24px 60px rgba(0,0,0,0.15)', overflow:'hidden' }}>
        <div style={{ padding:'16px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>Add Sub-Position</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}><X size={16}/></button>
        </div>
        <div style={{ padding:18, display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:5, fontWeight:600, textTransform:'uppercase', letterSpacing:0.8 }}>Position / Role *</label>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Shift Engineer" style={inp} autoFocus/>
          </div>
          <div>
            <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:5, fontWeight:600, textTransform:'uppercase', letterSpacing:0.8 }}>Team / Section</label>
            <input value={team} onChange={e => setTeam(e.target.value)} placeholder="e.g. Team A" style={inp}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:'#64748b', display:'block', marginBottom:5, fontWeight:600, textTransform:'uppercase', letterSpacing:0.8 }}>Stats Group</label>
            <input value={cat} onChange={e => setCat(e.target.value)} placeholder={role || 'Same as role'} style={{ ...inp, fontSize:12 }}/>
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12, color:'#64748b' }}>
            <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} style={{ accentColor:'#ea580c' }}/>
            Mark as urgent vacancy (orange card)
          </label>
        </div>
        <div style={{ padding:'12px 18px', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'flex-end', gap:8, background:'#f8fafc' }}>
          <button onClick={onClose} style={{ padding:'7px 16px', fontSize:12, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, color:'#64748b', cursor:'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={!role.trim() || saving}
            style={{ padding:'7px 16px', fontSize:12, background: role.trim() ? '#2563eb' : '#e2e8f0', border:'none', borderRadius:8, color: role.trim() ? '#fff' : '#94a3b8', cursor: role.trim() ? 'pointer' : 'not-allowed', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
            <Plus size={12}/> {saving ? 'Adding…' : 'Add Position'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Profile Panel ─────────────────────────────────────────────────────────────
function gtTenure(joiningDate: string): string {
  if (!joiningDate) return '—';
  const totalMonths = Math.floor((Date.now() - new Date(joiningDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return m > 0 ? `${y}y ${m}m` : `${y}y`;
}

function ProfilePanel({ node, onClose, onViewFull }: { node: OrgNode; onClose: () => void; onViewFull: () => void }) {
  const { pos, emp } = node;
  const [tab, setTab] = useState<'info'|'quals'|'perf'>('info');
  const accent = cardAccent(pos);
  const filled = isFilled(pos);
  const displayName = emp?.name || pos.personName;
  const initials = filled ? displayName.trim().split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : '';
  const cColor: Record<string,string> = { valid:'#16a34a', expiring:'#d97706', expired:'#dc2626', none:'#94a3b8' };
  const cLabel: Record<string,string> = { valid:'Valid', expiring:'Expiring', expired:'Expired', none:'—' };
  const certStatus = (exp: string) => { if (!exp) return 'none'; const d=(new Date(exp).getTime()-Date.now())/86400000; return d<0?'expired':d<=60?'expiring':'valid'; };

  return (
    <div style={{ position:'fixed', right:0, top:0, bottom:0, width:380, background:'#fff', borderLeft:'1px solid #e2e8f0', boxShadow:'-8px 0 32px rgba(0,0,0,0.10)', zIndex:500, display:'flex', flexDirection:'column', animation:'slideInRight 0.22s ease' }}>
      <div style={{ padding:'14px 16px 12px', borderBottom:'1px solid #f1f5f9', flexShrink:0, background:'#f8fafc' }}>
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
          <button onClick={onClose} style={{ background:'#f1f5f9', border:'1px solid #e2e8f0', color:'#64748b', cursor:'pointer', borderRadius:8, padding:'4px 8px', display:'flex' }}><X size={15}/></button>
        </div>
        <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
          <div style={{ width:52, height:52, borderRadius:12, flexShrink:0, background: emp?.photo ? 'transparent' : accent+'15', border:`2px solid ${accent}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:accent, overflow:'hidden' }}>
            {!filled ? <User size={20} color={accent}/> : emp?.photo ? <img src={emp.photo} style={{ width:'100%',height:'100%',objectFit:'cover' }} alt=""/> : initials}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            {filled ? (
              <>
                <div style={{ fontSize:15, fontWeight:700, color:'#1e293b' }}>{displayName}</div>
                {emp && <div style={{ fontSize:11, color:'#2563eb', marginTop:2, fontWeight:500 }}>{emp.empId}</div>}
                <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{pos.role}{pos.team ? ` · ${pos.team}` : ''}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize:13, fontWeight:700, color:accent, fontStyle:'italic' }}>Position Vacant</div>
                <div style={{ fontSize:12, color:'#1e293b', marginTop:3, fontWeight:600 }}>{pos.role}</div>
              </>
            )}
            <span style={{ fontSize:11, fontWeight:600, color:accent, background:accent+'18', border:`1px solid ${accent}35`, padding:'2px 9px', borderRadius:20, marginTop:6, display:'inline-block' }}>
              {RS_LABEL[pos.recruitmentStatus] || (filled ? 'Joined' : 'Vacant')}
            </span>
          </div>
        </div>
      </div>

      {emp && (
        <div style={{ display:'flex', borderBottom:'1px solid #f1f5f9', flexShrink:0 }}>
          {([['info','Overview'],['quals','Qualifications'],['perf','Performance']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flex:1, padding:'10px 0', border:'none', cursor:'pointer', fontSize:12, fontWeight:500, background:'none', color:tab===k?'#2563eb':'#94a3b8', borderBottom:tab===k?'2px solid #2563eb':'2px solid transparent', transition:'all 0.15s' }}>{l}</button>
          ))}
        </div>
      )}

      <div style={{ flex:1, overflowY:'auto', padding:16 }}>
        {!emp && (
          <div style={{ textAlign:'center', padding:'36px 16px' }}>
            <div style={{ width:52, height:52, borderRadius:'50%', background:accent+'10', border:`2px dashed ${accent}40`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}><User size={22} color={accent}/></div>
            <div style={{ fontSize:13, fontWeight:700, color:accent, marginBottom:6 }}>{filled ? 'Not linked to employee record' : pos.urgent ? 'Urgent Vacancy' : 'Position Not Yet Filled'}</div>
            <div style={{ fontSize:12, color:'#64748b', lineHeight:1.6 }}>{filled ? `"${pos.personName}" is set but not linked. Click ✎ to link them.` : 'Click the pencil icon on the card to assign a person.'}</div>
          </div>
        )}
        {emp && tab==='info' && (
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            <div style={{ background:'#f8fafc', borderRadius:10, padding:'11px 13px', border:'1px solid #f1f5f9' }}>
              <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:1, marginBottom:9 }}>Role & Department</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 10px' }}>
                {[['Department',emp.department],['Section',emp.section||'—'],['Manager',emp.reportingManager||'—'],['Grade',emp.grade||'—'],['Joining Date',emp.joiningDate||'—'],['Experience',`${gtTenure(emp.joiningDate)} (${emp.yearsOfExperience||0}y overall)`],['Nationality',emp.nationality||'—'],['Type',emp.employeeType||'—']].map(([k,v]) => (
                  <div key={k}><div style={{ fontSize:10, color:'#94a3b8', marginBottom:1 }}>{k}</div><div style={{ fontSize:11, color:'#334155', fontWeight:500 }}>{v}</div></div>
                ))}
              </div>
            </div>
            <div style={{ background:'#f8fafc', borderRadius:10, padding:'11px 13px', border:'1px solid #f1f5f9' }}>
              <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:1, marginBottom:9 }}>Contact</div>
              {emp.uaePhone    && <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}><Phone size={11} color="#94a3b8"/><span style={{ fontSize:11, color:'#374151' }}>{emp.uaePhone}</span></div>}
              {(() => { const BLANK = /^(nil|n\/a|none|--|—|-|na)$/i; const email = [emp.companyEmail, emp.personalEmail].find(e => e && !BLANK.test(e.trim())); return email ? <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}><Mail size={11} color="#94a3b8"/><span style={{ fontSize:11, color:'#374151' }}>{email}</span></div> : null; })()}
              {emp.currentAddress && <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}><MapPin size={11} color="#94a3b8" style={{ marginTop:2, flexShrink:0 }}/><span style={{ fontSize:11, color:'#374151' }}>{emp.currentAddress}</span></div>}
            </div>
          </div>
        )}
        {emp && tab==='quals' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {emp.qualifications.length === 0
              ? <div style={{ textAlign:'center', padding:'24px 0', color:'#94a3b8', fontSize:12 }}>No qualifications on record</div>
              : emp.qualifications.map(q => { const cs=certStatus(q.expiryDate); const cc=cColor[cs]; return (
                <div key={q.id} style={{ background:'#f8fafc', borderRadius:9, padding:'10px 12px', borderLeft:`3px solid ${cc}`, border:`1px solid #f1f5f9`, borderLeftWidth:3, borderLeftColor:cc }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, gap:8 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#1e293b', lineHeight:1.3 }}>{q.courseName}</div>
                    <span style={{ fontSize:10, fontWeight:600, color:cc, background:cc+'18', padding:'2px 6px', borderRadius:20, whiteSpace:'nowrap', flexShrink:0 }}>{cLabel[cs]}</span>
                  </div>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>{q.category} · {q.institute}</div>
                  {q.expiryDate && <div style={{ fontSize:10, color:cc, marginTop:4 }}>Expires: {q.expiryDate}</div>}
                </div>
              ); })}
          </div>
        )}
        {emp && tab==='perf' && emp.performance.length===0 && <div style={{ textAlign:'center', padding:'24px 0', color:'#94a3b8', fontSize:12 }}>No performance data on record</div>}
        {emp && tab==='perf' && emp.performance.length>0 && (() => {
          const latest=[...emp.performance].sort((a,b)=>b.year-a.year)[0];
          return (
            <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:13 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1e293b' }}>Review {latest.year}</div>
                <div style={{ fontSize:20, fontWeight:800, color:'#2563eb' }}>{latest.kpiScore}<span style={{ fontSize:10, color:'#94a3b8' }}>/100</span></div>
              </div>
              {[['Technical',latest.technical],['Attendance',latest.attendance],['Safety',latest.safety],['Leadership',latest.leadership],['Teamwork',latest.teamwork]].map(([l,v]) => (
                <div key={l as string} style={{ marginBottom:6 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#64748b', marginBottom:3 }}><span>{l}</span><span style={{ color:'#1e293b', fontWeight:600 }}>{v}</span></div>
                  <div style={{ height:5, background:'#e2e8f0', borderRadius:3, overflow:'hidden' }}><div style={{ width:`${v}%`, height:'100%', borderRadius:3, background:Number(v)>=80?'#16a34a':Number(v)>=60?'#2563eb':'#d97706' }}/></div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {emp && (
        <div style={{ padding:'12px 16px', borderTop:'1px solid #f1f5f9', flexShrink:0, background:'#f8fafc' }}>
          <button onClick={onViewFull} style={{ width:'100%', padding:'9px 0', background:'#2563eb', border:'none', borderRadius:9, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <ExternalLink size={13}/> View Full Profile
          </button>
        </div>
      )}
    </div>
  );
}

// ── OrgChart page ─────────────────────────────────────────────────────────────
export default function OrgChart() {
  const navigate = useNavigate();
  const { employees } = useEmployees();

  const [positions,    setPositions]    = useState<OrgPos[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [zoom,         setZoom]         = useState(1);
  const [search,       setSearch]       = useState('');
  const [pdfExporting, setPdfExporting] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [editingNode,  setEditingNode]  = useState<OrgNode | null>(null);
  const [addingUnder,  setAddingUnder]  = useState<{ parentPosId: string; sortOrder: number } | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting,    setResetting]    = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        let data: OrgPos[] = await apiFetch(API);
        if (!data.length) { await apiFetch(`${API}/seed`, { method:'POST' }); data = await apiFetch(API); }
        setPositions(data);
      } catch { setPositions([]); } finally { setLoading(false); }
    })();
  }, []);

  const tree         = useMemo(() => buildPosTree(positions, employees), [positions, employees]);
  const allParentIds = useMemo(() => collectParentPosIds(tree), [tree]);

  const searchMatch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return positions.find(p => p.role.toLowerCase().includes(q) || p.personName.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)) ?? null;
  }, [search, positions]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const expandAll   = useCallback(() => setCollapsedIds(new Set()), []);
  const collapseAll = useCallback(() => setCollapsedIds(new Set(allParentIds)), [allParentIds]);

  const handleSelect = useCallback((node: OrgNode) => {
    setSelectedNode(prev => prev?.pos.posId === node.pos.posId ? null : node);
    setEditingNode(null);
  }, []);
  const handleEdit = useCallback((node: OrgNode, e: React.MouseEvent) => {
    e.stopPropagation(); setEditingNode(node); setSelectedNode(null);
  }, []);

  const handleSavePos = useCallback(async (posId: string, patch: Partial<OrgPos>) => {
    try {
      const updated: OrgPos = await apiFetch(`${API}/${posId}`, { method:'PATCH', body:JSON.stringify(patch) });
      setPositions(prev => prev.map(p => p.posId === posId ? { ...p, ...updated } : p));
    } catch { /**/ }
  }, []);

  const handleDeletePos = useCallback(async (posId: string) => {
    try {
      await apiFetch(`${API}/${posId}`, { method:'DELETE' });
      const toRemove = new Set<string>([posId]);
      let changed = true;
      while (changed) { changed = false; positions.forEach(p => { if (p.parentId && toRemove.has(p.parentId) && !toRemove.has(p.posId)) { toRemove.add(p.posId); changed = true; } }); }
      setPositions(prev => prev.filter(p => !toRemove.has(p.posId)));
    } catch { /**/ }
  }, [positions]);

  const handleAddPos = useCallback(async (data: Partial<OrgPos>) => {
    try {
      const newPos: OrgPos = await apiFetch(API, { method:'POST', body:JSON.stringify(data) });
      setPositions(prev => [...prev, newPos]);
    } catch { /**/ }
  }, []);

  const handleReset = useCallback(async () => {
    setResetting(true);
    try {
      await apiFetch(`${API}/reset`, { method: 'POST' });
      const data: OrgPos[] = await apiFetch(API);
      setPositions(data);
      setCollapsedIds(new Set());
      setSelectedNode(null);
    } catch { /**/ } finally {
      setResetting(false);
      setResetConfirm(false);
    }
  }, []);

  const stats = useMemo(() => ({
    total:  positions.length,
    filled: positions.filter(p => isFilled(p)).length,
    vacant: positions.filter(p => !isFilled(p)).length,
    urgent: positions.filter(p => !isFilled(p) && p.urgent).length,
  }), [positions]);

  // Pre-compute layout and visible node lists (avoids IIFE in JSX)
  const chartLayout = useMemo(() => {
    if (!tree.length) return null;
    const { map, totalW, totalH } = computeLayout(tree, collapsedIds);
    const visNodes: OrgNode[] = [];
    const collectVis = (nodes: OrgNode[]) => {
      nodes.forEach(n => { visNodes.push(n); if (!collapsedIds.has(n.pos.posId)) collectVis(n.children); });
    };
    collectVis(tree);
    const connGroups: { parentId: string; childIds: string[] }[] = [];
    visNodes.forEach(n => {
      if (!collapsedIds.has(n.pos.posId) && n.children.length)
        connGroups.push({ parentId: n.pos.posId, childIds: n.children.map(c => c.pos.posId) });
    });
    return { map, totalW, totalH, visNodes, connGroups };
  }, [tree, collapsedIds]);

  const fitToScreen = useCallback(() => {
    if (!canvasRef.current || !chartLayout) return;
    const availW = canvasRef.current.clientWidth  - 80;
    const availH = canvasRef.current.clientHeight - 80;
    const raw = Math.min(availW / chartLayout.totalW, availH / chartLayout.totalH, 1.0);
    setZoom(Math.max(0.2, parseFloat((raw * 0.90).toFixed(2))));
  }, [chartLayout]);

  // Auto-fit when layout changes
  useEffect(() => {
    if (chartLayout) fitToScreen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartLayout?.totalW, chartLayout?.totalH]);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:400, flexDirection:'column', gap:12 }}>
      <div style={{ width:36, height:36, border:'3px solid #bfdbfe', borderTopColor:'#2563eb', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <div style={{ color:'#94a3b8', fontSize:13 }}>Loading org chart…</div>
    </div>
  );

  // ── Controls bar style helpers ─────────────────────────────────────────────
  const ctrlBtn: React.CSSProperties = {
    padding:'0 12px', height:32, fontSize:12, background:'#f8fafc',
    border:'1px solid #e2e8f0', borderRadius:8, color:'#374151', cursor:'pointer',
    display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap', fontWeight:500,
  };
  const divider = <div style={{ width:1, height:24, background:'#e2e8f0' }}/>;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 110px)', overflow:'hidden', background:'#e5e7eb' }}>

      {/* ── Controls bar ─────────────────────────────────────────────────── */}
      <div style={{ padding:'10px 16px', marginBottom:8, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', flexShrink:0, background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Network size={16} color="#2563eb"/>
          <span style={{ fontSize:14, fontWeight:700, color:'#1e293b' }}>Organization Chart</span>
        </div>
        {divider}

        {/* Search */}
        <div style={{ position:'relative', minWidth:140, maxWidth:200, flex:1 }}>
          <Search size={12} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search role, name…"
            style={{ width:'100%', boxSizing:'border-box', paddingLeft:26, height:32, borderRadius:8, border:'1px solid #e2e8f0', fontSize:12, color:'#1e293b', background:'#f8fafc', outline:'none' }}/>
        </div>
        {divider}

        <button style={ctrlBtn} onClick={expandAll}><Plus size={12}/> Expand All</button>
        <button style={ctrlBtn} onClick={collapseAll}><Minimize2 size={12}/> Collapse All</button>
        {divider}

        {/* Zoom */}
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <button style={{ ...ctrlBtn, padding:'0 8px' }} onClick={() => setZoom(z => Math.max(0.2,+(z-0.05).toFixed(2)))}><ZoomOut size={13}/></button>
          <span style={{ fontSize:12, color:'#64748b', minWidth:38, textAlign:'center', fontWeight:600 }}>{Math.round(zoom*100)}%</span>
          <button style={{ ...ctrlBtn, padding:'0 8px' }} onClick={() => setZoom(z => Math.min(2.0,+(z+0.05).toFixed(2)))}><ZoomIn size={13}/></button>
          <button style={{ ...ctrlBtn, padding:'0 10px', background:'#eff6ff', border:'1px solid #bfdbfe', color:'#2563eb', fontWeight:600 }} onClick={fitToScreen}>
            <Maximize2 size={12}/> Fit
          </button>
          <button style={{ ...ctrlBtn, padding:'0 10px' }} onClick={() => setZoom(1)}>100%</button>
        </div>
        {divider}

        {/* Position Summary link */}
        <button onClick={() => navigate('/org-chart/summary')} style={{
          ...ctrlBtn, background:'#eff6ff', border:'1px solid #bfdbfe', color:'#2563eb', fontWeight:600,
        }}>
          <BarChart2 size={12}/> Position Summary
        </button>

        {/* Download PDF */}
        <button disabled={pdfExporting} onClick={async () => {
          setPdfExporting(true);
          await exportOrgChartPDF(positions);
          setPdfExporting(false);
        }} style={{
          ...ctrlBtn, background: pdfExporting ? '#f8fafc' : '#fef2f2',
          border:'1px solid #fecaca', color:'#dc2626', fontWeight:600,
          opacity: pdfExporting ? 0.7 : 1, cursor: pdfExporting ? 'default' : 'pointer',
        }}>
          <Download size={12}/> {pdfExporting ? 'Generating…' : 'Download PDF'}
        </button>

        {/* Reset Structure */}
        <button onClick={() => setResetConfirm(true)} style={{
          ...ctrlBtn, background:'#fff7ed', border:'1px solid #fed7aa', color:'#c2410c', fontWeight:600,
        }}>
          <RotateCcw size={12}/> Reset Structure
        </button>

        {/* Stat counters */}
        <div style={{ marginLeft:'auto', display:'flex', gap:16, flexShrink:0 }}>
          {[
            { label:'Positions', value:stats.total,  color:'#2563eb' },
            { label:'Filled',    value:stats.filled, color:'#16a34a' },
            { label:'Vacant',    value:stats.vacant, color:'#94a3b8' },
            { label:'Urgent',    value:stats.urgent, color:'#ea580c' },
          ].map(s => (
            <div key={s.label} style={{ textAlign:'center' }}>
              <div style={{ fontSize:15, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', letterSpacing:0.5, marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:16, marginBottom:8, flexShrink:0, alignItems:'center', paddingLeft:4 }}>
        {[
          ['Filled',          '#16a34a', '#f0fdf4', '#86efac'],
          ['Urgent Vacancy',  '#ea580c', '#fff7ed', '#fdba74'],
          ['Position Vacant', '#94a3b8', '#f8fafc', '#cbd5e1'],
        ].map(([l,accent,bg,border]) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#64748b' }}>
            <div style={{ width:30, height:14, borderRadius:3, background:bg, border:`1px solid ${border}`, borderTop:`3px solid ${accent}`, boxShadow:'0 1px 2px rgba(0,0,0,0.06)' }}/>
            {l}
          </div>
        ))}
        <div style={{ marginLeft:'auto', fontSize:11, color:'#94a3b8', fontStyle:'italic' }}>Click ✎ to edit a card · Click card to view profile</div>
      </div>

      {/* ── Chart canvas ─────────────────────────────────────────────────── */}
      <div ref={canvasRef}
        style={{ flex:1, overflow:'auto', background:'#f8fafc', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}
        onClick={e => { if (e.target === e.currentTarget) setSelectedNode(null); }}>
        {tree.length === 0 ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'100%', height:'100%', flexDirection:'column', gap:10 }}>
            <Network size={48} color="#e2e8f0"/>
            <div style={{ color:'#94a3b8', fontSize:14 }}>No positions found</div>
          </div>
        ) : chartLayout ? (
          <div style={{ minWidth:'100%', minHeight:'100%', display:'flex', justifyContent:'center', alignItems:'flex-start', padding:'32px 32px 64px', boxSizing:'border-box' }}>
            <div style={{ transform:`scale(${zoom})`, transformOrigin:'top center', transition:'transform 0.15s ease', width:chartLayout.totalW, height:chartLayout.totalH, position:'relative', flexShrink:0 }}>

              {/* SVG connector lines */}
              <svg style={{ position:'absolute', top:0, left:0, width:chartLayout.totalW, height:chartLayout.totalH, pointerEvents:'none', overflow:'visible' }}>
                {chartLayout.connGroups.map(({ parentId, childIds }) => {
                  const pPos = chartLayout.map.get(parentId);
                  if (!pPos) return null;
                  const cList = childIds.map(id => chartLayout.map.get(id)).filter((p): p is LPos => !!p).sort((a, b) => a.cx - b.cx);
                  if (!cList.length) return null;
                  const y1 = pPos.y + CONN_Y, y2 = cList[0].y, midY = Math.round((y1 + y2) / 2);
                  return (
                    <g key={parentId}>
                      <line x1={pPos.cx} y1={y1} x2={pPos.cx} y2={midY} stroke={LINE_C} strokeWidth={LINE_W}/>
                      {cList.length > 1 && <line x1={cList[0].cx} y1={midY} x2={cList[cList.length-1].cx} y2={midY} stroke={LINE_C} strokeWidth={LINE_W}/>}
                      {cList.map(cp => <line key={cp.cx} x1={cp.cx} y1={midY} x2={cp.cx} y2={y2} stroke={LINE_C} strokeWidth={LINE_W}/>)}
                    </g>
                  );
                })}
              </svg>

              {/* Cards + toggle buttons */}
              {chartLayout.visNodes.map(node => {
                const lp = chartLayout.map.get(node.pos.posId);
                if (!lp) return null;
                const isCol = collapsedIds.has(node.pos.posId);
                const hasCh = node.children.length > 0;
                return (
                  <div key={node.pos.posId} style={{ position:'absolute', left:lp.cx - CARD_W/2, top:lp.y, display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <PosCard node={node}
                      selected={selectedNode?.pos.posId === node.pos.posId}
                      searchMatch={searchMatch?.posId === node.pos.posId}
                      onSelect={() => handleSelect(node)}
                      onEdit={e => handleEdit(node, e)}/>
                    {hasCh && (
                      <button onClick={e => { e.stopPropagation(); toggleCollapse(node.pos.posId); }}
                        title={isCol ? `Expand (${node.children.length})` : 'Collapse'}
                        style={{ width:BTN_H, height:BTN_H, borderRadius:'50%', marginTop:BTN_MT, flexShrink:0, background:isCol?'#2563eb':'#fff', border:`1.5px solid ${isCol?'#2563eb':'#94a3b8'}`, color:isCol?'#fff':'#64748b', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, lineHeight:1, padding:0, transition:'all 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.12)' }}>
                        {isCol ? '+' : '−'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Profile panel */}
      {selectedNode && !editingNode && (
        <ProfilePanel node={selectedNode} onClose={() => setSelectedNode(null)}
          onViewFull={() => { if (selectedNode.emp) navigate(`/employees/${selectedNode.emp.id}`); setSelectedNode(null); }}/>
      )}

      {/* Edit modal */}
      {editingNode && (
        <EditModal node={editingNode} employees={employees} onSave={handleSavePos} onDelete={handleDeletePos}
          onAddChild={(parentPosId, sortOrder) => setAddingUnder({ parentPosId, sortOrder })} onClose={() => setEditingNode(null)}/>
      )}

      {/* Add modal */}
      {addingUnder && (
        <AddModal parentPosId={addingUnder.parentPosId} defaultSortOrder={addingUnder.sortOrder}
          onSave={handleAddPos} onClose={() => setAddingUnder(null)}/>
      )}

      {/* Reset confirm modal */}
      {resetConfirm && (
        <div onClick={e => { if (e.target === e.currentTarget) setResetConfirm(false); }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1002, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ width:400, borderRadius:14, background:'#fff', border:'1px solid #e2e8f0', boxShadow:'0 24px 60px rgba(0,0,0,0.15)', overflow:'hidden' }}>
            <div style={{ padding:'16px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff7ed' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <RotateCcw size={15} color="#c2410c"/>
                <span style={{ fontSize:13, fontWeight:700, color:'#c2410c' }}>Reset Org Structure</span>
              </div>
              <button onClick={() => setResetConfirm(false)} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer' }}><X size={16}/></button>
            </div>
            <div style={{ padding:'18px 20px' }}>
              <p style={{ fontSize:13, color:'#374151', lineHeight:1.7, margin:0 }}>
                This will <strong>delete all current positions</strong> and rebuild the org chart with the updated default structure:
              </p>
              <ul style={{ fontSize:12, color:'#64748b', margin:'12px 0 0', paddingLeft:18, lineHeight:2 }}>
                <li>E&amp;I, IT Manager → E&amp;I, Deputy Manager</li>
                <li>Deputy Manager → <strong>General E&amp;I Engineer · Automation Engineer · IT Engineer</strong></li>
                <li>Deputy Manager → <strong>Shift Engineer (A, B, C) · Reliving Shift Engineer</strong></li>
                <li>Each Shift Engineer → Sub-role → Team Member</li>
              </ul>
              <p style={{ fontSize:11, color:'#ef4444', marginTop:12, fontWeight:600 }}>
                ⚠ All manually assigned person names will be lost.
              </p>
            </div>
            <div style={{ padding:'12px 18px', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'flex-end', gap:8, background:'#f8fafc' }}>
              <button onClick={() => setResetConfirm(false)} style={{ padding:'7px 16px', fontSize:12, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, color:'#64748b', cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={handleReset} disabled={resetting} style={{
                padding:'7px 18px', fontSize:12, background: resetting ? '#f1f5f9' : '#c2410c', border:'none',
                borderRadius:8, color: resetting ? '#94a3b8' : '#fff', cursor: resetting ? 'default' : 'pointer',
                fontWeight:600, display:'flex', alignItems:'center', gap:5,
              }}>
                <RotateCcw size={12}/> {resetting ? 'Resetting…' : 'Yes, Reset Structure'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
