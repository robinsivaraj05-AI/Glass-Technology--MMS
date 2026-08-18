// @ts-nocheck
import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Bell, Activity, Zap, Wrench, AlertTriangle,
  CheckCircle, CheckCircle2, Clock, Users, DollarSign, Gauge, Cpu,
  Calendar, Package, RefreshCw, ChevronRight, Battery, Monitor, Server,
  FileText, User, Building2, BarChart2, BarChart3, Radio,
  ClipboardList, ArrowUpRight, ArrowDownRight, Thermometer, Star,
  UserCheck, HardDrive, Settings, Search, MapPin,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const NOW    = new Date();
const hour   = NOW.getHours();
const greet  = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
const shift  = hour < 8  ? 'Night Shift'  : hour < 16  ? 'Day Shift'     : 'Evening Shift';
const dateLbl = NOW.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// ─── Design tokens ────────────────────────────────────────────────────────────
const CARD: any = {
  background: '#FFFFFF', borderRadius: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
  border: '1px solid #F1F5F9',
};
const PAGE_BG = '#F0F4F8';

// ─── KPI definitions ──────────────────────────────────────────────────────────
const KPIS = [
  { id:'oee',    label:'OEE',                value:'87.4', unit:'%',   color:'#22C55E', bg:'#F0FDF4', border:'#BBF7D0',
    gradient:'linear-gradient(135deg,#22C55E,#16A34A)',  icon:<Gauge size={26}/>,   trend:'up',   trendVal:'+2.1%',
    sub:'Overall Equipment Effectiveness',   equip:'Clamp Meter' },
  { id:'mtbf',   label:'MTBF',               value:'342',  unit:'hrs', color:'#3B82F6', bg:'#EFF6FF', border:'#BFDBFE',
    gradient:'linear-gradient(135deg,#3B82F6,#1D4ED8)',  icon:<Activity size={26}/>, trend:'up',  trendVal:'+18hrs',
    sub:'Mean Time Between Failures',        equip:'Digital Multimeter' },
  { id:'mttr',   label:'MTTR',               value:'2.3',  unit:'hrs', color:'#F97316', bg:'#FFF7ED', border:'#FED7AA',
    gradient:'linear-gradient(135deg,#F97316,#EA580C)',  icon:<Clock size={26}/>,   trend:'down', trendVal:'-0.4hrs',
    sub:'Mean Time To Repair',               equip:'Insulation Tester' },
  { id:'pm',     label:'PM Compliance',       value:'94.2', unit:'%',   color:'#8B5CF6', bg:'#F5F3FF', border:'#DDD6FE',
    gradient:'linear-gradient(135deg,#8B5CF6,#7C3AED)',  icon:<CheckCircle size={26}/>, trend:'up', trendVal:'+3.5%',
    sub:'Preventive Maintenance',            equip:'Loop Calibrator' },
  { id:'elec',   label:'Electrical Avail.',   value:'98.7', unit:'%',   color:'#F59E0B', bg:'#FFFBEB', border:'#FDE68A',
    gradient:'linear-gradient(135deg,#F59E0B,#D97706)',  icon:<Zap size={26}/>,     trend:'up',  trendVal:'+0.3%',
    sub:'Electrical Uptime Availability',    equip:'VFD Panel' },
  { id:'inst',   label:'Instr. Avail.',       value:'97.1', unit:'%',   color:'#06B6D4', bg:'#ECFEFF', border:'#A5F3FC',
    gradient:'linear-gradient(135deg,#06B6D4,#0891B2)',  icon:<Radio size={26}/>,   trend:'up',  trendVal:'+1.2%',
    sub:'Instrumentation Uptime',            equip:'HART Communicator' },
  { id:'pf',     label:'Power Factor',        value:'0.94', unit:'PF',  color:'#EC4899', bg:'#FDF2F8', border:'#FBCFE8',
    gradient:'linear-gradient(135deg,#EC4899,#DB2777)',  icon:<Battery size={26}/>, trend:'up',  trendVal:'+0.02',
    sub:'Plant Power Factor',                equip:'Power Analyzer' },
  { id:'budget', label:'Budget Utilization',  value:'68.3', unit:'%',   color:'#14B8A6', bg:'#F0FDFA', border:'#99F6E4',
    gradient:'linear-gradient(135deg,#14B8A6,#0D9488)',  icon:<DollarSign size={26}/>, trend:'up', trendVal:'+5.2%',
    sub:'YTD Budget Utilization',            equip:'ERP Dashboard' },
];

// ─── Status cards ─────────────────────────────────────────────────────────────
const STATUS_CARDS = [
  { label:'Active Breakdowns', value:3,       icon:<AlertTriangle size={24}/>, color:'#EF4444', bg:'#FEF2F2', border:'#FECACA', sub:'2 Critical · 1 Minor',              borderLeft:'#EF4444' },
  { label:'PM Due Today',      value:7,       icon:<Calendar size={24}/>,      color:'#F59E0B', bg:'#FFFBEB', border:'#FDE68A', sub:'3 Electrical · 4 Instrumentation',  borderLeft:'#F59E0B' },
  { label:'Running Machines',  value:'42/45', icon:<Activity size={24}/>,      color:'#22C55E', bg:'#F0FDF4', border:'#BBF7D0', sub:'3 Machines scheduled for PM',       borderLeft:'#22C55E' },
  { label:'Open Work Orders',  value:12,      icon:<ClipboardList size={24}/>, color:'#3B82F6', bg:'#EFF6FF', border:'#BFDBFE', sub:'5 High Priority',                   borderLeft:'#3B82F6' },
];

