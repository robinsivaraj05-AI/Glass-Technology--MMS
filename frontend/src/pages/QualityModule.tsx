// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { FileText, ClipboardCheck, AlertTriangle, CalendarClock, Search, Upload, Download, Plus, RefreshCw, CheckCircle2, Clock3, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const standards = ['ISO 9001:2026', 'ISO 14001:2026', 'ISO 45001:2018 + Amd 1:2024'];
const departments = ['E&I','Mechanical','Production','Quality','HSE','Purchase','Store','HR','Utilities','Admin'];
const inputStyle = { width:'100%', padding:'9px 10px', border:'1px solid #dbe2ea', borderRadius:7, fontSize:12, color:'#1e293b', background:'#fff', boxSizing:'border-box' as const };
const labelStyle = { display:'block', fontSize:11, fontWeight:700, color:'#475569', marginBottom:5 };
const buttonStyle = { border:0, borderRadius:7, padding:'9px 13px', fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 };
const dateText = (v) => v ? new Date(v).toLocaleDateString('en-AE',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const dueState = (d) => !d ? 'Not set' : (new Date(d).getTime() < new Date().setHours(0,0,0,0) ? 'Overdue' : (new Date(d).getTime() < Date.now()+30*86400000 ? 'Due soon' : 'Current'));

export default function QualityModule() {
  const [tab,setTab] = useState('documents');
  const [documents,setDocuments] = useState([]);
  const [audits,setAudits] = useState([]);
  const [capas,setCapas] = useState([]);
  const [summary,setSummary] = useState({documents:0,audits:0,openCapas:0,dueDocuments:0,overdueCapas:0});
  const [loading,setLoading] = useState(true);
  const [search,setSearch] = useState('');
  const [showForm,setShowForm] = useState(false);
  const [saving,setSaving] = useState(false);
  const [form,setForm] = useState({});
  const [historyData,setHistoryData] = useState(null);
  const [editingRecord,setEditingRecord] = useState(null);
  const { user } = useAuth();
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const load = async () => {
    setLoading(true);
    try {
      const [d,a,c,s] = await Promise.all([
        apiFetch('/api/quality/documents'), apiFetch('/api/quality/audits'),
        apiFetch('/api/quality/capas'), apiFetch('/api/quality/summary')
      ]);
      setDocuments(d.records||[]); setAudits(a.records||[]); setCapas(c.records||[]); setSummary(s);
    } catch(e) { toast.error(e.message||'Unable to load Quality Module records'); }
    finally { setLoading(false); }
  };
  useEffect(()=>{load();},[]);

  const active = tab==='documents'?documents:tab==='audits'?audits:capas;
  const filtered = useMemo(()=>active.filter(r=>[r.recordNo,r.title,r.department,r.standard,r.owner,r.responsible,r.equipment].join(' ').toLowerCase().includes(search.toLowerCase())),[active,search]);
  const openNew = () => { setEditingRecord(null); setForm({department:'E&I',standard:standards[0],revision:'00',documentType:'SOP',status:'Draft',auditType:'Internal',findingType:tab==='capas'?'Minor NC':'Observation',targetDate:'',issueDate:'',reviewDate:'',auditDate:''}); setShowForm(true); };
  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if(editingRecord) {
        await apiFetch('/api/quality/records/'+editingRecord._id,{method:'PATCH',body:JSON.stringify(form)});
      } else if(tab==='documents') {
        const body = new FormData();
        Object.entries(form).forEach(([k,v])=>{ if(k!=='file' && v!==undefined && v!==null) body.append(k, String(v)); });
        if(form.file) body.append('file',form.file);
        await apiFetch('/api/quality/documents',{method:'POST',body});
      } else {
        const endpoint = tab==='audits'?'/api/quality/audits':'/api/quality/capas';
        await apiFetch(endpoint,{method:'POST',body:JSON.stringify(form)});
      }
      toast.success('Record saved successfully'); setShowForm(false); await load();
    } catch(e) { toast.error(e.message||'Save failed'); }
    finally { setSaving(false); }
  };
  const updateStatus = async (r,status) => {
    try { await apiFetch('/api/quality/records/'+r._id,{method:'PATCH',body:JSON.stringify({status,...(status==='Closed'?{closureDate:new Date().toISOString()}: {})})}); toast.success('Status updated'); await load(); }
    catch(e) { toast.error(e.message||'Update failed'); }
  };
  const openFile = async (r) => {
    try {
      const token = sessionStorage.getItem('mms_token');
      const response = await fetch('/api/quality/documents/'+r._id+'/file', { headers: token && !token.startsWith('demo-jwt-token-') ? { Authorization: 'Bearer '+token } : {} });
      if (!response.ok) throw new Error('Unable to retrieve document file.');
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(()=>URL.revokeObjectURL(url),60000);
    } catch(e) { toast.error(e.message || 'File open failed'); }
  };
  const workflowAction = async (r, action) => {
    const comments = window.prompt(action==='reject'?'Reason for rejection (mandatory):':'Comments (optional):', '');
    if (action==='reject' && !comments?.trim()) return;
    if (comments===null) return;
    try {
      await apiFetch('/api/quality/documents/'+r._id+'/'+action,{method:'POST',body:JSON.stringify({comments})});
      toast.success('Document workflow updated'); await load();
    } catch(e) { toast.error(e.message || 'Workflow action failed'); }
  };
  const createRevision = async (r) => {
    const revision = window.prompt('Enter new revision number (e.g. 01):');
    if (!revision?.trim()) return;
    const changeSummary = window.prompt('Describe the changes in this revision:');
    if (!changeSummary?.trim()) return;
    const picker = document.createElement('input'); picker.type='file'; picker.accept='.pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp';
    picker.onchange = async () => {
      const file = picker.files?.[0]; if (!file) return;
      const body = new FormData(); body.append('revision',revision.trim()); body.append('changeSummary',changeSummary.trim()); body.append('file',file);
      try { await apiFetch('/api/quality/documents/'+r._id+'/revisions',{method:'POST',body}); toast.success('New draft revision created; submit it for review.'); await load(); }
      catch(e) { toast.error(e.message || 'Revision creation failed'); }
    };
    picker.click();
  };
  const viewHistory = async (r) => {
    try { const data=await apiFetch('/api/quality/documents/'+r._id+'/history'); setHistoryData({record:r, ...data}); }
    catch(e) { toast.error(e.message || 'Unable to load document history'); }
  };

  const tabs = [
    {id:'documents',label:'Document Register',icon:FileText,count:documents.length},
    {id:'audits',label:'Audit Register',icon:ClipboardCheck,count:audits.length},
    {id:'capas',label:'NCR & CAPA',icon:AlertTriangle,count:capas.length},
  ];
  const stats = [
    {label:'Controlled documents',value:summary.documents,icon:FolderOpen,color:'#2563eb'},
    {label:'Audit records',value:summary.audits,icon:ClipboardCheck,color:'#0891b2'},
    {label:'Open NCR / CAPA',value:summary.openCapas,icon:AlertTriangle,color:'#d97706'},
    {label:'Review / action overdue',value:summary.dueDocuments+summary.overdueCapas,icon:CalendarClock,color:'#dc2626'},
  ];

  return <div style={{maxWidth:1500,margin:'0 auto',color:'#1e293b'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap',marginBottom:18}}>
      <div><div style={{fontSize:11,color:'#64748b',marginBottom:4}}>ISO &amp; AUDIT / QUALITY MANAGEMENT</div><h1 style={{fontSize:22,margin:0,fontWeight:800}}>Quality &amp; Audit Management</h1><p style={{fontSize:12,color:'#64748b',margin:'6px 0 0'}}>Controlled documents, audit findings, NCR and corrective-action tracking.</p></div>
      <div style={{display:'flex',gap:8}}><button onClick={load} style={{...buttonStyle,background:'#fff',border:'1px solid #dbe2ea',color:'#334155'}}><RefreshCw size={14}/> Refresh</button><button onClick={openNew} style={{...buttonStyle,background:'#2563eb',color:'#fff'}}><Plus size={14}/> Add {tab==='documents'?'Document':tab==='audits'?'Audit':'NCR / CAPA'}</button></div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12,marginBottom:18}}>
      {stats.map(s=><div key={s.label} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,padding:15,display:'flex',alignItems:'center',gap:12}}><div style={{width:38,height:38,borderRadius:9,background:s.color+'14',color:s.color,display:'grid',placeItems:'center'}}><s.icon size={19}/></div><div><div style={{fontSize:11,color:'#64748b'}}>{s.label}</div><div style={{fontSize:23,fontWeight:800}}>{s.value}</div></div></div>)}
    </div>
    <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,overflow:'hidden'}}>
      <div style={{display:'flex',gap:4,padding:'10px 12px',borderBottom:'1px solid #e2e8f0',flexWrap:'wrap'}}>
        {tabs.map(t=><button key={t.id} onClick={()=>{setTab(t.id);setSearch('');setShowForm(false);}} style={{...buttonStyle,background:tab===t.id?'#eff6ff':'transparent',color:tab===t.id?'#1d4ed8':'#64748b'}}><t.icon size={14}/>{t.label}<span style={{background:tab===t.id?'#dbeafe':'#f1f5f9',padding:'2px 6px',borderRadius:10,fontSize:10}}>{t.count}</span></button>)}
        <div style={{marginLeft:'auto',position:'relative',minWidth:210,flex:'0 1 280px'}}><Search size={14} style={{position:'absolute',left:10,top:10,color:'#94a3b8'}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search number, title, department..." style={{...inputStyle,paddingLeft:30}}/></div>
      </div>
      {historyData&&<div style={{padding:16,borderBottom:'1px solid #e2e8f0',background:'#f8fafc'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><strong style={{fontSize:13}}>Document history – {historyData.record.recordNo}</strong><button onClick={()=>setHistoryData(null)} style={{...buttonStyle,background:'#e2e8f0',color:'#334155'}}>Close</button></div>
        <div style={{fontSize:12,marginBottom:8}}>Current revision: <b>{historyData.current.revision}</b> · Status: <b>{historyData.current.status}</b></div>
        <div style={{fontWeight:700,fontSize:11,marginBottom:5}}>Approval activity</div>
        {(historyData.current.approvalHistory||[]).slice().reverse().map((h,i)=><div key={i} style={{padding:'7px 0',borderTop:'1px solid #e2e8f0',fontSize:11}}><b>{h.action}</b> – {h.actorName} ({h.actorRole}) · {dateText(h.at)}<div style={{color:'#64748b'}}>{h.comments||'No comments'} · Rev {h.revision}</div></div>)}
        <div style={{fontWeight:700,fontSize:11,margin:'10px 0 5px'}}>Archived revisions</div>
        {(historyData.revisions||[]).length===0?<div style={{fontSize:11,color:'#64748b'}}>No archived revisions yet.</div>:(historyData.revisions||[]).map((v,i)=><div key={i} style={{padding:'7px 0',borderTop:'1px solid #e2e8f0',fontSize:11}}>Revision <b>{v.revision}</b> · Archived {dateText(v.archivedAt)} by {v.archivedBy}<div style={{color:'#64748b'}}>{v.changeSummary}</div></div>)}
      </div>}
      {showForm&&<form onSubmit={save} style={{padding:16,background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
        <div style={{fontWeight:800,fontSize:14,marginBottom:12}}>{editingRecord?'Edit':'New'} {tab==='documents'?'controlled document':tab==='audits'?'audit record':'NCR / CAPA record'}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>
          <div><label style={labelStyle}>Record / Document No. *</label><input required value={form.recordNo||''} onChange={e=>set('recordNo',e.target.value)} placeholder={tab==='documents'?'GT-EI-SOP-001':'GT-QA-2026-001'} style={inputStyle}/></div>
          <div><label style={labelStyle}>Title *</label><input required value={form.title||''} onChange={e=>set('title',e.target.value)} style={inputStyle}/></div>
          <div><label style={labelStyle}>Department</label><select value={form.department||'E&I'} onChange={e=>set('department',e.target.value)} style={inputStyle}>{departments.map(x=><option key={x}>{x}</option>)}</select></div>
          <div><label style={labelStyle}>ISO Standard</label><select value={form.standard||standards[0]} onChange={e=>set('standard',e.target.value)} style={inputStyle}>{standards.map(x=><option key={x}>{x}</option>)}</select></div>
          {tab==='documents'?<>
            <div><label style={labelStyle}>Document Type</label><select value={form.documentType||'SOP'} onChange={e=>set('documentType',e.target.value)} style={inputStyle}>{['Policy','Manual','Procedure','SOP','Work Instruction','Form','Checklist','Record','Drawing','OEM Manual','Certificate'].map(x=><option key={x}>{x}</option>)}</select></div>
            <div><label style={labelStyle}>Revision</label><input value={form.revision||'00'} onChange={e=>set('revision',e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Clause references (comma separated)</label><input value={form.clauses||''} onChange={e=>set('clauses',e.target.value)} placeholder="e.g. 7.5, 8.1" style={inputStyle}/></div>
            <div><label style={labelStyle}>Equipment / Area</label><input value={form.equipment||''} onChange={e=>set('equipment',e.target.value)} placeholder="e.g. Furnace MCC / Substation-1" style={inputStyle}/></div>
            <div><label style={labelStyle}>Document Owner</label><input value={form.owner||''} onChange={e=>set('owner',e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Issue Date</label><input type="date" value={form.issueDate||''} onChange={e=>set('issueDate',e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Next Review Date</label><input type="date" value={form.reviewDate||''} onChange={e=>set('reviewDate',e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Prepared / Reviewed / Approved</label><input value={form.preparedBy||''} onChange={e=>set('preparedBy',e.target.value)} placeholder="Prepared by" style={{...inputStyle,marginBottom:5}}/><input value={form.reviewedBy||''} onChange={e=>set('reviewedBy',e.target.value)} placeholder="Reviewed by" style={{...inputStyle,marginBottom:5}}/><input value={form.approvedBy||''} onChange={e=>set('approvedBy',e.target.value)} placeholder="Approved by" style={inputStyle}/></div>
            <div><label style={labelStyle}>Status</label><select value={form.status||'Draft'} onChange={e=>set('status',e.target.value)} style={inputStyle}>{['Draft','Under Review','Approved','Obsolete'].map(x=><option key={x}>{x}</option>)}</select></div>
            <div><label style={labelStyle}>Attach document (max 10 MB)</label><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp" onChange={e=>set('file',e.target.files?.[0])} style={{...inputStyle,padding:6}}/></div>
          </>:tab==='audits'?<>
            <div><label style={labelStyle}>Audit Type</label><select value={form.auditType||'Internal'} onChange={e=>set('auditType',e.target.value)} style={inputStyle}>{['Internal','External','Customer','Supplier'].map(x=><option key={x}>{x}</option>)}</select></div>
            <div><label style={labelStyle}>Audit Date</label><input type="date" value={form.auditDate||''} onChange={e=>set('auditDate',e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Auditor</label><input value={form.auditor||''} onChange={e=>set('auditor',e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Finding Classification</label><select value={form.findingType||'Observation'} onChange={e=>set('findingType',e.target.value)} style={inputStyle}>{['No Finding','Observation','Opportunity for Improvement','Minor NC','Major NC'].map(x=><option key={x}>{x}</option>)}</select></div>
            <div><label style={labelStyle}>Finding / Observation</label><input value={form.finding||''} onChange={e=>set('finding',e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Responsible Person</label><input value={form.responsible||''} onChange={e=>set('responsible',e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Target Closure Date</label><input type="date" value={form.targetDate||''} onChange={e=>set('targetDate',e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Status</label><select value={form.status||'Open'} onChange={e=>set('status',e.target.value)} style={inputStyle}>{['Open','In Progress','Closed'].map(x=><option key={x}>{x}</option>)}</select></div>
          </>:<>
            <div><label style={labelStyle}>Finding Classification</label><select value={form.findingType||'Minor NC'} onChange={e=>set('findingType',e.target.value)} style={inputStyle}>{['Minor NC','Major NC','Observation','Customer Complaint','Internal Finding'].map(x=><option key={x}>{x}</option>)}</select></div>
            <div><label style={labelStyle}>Nonconformity / Finding</label><input value={form.finding||''} onChange={e=>set('finding',e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Root Cause</label><input value={form.rootCause||''} onChange={e=>set('rootCause',e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Immediate Correction</label><input value={form.correction||''} onChange={e=>set('correction',e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Corrective Action</label><input value={form.correctiveAction||''} onChange={e=>set('correctiveAction',e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Responsible Person</label><input value={form.responsible||''} onChange={e=>set('responsible',e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Target Closure Date</label><input type="date" value={form.targetDate||''} onChange={e=>set('targetDate',e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Objective Evidence</label><input value={form.evidence||''} onChange={e=>set('evidence',e.target.value)} placeholder="Evidence reference / details" style={inputStyle}/></div>
            <div><label style={labelStyle}>Effectiveness Verification Result</label><input value={form.effectivenessResult||''} onChange={e=>set('effectivenessResult',e.target.value)} placeholder="How recurrence prevention was verified" style={inputStyle}/></div>
            <div><label style={labelStyle}>Verified By</label><input value={form.verifiedBy||''} onChange={e=>set('verifiedBy',e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Status</label><select value={form.status||'Open'} onChange={e=>set('status',e.target.value)} style={inputStyle}>{['Open','In Progress','Pending Verification','Closed'].map(x=><option key={x}>{x}</option>)}</select></div>
          </>}
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:14}}><button type="button" onClick={()=>setShowForm(false)} style={{...buttonStyle,background:'#e2e8f0',color:'#334155'}}>Cancel</button><button disabled={saving} type="submit" style={{...buttonStyle,background:'#2563eb',color:'#fff'}}>{saving?'Saving...':editingRecord?'Update Record':'Save Record'}</button></div>
      </form>}
      {loading?<div style={{padding:40,textAlign:'center',color:'#64748b'}}>Loading quality records...</div>:filtered.length===0?<div style={{padding:48,textAlign:'center',color:'#64748b'}}><FolderOpen size={30} style={{margin:'0 auto 8px',opacity:.4}}/><div style={{fontWeight:700,fontSize:14}}>No {tab} records available</div><div style={{fontSize:12,marginTop:5}}>Use “Add {tab==='documents'?'Document':tab==='audits'?'Audit':'NCR / CAPA'}” to start maintaining controlled records.</div></div>:
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr style={{background:'#f8fafc',textAlign:'left',color:'#64748b'}}>{(tab==='documents'?['Document No.','Title / Equipment','Department','Standard / Clause','Revision','Review Due','Owner','Status','File','Workflow']:tab==='audits'?['Audit No.','Audit / Finding','Type','Department','Date','Auditor','Finding Class','Owner','Target','Status']:['NCR / CAPA No.','Nonconformity','Department','Standard','Root Cause / Action','Responsible','Target Date','Status','Update']).map(h=><th key={h} style={{padding:'11px 10px',whiteSpace:'nowrap',fontSize:10}}>{h}</th>)}</tr></thead><tbody>{filtered.map(r=><tr key={r._id} style={{borderTop:'1px solid #eef2f7'}}>
        {tab==='documents'?<><td style={{padding:10,fontWeight:700,whiteSpace:'nowrap'}}>{r.recordNo}</td><td style={{padding:10,minWidth:180}}><div style={{fontWeight:700}}>{r.title}</div><div style={{fontSize:10,color:'#94a3b8'}}>{r.equipment||r.documentType}</div></td><td style={{padding:10}}>{r.department}</td><td style={{padding:10,minWidth:130}}>{r.standard}<div style={{fontSize:10,color:'#64748b'}}>{(r.clauses||[]).join(', ')}</div></td><td style={{padding:10}}>{r.revision}</td><td style={{padding:10,whiteSpace:'nowrap'}}>{dateText(r.reviewDate)}<div style={{fontSize:10,color:dueState(r.reviewDate)==='Overdue'?'#dc2626':dueState(r.reviewDate)==='Due soon'?'#d97706':'#64748b'}}>{dueState(r.reviewDate)}</div></td><td style={{padding:10}}>{r.owner||'—'}</td><td style={{padding:10}}><span style={{background:r.status==='Approved'?'#dcfce7':r.status==='Obsolete'?'#fee2e2':'#f1f5f9',color:r.status==='Approved'?'#166534':r.status==='Obsolete'?'#991b1b':'#475569',padding:'4px 7px',borderRadius:12,fontSize:10}}>{r.status}</span></td><td style={{padding:10}}>{r.fileName?<button onClick={()=>openFile(r)} style={{...buttonStyle,background:'#eff6ff',color:'#1d4ed8',padding:'6px 8px'}}><Download size={12}/>Open</button>:'—'}</td><td style={{padding:10,minWidth:240}}><div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
          {(r.status==='Draft'||r.status==='Rejected')?<button onClick={()=>workflowAction(r,'submit')} style={{...buttonStyle,background:'#eff6ff',color:'#1d4ed8',padding:'6px 8px'}}>Submit</button>:null}
          {r.status==='Under Review'&&['manager','deputy_manager'].includes(user?.role)?<><button onClick={()=>workflowAction(r,'review')} style={{...buttonStyle,background:'#e0f2fe',color:'#075985',padding:'6px 8px'}}>Review</button><button onClick={()=>workflowAction(r,'reject')} style={{...buttonStyle,background:'#fee2e2',color:'#991b1b',padding:'6px 8px'}}>Reject</button></>:null}
          {r.status==='Reviewed'&&user?.role==='manager'?<button onClick={()=>workflowAction(r,'approve')} style={{...buttonStyle,background:'#dcfce7',color:'#166534',padding:'6px 8px'}}>Approve</button>:null}
          {r.status==='Approved'&&['manager','deputy_manager','shift_engineer'].includes(user?.role)?<button onClick={()=>createRevision(r)} style={{...buttonStyle,background:'#f1f5f9',color:'#334155',padding:'6px 8px'}}>New Revision</button>:null}
          <button onClick={()=>viewHistory(r)} style={{...buttonStyle,background:'#f8fafc',color:'#475569',padding:'6px 8px'}}>History</button>
        </div></td></>}:
        tab==='audits'?<><td style={{padding:10,fontWeight:700}}>{r.recordNo}</td><td style={{padding:10,minWidth:180}}><div style={{fontWeight:700}}>{r.title}</div><div style={{color:'#64748b',fontSize:10}}>{r.finding||'No finding detail'}</div></td><td style={{padding:10}}>{r.auditType}</td><td style={{padding:10}}>{r.department}</td><td style={{padding:10,whiteSpace:'nowrap'}}>{dateText(r.auditDate)}</td><td style={{padding:10}}>{r.auditor||'—'}</td><td style={{padding:10}}>{r.findingType}</td><td style={{padding:10}}>{r.responsible||'—'}</td><td style={{padding:10,whiteSpace:'nowrap'}}>{dateText(r.targetDate)}</td><td style={{padding:10}}><select value={r.status} onChange={e=>updateStatus(r,e.target.value)} style={{...inputStyle,minWidth:110,padding:5}}>{['Open','In Progress','Closed'].map(x=><option key={x}>{x}</option>)}</select></td></>:
        <><td style={{padding:10,fontWeight:700,whiteSpace:'nowrap'}}>{r.recordNo}</td><td style={{padding:10,minWidth:180}}><div style={{fontWeight:700}}>{r.title}</div><div style={{fontSize:10,color:'#64748b'}}>{r.finding}</div></td><td style={{padding:10}}>{r.department}</td><td style={{padding:10}}>{r.standard}</td><td style={{padding:10,minWidth:170}}><div>{r.rootCause||'Root cause pending'}</div><div style={{fontSize:10,color:'#64748b'}}>{r.correctiveAction||'Action pending'}</div></td><td style={{padding:10}}>{r.responsible||'—'}</td><td style={{padding:10,whiteSpace:'nowrap',color:dueState(r.targetDate)==='Overdue'?'#dc2626':'inherit'}}>{dateText(r.targetDate)}<div style={{fontSize:10}}>{dueState(r.targetDate)}</div></td><td style={{padding:10}}><select value={r.status} onChange={e=>updateStatus(r,e.target.value)} style={{...inputStyle,minWidth:125,padding:5}}>{['Open','In Progress','Pending Verification','Closed'].map(x=><option key={x}>{x}</option>)}</select></td><td style={{padding:10}}><button onClick={()=>{setTab('capas');setEditingRecord(r);setForm({recordNo:r.recordNo,title:r.title,department:r.department,standard:r.standard,findingType:r.findingType,finding:r.finding,rootCause:r.rootCause,correction:r.correction,correctiveAction:r.correctiveAction,responsible:r.responsible,targetDate:r.targetDate?new Date(r.targetDate).toISOString().slice(0,10):'',evidence:r.evidence,verifiedBy:r.verifiedBy,effectivenessResult:r.effectivenessResult,status:r.status});setShowForm(true);}} style={{...buttonStyle,background:'#f1f5f9',color:'#334155',padding:'6px 8px'}}>Edit</button></td></>}
      </tr>)}</tbody></table></div>}
    </div>
    <div style={{fontSize:10,color:'#94a3b8',marginTop:10}}>ISO clause mapping and document categories must be validated against your organization's certified scope and controlled procedures. File attachments are stored in MongoDB (10 MB maximum per file); ensure database backup and access-control policies are in place.</div>
  </div>;
}
