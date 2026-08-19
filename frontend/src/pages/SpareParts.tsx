// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import {
  Package, DollarSign, Search, Download, Upload,
  Plus, Edit2, Trash2, RefreshCw, ChevronUp, ChevronDown, ChevronLeft,
  ChevronRight, X, Check, FileText, BarChart2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import * as XLSX from 'xlsx';

const API = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
const STORES = [
  'All Stores',
  'Main Store', 'E&I Store', 'IT Store', 'Other Stores',
  'Main Store - OEM Spare', 'Electrical Store - OEM Spare',
];
const STORE_COLORS: Record<string, string> = {
  'Main Store':                  '#3B82F6',
  'E&I Store':                   '#8B5CF6',
  'IT Store':                    '#22C55E',
  'Other Stores':                '#F59E0B',
  'Main Store - OEM Spare':      '#14B8A6',
  'Electrical Store - OEM Spare':'#EC4899',
};
/* OEM stores — cost included in project, shown separately as free-of-cost */
const OEM_STORES = ['Main Store - OEM Spare', 'Electrical Store - OEM Spare'];

/* Classify a spare into its effective display store:
   Main Store  + PO contains "OEM" → Main Store - OEM Spare
   E&I Store   + PO contains "OEM" → Electrical Store - OEM Spare
   Otherwise   → storeName as-is                                      */
function effectiveStore(s: any): string {
  const po = (s.poNumber || '').toLowerCase();
  if (po.includes('oem')) {
    if (s.storeName === 'Main Store') return 'Main Store - OEM Spare';
    if (s.storeName === 'E&I Store')  return 'Electrical Store - OEM Spare';
  }
  return s.storeName;
}
const CHART_COLORS = ['#3B82F6','#8B5CF6','#22C55E','#F59E0B','#EF4444','#06B6D4','#F97316','#EC4899','#10B981','#6366F1'];

const BLANK: any = {
  spareCode:'', itemName:'', category:'', area:'', storeName:'Main Store',
  unit:'Nos', currentStock:0, unitPrice:0, poNumber:'',
};

function fmt(n: number) { return (n || 0).toLocaleString('en-AE'); }
function fmtAED(n: number) {
  const v = n || 0;
  if (v >= 1000000) return `AED ${(v/1000000).toFixed(2)}M`;
  if (v >= 1000)    return `AED ${(v/1000).toFixed(1)}K`;
  return `AED ${fmt(v)}`;
}