// ─── Staffing (computed dynamically from /api/employees) ──────────────────────

// ─── Maintenance progress ─────────────────────────────────────────────────────
const MAINT = [
  { label:'Planning',    value:8,  color:'#3B82F6', pct:8  },
  { label:'In Progress', value:15, color:'#F59E0B', pct:15 },
  { label:'On Hold',     value:4,  color:'#EF4444', pct:4  },
  { label:'Completed',   value:73, color:'#22C55E', pct:73 },
];

// ─── Reminders ────────────────────────────────────────────────────────────────
const REMINDERS = [
  { freq:'Daily',     color:'#3B82F6', bg:'#EFF6FF', border:'#BFDBFE',
    items:['Inspect MCC panels','Check UPS battery levels','Log energy readings'] },
  { freq:'Weekly',    color:'#22C55E', bg:'#F0FDF4', border:'#BBF7D0',
    items:['Test emergency lighting','PM on conveyor motors'] },
  { freq:'Monthly',   color:'#8B5CF6', bg:'#F5F3FF', border:'#DDD6FE',
    items:['Infrared thermography scan','VFD parameter backup'] },
  { freq:'Quarterly', color:'#F59E0B', bg:'#FFFBEB', border:'#FDE68A',
    items:['Megger test — HT cables','Full PLC backup'] },
  { freq:'Yearly',    color:'#EF4444', bg:'#FEF2F2', border:'#FECACA',
    items:['Annual shutdown PM','Transformer oil test'] },
];

// ─── Pending jobs ─────────────────────────────────────────────────────────────
const JOBS = [
  { id:'JOB-2025-001', equipment:'Furnace Motor M-12',       due:'20 Aug 2025', priority:'Critical', person:'Ahmed Ali', status:'Open'        },
  { id:'JOB-2025-002', equipment:'Lehr Conveyor Belt',        due:'22 Aug 2025', priority:'High',     person:'Mohammed',  status:'In Progress' },
  { id:'JOB-2025-003', equipment:'PLC Rack — Zone 3',         due:'25 Aug 2025', priority:'Medium',   person:'Rabin',     status:'Open'        },
  { id:'JOB-2025-004', equipment:'Pressure Transmitter PT-204',due:'28 Aug 2025',priority:'High',     person:'Suresh',    status:'On Hold'     },
  { id:'JOB-2025-005', equipment:'MCC Panel Section 5',       due:'30 Aug 2025', priority:'Low',      person:'Kumar',     status:'Open'        },
];

// ─── Follow-ups ───────────────────────────────────────────────────────────────
const FOLLOWUPS = [
  { id:'FLW-001', date:'18 Aug', owner:'Ahmed Ali', next:'Get spare motor from store',  progress:60, color:'#3B82F6' },
  { id:'FLW-002', date:'19 Aug', owner:'Mohammed',  next:'Await vendor quotation',       progress:30, color:'#F59E0B' },
  { id:'FLW-003', date:'20 Aug', owner:'Rabin',     next:'PLC program backup complete',  progress:80, color:'#22C55E' },
  { id:'FLW-004', date:'21 Aug', owner:'Suresh',    next:'Calibration cert received',    progress:90, color:'#22C55E' },
  { id:'FLW-005', date:'22 Aug', owner:'Kumar',     next:'Switchgear inspection done',   progress:20, color:'#EF4444' },
];

// ─── Chart data ───────────────────────────────────────────────────────────────
const pmTrend = [
  {m:'Jan',pm:88,tgt:95},{m:'Feb',pm:86,tgt:95},{m:'Mar',pm:90,tgt:95},{m:'Apr',pm:91,tgt:95},
  {m:'May',pm:89,tgt:95},{m:'Jun',pm:92,tgt:95},{m:'Jul',pm:93,tgt:95},{m:'Aug',pm:94,tgt:95},
];
const bkdData = [
  {cat:'Electrical',n:12,fill:'#3B82F6'},{cat:'Mechanical',n:8,fill:'#F59E0B'},
  {cat:'Instrument',n:6,fill:'#8B5CF6'},{cat:'Utility',n:4,fill:'#22C55E'},{cat:'Civil',n:2,fill:'#EF4444'},
];
const eqHealth  = [{name:'Good',v:68,c:'#22C55E'},{name:'Fair',v:22,c:'#F59E0B'},{name:'Critical',v:10,c:'#EF4444'}];
const woStatus  = [{name:'Completed',v:73,c:'#22C55E'},{name:'In Progress',v:15,c:'#3B82F6'},{name:'On Hold',v:8,c:'#F59E0B'},{name:'Cancelled',v:4,c:'#EF4444'}];
const costData  = [
  {m:'Jan',el:42,ins:28,ci:8},{m:'Feb',el:38,ins:32,ci:6},{m:'Mar',el:55,ins:30,ci:10},
  {m:'Apr',el:48,ins:35,ci:5},{m:'May',el:52,ins:29,ci:7},{m:'Jun',el:46,ins:31,ci:9},
  {m:'Jul',el:58,ins:33,ci:11},{m:'Aug',el:43,ins:27,ci:6},
];
const energyD   = [{m:'Jan',k:128},{m:'Feb',k:119},{m:'Mar',k:132},{m:'Apr',k:125},{m:'May',k:138},{m:'Jun',k:142},{m:'Jul',k:136},{m:'Aug',k:131}];
const mtbfD     = [{m:'Jan',v:290},{m:'Feb',v:305},{m:'Mar',v:298},{m:'Apr',v:312},{m:'May',v:320},{m:'Jun',v:330},{m:'Jul',v:338},{m:'Aug',v:342}];
const mttrD     = [{m:'Jan',v:3.2},{m:'Feb',v:3.0},{m:'Mar',v:2.9},{m:'Apr',v:2.8},{m:'May',v:2.7},{m:'Jun',v:2.5},{m:'Jul',v:2.4},{m:'Aug',v:2.3}];