/* ─── MAIN PAGE ─────────────────────────────────────────────────────────── */
export default function SpareParts() {
  const [spares,       setSpares]       = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeStore,  setActiveStore]  = useState('All Stores');
  const [activeTab,    setActiveTab]    = useState<'inventory'|'analytics'>('inventory');
  const [search,       setSearch]       = useState('');
  const [catFilter,    setCatFilter]    = useState('all');
  const [areaFilter,   setAreaFilter]   = useState('all');
  const [poFilter,     setPoFilter]     = useState('all');
  const [sortBy,       setSortBy]       = useState('itemName');
  const [sortDir,      setSortDir]      = useState<'asc'|'desc'>('asc');
  const [page,         setPage]         = useState(1);
  const PAGE = 15;

  const [showAdd,    setShowAdd]    = useState(false);
  const [editItem,   setEditItem]   = useState<any>(null);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importing,  setImporting]  = useState(false);
  const [importDone, setImportDone] = useState<any>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchSpares(); }, []);

  async function fetchSpares() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/spare-parts?limit=2000`);
      const d = await r.json();
      setSpares(d.items || []);
    } catch { setSpares([]); }
    setLoading(false);
  }

  /* derived — zero-stock items are hidden everywhere */
  const inStockSpares = spares.filter((s:any) => (s.currentStock || 0) > 0);
  /* effectiveStore-based tab filtering:
     "Main Store" tab → Main Store items that are NOT OEM
     "Main Store - OEM Spare" tab → Main Store items whose PO contains "OEM"
     "Electrical Store - OEM Spare" tab → E&I Store items whose PO contains "OEM" */
  const storeItems = activeStore === 'All Stores'
    ? inStockSpares
    : inStockSpares.filter((s:any) => effectiveStore(s) === activeStore);
  const categories = ['all', ...Array.from(new Set(inStockSpares.map((s:any) => s.category))).filter(Boolean)];
  const areas      = ['all', ...Array.from(new Set(inStockSpares.map((s:any) => s.area))).filter(Boolean).sort()];
  const poNumbers  = ['all', ...Array.from(new Set(inStockSpares.map((s:any) => s.poNumber))).filter(Boolean).sort()];

  const filtered = storeItems.filter((s:any) => {
    const t = search.toLowerCase();
    if (t && !s.itemName?.toLowerCase().includes(t) && !s.spareCode?.toLowerCase().includes(t)
           && !s.category?.toLowerCase().includes(t) && !s.poNumber?.toLowerCase().includes(t)
           && !s.area?.toLowerCase().includes(t)) return false;
    if (catFilter  !== 'all' && s.category !== catFilter)  return false;
    if (areaFilter !== 'all' && s.area     !== areaFilter) return false;
    if (poFilter   !== 'all' && s.poNumber !== poFilter)   return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortBy] ?? '', bv = b[sortBy] ?? '';
    if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE));
  const pageItems = sorted.slice((page - 1) * PAGE, page * PAGE);

  function kpi(arr: any[]) {
    return {
      total:      arr.length,
      stockValue: arr.reduce((s, i) => s + (i.totalValue || 0), 0),
    };
  }
  const regularSpares = inStockSpares.filter((s:any) => !OEM_STORES.includes(effectiveStore(s)));
  const overallKpi = kpi(regularSpares);
  const storeKpi   = kpi(storeItems);

  const ALL_STORE_NAMES = ['Main Store','E&I Store','IT Store','Other Stores','Main Store - OEM Spare','Electrical Store - OEM Spare'];
  const storeSummary = ALL_STORE_NAMES.map(store => {
    const items = inStockSpares.filter((s:any) => effectiveStore(s) === store);
    const isOEM = OEM_STORES.includes(store);
    return {
      store, isOEM, items: items.length,
      value: items.reduce((s, i) => s + (i.totalValue || 0), 0),
    };
  });

  function toggleSort(col: string) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
    setPage(1);
  }

  /* ─── Excel Export ─── */
  function handleExport() {
    const wb = XLSX.utils.book_new();
    const rows = spares.map((s:any) => ({
      'Spare Code':     s.spareCode,
      'Item Name':      s.itemName,
      'Category':       s.category,
      'Area':           s.area || '',
      'Store':          s.storeName,
      'Unit':           s.unit,
      'Current Stock':  s.currentStock,
      'Unit Price (AED)': s.unitPrice,
      'Total Value (AED)':s.totalValue,
      'PO Number':      s.poNumber || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Spare Parts Inventory');
    const sumRows = storeSummary.map(s => ({
      'Store Name': s.store, 'Total Items': s.items, 'Inventory Value (AED)': s.value,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sumRows), 'Store Cost Summary');
    XLSX.writeFile(wb, `SpareParts_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  function handleDownloadTemplate() {
    const wb = XLSX.utils.book_new();
    const tpl = [{
      'Spare Code':'SP-001', 'Item Name':'Example Circuit Breaker', 'Category':'Electrical',
      'Area':'Section A', 'Store':'Main Store', 'Unit':'Nos', 'Current Stock':10,
      'Unit Price':500, 'PO Number':'PO-2026-001',
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tpl), 'Import Template');
    XLSX.writeFile(wb, 'SpareParts_ImportTemplate.xlsx');
  }

  function handleImportFile(e: any) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const wb = XLSX.read(ev.target!.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      setImportRows(XLSX.utils.sheet_to_json(ws));
      setImportDone(null);
    };
    reader.readAsBinaryString(file);
  }

  async function handleImportConfirm() {
    setImporting(true);
    let added = 0, updated = 0, failed = 0;
    for (const row of importRows) {
      try {
        const currentStock = Number(row['Current Stock'] || 0);
        const unitPrice    = Number(row['Unit Price']    || 0);
        const payload = {
          spareCode:    String(row['Spare Code'] || '').trim(),
          itemName:     String(row['Item Name']  || '').trim(),
          category:     String(row['Category']   || 'General').trim(),
          area:         String(row['Area']         || '').trim(),
          storeName:    String(row['Store']       || 'Main Store').trim(),
          unit:         String(row['Unit']        || 'Nos').trim(),
          openingStock: currentStock,
          receivedQty:  0,
          issuedQty:    0,
          currentStock,
          unitPrice,
          totalValue:   currentStock * unitPrice,
          poNumber:     String(row['PO Number']   || '').trim(),
        };
        if (!payload.spareCode || !payload.itemName) { failed++; continue; }
        const existing = spares.find((s:any) => s.spareCode === payload.spareCode);
        const method = existing ? 'PUT' : 'POST';
        const url = existing ? `${API}/api/spare-parts/${existing._id}` : `${API}/api/spare-parts`;
        const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if (res.ok) { existing ? updated++ : added++; } else { failed++; }
      } catch { failed++; }
    }
    setImportDone({ added, updated, failed });
    setImporting(false);
    await fetchSpares();
  }

  async function handleSave(data: any) {
    const method = editItem ? 'PUT' : 'POST';
    const url    = editItem ? `${API}/api/spare-parts/${editItem._id}` : `${API}/api/spare-parts`;
    const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    if (!res.ok) { const d = await res.json(); alert(d.message || 'Save failed'); return; }
    setShowAdd(false); setEditItem(null);
    await fetchSpares();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this spare part?')) return;
    await fetch(`${API}/api/spare-parts/${id}`, { method: 'DELETE' });
    await fetchSpares();
  }

  /* analytics */
  const storeCostChart = storeSummary.map(s => ({ name: s.store.replace(' Store',''), value: s.value }));
  const catCostChart   = Array.from(new Set(spares.map((s:any) => s.category))).filter(Boolean).map(cat => ({
    name: String(cat), value: spares.filter((s:any) => s.category === cat).reduce((a,s) => a+(s.totalValue||0),0),
  })).sort((a,b) => b.value-a.value).slice(0,10);
  const top10Chart = [...spares].sort((a,b) => b.totalValue-a.totalValue).slice(0,10).map((s:any) => ({
    name: (s.itemName||'').slice(0,18), value: s.totalValue,
  }));

  /* ─── RENDER ─────────────────────────────────────────────────────────── */
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'linear-gradient(135deg,#3B82F6,#6366F1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Package size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:'#111827' }}>Spare Parts Inventory</div>
            <div style={{ fontSize:12, color:'#64748b' }}>{regularSpares.length} regular · {inStockSpares.length - regularSpares.length} OEM · {storeSummary.filter(s=>s.items>0).length} stores</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={handleExport} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 13px', background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8, color:'#166534', fontSize:12, cursor:'pointer', fontWeight:500 }}>
            <Download size={13}/> Export Excel
          </button>
          <button onClick={()=>{setShowImport(true);setImportRows([]);setImportDone(null);}} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 13px', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:8, color:'#1E40AF', fontSize:12, cursor:'pointer', fontWeight:500 }}>
            <Upload size={13}/> Import Excel
          </button>
          <button onClick={fetchSpares} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:8, color:'#64748b', fontSize:12, cursor:'pointer' }}>
            <RefreshCw size={13}/>
          </button>
          <button onClick={()=>{setEditItem(null);setShowAdd(true);}} style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 14px', background:'linear-gradient(135deg,#3B82F6,#6366F1)', borderRadius:8, color:'white', fontSize:12, border:'none', cursor:'pointer', fontWeight:500 }}>
            <Plus size={13}/> Add Item
          </button>
        </div>
      </div>

      {/* Overall KPI Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
        {[
          { label:'Total Items',      value:overallKpi.total,            icon:<Package size={18}/>,    color:'#3B82F6', bg:'#EFF6FF', brd:'#BFDBFE' },
          { label:'Total Stock Value',value:fmtAED(overallKpi.stockValue), icon:<DollarSign size={18}/>, color:'#22C55E', bg:'#F0FDF4', brd:'#BBF7D0' },
        ].map(c=>(
          <div key={c.label} style={{ background:c.bg, border:`1px solid ${c.brd}`, borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:8, background:c.color+'20', display:'flex', alignItems:'center', justifyContent:'center', color:c.color }}>{c.icon}</div>
            <div>
              <div style={{ fontSize:22, fontWeight:700, color:'#111827' }}>{c.value}</div>
              <div style={{ fontSize:11, color:'#64748b' }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Store Selector Tabs */}
      <div style={{ display:'flex', gap:4, background:'#F1F5F9', padding:4, borderRadius:10, width:'fit-content', flexWrap:'wrap' }}>
        {STORES.map(store=>(
          <button key={store} onClick={()=>{setActiveStore(store);setPage(1);}} style={{
            padding:'6px 16px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight:500,
            background: activeStore===store ? 'white' : 'none',
            color:      activeStore===store ? '#111827' : '#64748b',
            boxShadow:  activeStore===store ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            transition:'all 0.15s',
          }}>
            {store}
          </button>
        ))}
      </div>

      {/* Per-Store KPI strip */}
      {activeStore !== 'All Stores' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
          {[
            { label:`${activeStore} Items`, value:storeKpi.total,            color:STORE_COLORS[activeStore]||'#3B82F6' },
            { label:'Stock Value',          value:fmtAED(storeKpi.stockValue), color:'#22C55E' },
          ].map(c=>(
            <div key={c.label} style={{ background:'white', border:'1px solid #E5E7EB', borderTop:`3px solid ${c.color}`, borderRadius:10, padding:'14px 18px' }}>
              <div style={{ fontSize:22, fontWeight:700, color:'#111827' }}>{c.value}</div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Store Cost Summary Table (All Stores view) */}
      {activeStore === 'All Stores' && (
        <div style={{ background:'white', borderRadius:12, border:'1px solid #E5E7EB', overflow:'hidden' }}>
          <div style={{ padding:'12px 18px', background:'#F8FAFC', borderBottom:'1px solid #E5E7EB', fontSize:13, fontWeight:600, color:'#111827', display:'flex', alignItems:'center', gap:8 }}>
            <BarChart2 size={14} style={{ color:'#3B82F6' }}/> Store-Wise Cost Summary
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#F9FAFB' }}>
                {['Store','Total Items','Inventory Value'].map(h=>(
                  <th key={h} style={{ padding:'10px 16px', textAlign:h==='Store'?'left':'right', color:'#374151', fontWeight:600, fontSize:12, borderBottom:'1px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* ── Regular stores ── */}
              {storeSummary.filter(s=>!s.isOEM).map((s,i)=>(
                <tr key={s.store} style={{ borderBottom:'1px solid #F3F4F6', background: i%2===0?'white':'#FAFAFA' }}>
                  <td style={{ padding:'10px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:STORE_COLORS[s.store]||'#94a3b8', flexShrink:0 }}/>
                      <span style={{ color:'#374151', fontWeight:500 }}>{s.store}</span>
                    </div>
                  </td>
                  <td style={{ padding:'10px 16px', textAlign:'right', color:'#374151' }}>{s.items}</td>
                  <td style={{ padding:'10px 16px', textAlign:'right', color:'#22C55E', fontWeight:600 }}>AED {fmt(s.value)}</td>
                </tr>
              ))}
              {/* ── Subtotal regular ── */}
              <tr style={{ background:'#F0F9FF', borderTop:'2px solid #BFDBFE' }}>
                <td style={{ padding:'10px 16px', fontWeight:700, color:'#1E40AF' }}>Total (Regular Stores)</td>
                <td style={{ padding:'10px 16px', textAlign:'right', fontWeight:700, color:'#111827' }}>{overallKpi.total}</td>
                <td style={{ padding:'10px 16px', textAlign:'right', fontWeight:700, color:'#22C55E' }}>AED {fmt(overallKpi.stockValue)}</td>
              </tr>
              {/* ── OEM Spare separator ── */}
              <tr>
                <td colSpan={3} style={{ padding:'8px 16px', background:'#FFF7ED', borderTop:'2px solid #FED7AA', borderBottom:'1px solid #FED7AA' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#C2410C', textTransform:'uppercase', letterSpacing:0.5 }}>OEM Spares — Cost Included in Project (Free of Cost)</span>
                  </div>
                </td>
              </tr>
              {storeSummary.filter(s=>s.isOEM).map((s,i)=>(
                <tr key={s.store} style={{ borderBottom:'1px solid #F3F4F6', background: i%2===0?'#FFFBF5':'#FFF7ED' }}>
                  <td style={{ padding:'10px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:STORE_COLORS[s.store]||'#94a3b8', flexShrink:0 }}/>
                      <span style={{ color:'#374151', fontWeight:500 }}>{s.store}</span>
                      <span style={{ fontSize:10, padding:'1px 6px', background:'#FED7AA', borderRadius:10, color:'#C2410C', fontWeight:600 }}>OEM</span>
                    </div>
                  </td>
                  <td style={{ padding:'10px 16px', textAlign:'right', color:'#374151' }}>{s.items}</td>
                  <td style={{ padding:'10px 16px', textAlign:'right', color:'#14B8A6', fontWeight:600 }}>Free of Cost</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Main Tabs */}
      <div style={{ display:'flex', gap:4, background:'#F1F5F9', padding:4, borderRadius:10, width:'fit-content' }}>
        {[{key:'inventory',label:'Inventory'},{key:'analytics',label:'Analytics & Reports'}].map(t=>(
          <button key={t.key} onClick={()=>setActiveTab(t.key as any)} style={{
            padding:'6px 18px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight:500,
            background:activeTab===t.key?'white':'none',
            color:activeTab===t.key?'#111827':'#64748b',
            boxShadow:activeTab===t.key?'0 1px 4px rgba(0,0,0,0.1)':'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ─── INVENTORY TAB ─── */}
      {activeTab === 'inventory' && (<>
        {/* Filter bar */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ position:'relative', flex:1, minWidth:200 }}>
            <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }}/>
            <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search code, name, category, PO number..."
              style={{ width:'100%', padding:'8px 12px 8px 30px', border:'1px solid #E2E8F0', borderRadius:8, fontSize:12, outline:'none', background:'white', color:'#374151', boxSizing:'border-box' }}/>
          </div>
          <select value={catFilter} onChange={e=>{setCatFilter(e.target.value);setPage(1);}} style={{ padding:'8px 10px', border:'1px solid #E2E8F0', borderRadius:8, fontSize:12, background:'white', color:'#374151', outline:'none' }}>
            {categories.map(c=><option key={String(c)} value={String(c)}>{c==='all'?'All Categories':String(c)}</option>)}
          </select>
          <select value={areaFilter} onChange={e=>{setAreaFilter(e.target.value);setPage(1);}} style={{ padding:'8px 10px', border:'1px solid #E2E8F0', borderRadius:8, fontSize:12, background:'white', color:'#374151', outline:'none' }}>
            {areas.map(a=><option key={String(a)} value={String(a)}>{a==='all'?'All Areas':String(a)}</option>)}
          </select>
          <select value={poFilter} onChange={e=>{setPoFilter(e.target.value);setPage(1);}} style={{ padding:'8px 10px', border:'1px solid #E2E8F0', borderRadius:8, fontSize:12, background:'white', color:'#374151', outline:'none', maxWidth:160 }}>
            {poNumbers.map(p=><option key={String(p)} value={String(p)}>{p==='all'?'All PO Numbers':String(p)}</option>)}
          </select>
          <span style={{ fontSize:12, color:'#64748b' }}>{filtered.length} item{filtered.length!==1?'s':''}</span>
        </div>

        {/* Table */}
        <div style={{ background:'white', borderRadius:12, border:'1px solid #E5E7EB', overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:800, tableLayout:'fixed' }}>
            <colgroup>
              <col style={{ width:88 }}/>   {/* Spare Code */}
              <col style={{ width:'28%' }}/> {/* Item Name */}
              <col style={{ width:90 }}/>   {/* Category */}
              <col style={{ width:82 }}/>   {/* Area */}
              <col style={{ width:70 }}/>   {/* Store */}
              <col style={{ width:50 }}/>   {/* Unit */}
              <col style={{ width:88 }}/>   {/* Current Stock */}
              <col style={{ width:72 }}/>   {/* Unit Price */}
              <col style={{ width:82 }}/>   {/* Total Value */}
              <col style={{ width:118 }}/>  {/* PO Number */}
              <col style={{ width:70 }}/>   {/* Actions */}
            </colgroup>
            <thead>
              <tr style={{ background:'#F9FAFB', borderBottom:'1px solid #E5E7EB' }}>
                {[
                  {key:'spareCode',    label:'Spare Code',    align:'left'},
                  {key:'itemName',     label:'Item Name',     align:'left'},
                  {key:'category',     label:'Category',      align:'left'},
                  {key:'area',         label:'Area',          align:'left'},
                  {key:'storeName',    label:'Store',         align:'left'},
                  {key:'unit',         label:'Unit',          align:'left'},
                  {key:'currentStock', label:'Current Stock', align:'center'},
                  {key:'unitPrice',    label:'Unit Price',    align:'center'},
                  {key:'totalValue',   label:'Total Value',   align:'right'},
                  {key:'poNumber',     label:'PO Number',     align:'left'},
                  {key:null,           label:'Actions',       align:'left'},
                ].map(h=>(
                  <th key={h.label} onClick={()=>h.key&&toggleSort(h.key)} style={{ padding:'10px 12px', textAlign:h.align as any, color:'#374151', fontWeight:600, fontSize:11, whiteSpace:'nowrap', cursor:h.key?'pointer':'default', userSelect:'none', overflow:'hidden' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', justifyContent: h.align==='center'?'center':'flex-start', gap:3 }}>
                      {h.label}
                      {h.key && sortBy===h.key && (sortDir==='asc'?<ChevronUp size={11}/>:<ChevronDown size={11}/>)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Loading inventory...</td></tr>
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={11} style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>No items found</td></tr>
              ) : pageItems.map((s:any, i:number)=>(
                <tr key={s._id} style={{ borderBottom:'1px solid #F3F4F6', background:i%2===0?'white':'#FAFAFA' }}>
                  <td style={{ padding:'9px 12px', color:'#3B82F6', fontFamily:'monospace', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.spareCode}</td>
                  <td style={{ padding:'9px 12px', color:'#111827', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.itemName}</td>
                  <td style={{ padding:'9px 12px', overflow:'hidden' }}><span style={{ padding:'2px 7px', background:'#F1F5F9', borderRadius:20, color:'#374151', fontSize:10 }}>{s.category}</span></td>
                  <td style={{ padding:'9px 12px', color:'#374151', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.area || '—'}</td>
                  <td style={{ padding:'9px 12px', overflow:'hidden' }}>
                    <span style={{ padding:'2px 7px', background:(STORE_COLORS[s.storeName]||'#94a3b8')+'20', borderRadius:20, color:STORE_COLORS[s.storeName]||'#64748b', fontSize:10, fontWeight:600 }}>
                      {(s.storeName||'').replace(' Store','')}
                    </span>
                  </td>
                  <td style={{ padding:'9px 12px', color:'#64748b', textAlign:'center' }}>{s.unit}</td>
                  <td style={{ padding:'9px 12px', textAlign:'center' }}>
                    <span style={{ fontWeight:700, fontSize:14, color:'#22C55E' }}>{s.currentStock||0}</span>
                  </td>
                  <td style={{ padding:'9px 12px', textAlign:'center', color:'#374151' }}>AED {fmt(s.unitPrice)}</td>
                  <td style={{ padding:'9px 12px', textAlign:'right', color:'#22C55E', fontWeight:600 }}>AED {fmt(s.totalValue)}</td>
                  <td style={{ padding:'9px 12px', color:'#6366F1', fontFamily:'monospace', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.poNumber || '—'}</td>
                  <td style={{ padding:'9px 12px' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={()=>{setEditItem(s);setShowAdd(true);}} style={{ padding:'4px 8px', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:6, color:'#3B82F6', cursor:'pointer', display:'flex', alignItems:'center' }}><Edit2 size={11}/></button>
                      <button onClick={()=>handleDelete(s._id)} style={{ padding:'4px 8px', background:'#FFF5F5', border:'1px solid #FECACA', borderRadius:6, color:'#EF4444', cursor:'pointer', display:'flex', alignItems:'center' }}><Trash2 size={11}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ padding:'6px 10px', border:'1px solid #E2E8F0', borderRadius:6, background:'white', color:page===1?'#CBD5E1':'#374151', cursor:page===1?'not-allowed':'pointer' }}>
              <ChevronLeft size={14}/>
            </button>
            {Array.from({length:Math.min(7,pageCount)},(_,i)=>{
              let p = i+1;
              if (pageCount>7) {
                if (page<=4) p=i+1;
                else if (page>=pageCount-3) p=pageCount-6+i;
                else p=page-3+i;
              }
              return (
                <button key={p} onClick={()=>setPage(p)} style={{ width:30, height:30, border:'1px solid #E2E8F0', borderRadius:6, background:p===page?'#3B82F6':'white', color:p===page?'white':'#374151', cursor:'pointer', fontSize:12 }}>{p}</button>
              );
            })}
            <button onClick={()=>setPage(p=>Math.min(pageCount,p+1))} disabled={page===pageCount} style={{ padding:'6px 10px', border:'1px solid #E2E8F0', borderRadius:6, background:'white', color:page===pageCount?'#CBD5E1':'#374151', cursor:page===pageCount?'not-allowed':'pointer' }}>
              <ChevronRight size={14}/>
            </button>
            <span style={{ fontSize:12, color:'#64748b' }}>Page {page} of {pageCount}</span>
          </div>
        )}
      </>)}

      {/* ─── ANALYTICS TAB ─── */}
      {activeTab === 'analytics' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ background:'white', borderRadius:12, border:'1px solid #E5E7EB', padding:20 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:16 }}>Inventory Value by Store</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={storeCostChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
                <XAxis dataKey="name" tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false} tickFormatter={(v:any)=>`AED ${(v/1000).toFixed(0)}K`}/>
                <Tooltip formatter={(v:any)=>[`AED ${Number(v).toLocaleString('en-AE')}`, 'Value']} contentStyle={{background:'white',border:'1px solid #E5E7EB',borderRadius:8,fontSize:12}}/>
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  {storeCostChart.map((_,idx)=><Cell key={idx} fill={Object.values(STORE_COLORS)[idx]||'#3B82F6'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background:'white', borderRadius:12, border:'1px solid #E5E7EB', padding:20 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:16 }}>Value by Category (Top 10)</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={catCostChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
                <XAxis type="number" tick={{fontSize:10,fill:'#64748b'}} axisLine={false} tickLine={false} tickFormatter={(v:any)=>`AED ${(v/1000).toFixed(0)}K`}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:'#374151'}} axisLine={false} tickLine={false} width={80}/>
                <Tooltip formatter={(v:any)=>[`AED ${Number(v).toLocaleString('en-AE')}`, 'Value']} contentStyle={{background:'white',border:'1px solid #E5E7EB',borderRadius:8,fontSize:12}}/>
                <Bar dataKey="value" radius={[0,4,4,0]}>
                  {catCostChart.map((_,idx)=><Cell key={idx} fill={CHART_COLORS[idx%CHART_COLORS.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background:'white', borderRadius:12, border:'1px solid #E5E7EB', padding:20, gridColumn:'1/-1' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:16 }}>Top 10 High Value Spare Parts</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={top10Chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
                <XAxis dataKey="name" tick={{fontSize:10,fill:'#64748b'}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false} tickFormatter={(v:any)=>`AED ${(v/1000).toFixed(0)}K`}/>
                <Tooltip formatter={(v:any)=>[`AED ${Number(v).toLocaleString('en-AE')}`, 'Total Value']} contentStyle={{background:'white',border:'1px solid #E5E7EB',borderRadius:8,fontSize:12}}/>
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  {top10Chart.map((_,idx)=><Cell key={idx} fill={CHART_COLORS[idx%CHART_COLORS.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Store Cost Report with export */}
          <div style={{ background:'white', borderRadius:12, border:'1px solid #E5E7EB', padding:20, gridColumn:'1/-1' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              <FileText size={14} style={{color:'#3B82F6'}}/> Store-Wise Cost Report
              <button onClick={()=>{
                const wb=XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(storeSummary.map(s=>({'Store':s.store,'Items':s.items,'Value (AED)':s.value}))),'Store Cost Summary');
                XLSX.writeFile(wb,`StoreCostSummary_${new Date().toISOString().slice(0,10)}.xlsx`);
              }} style={{ marginLeft:'auto', padding:'4px 10px', background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:6, color:'#166534', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                <Download size={11}/> Export
              </button>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'#F9FAFB' }}>
                  {['Store','Items','Inventory Value','% of Total'].map(h=>(
                    <th key={h} style={{ padding:'8px 12px', textAlign:h==='Store'?'left':'right', color:'#374151', fontWeight:600, fontSize:11, borderBottom:'1px solid #E5E7EB' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {storeSummary.map((s,i)=>{
                  const pct = overallKpi.stockValue>0 ? ((s.value/overallKpi.stockValue)*100).toFixed(1) : '0.0';
                  return (
                    <tr key={s.store} style={{ borderBottom:'1px solid #F3F4F6', background:i%2===0?'white':'#FAFAFA' }}>
                      <td style={{ padding:'9px 12px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:10, height:10, borderRadius:2, background:STORE_COLORS[s.store]||'#94a3b8' }}/>
                          <span style={{ color:'#374151', fontWeight:500 }}>{s.store}</span>
                        </div>
                      </td>
                      <td style={{ padding:'9px 12px', textAlign:'right', color:'#374151' }}>{s.items}</td>
                      <td style={{ padding:'9px 12px', textAlign:'right', color:'#22C55E', fontWeight:600 }}>AED {fmt(s.value)}</td>
                      <td style={{ padding:'9px 12px', textAlign:'right' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8 }}>
                          <div style={{ width:60, height:6, background:'#F1F5F9', borderRadius:3, overflow:'hidden' }}>
                            <div style={{ width:`${pct}%`, height:'100%', background:STORE_COLORS[s.store]||'#3B82F6', borderRadius:3 }}/>
                          </div>
                          <span style={{ color:'#64748b', fontSize:11, minWidth:36 }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background:'#F0F9FF', borderTop:'2px solid #BFDBFE' }}>
                  <td style={{ padding:'9px 12px', fontWeight:700, color:'#1E40AF' }}>Total</td>
                  <td style={{ padding:'9px 12px', textAlign:'right', fontWeight:700, color:'#111827' }}>{overallKpi.total}</td>
                  <td style={{ padding:'9px 12px', textAlign:'right', fontWeight:700, color:'#22C55E' }}>AED {fmt(overallKpi.stockValue)}</td>
                  <td style={{ padding:'9px 12px', textAlign:'right', color:'#64748b', fontSize:11 }}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAdd && <AddEditModal item={editItem} onSave={handleSave} onClose={()=>{setShowAdd(false);setEditItem(null);}}/>}

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          importRows={importRows} importing={importing} importDone={importDone}
          onFileSelect={handleImportFile} onConfirm={handleImportConfirm}
          onDownloadTemplate={handleDownloadTemplate}
          onClose={()=>{setShowImport(false);setImportRows([]);setImportDone(null);if(importRef.current)importRef.current.value='';}}
          importRef={importRef}
        />
      )}
    </div>
  );
}

/* ─── ADD / EDIT MODAL ──────────────────────────────────────────────────── */
function AddEditModal({ item, onSave, onClose }: any) {
  const [form, setForm] = useState<any>({ ...BLANK, ...(item || {}) });

  function set(k: string, v: any) {
    setForm((f: any) => {
      const next  = { ...f, [k]: v };
      const stock = Number(k==='currentStock' ? v : f.currentStock) || 0;
      const price = Number(k==='unitPrice'    ? v : f.unitPrice)    || 0;
      next.totalValue = stock * price;
      return next;
    });
  }

  function submit(e: any) {
    e.preventDefault();
    if (!form.spareCode?.trim()) return alert('Spare Code is required');
    if (!form.itemName?.trim())  return alert('Item Name is required');
    onSave({ ...form, openingStock: form.currentStock, receivedQty: 0, issuedQty: 0 });
  }

  const fieldStyle = { width:'100%', padding:'8px 10px', border:'1px solid #E2E8F0', borderRadius:8, fontSize:12, outline:'none', background:'white', color:'#374151', boxSizing:'border-box' as const };
  const labelStyle = { fontSize:12, color:'#374151', display:'block', marginBottom:5, fontWeight:500 as const };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20, overflowY:'auto' }}>
      <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:680, boxShadow:'0 20px 60px rgba(0,0,0,0.15)', maxHeight:'92vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid #E5E7EB', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#111827' }}>{item ? 'Edit Spare Part' : 'Add New Spare Part'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748b', padding:4 }}><X size={18}/></button>
        </div>
        <form onSubmit={submit} style={{ overflow:'auto', flex:1 }}>
          <div style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>

            <div>
              <label style={labelStyle}>Spare Code <span style={{color:'#EF4444'}}>*</span></label>
              <input value={form.spareCode||''} onChange={e=>set('spareCode',e.target.value)} placeholder="e.g. SP-E-001" style={fieldStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Item Name <span style={{color:'#EF4444'}}>*</span></label>
              <input value={form.itemName||''} onChange={e=>set('itemName',e.target.value)} placeholder="Spare part name" style={fieldStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <input value={form.category||''} onChange={e=>set('category',e.target.value)} placeholder="e.g. Electrical, Mechanical..." style={fieldStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Area</label>
              <input value={form.area||''} onChange={e=>set('area',e.target.value)} placeholder="e.g. Section A, Plant 1..." style={fieldStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Store Name</label>
              <select value={form.storeName||'Main Store'} onChange={e=>set('storeName',e.target.value)} style={fieldStyle}>
                {['Main Store','E&I Store','IT Store','Other Stores'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <div style={{ fontSize:10, color:'#6366F1', marginTop:4 }}>
                To mark as OEM Spare, select the store and enter "OEM Spare" in the PO Number field.
              </div>
            </div>
            <div>
              <label style={labelStyle}>Unit</label>
              <input value={form.unit||''} onChange={e=>set('unit',e.target.value)} placeholder="Nos / Set / Kg / Mtr..." style={fieldStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Current Stock</label>
              <input type="number" min="0" value={form.currentStock||0} onChange={e=>set('currentStock',Number(e.target.value))} style={fieldStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Unit Price (AED)</label>
              <input type="number" min="0" value={form.unitPrice||0} onChange={e=>set('unitPrice',Number(e.target.value))} style={fieldStyle}/>
            </div>
            <div>
              <label style={labelStyle}>PO Number</label>
              <input value={form.poNumber||''} onChange={e=>set('poNumber',e.target.value)} placeholder="e.g. PO-2026-001" style={fieldStyle}/>
            </div>

            <div style={{ gridColumn:'1/-1' }}>
              <label style={labelStyle}>Total Inventory Value (AED) <span style={{color:'#22C55E',fontSize:10}}>(auto = Current Stock × Unit Price)</span></label>
              <input value={`AED ${fmt(form.totalValue||0)}`} readOnly style={{...fieldStyle, background:'#F0FDF4', color:'#22C55E', fontWeight:700, fontSize:14}}/>
            </div>

          </div>
          <div style={{ padding:'16px 24px', borderTop:'1px solid #E5E7EB', display:'flex', gap:10, justifyContent:'flex-end', flexShrink:0 }}>
            <button type="button" onClick={onClose} style={{ padding:'9px 20px', background:'#F1F5F9', border:'1px solid #E2E8F0', borderRadius:8, color:'#374151', fontSize:13, cursor:'pointer' }}>Cancel</button>
            <button type="submit" style={{ padding:'9px 24px', background:'linear-gradient(135deg,#3B82F6,#6366F1)', borderRadius:8, color:'white', fontSize:13, border:'none', cursor:'pointer', fontWeight:600 }}>
              {item ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── IMPORT MODAL ──────────────────────────────────────────────────────── */
function ImportModal({ importRows, importing, importDone, onFileSelect, onConfirm, onDownloadTemplate, onClose, importRef }: any) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20, overflowY:'auto' }}>
      <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:820, boxShadow:'0 20px 60px rgba(0,0,0,0.15)', maxHeight:'92vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid #E5E7EB', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#111827' }}>Import Spare Parts from Excel</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748b', padding:4 }}><X size={18}/></button>
        </div>

        <div style={{ padding:'20px 24px', overflow:'auto', flex:1, display:'flex', flexDirection:'column', gap:16 }}>
          {/* Step 1 */}
          <div style={{ padding:14, background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#1E40AF', marginBottom:6 }}>Step 1 — Download Template</div>
            <div style={{ fontSize:12, color:'#374151', marginBottom:10 }}>
              Download the Excel template, fill your data. <strong>Matching Spare Codes</strong> will be updated; new codes will be added as new items.
            </div>
            <button onClick={onDownloadTemplate} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', background:'white', border:'1px solid #BFDBFE', borderRadius:8, color:'#1E40AF', fontSize:12, cursor:'pointer', fontWeight:500 }}>
              <Download size={13}/> Download Template (.xlsx)
            </button>
          </div>

          {/* Step 2 */}
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:'#374151', marginBottom:8 }}>Step 2 — Upload Filled Excel File</div>
            <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
              <input ref={importRef} type="file" accept=".xlsx,.xls" onChange={onFileSelect} style={{ display:'none' }}/>
              <button onClick={()=>importRef.current?.click()} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'10px 18px', background:'#F8FAFC', border:'2px dashed #CBD5E1', borderRadius:8, color:'#374151', fontSize:12, cursor:'pointer' }}>
                <Upload size={14}/> Choose Excel File
              </button>
              {importRows.length > 0 && (
                <span style={{ fontSize:12, color:'#22C55E', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                  <Check size={14}/> {importRows.length} rows loaded
                </span>
              )}
            </div>
          </div>

          {/* Preview */}
          {importRows.length > 0 && !importDone && (
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:'#374151', marginBottom:8 }}>
                Preview — {Math.min(10, importRows.length)} of {importRows.length} rows
              </div>
              <div style={{ overflow:'auto', borderRadius:8, border:'1px solid #E5E7EB' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                  <thead>
                    <tr style={{ background:'#F9FAFB' }}>
                      {['Spare Code','Item Name','Category','Area','Store','Unit','Current Stock','Unit Price','PO Number'].map(h=>(
                        <th key={h} style={{ padding:'8px 10px', textAlign:'left', color:'#374151', fontWeight:600, borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0,10).map((r:any,i:number)=>(
                      <tr key={i} style={{ borderBottom:'1px solid #F3F4F6', background:i%2===0?'white':'#FAFAFA' }}>
                        <td style={{ padding:'7px 10px', color:'#3B82F6', fontFamily:'monospace', fontWeight:600 }}>{String(r['Spare Code']||'—')}</td>
                        <td style={{ padding:'7px 10px', color:'#111827' }}>{String(r['Item Name']||'—')}</td>
                        <td style={{ padding:'7px 10px', color:'#64748b' }}>{String(r['Category']||'—')}</td>
                        <td style={{ padding:'7px 10px', color:'#64748b' }}>{String(r['Area']||'—')}</td>
                        <td style={{ padding:'7px 10px', color:'#64748b' }}>{String(r['Store']||'—')}</td>
                        <td style={{ padding:'7px 10px', color:'#64748b' }}>{String(r['Unit']||'—')}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right', color:'#374151' }}>{r['Current Stock']??'—'}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right', color:'#374151' }}>AED {r['Unit Price']??'—'}</td>
                        <td style={{ padding:'7px 10px', color:'#6366F1', fontFamily:'monospace' }}>{String(r['PO Number']||'—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Done */}
          {importDone && (
            <div style={{ padding:16, background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#166534', marginBottom:12 }}>Import Complete!</div>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                {[
                  { label:'New Items Added', value:importDone.added,   color:'#22C55E', bg:'#F0FDF4', brd:'#BBF7D0' },
                  { label:'Items Updated',   value:importDone.updated, color:'#3B82F6', bg:'#EFF6FF', brd:'#BFDBFE' },
                  { label:'Failed / Skipped',value:importDone.failed,  color:'#EF4444', bg:'#FFF5F5', brd:'#FECACA' },
                ].map(c=>(
                  <div key={c.label} style={{ textAlign:'center', padding:'12px 24px', background:c.bg, borderRadius:10, border:`1px solid ${c.brd}` }}>
                    <div style={{ fontSize:26, fontWeight:700, color:c.color }}>{c.value}</div>
                    <div style={{ fontSize:11, color:'#64748b' }}>{c.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding:'16px 24px', borderTop:'1px solid #E5E7EB', display:'flex', gap:10, justifyContent:'flex-end', flexShrink:0 }}>
          <button onClick={onClose} style={{ padding:'9px 20px', background:'#F1F5F9', border:'1px solid #E2E8F0', borderRadius:8, color:'#374151', fontSize:13, cursor:'pointer' }}>
            {importDone ? 'Close' : 'Cancel'}
          </button>
          {importRows.length > 0 && !importDone && (
            <button onClick={onConfirm} disabled={importing} style={{ padding:'9px 24px', background:'linear-gradient(135deg,#22C55E,#16A34A)', borderRadius:8, color:'white', fontSize:13, border:'none', cursor:importing?'not-allowed':'pointer', fontWeight:600, opacity:importing?0.7:1 }}>
              {importing ? `Importing ${importRows.length} rows...` : `Import ${importRows.length} Rows`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