// ─── Mini components ──────────────────────────────────────────────────────────
const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:'10px 14px',
      boxShadow:'0 4px 16px rgba(0,0,0,0.10)', fontSize:12 }}>
      {label && <div style={{ fontWeight:700, color:'#374151', marginBottom:5 }}>{label}</div>}
      {payload.map((p:any, i:number) => (
        <div key={i} style={{ color:p.color||'#374151', fontWeight:600 }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
};

const PrioBadge = ({ p }: { p:string }) => {
  const m: Record<string,any> = {
    Critical:{bg:'#FEF2F2',tc:'#EF4444'}, High:{bg:'#FFF7ED',tc:'#F97316'},
    Medium:{bg:'#FFFBEB',tc:'#F59E0B'},   Low:{bg:'#F0FDF4',tc:'#22C55E'},
  };
  const c = m[p]||m.Low;
  return <span style={{ fontSize:10,fontWeight:800,padding:'2px 9px',borderRadius:20,background:c.bg,color:c.tc,border:`1px solid ${c.tc}40` }}>{p}</span>;
};

const StatBadge = ({ s }: { s:string }) => {
  const m: Record<string,any> = {
    Open:{bg:'#EFF6FF',tc:'#3B82F6'}, 'In Progress':{bg:'#FFFBEB',tc:'#F59E0B'},
    'On Hold':{bg:'#FEF2F2',tc:'#EF4444'}, Completed:{bg:'#F0FDF4',tc:'#22C55E'},
  };
  const c = m[s]||m.Open;
  return <span style={{ fontSize:10,fontWeight:800,padding:'2px 9px',borderRadius:20,background:c.bg,color:c.tc,border:`1px solid ${c.tc}40` }}>{s}</span>;
};

function EquipBadge({ gradient, icon, w=78, h=68 }: { gradient:string; icon:React.ReactNode; w?:number; h?:number }) {
  return (
    <div style={{ width:w, height:h, borderRadius:12, background:gradient, flexShrink:0, display:'flex',
      alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden',
      boxShadow:'0 4px 14px rgba(0,0,0,0.18)' }}>
      <div style={{ position:'absolute', top:-10, right:-10, width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,0.18)' }}/>
      <div style={{ position:'absolute', bottom:-8, left:-8, width:26, height:26, borderRadius:'50%', background:'rgba(255,255,255,0.10)' }}/>
      <div style={{ color:'#fff', position:'relative', zIndex:1, opacity:0.96 }}>{icon}</div>
    </div>
  );
}

function SectionTitle({ icon, label, action }: { icon:React.ReactNode; label:string; action?:string }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ color:'#374151' }}>{icon}</span>
        <span style={{ fontSize:14, fontWeight:800, color:'#1E293B' }}>{label}</span>
      </div>
      {action && <span style={{ fontSize:11, color:'#3B82F6', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:2 }}>{action} <ChevronRight size={12}/></span>}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orgPositions, setOrgPositions] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/org-positions')
      .then(r => r.json())
      .then(d => setOrgPositions(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Mirror exact logic from OrgChartSummary
  const getRS = (p: any) => p.recruitmentStatus || (p.personName?.trim() ? 'joined' : 'pending');
  const total       = orgPositions.length;
  const joinedCount = orgPositions.filter(p => getRS(p) === 'joined').length;
  const readyCount  = orgPositions.filter(p => getRS(p) === 'ready_to_join').length;
  const hrCount     = orgPositions.filter(p => getRS(p) === 'hr_process').length;
  const pendingCount= orgPositions.filter(p => getRS(p) === 'pending').length;
  const fillPct     = total > 0 ? +((joinedCount / total) * 100).toFixed(1) : 0;
  const activeCount = joinedCount; // kept for banner compatibility
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  const STAFFING = [
    { label:'Total Positions', value: total,        pct: 100,            color:'#3B82F6', bg:'#EFF6FF', border:'#BFDBFE', icon:<Users size={20}/> },
    { label:'Joined',          value: joinedCount,  pct: pct(joinedCount), color:'#22C55E', bg:'#F0FDF4', border:'#BBF7D0', icon:<CheckCircle size={20}/> },
    { label:'Ready to Join',   value: readyCount,   pct: pct(readyCount),  color:'#06B6D4', bg:'#ECFEFF', border:'#A5F3FC', icon:<Clock size={20}/> },
    { label:'HR Process',      value: hrCount,      pct: pct(hrCount),     color:'#8B5CF6', bg:'#F5F3FF', border:'#DDD6FE', icon:<FileText size={20}/> },
    { label:'Pending',         value: pendingCount, pct: pct(pendingCount),color:'#EF4444', bg:'#FEF2F2', border:'#FECACA', icon:<AlertTriangle size={20}/> },
  ];

  return (
    <div style={{ background:PAGE_BG, margin:'-20px -24px', padding:'24px 28px', minHeight:'calc(100vh - 60px)', fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:'#111827' }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════════ */}
      <div style={{ ...CARD, marginBottom:22, overflow:'hidden', background:'#fff' }}>
        {/* Blue top accent bar */}
        <div style={{ height:4, background:'linear-gradient(90deg,#1E40AF,#3B82F6,#06B6D4,#22C55E)' }}/>
        <div style={{ padding:'18px 24px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:18 }}>
            {/* Logo circle */}
            <div style={{ width:52, height:52, borderRadius:14, background:'linear-gradient(135deg,#1E40AF,#3B82F6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:'#fff', fontWeight:900, flexShrink:0, boxShadow:'0 4px 12px rgba(59,130,246,0.35)' }}>
              ⚡
            </div>
            <div>
              <div style={{ fontSize:11, color:'#9CA3AF', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>
                E &amp; I Maintenance Management System
              </div>
              <div style={{ fontSize:20, fontWeight:900, color:'#1E293B', lineHeight:1.2 }}>
                {greet}, {user?.name || 'Mr. Rabin'} 👋
              </div>
              <div style={{ display:'flex', gap:18, marginTop:7, flexWrap:'wrap' }}>
                {[
                  { icon:<Calendar size={12}/>, label:dateLbl },
                  { icon:<Clock size={12}/>,    label:shift },
                  { icon:<Building2 size={12}/>,label:'Glass Technology (MENA) L.L.C' },
                  { icon:<MapPin size={12}/>,   label:'Sharjah, UAE' },
                ].map((x,i) => (
                  <span key={i} style={{ fontSize:11, color:'#6B7280', display:'flex', alignItems:'center', gap:5, fontWeight:500 }}>
                    <span style={{ color:'#9CA3AF' }}>{x.icon}</span>{x.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            {/* Alert badges */}
            <div style={{ display:'flex', alignItems:'center', gap:7, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'8px 14px', cursor:'pointer' }}>
              <AlertTriangle size={13} color="#EF4444"/>
              <span style={{ fontSize:12, fontWeight:700, color:'#EF4444' }}>3 Active Breakdowns</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:7, background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, padding:'8px 14px', cursor:'pointer' }}>
              <Calendar size={13} color="#F59E0B"/>
              <span style={{ fontSize:12, fontWeight:700, color:'#F59E0B' }}>7 PM Due Today</span>
            </div>
            {/* Bell */}
            <div style={{ position:'relative', cursor:'pointer' }}>
              <div style={{ width:40, height:40, borderRadius:12, background:'#F8FAFC', border:'1px solid #E5E7EB', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Bell size={17} color="#374151"/>
              </div>
              <div style={{ position:'absolute', top:-4, right:-4, width:16, height:16, background:'#EF4444', borderRadius:'50%', fontSize:9, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, border:'2px solid #fff' }}>5</div>
            </div>
            {/* Avatar */}
            <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#1E40AF,#3B82F6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:900, color:'#fff', cursor:'pointer', boxShadow:'0 2px 8px rgba(59,130,246,0.3)' }}>
              {(user?.name||'R').charAt(0)}
            </div>
          </div>
        </div>
      </div>

      {/* ══ KPI CARDS — all 8 in one row ══════════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:10, marginBottom:16 }}>
        {KPIS.map(k => (
          <div key={k.id} style={{ ...CARD, padding:'12px 14px', background:k.bg, border:`1px solid ${k.border}`, position:'relative', overflow:'hidden' }}>
            {/* Top accent line */}
            <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:k.gradient, borderRadius:'16px 16px 0 0' }}/>
            {/* Label row + badge */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <div style={{ flex:1, minWidth:0, paddingRight:6 }}>
                <div style={{ fontSize:11, fontWeight:800, color:'#6B7280', textTransform:'uppercase', letterSpacing:0.8, lineHeight:1.3 }}>{k.label}</div>
              </div>
              <EquipBadge gradient={k.gradient} icon={k.icon} w={52} h={46}/>
            </div>
            {/* Value */}
            <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:8 }}>
              <span style={{ fontSize:30, fontWeight:900, color:k.color, lineHeight:1, letterSpacing:-1 }}>{k.value}</span>
              <span style={{ fontSize:14, color:'#6B7280', fontWeight:700 }}>{k.unit}</span>
            </div>
            {/* Trend */}
            <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 7px', background:'rgba(255,255,255,0.75)', borderRadius:7, width:'fit-content' }}>
              {k.trend === 'up'
                ? <ArrowUpRight size={12} color="#22C55E"/>
                : <ArrowDownRight size={12} color="#EF4444"/>}
              <span style={{ fontSize:11, fontWeight:800, color:k.trend==='up'?'#22C55E':'#EF4444' }}>{k.trendVal}</span>
            </div>
            {/* Equip label */}
            <div style={{ position:'absolute', bottom:5, right:8, fontSize:8, color:'#9CA3AF', fontStyle:'italic' }}>{k.equip}</div>
          </div>
        ))}
      </div>

      {/* ══ STATUS CARDS ════════════════════════════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        {STATUS_CARDS.map((s,i) => (
          <div key={i} style={{ ...CARD, padding:'14px 18px', display:'flex', alignItems:'center', gap:14,
            borderLeft:`4px solid ${s.borderLeft}`, background:s.bg, border:`1px solid ${s.border}`,
            borderLeftColor:s.borderLeft, position:'relative', overflow:'hidden' }}>
            <div style={{ width:46, height:46, borderRadius:13, background:`${s.color}18`, display:'flex', alignItems:'center', justifyContent:'center', color:s.color, flexShrink:0 }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize:32, fontWeight:900, color:s.color, lineHeight:1, letterSpacing:-1 }}>{s.value}</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginTop:3 }}>{s.label}</div>
              <div style={{ fontSize:11, color:'#6B7280', marginTop:2 }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ══ STAFFING STRIP ══════════════════════════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:16 }}>
        {STAFFING.map((s,i) => (
          <div key={i}
            onClick={() => navigate('/org-chart/summary')}
            style={{ ...CARD, padding:'16px 20px', border:`1px solid ${s.border}`, background:s.bg,
              cursor:'pointer', transition:'all 0.18s', display:'flex', alignItems:'center', gap:14,
              borderLeft:`4px solid ${s.color}` }}
            onMouseOver={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.10)'; e.currentTarget.style.transform='translateY(-2px)'; }}
            onMouseOut={e => { e.currentTarget.style.boxShadow=''; e.currentTarget.style.transform=''; }}
          >
            {/* Icon badge */}
            <div style={{ width:46, height:46, borderRadius:13, background:`${s.color}20`, display:'flex', alignItems:'center', justifyContent:'center', color:s.color, flexShrink:0 }}>
              {s.icon}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:28, fontWeight:900, color:s.color, lineHeight:1, letterSpacing:-1 }}>{s.value}</div>
              <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginTop:3 }}>{s.label}</div>
              {i > 0 && (
                <div style={{ fontSize:11, color:s.color, fontWeight:700, marginTop:2 }}>{s.pct}%</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ══ MIDDLE ROW ══════════════════════════════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 220px 240px', gap:10, marginBottom:16, alignItems:'start' }}>

        {/* Project Financials */}
        <div style={{ ...CARD, padding:'16px' }}>
          <SectionTitle icon={<DollarSign size={15}/>} label="Project Financials" action="Full Report"/>
          {/* Summary tiles */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:18 }}>
            {[
              {label:'Total Budget', value:'AED 850K', color:'#3B82F6', bg:'#EFF6FF', icon:<DollarSign size={16}/>},
              {label:'Total Spent',  value:'AED 581K', color:'#F59E0B', bg:'#FFFBEB', icon:<TrendingUp size={16}/>},
              {label:'Remaining',    value:'AED 269K', color:'#22C55E', bg:'#F0FDF4', icon:<BarChart3 size={16}/>},
            ].map((f,i) => (
              <div key={i} style={{ background:f.bg, borderRadius:14, padding:'14px', textAlign:'center', border:`1px solid ${f.color}20` }}>
                <div style={{ color:f.color, marginBottom:6, display:'flex', justifyContent:'center' }}>{f.icon}</div>
                <div style={{ fontSize:16, fontWeight:900, color:f.color }}>{f.value}</div>
                <div style={{ fontSize:9, color:'#6B7280', marginTop:3, fontWeight:700, textTransform:'uppercase', letterSpacing:0.6 }}>{f.label}</div>
              </div>
            ))}
          </div>
          {/* Horizontal bars */}
          <div style={{ marginBottom:16 }}>
            {[
              {label:'Total Budget',value:100,color:'#3B82F6',display:'AED 850K'},
              {label:'Spent',       value:68.4,color:'#F59E0B',display:'AED 581K'},
              {label:'Remaining',   value:31.6,color:'#22C55E',display:'AED 269K'},
            ].map((b,i) => (
              <div key={i} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                  <span style={{ color:'#374151', fontWeight:600 }}>{b.label}</span>
                  <span style={{ color:b.color, fontWeight:800 }}>{b.display}</span>
                </div>
                <div style={{ height:6, background:'#F3F4F6', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${b.value}%`, background:b.color, borderRadius:99 }}/>
                </div>
              </div>
            ))}
          </div>
          {/* Stacked bar chart */}
          <div style={{ height:140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costData} barSize={20} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                <XAxis dataKey="m" tick={{fill:'#9CA3AF',fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'#9CA3AF',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}K`}/>
                <Tooltip content={<Tip/>} formatter={(v:any)=>`AED ${v}K`}/>
                <Bar dataKey="el"  name="Electrical"      stackId="a" fill="#3B82F6"/>
                <Bar dataKey="ins" name="Instrumentation" stackId="a" fill="#8B5CF6"/>
                <Bar dataKey="ci"  name="Civil"           stackId="a" fill="#22C55E" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display:'flex', gap:16, marginTop:8, justifyContent:'center' }}>
            {[{c:'#3B82F6',l:'Electrical'},{c:'#8B5CF6',l:'Instrumentation'},{c:'#22C55E',l:'Civil'}].map((x,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:10,height:4,borderRadius:2,background:x.c }}/>
                <span style={{ fontSize:10,color:'#6B7280' }}>{x.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance Progress */}
        <div style={{ ...CARD, padding:'16px' }}>
          <SectionTitle icon={<BarChart2 size={15}/>} label="Maintenance" />
          <div style={{ textAlign:'center', marginBottom:14 }}>
            <div style={{ height:120, position:'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={MAINT} cx="50%" cy="50%" innerRadius={34} outerRadius={52} dataKey="value" paddingAngle={3}>
                    {MAINT.map((m,i)=><Cell key={i} fill={m.color}/>)}
                  </Pie>
                  <Tooltip content={<Tip/>}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center', pointerEvents:'none' }}>
                <div style={{ fontSize:20,fontWeight:900,color:'#1E293B' }}>100</div>
                <div style={{ fontSize:9,color:'#6B7280' }}>Work Orders</div>
              </div>
            </div>
          </div>
          {MAINT.map((m,i)=>(
            <div key={i} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <div style={{ width:8,height:8,borderRadius:'50%',background:m.color }}/>
                  <span style={{ fontSize:11,color:'#374151',fontWeight:600 }}>{m.label}</span>
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <span style={{ fontSize:13,fontWeight:900,color:m.color }}>{m.value}</span>
                  <span style={{ fontSize:9,color:'#9CA3AF' }}>{m.pct}%</span>
                </div>
              </div>
              <div style={{ height:5,background:'#F3F4F6',borderRadius:99,overflow:'hidden' }}>
                <div style={{ height:'100%',width:`${m.pct}%`,background:m.color,borderRadius:99 }}/>
              </div>
            </div>
          ))}
        </div>

        {/* Reminder Center */}
        <div style={{ ...CARD, padding:'16px' }}>
          <SectionTitle icon={<Bell size={15}/>} label="Reminder Center" action="All"/>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {REMINDERS.map((r,i)=>(
              <div key={i} style={{ background:r.bg, borderRadius:12, padding:'10px 12px', border:`1px solid ${r.border}`, position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:-8,right:-8,width:30,height:30,borderRadius:'50%',background:r.color,opacity:0.08 }}/>
                <div style={{ fontSize:9,fontWeight:900,color:r.color,textTransform:'uppercase',letterSpacing:1,marginBottom:5,display:'flex',alignItems:'center',gap:5 }}>
                  <div style={{ width:6,height:6,borderRadius:'50%',background:r.color }}/>{r.freq}
                </div>
                {r.items.slice(0,2).map((item,j)=>(
                  <div key={j} style={{ display:'flex',alignItems:'flex-start',gap:6,fontSize:10,color:'#374151',marginBottom:3 }}>
                    <div style={{ width:3,height:3,borderRadius:'50%',background:r.color,marginTop:4,flexShrink:0 }}/>
                    <span style={{ lineHeight:1.3 }}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ JOBS & FOLLOW-UP ════════════════════════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>

        {/* Pending Jobs */}
        <div style={{ ...CARD, padding:'16px' }}>
          <SectionTitle icon={<ClipboardList size={15}/>} label="Pending Jobs" action="View All"/>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#F8FAFC' }}>
                  {['Job ID','Equipment','Due Date','Priority','Responsible','Status'].map(h=>(
                    <th key={h} style={{ padding:'9px 10px',textAlign:'left',fontSize:9,fontWeight:800,color:'#6B7280',textTransform:'uppercase',letterSpacing:0.8,borderBottom:'2px solid #F1F5F9',whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {JOBS.map((j,i)=>(
                  <tr key={j.id} style={{ background:i%2===0?'#FAFAFA':'#FFF', transition:'background 0.15s' }}>
                    <td style={{ padding:'10px 10px',fontSize:11,fontFamily:'monospace',color:'#3B82F6',fontWeight:700,whiteSpace:'nowrap' }}>{j.id}</td>
                    <td style={{ padding:'10px 10px',fontSize:11,color:'#374151',fontWeight:600,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{j.equipment}</td>
                    <td style={{ padding:'10px 10px',fontSize:11,color:'#6B7280',whiteSpace:'nowrap' }}>{j.due}</td>
                    <td style={{ padding:'10px 10px' }}><PrioBadge p={j.priority}/></td>
                    <td style={{ padding:'10px 10px',fontSize:11,color:'#374151' }}>{j.person}</td>
                    <td style={{ padding:'10px 10px' }}><StatBadge s={j.status}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Follow-up Widget */}
        <div style={{ ...CARD, padding:'16px' }}>
          <SectionTitle icon={<RefreshCw size={15}/>} label="Follow-up Status" action="View All"/>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {FOLLOWUPS.map((f,i)=>(
              <div key={f.id} style={{ background:'#FAFAFA', borderRadius:12, padding:'12px 14px', border:'1px solid #F1F5F9', display:'flex', alignItems:'center', gap:12 }}>
                {/* Avatar */}
                <div style={{ width:38,height:38,borderRadius:'50%',background:`${f.color}20`,border:`2px solid ${f.color}40`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:13,fontWeight:900,color:f.color }}>
                  {f.owner.charAt(0)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:12,fontWeight:700,color:'#374151' }}>{f.owner}</span>
                    <span style={{ fontSize:10,color:'#9CA3AF' }}>{f.date}</span>
                  </div>
                  <div style={{ fontSize:11,color:'#6B7280',marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{f.next}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ flex:1,height:5,background:'#F3F4F6',borderRadius:99,overflow:'hidden' }}>
                      <div style={{ height:'100%',width:`${f.progress}%`,background:f.color,borderRadius:99 }}/>
                    </div>
                    <span style={{ fontSize:10,fontWeight:800,color:f.color,flexShrink:0 }}>{f.progress}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ CHARTS ROW 1 ════════════════════════════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'1.8fr 1fr 0.85fr 0.85fr', gap:10, marginBottom:14 }}>

        {/* PM Compliance Trend */}
        <div style={{ ...CARD, padding:'16px' }}>
          <SectionTitle icon={<TrendingUp size={15}/>} label="PM Compliance Trend"/>
          <div style={{ display:'flex', gap:16, marginBottom:12 }}>
            <div style={{ fontSize:28,fontWeight:900,color:'#22C55E' }}>94.2<span style={{ fontSize:14,color:'#6B7280',fontWeight:600 }}>%</span></div>
            <div style={{ display:'flex', alignItems:'center', gap:5, background:'#F0FDF4', borderRadius:8, padding:'4px 10px' }}>
              <ArrowUpRight size={13} color="#22C55E"/>
              <span style={{ fontSize:11,fontWeight:800,color:'#22C55E' }}>+3.5%</span>
            </div>
          </div>
          <div style={{ height:180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pmTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                <XAxis dataKey="m" tick={{fill:'#9CA3AF',fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis domain={[80,100]} tick={{fill:'#9CA3AF',fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<Tip/>}/>
                <Line type="monotone" dataKey="tgt" name="Target" stroke="#E5E7EB" strokeDasharray="5 5" strokeWidth={1.5} dot={false}/>
                <Line type="monotone" dataKey="pm" name="PM Compliance %" stroke="#22C55E" strokeWidth={2.5} dot={{r:3,fill:'#22C55E',strokeWidth:0}} activeDot={{r:5,fill:'#22C55E'}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown Analysis */}
        <div style={{ ...CARD, padding:'16px' }}>
          <SectionTitle icon={<AlertTriangle size={15}/>} label="Breakdown Analysis"/>
          <div style={{ height:220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bkdData} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false}/>
                <XAxis type="number" tick={{fill:'#9CA3AF',fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="cat" tick={{fill:'#374151',fontSize:10}} axisLine={false} tickLine={false} width={72}/>
                <Tooltip content={<Tip/>}/>
                <Bar dataKey="n" name="Count" radius={[0,8,8,0]}>
                  {bkdData.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Equipment Health */}
        <div style={{ ...CARD, padding:'16px' }}>
          <SectionTitle icon={<Activity size={15}/>} label="Equipment Health"/>
          <div style={{ height:140, position:'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={eqHealth} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="v" paddingAngle={3}>
                  {eqHealth.map((e,i)=><Cell key={i} fill={e.c}/>)}
                </Pie>
                <Tooltip content={<Tip/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center',pointerEvents:'none' }}>
              <div style={{ fontSize:20,fontWeight:900,color:'#22C55E' }}>68%</div>
              <div style={{ fontSize:9,color:'#6B7280' }}>Good</div>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:10 }}>
            {eqHealth.map((e,i)=>(
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', gap:7, alignItems:'center' }}>
                  <div style={{ width:8,height:8,borderRadius:'50%',background:e.c }}/>
                  <span style={{ fontSize:11,color:'#374151',fontWeight:600 }}>{e.name}</span>
                </div>
                <span style={{ fontSize:12,fontWeight:800,color:e.c }}>{e.v}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* WO Status */}
        <div style={{ ...CARD, padding:'16px' }}>
          <SectionTitle icon={<CheckCircle size={15}/>} label="Work Order Status"/>
          <div style={{ height:140, position:'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={woStatus} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="v" paddingAngle={3}>
                  {woStatus.map((w,i)=><Cell key={i} fill={w.c}/>)}
                </Pie>
                <Tooltip content={<Tip/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center',pointerEvents:'none' }}>
              <div style={{ fontSize:20,fontWeight:900,color:'#22C55E' }}>100</div>
              <div style={{ fontSize:9,color:'#6B7280' }}>Total WOs</div>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:10 }}>
            {woStatus.map((w,i)=>(
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', gap:7, alignItems:'center' }}>
                  <div style={{ width:8,height:8,borderRadius:'50%',background:w.c }}/>
                  <span style={{ fontSize:11,color:'#374151',fontWeight:600 }}>{w.name}</span>
                </div>
                <span style={{ fontSize:12,fontWeight:800,color:w.c }}>{w.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ CHARTS ROW 2 ════════════════════════════════════════════════════════ */}
      <div style={{ display:'grid', gridTemplateColumns:'1.8fr 1fr 1fr 1fr', gap:10 }}>

        {/* Monthly Maintenance Cost */}
        <div style={{ ...CARD, padding:'16px' }}>
          <SectionTitle icon={<DollarSign size={15}/>} label="Monthly Maintenance Cost (AED '000)"/>
          <div style={{ height:200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costData} barGap={1} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                <XAxis dataKey="m" tick={{fill:'#9CA3AF',fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'#9CA3AF',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}K`}/>
                <Tooltip content={<Tip/>} formatter={(v:any)=>`AED ${v}K`}/>
                <Bar dataKey="el"  name="Electrical"      stackId="a" fill="#3B82F6"/>
                <Bar dataKey="ins" name="Instrumentation" stackId="a" fill="#8B5CF6"/>
                <Bar dataKey="ci"  name="Civil"           stackId="a" fill="#22C55E" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display:'flex', gap:16, marginTop:8, justifyContent:'center' }}>
            {[{c:'#3B82F6',l:'Electrical'},{c:'#8B5CF6',l:'Instrumentation'},{c:'#22C55E',l:'Civil'}].map((x,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:12,height:4,borderRadius:2,background:x.c }}/>
                <span style={{ fontSize:10,color:'#6B7280' }}>{x.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Energy Consumption */}
        <div style={{ ...CARD, padding:'16px' }}>
          <SectionTitle icon={<Zap size={15}/>} label="Energy Consumption"/>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:26,fontWeight:900,color:'#F59E0B' }}>131K<span style={{ fontSize:12,color:'#6B7280',fontWeight:600 }}> kWh</span></div>
            <div style={{ fontSize:10,color:'#6B7280',marginTop:2 }}>Current month consumption</div>
          </div>
          <div style={{ height:155 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={energyD}>
                <defs>
                  <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.18}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                <XAxis dataKey="m" tick={{fill:'#9CA3AF',fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'#9CA3AF',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}K`}/>
                <Tooltip content={<Tip/>}/>
                <Area type="monotone" dataKey="k" name="kWh (thousands)" stroke="#F59E0B" strokeWidth={2} fill="url(#eg)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MTBF Trend */}
        <div style={{ ...CARD, padding:'16px' }}>
          <SectionTitle icon={<TrendingUp size={15}/>} label="MTBF Trend"/>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:26,fontWeight:900,color:'#3B82F6' }}>342<span style={{ fontSize:12,color:'#6B7280',fontWeight:600 }}> hrs</span></div>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <ArrowUpRight size={12} color="#22C55E"/>
              <span style={{ fontSize:10,color:'#22C55E',fontWeight:700 }}>Improving trend</span>
            </div>
          </div>
          <div style={{ height:155 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mtbfD}>
                <defs>
                  <linearGradient id="mbg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                <XAxis dataKey="m" tick={{fill:'#9CA3AF',fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis domain={[260,360]} tick={{fill:'#9CA3AF',fontSize:9}} axisLine={false} tickLine={false}/>
                <Tooltip content={<Tip/>}/>
                <Area type="monotone" dataKey="v" name="MTBF (hrs)" stroke="#3B82F6" strokeWidth={2} fill="url(#mbg)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MTTR Trend */}
        <div style={{ ...CARD, padding:'16px' }}>
          <SectionTitle icon={<TrendingDown size={15}/>} label="MTTR Trend"/>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:26,fontWeight:900,color:'#22C55E' }}>2.3<span style={{ fontSize:12,color:'#6B7280',fontWeight:600 }}> hrs</span></div>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <ArrowDownRight size={12} color="#22C55E"/>
              <span style={{ fontSize:10,color:'#22C55E',fontWeight:700 }}>Decreasing (Good)</span>
            </div>
          </div>
          <div style={{ height:155 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mttrD}>
                <defs>
                  <linearGradient id="mtrg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22C55E" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                <XAxis dataKey="m" tick={{fill:'#9CA3AF',fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis domain={[2,3.5]} tick={{fill:'#9CA3AF',fontSize:9}} axisLine={false} tickLine={false}/>
                <Tooltip content={<Tip/>}/>
                <Area type="monotone" dataKey="v" name="MTTR (hrs)" stroke="#22C55E" strokeWidth={2} fill="url(#mtrg)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════════ */}
      <div style={{ marginTop:24, textAlign:'center', fontSize:11, color:'#9CA3AF', paddingBottom:8 }}>
        E &amp; I Maintenance Management System · Glass Technology (MENA) L.L.C · Sharjah, UAE · {dateLbl}
      </div>

    </div>
  );
}
