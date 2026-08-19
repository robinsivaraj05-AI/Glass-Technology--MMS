import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, Edit, Save, X, Plus, Trash2, Upload, Download, Eye,
  User, Briefcase, GraduationCap, Award, Star, FileText, BarChart3,
  Calendar, Clock, TrendingUp, Phone, MapPin, Shield,
  CheckCircle, Camera,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  type FullEmployee, type EmploymentRecord, type EducationRecord,
  type QualificationRecord, type SkillRecord, type TrainingRecord,
  type PerformanceRecord, type PromotionRecord, type LeaveRecord, type AttendanceSummary,
} from '../data/employeeData';
import { useEmployees } from '../context/EmployeeContext';

const STATUS_COLOR: Record<string, string> = { active:'#22c55e', on_leave:'#f59e0b', suspended:'#ef4444', resigned:'#64748b', not_joined:'#f97316' };
const STATUS_LABEL: Record<string, string> = { active:'Active', on_leave:'On Leave', suspended:'Suspended', resigned:'Resigned', not_joined:'Not Yet Joined' };

function certStatus(expiry: string) {
  if (!expiry) return 'none';
  const diff = (new Date(expiry).getTime() - Date.now()) / 86400000;
  if (diff < 0) return 'expired';
  if (diff <= 60) return 'expiring';
  return 'valid';
}
const CERT_COLOR: Record<string, string> = { valid:'#22c55e', expiring:'#f59e0b', expired:'#ef4444', none:'#64748b' };
const CERT_LABEL: Record<string, string> = { valid:'Valid', expiring:'Expiring Soon', expired:'Expired', none:'No Expiry' };

function StarRating({ rating, onChange }: { rating: number; onChange?: (r: number) => void }) {
  return (
    <div style={{ display:'flex', gap:3 }}>
      {[1,2,3,4,5].map(n => (
        <Star key={n} size={15} fill={n <= rating ? '#f59e0b' : 'none'} color={n <= rating ? '#f59e0b' : '#334155'}
          style={{ cursor: onChange ? 'pointer' : 'default' }} onClick={() => onChange?.(n)} />
      ))}
    </div>
  );
}

const inp: React.CSSProperties = { width:'100%', background:'white', border:'1px solid #E2E8F0', borderRadius:8, padding:'8px 12px', color:'#374151', fontSize:13, outline:'none', boxSizing:'border-box', colorScheme:'light' };
const lbl: React.CSSProperties = { fontSize:11, color:'#64748b', marginBottom:4, display:'block', fontWeight:500 };
const r2: React.CSSProperties = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 };
const r3: React.CSSProperties = { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 };
const secHdr = (label: string, icon: React.ReactNode) => (
  <div style={{ fontSize:11, color:'#3b82f6', fontWeight:600, textTransform:'uppercase', letterSpacing:1, display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
    {icon} {label}
  </div>
);

const InfoBox = ({ label, value }: { label: string; value: string }) => (
  <div style={{ background:'#F8FAFC', border:'1px solid #E5E7EB', borderRadius:8, padding:'10px 14px' }}>
    <div style={{ fontSize:10, color:'#64748b', marginBottom:2 }}>{label}</div>
    <div style={{ fontSize:13, color:'#111827', fontWeight:500 }}>{value || '—'}</div>
  </div>
);

function Modal({ title, onClose, onSave, children }: { title: string; onClose: () => void; onSave: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:20 }}>
      <div style={{ background:'white', borderRadius:14, boxShadow:'0 20px 60px rgba(0,0,0,0.15)', width:'100%', maxWidth:640, maxHeight:'90vh', overflowY:'auto', padding:24, position:'relative' }}>
        <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={18}/></button>
        <h3 style={{ margin:'0 0 18px', fontSize:15, fontWeight:700, color:'#111827' }}>{title}</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>{children}</div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
          <button className="btn-secondary" onClick={onClose} style={{ fontSize:13 }}>Cancel</button>
          <button className="btn-primary" onClick={onSave} style={{ fontSize:13, display:'flex', alignItems:'center', gap:4 }}><Save size={13}/> Save</button>
        </div>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={lbl}>{label}</label>{children}</div>;
}

function TI({ label, field, form, setForm, type = 'text' }: { label: string; field: string; form: Record<string, any>; setForm: React.Dispatch<React.SetStateAction<any>>; type?: string }) {
  return (
    <F label={label}>
      <input type={type} style={inp} value={form[field] ?? ''} onChange={e => setForm((p: any) => ({ ...p, [field]: e.target.value }))} placeholder={label} />
    </F>
  );
}

function NI({ label, field, form, setForm }: { label: string; field: string; form: Record<string, any>; setForm: React.Dispatch<React.SetStateAction<any>> }) {
  return (
    <F label={label}>
      <input type="number" style={inp} value={form[field] ?? ''} onChange={e => setForm((p: any) => ({ ...p, [field]: Number(e.target.value) }))} placeholder={label} />
    </F>
  );
}

const iconBtn = (color: string): React.CSSProperties => ({
  padding:'4px 8px', fontSize:11, background:`rgba(${color},0.1)`, border:`1px solid rgba(${color},0.3)`,
  borderRadius:6, color:`rgb(${color})`, cursor:'pointer', display:'flex', alignItems:'center', gap:3,
});

export default function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const { employees, loading, updateEmployee } = useEmployees();
  const { user } = useAuth();
  const isAdmin = user?.role === 'manager';

  // ── ALL STATE MUST BE BEFORE ANY CONDITIONAL RETURN ──

  const [activeTab, setActiveTab] = useState('personal');
  const [editPersonal, setEditPersonal] = useState(false);
  const [personalSaved, setPersonalSaved] = useState(false);
  const [personalForm, setPersonalForm] = useState<Partial<FullEmployee>>({});

  // Employment History
  const [showEHModal, setShowEHModal] = useState(false);
  const [editingEHId, setEditingEHId] = useState<string | null>(null);
  const [ehForm, setEhForm] = useState<Partial<EmploymentRecord>>({});

  // Education
  const [showEdModal, setShowEdModal] = useState(false);
  const [editingEdId, setEditingEdId] = useState<string | null>(null);
  const [edForm, setEdForm] = useState<Partial<EducationRecord>>({});

  // Qualifications
  const [showQualModal, setShowQualModal] = useState(false);
  const [editingQualId, setEditingQualId] = useState<string | null>(null);
  const [qualForm, setQualForm] = useState<Partial<QualificationRecord>>({});

  // Skills
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [editingSkillIdx, setEditingSkillIdx] = useState<number | null>(null);
  const [skillForm, setSkillForm] = useState<SkillRecord>({ name: '', category: '', rating: 3 });

  // Documents
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState<{ name: string; type: string; expiryDate: string }>({ name: '', type: '', expiryDate: '' });
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Attendance
  const [editAttend, setEditAttend] = useState(false);
  const [attendForm, setAttendForm] = useState<Omit<AttendanceSummary, 'monthly'>>({ workingDays:0, present:0, absent:0, leave:0, lateEntry:0, earlyExit:0, overtime:0 });
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [editingMonthIdx, setEditingMonthIdx] = useState<number | null>(null);
  const [monthForm, setMonthForm] = useState({ month:'', present:0, absent:0, leave:0 });

  // Leaves
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);
  const [leaveForm, setLeaveForm] = useState<Partial<LeaveRecord>>({});

  // Training
  const [showTrainModal, setShowTrainModal] = useState(false);
  const [editingTrainId, setEditingTrainId] = useState<string | null>(null);
  const [trainForm, setTrainForm] = useState<Partial<TrainingRecord>>({});

  // Performance
  const [showPerfModal, setShowPerfModal] = useState(false);
  const [editingPerfId, setEditingPerfId] = useState<string | null>(null);
  const [perfForm, setPerfForm] = useState<Partial<PerformanceRecord>>({ year: new Date().getFullYear() });

  // Promotions
  const [showPromModal, setShowPromModal] = useState(false);
  const [editingPromId, setEditingPromId] = useState<string | null>(null);
  const [promForm, setPromForm] = useState<Partial<PromotionRecord>>({});

  // ── CONDITIONAL RETURNS AFTER ALL HOOKS ──

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:400, flexDirection:'column', gap:12 }}>
      <div style={{ width:36, height:36, border:'3px solid rgba(59,130,246,0.3)', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <div style={{ color:'#64748b', fontSize:13 }}>Loading…</div>
    </div>
  );

  const emp = employees.find(e => e.id === id);

  if (!emp) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:400, gap:12 }}>
      <User size={48} color="#334155" />
      <div style={{ color:'#64748b', fontSize:14 }}>Employee not found</div>
      <button className="btn-primary" onClick={() => navigate('/employees')}>Back to Directory</button>
    </div>
  );

  // ── HANDLERS (use emp safely after the !emp guard) ──

  const saveEmp = (updates: Partial<FullEmployee>) => updateEmployee(emp.id, updates);
  const confirmDel = (msg: string, fn: () => void) => { if (window.confirm(msg)) fn(); };
  const today = () => new Date().toISOString().slice(0, 10);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => saveEmp({ photo: reader.result as string });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Employment History
  const openAddEH  = () => { setEditingEHId(null); setEhForm({}); setShowEHModal(true); };
  const openEditEH = (item: EmploymentRecord) => { setEditingEHId(item.id); setEhForm({ ...item }); setShowEHModal(true); };
  const saveEH = () => {
    if (editingEHId) {
      saveEmp({ employmentHistory: emp.employmentHistory.map(x => x.id === editingEHId ? { ...x, ...ehForm } as EmploymentRecord : x) });
    } else {
      saveEmp({ employmentHistory: [...emp.employmentHistory, { ...ehForm, id: String(Date.now()) } as EmploymentRecord] });
    }
    setShowEHModal(false);
  };
  const deleteEH = (id: string) => confirmDel('Delete this employment record?', () =>
    saveEmp({ employmentHistory: emp.employmentHistory.filter(x => x.id !== id) }));

  // Education
  const openAddEd  = () => { setEditingEdId(null); setEdForm({}); setShowEdModal(true); };
  const openEditEd = (item: EducationRecord) => { setEditingEdId(item.id); setEdForm({ ...item }); setShowEdModal(true); };
  const saveEd = () => {
    if (editingEdId) {
      saveEmp({ education: emp.education.map(x => x.id === editingEdId ? { ...x, ...edForm } as EducationRecord : x) });
    } else {
      saveEmp({ education: [...emp.education, { ...edForm, id: String(Date.now()) } as EducationRecord] });
    }
    setShowEdModal(false);
  };
  const deleteEd = (id: string) => confirmDel('Delete this education record?', () =>
    saveEmp({ education: emp.education.filter(x => x.id !== id) }));

  // Qualifications
  const openAddQual  = () => { setEditingQualId(null); setQualForm({}); setShowQualModal(true); };
  const openEditQual = (item: QualificationRecord) => { setEditingQualId(item.id); setQualForm({ ...item }); setShowQualModal(true); };
  const saveQual = () => {
    if (editingQualId) {
      saveEmp({ qualifications: emp.qualifications.map(x => x.id === editingQualId ? { ...x, ...qualForm, hours: Number(qualForm.hours)||0 } as QualificationRecord : x) });
    } else {
      saveEmp({ qualifications: [...emp.qualifications, { ...qualForm, id: String(Date.now()), hours: Number(qualForm.hours)||0 } as QualificationRecord] });
    }
    setShowQualModal(false);
  };
  const deleteQual = (id: string) => confirmDel('Delete this qualification?', () =>
    saveEmp({ qualifications: emp.qualifications.filter(x => x.id !== id) }));

  // Skills
  const openAddSkill  = () => { setEditingSkillIdx(null); setSkillForm({ name:'', category:'', rating:3 }); setShowSkillModal(true); };
  const openEditSkill = (s: SkillRecord, idx: number) => { setEditingSkillIdx(idx); setSkillForm({ ...s }); setShowSkillModal(true); };
  const saveSkill = () => {
    if (editingSkillIdx !== null) {
      saveEmp({ skills: emp.skills.map((s, i) => i === editingSkillIdx ? { ...skillForm } : s) });
    } else {
      saveEmp({ skills: [...emp.skills, { ...skillForm }] });
    }
    setShowSkillModal(false);
  };
  const deleteSkill = (idx: number) => confirmDel('Delete this skill?', () =>
    saveEmp({ skills: emp.skills.filter((_, i) => i !== idx) }));

  // Documents
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setDocForm({ name: file.name, type: '', expiryDate: '' });
    setShowDocModal(true);
    e.target.value = '';
  };
  const saveDoc = () => {
    if (!pendingFile) return;
    const sizeKB = pendingFile.size / 1024;
    const sizeStr = sizeKB >= 1024 ? `${(sizeKB/1024).toFixed(1)} MB` : `${Math.round(sizeKB)} KB`;
    const reader = new FileReader();
    reader.onload = () => {
      const newDoc = {
        id: String(Date.now()),
        name: docForm.name || pendingFile.name,
        type: docForm.type || 'Other',
        uploadDate: today(),
        expiryDate: docForm.expiryDate,
        size: sizeStr,
        dataUrl: reader.result as string,
      };
      saveEmp({ documents: [...emp.documents, newDoc] });
    };
    reader.readAsDataURL(pendingFile);
    setShowDocModal(false); setPendingFile(null);
  };
  const deleteDoc = (id: string) => confirmDel('Delete this document?', () =>
    saveEmp({ documents: emp.documents.filter(x => x.id !== id) }));

  // Attendance summary
  const openEditAttend = () => {
    const { monthly: _m, ...rest } = emp.attendance;
    setAttendForm(rest);
    setEditAttend(true);
  };
  const saveAttend = () => {
    saveEmp({ attendance: { ...attendForm, monthly: emp.attendance.monthly } });
    setEditAttend(false);
  };
  // Monthly records
  const openAddMonth = () => { setEditingMonthIdx(null); setMonthForm({ month:'', present:0, absent:0, leave:0 }); setShowMonthModal(true); };
  const openEditMonth = (m: AttendanceSummary['monthly'][number], idx: number) => { setEditingMonthIdx(idx); setMonthForm({ ...m }); setShowMonthModal(true); };
  const saveMonth = () => {
    const months = [...emp.attendance.monthly];
    if (editingMonthIdx !== null) months[editingMonthIdx] = { ...monthForm };
    else months.push({ ...monthForm });
    saveEmp({ attendance: { ...emp.attendance, monthly: months } });
    setShowMonthModal(false);
  };
  const deleteMonth = (idx: number) => confirmDel('Remove this month?', () =>
    saveEmp({ attendance: { ...emp.attendance, monthly: emp.attendance.monthly.filter((_, i) => i !== idx) } }));

  // Leaves
  const openAddLeave  = () => { setEditingLeaveId(null); setLeaveForm({}); setShowLeaveModal(true); };
  const openEditLeave = (l: LeaveRecord) => { setEditingLeaveId(l.id); setLeaveForm({ ...l }); setShowLeaveModal(true); };
  const saveLeave = () => {
    if (editingLeaveId) {
      saveEmp({ leaves: emp.leaves.map(x => x.id === editingLeaveId ? { ...x, ...leaveForm, days: Number(leaveForm.days)||0 } as LeaveRecord : x) });
    } else {
      saveEmp({ leaves: [...emp.leaves, { ...leaveForm, id: String(Date.now()), days: Number(leaveForm.days)||0 } as LeaveRecord] });
    }
    setShowLeaveModal(false);
  };
  const deleteLeave = (id: string) => confirmDel('Delete this leave record?', () =>
    saveEmp({ leaves: emp.leaves.filter(x => x.id !== id) }));

  // Training
  const openAddTrain  = () => { setEditingTrainId(null); setTrainForm({}); setShowTrainModal(true); };
  const openEditTrain = (t: TrainingRecord) => { setEditingTrainId(t.id); setTrainForm({ ...t }); setShowTrainModal(true); };
  const saveTrain = () => {
    if (editingTrainId) {
      saveEmp({ training: emp.training.map(x => x.id === editingTrainId ? { ...x, ...trainForm } as TrainingRecord : x) });
    } else {
      saveEmp({ training: [...emp.training, { ...trainForm, id: String(Date.now()) } as TrainingRecord] });
    }
    setShowTrainModal(false);
  };
  const deleteTrain = (id: string) => confirmDel('Delete this training record?', () =>
    saveEmp({ training: emp.training.filter(x => x.id !== id) }));

  // Performance
  const openAddPerf  = () => { setEditingPerfId(null); setPerfForm({ year: new Date().getFullYear() }); setShowPerfModal(true); };
  const openEditPerf = (p: PerformanceRecord) => { setEditingPerfId(p.id); setPerfForm({ ...p }); setShowPerfModal(true); };
  const savePerf = () => {
    if (editingPerfId) {
      saveEmp({ performance: emp.performance.map(x => x.id === editingPerfId ? { ...x, ...perfForm } as PerformanceRecord : x) });
    } else {
      saveEmp({ performance: [...emp.performance, { ...perfForm, id: String(Date.now()) } as PerformanceRecord] });
    }
    setShowPerfModal(false);
  };
  const deletePerf = (id: string) => confirmDel('Delete this performance record?', () =>
    saveEmp({ performance: emp.performance.filter(x => x.id !== id) }));

  // Promotions
  const openAddProm  = () => { setEditingPromId(null); setPromForm({}); setShowPromModal(true); };
  const openEditProm = (p: PromotionRecord) => { setEditingPromId(p.id); setPromForm({ ...p }); setShowPromModal(true); };
  const saveProm = () => {
    if (editingPromId) {
      saveEmp({ promotions: emp.promotions.map(x => x.id === editingPromId ? { ...x, ...promForm, incrementPct: Number(promForm.incrementPct)||0 } as PromotionRecord : x) });
    } else {
      saveEmp({ promotions: [...emp.promotions, { ...promForm, id: String(Date.now()), incrementPct: Number(promForm.incrementPct)||0 } as PromotionRecord] });
    }
    setShowPromModal(false);
  };
  const deleteProm = (id: string) => confirmDel('Delete this promotion record?', () =>
    saveEmp({ promotions: emp.promotions.filter(x => x.id !== id) }));

  const handleDownloadProfilePDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const blue: [number,number,number] = [59,130,246];
    const slate: [number,number,number] = [100,116,139];
    const white: [number,number,number] = [255,255,255];
    const dark: [number,number,number] = [15,23,42];
    let y = 0;

    const lastY = () => (doc as any).lastAutoTable.finalY + 6;
    const chk = (need = 30) => { if (y > 270 - need) { doc.addPage(); y = 14; } };

    const sectionBar = (title: string) => {
      chk(20);
      doc.setFillColor(...blue);
      doc.rect(10, y, W - 20, 7, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(...white);
      doc.text(title.toUpperCase(), 14, y + 5);
      y += 10;
    };

    const twoCol = (rows: [string, string, string, string][]) => {
      autoTable(doc, {
        startY: y, body: rows, theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle:'bold', textColor:slate as any, cellWidth:44 },
          1: { cellWidth:50 },
          2: { fontStyle:'bold', textColor:slate as any, cellWidth:44 },
          3: { cellWidth:42 },
        },
        margin: { left:10, right:10 },
      });
      y = lastY();
    };

    const emp_age = Math.floor((Date.now() - new Date(emp.dateOfBirth).getTime()) / 31536000000);
    const _gtMs2 = emp.joiningDate ? Date.now() - new Date(emp.joiningDate).getTime() : 0;
    const _gtYr2 = Math.floor(_gtMs2 / 31536000000);
    const _gtMo2 = Math.floor((_gtMs2 % 31536000000) / (31536000000 / 12));
    const gtStr = emp.joiningDate
      ? (_gtYr2 > 0 ? `${_gtYr2}yr ${_gtMo2}mo` : `${_gtMo2} months`)
      : '—';

    // ── HEADER BANNER ──
    doc.setFillColor(...dark);
    doc.rect(0, 0, W, 48, 'F');

    // Photo avatar — x:10, y:8, size:32mm  → center (26, 24)
    const pX = 10, pY = 8, pSz = 32;
    const pCX = pX + pSz / 2;   // 26
    const pCY = pY + pSz / 2;   // 24

    if (emp.photo) {
      // Clip photo to circle using canvas before embedding
      const px = 128;
      const canvas = document.createElement('canvas');
      canvas.width = px; canvas.height = px;
      const ctx = canvas.getContext('2d')!;
      ctx.beginPath();
      ctx.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const img = new Image();
      img.src = emp.photo;
      await new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); });
      ctx.drawImage(img, 0, 0, px, px);
      // White border ring
      doc.setDrawColor(...white);
      doc.setLineWidth(0.6);
      doc.circle(pCX, pCY, pSz / 2 + 0.4, 'S');
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', pX, pY, pSz, pSz);
    } else {
      // Fallback: initials circle
      doc.setFillColor(...blue);
      doc.circle(pCX, pCY, pSz / 2, 'F');
      const initials = emp.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
      doc.text(initials, pCX, pCY + 1.5, { align: 'center', baseline: 'middle' });
    }

    // Employee text — aligned right of photo
    const tX = pX + pSz + 6;  // 48
    doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white);
    doc.text(emp.name, tX, 16);
    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal');
    doc.text(`${emp.designation}  ·  ${emp.empId}`, tX, 23);
    doc.setFontSize(8.5); doc.setTextColor(160, 190, 220);
    doc.text(`${emp.department}${emp.section ? '  ·  ' + emp.section : ''}`, tX, 29);
    doc.text(`Grade: ${emp.grade}  ·  Status: ${STATUS_LABEL[emp.status]}  ·  Joined: ${emp.joiningDate || '—'}`, tX, 35);
    doc.setFontSize(7.5); doc.setTextColor(130, 150, 170);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}`, W - 10, 9, { align: 'right' });
    y = 56;

    // ── PERSONAL INFO ──
    sectionBar('Personal Information');
    twoCol([
      ['Date of Birth', emp.dateOfBirth || '—', 'Age', `${emp_age} years`],
      ['Gender', emp.gender || '—', 'Nationality', emp.nationality || '—'],
      ['Marital Status', emp.maritalStatus || '—', 'Blood Group', emp.bloodGroup || '—'],
      ['Joining Date', emp.joiningDate || '—', 'Years in GT', gtStr],
      ['Prev. Company Exp.', `${Number(emp.yearsOfExperience || 0)} yrs`, 'Total Experience', `${Number(emp.yearsOfExperience || 0) + _gtYr2} yrs ${_gtMo2} mo`],
      ['Reporting Manager', emp.reportingManager || '—', 'Employee Type', emp.employeeType || '—'],
      ['Emergency Contact', emp.emergencyContactPerson || '—', 'Emergency Phone', emp.emergencyContactNumber || '—'],
    ]);

    // ── CONTACT ──
    sectionBar('Contact Information');
    twoCol([
      ['Company Email', emp.companyEmail || '—', 'Personal Email', emp.personalEmail || '—'],
      ['UAE Phone', emp.uaePhone || '—', 'India Phone', emp.indiaPhone || '—'],
      ['Company Phone', emp.companyPhone || '—', 'Employee Type', emp.employeeType || '—'],
      ['Current Address', emp.currentAddress || '—', 'Permanent Address', emp.permanentAddress || '—'],
    ]);

    // ── EMPLOYMENT HISTORY ──
    if (emp.employmentHistory.length > 0) {
      chk(25);
      sectionBar('Employment History');
      autoTable(doc, {
        startY: y,
        head: [['Company','Designation','Country','From','To','Experience','Reason for Leaving']],
        body: emp.employmentHistory.map(e => [e.company, e.designation, e.country||'—', e.joiningDate||'—', e.leavingDate||'Present', e.experience||'—', e.reasonLeaving||'—']),
        theme: 'striped',
        headStyles: { fillColor: blue, fontSize:8.5, fontStyle:'bold' },
        styles: { fontSize:8, cellPadding:2 },
        margin: { left:10, right:10 },
      });
      y = lastY();
    }

    // ── EDUCATION ──
    if (emp.education.length > 0) {
      chk(25);
      sectionBar('Education');
      autoTable(doc, {
        startY: y,
        head: [['Degree','Course / Specialization','Institution','Year','Grade','Duration']],
        body: emp.education.map(e => [e.degree, `${e.course}${e.specialization ? ' – ' + e.specialization : ''}`, e.institution||e.university||'—', e.passingYear||'—', e.grade||'—', e.duration||'—']),
        theme: 'striped',
        headStyles: { fillColor: blue, fontSize:8.5, fontStyle:'bold' },
        styles: { fontSize:8, cellPadding:2 },
        margin: { left:10, right:10 },
      });
      y = lastY();
    }

    // ── QUALIFICATIONS ──
    if (emp.qualifications.length > 0) {
      chk(25);
      sectionBar('Qualifications & Certifications');
      autoTable(doc, {
        startY: y,
        head: [['Certificate','Category','Institute','Cert No.','Completed','Expiry','Result']],
        body: emp.qualifications.map(q => [q.courseName, q.category||'—', q.institute||'—', q.certificateNo||'—', q.completionDate||'—', q.expiryDate||'No Expiry', q.result||'—']),
        theme: 'striped',
        headStyles: { fillColor: blue, fontSize:8.5, fontStyle:'bold' },
        styles: { fontSize:8, cellPadding:2 },
        margin: { left:10, right:10 },
      });
      y = lastY();
    }

    // ── SKILLS ──
    if (emp.skills.length > 0) {
      chk(25);
      sectionBar('Skills & Competencies');
      autoTable(doc, {
        startY: y,
        head: [['Skill','Category','Proficiency','Rating']],
        body: emp.skills.map(s => [s.name, s.category||'—', ['','Beginner','Basic','Intermediate','Advanced','Expert'][s.rating]||'—', `${s.rating}/5`]),
        theme: 'striped',
        headStyles: { fillColor: blue, fontSize:8.5, fontStyle:'bold' },
        styles: { fontSize:8, cellPadding:2 },
        margin: { left:10, right:10 },
      });
      y = lastY();
    }

    // ── TRAINING ──
    if (emp.training.length > 0) {
      chk(25);
      sectionBar('Training & Development');
      autoTable(doc, {
        startY: y,
        head: [['Training Name','Type','Mode','Trainer','Date','Duration','Result']],
        body: emp.training.map(t => [t.name, t.type||'—', t.mode||'—', t.trainer||'—', t.date||'—', t.duration||'—', t.result||'—']),
        theme: 'striped',
        headStyles: { fillColor: blue, fontSize:8.5, fontStyle:'bold' },
        styles: { fontSize:8, cellPadding:2 },
        margin: { left:10, right:10 },
      });
      y = lastY();
    }

    // ── PROMOTIONS ──
    if (emp.promotions.length > 0) {
      chk(25);
      sectionBar('Promotions & Salary History');
      autoTable(doc, {
        startY: y,
        head: [['Effective Date','Previous Designation','New Designation','Prev Grade','New Grade','Prev Salary','New Salary','Increment','Approved By']],
        body: emp.promotions.map(p => [p.effectiveDate||'—', p.prevDesignation||'—', p.newDesignation||'—', p.prevGrade||'—', p.newGrade||'—', p.prevSalary||'—', p.newSalary||'—', p.incrementPct ? `${p.incrementPct}%` : '—', p.approvedBy||'—']),
        theme: 'striped',
        headStyles: { fillColor: blue, fontSize:8, fontStyle:'bold' },
        styles: { fontSize:7.5, cellPadding:2 },
        margin: { left:10, right:10 },
      });
      y = lastY();
    }

    // footer on every page
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5); doc.setTextColor(150,160,175);
      doc.text(`${emp.name} — Confidential Employee Profile`, 10, 292);
      doc.text(`Page ${i} of ${totalPages}`, W - 10, 292, { align:'right' });
    }

    doc.save(`${emp.name.replace(/ /g, '_')}_Profile.pdf`);
  };

  const age = emp.dateOfBirth ? Math.floor((Date.now() - new Date(emp.dateOfBirth).getTime()) / 31536000000) : 0;
  const _MS   = 31536000000;
  const _gtMs = emp.joiningDate ? Date.now() - new Date(emp.joiningDate).getTime() : 0;
  const _gtYr = Math.floor(_gtMs / _MS);
  const _gtMo = Math.floor((_gtMs % _MS) / (_MS / 12));
  const yearsInGT = emp.joiningDate
    ? (_gtYr > 0 ? `${_gtYr} yr${_gtYr !== 1 ? 's' : ''} ${_gtMo} mo` : `${_gtMo} month${_gtMo !== 1 ? 's' : ''}`)
    : '—';

  const TABS = [
    { key:'personal',    label:'Personal Info',       icon:<User size={13}/> },
    { key:'employment',  label:'Employment History',   icon:<Briefcase size={13}/> },
    { key:'education',   label:'Education',            icon:<GraduationCap size={13}/> },
    { key:'qualif',      label:'Qualifications',       icon:<Award size={13}/> },
    { key:'documents',   label:'Resume',                icon:<FileText size={13}/> },
    { key:'leaves',      label:'Leave History',        icon:<Clock size={13}/> },
    { key:'training',    label:'Training',             icon:<Award size={13}/> },
    { key:'promotions',  label:'Promotions & Salary',  icon:<TrendingUp size={13}/> },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Header */}
      <div className="glass-card" style={{ padding:20, display:'flex', alignItems:'center', gap:16 }}>
        <button onClick={() => navigate('/employees')} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:12 }}>
          <ArrowLeft size={16}/> Back
        </button>
        <div style={{ width:1, height:36, background:'#E2E8F0' }}/>
        <div style={{ position:'relative', flexShrink:0 }}>
          <div style={{ width:64, height:64, borderRadius:'50%', background: emp.photo ? 'transparent' : 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700, color:'white', overflow:'hidden', border:'2px solid rgba(59,130,246,0.4)' }}>
            {emp.photo ? <img src={emp.photo} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : emp.name.split(' ').map(n=>n[0]).join('')}
          </div>
          <button onClick={() => photoRef.current?.click()} title="Change photo" style={{ position:'absolute', bottom:0, right:0, width:22, height:22, borderRadius:'50%', background:'#3b82f6', border:'2px solid #0f172a', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0 }}>
            <Camera size={11} color="white"/>
          </button>
          <input ref={photoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhotoChange}/>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:700, color:'#111827' }}>{emp.name}</div>
          <div style={{ fontSize:12, color:'#2563EB' }}>{emp.designation} · {emp.empId}</div>
          <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{emp.department} · Reports to: {emp.reportingManager}</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:12, fontWeight:600, color:STATUS_COLOR[emp.status], background:STATUS_COLOR[emp.status]+'20', padding:'4px 12px', borderRadius:20, border:`1px solid ${STATUS_COLOR[emp.status]}40` }}>
            {STATUS_LABEL[emp.status]}
          </span>
          <span style={{ fontSize:11, color:'#64748b', background:'#F1F5F9', padding:'4px 10px', borderRadius:8, border:'1px solid #E2E8F0' }}>
            Grade: {emp.grade}
          </span>
          <button onClick={handleDownloadProfilePDF} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 14px', background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.35)', borderRadius:8, color:'#60a5fa', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            <Download size={13}/> Download PDF
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:2, overflowX:'auto', paddingBottom:4 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding:'8px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:500,
            whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5,
            background: activeTab === t.key ? '#3b82f6' : '#F1F5F9',
            color: activeTab === t.key ? 'white' : '#374151',
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* ── PERSONAL INFO ── */}
      {activeTab === 'personal' && (
        <div className="glass-card" style={{ padding:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>Personal Information</div>
            <button className={editPersonal ? 'btn-primary' : 'btn-secondary'} style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }}
              onClick={() => {
                if (editPersonal) {
                  saveEmp(personalForm);
                  setPersonalSaved(true);
                  setTimeout(() => setPersonalSaved(false), 2500);
                } else {
                  setPersonalForm(emp);
                }
                setEditPersonal(!editPersonal);
              }}>
              {personalSaved ? <><CheckCircle size={13}/> Saved!</> : editPersonal ? <><Save size={13}/> Save Changes</> : <><Edit size={13}/> Edit</>}
            </button>
          </div>

          {!editPersonal ? (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {secHdr('Identity & Role', <User size={12}/>)}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                <InfoBox label="Employee ID" value={emp.empId} />
                <InfoBox label="Designation" value={emp.designation} />
                <InfoBox label="Department" value={emp.department} />
                <InfoBox label="Section" value={emp.section} />
                <InfoBox label="Reporting Manager" value={emp.reportingManager} />
                <InfoBox label="Employee Type" value={emp.employeeType} />
                <InfoBox label="Grade" value={emp.grade} />
                <InfoBox label="Status" value={STATUS_LABEL[emp.status]} />
              </div>
              {secHdr('Personal Details', <User size={12}/>)}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                <InfoBox label="Nationality" value={emp.nationality} />
                <InfoBox label="Date of Birth" value={emp.dateOfBirth} />
                <InfoBox label="Age" value={age + ' years'} />
                <InfoBox label="Gender" value={emp.gender} />
                <InfoBox label="Blood Group" value={emp.bloodGroup} />
                <InfoBox label="Marital Status" value={emp.maritalStatus} />
                <InfoBox label="Joining Date" value={emp.joiningDate} />
                <InfoBox label="Prev. Company Exp." value={Number(emp.yearsOfExperience || 0) + ' years'} />
                <InfoBox label="Years in GT" value={yearsInGT} />
                <InfoBox label="Total Experience" value={`${Number(emp.yearsOfExperience || 0) + _gtYr} yrs ${_gtMo} mo`} />
              </div>
              {secHdr('Contact', <Phone size={12}/>)}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                <InfoBox label="India Phone" value={emp.indiaPhone} />
                <InfoBox label="UAE Personal No." value={emp.uaePhone} />
                <InfoBox label="UAE Company No." value={emp.companyPhone} />
                <InfoBox label="Personal Email" value={emp.personalEmail} />
                <InfoBox label="Company Email" value={emp.companyEmail} />
                <InfoBox label="Emergency Contact" value={emp.emergencyContactPerson} />
                <InfoBox label="Emergency Phone" value={emp.emergencyContactNumber} />
              </div>
              {secHdr('Address', <MapPin size={12}/>)}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <InfoBox label="Current Address" value={emp.currentAddress} />
                <InfoBox label="Permanent Address" value={emp.permanentAddress} />
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {secHdr('Identity & Role', <User size={12}/>)}
              <div style={r3}>
                <TI label="Designation" field="designation" form={personalForm} setForm={setPersonalForm}/>
                <TI label="Department" field="department" form={personalForm} setForm={setPersonalForm}/>
                <TI label="Section" field="section" form={personalForm} setForm={setPersonalForm}/>
              </div>
              <div style={r3}>
                <TI label="Reporting Manager" field="reportingManager" form={personalForm} setForm={setPersonalForm}/>
                <TI label="Employee Type" field="employeeType" form={personalForm} setForm={setPersonalForm}/>
                <TI label="Grade" field="grade" form={personalForm} setForm={setPersonalForm}/>
              </div>
              <div style={r2}><F label="Status"><select style={inp} value={personalForm.status||'active'} onChange={e => setPersonalForm(p=>({...p,status:e.target.value as any}))}>
                <option value="active">Active</option><option value="on_leave">On Leave</option><option value="suspended">Suspended</option><option value="resigned">Resigned</option><option value="not_joined">Not Yet Joined</option>
              </select></F></div>
              {secHdr('Personal Details', <User size={12}/>)}
              <div style={r3}>
                <TI label="Nationality" field="nationality" form={personalForm} setForm={setPersonalForm}/>
                <TI label="Date of Birth" field="dateOfBirth" form={personalForm} setForm={setPersonalForm} type="date"/>
                <TI label="Gender" field="gender" form={personalForm} setForm={setPersonalForm}/>
              </div>
              <div style={r3}>
                <TI label="Blood Group" field="bloodGroup" form={personalForm} setForm={setPersonalForm}/>
                <TI label="Marital Status" field="maritalStatus" form={personalForm} setForm={setPersonalForm}/>
                <TI label="Joining Date" field="joiningDate" form={personalForm} setForm={setPersonalForm} type="date"/>
              </div>
              <div style={r2}>
                <TI label="Prev. Company Experience (yrs)" field="yearsOfExperience" form={personalForm} setForm={setPersonalForm}/>
                <F label="Total Experience (calculated)">
                  <input style={{...inp, color:'#60a5fa', fontWeight:600}} readOnly value={`${Number(personalForm.yearsOfExperience || 0) + _gtYr} yrs ${_gtMo} mo`}/>
                </F>
              </div>
              {secHdr('Contact Numbers', <Phone size={12}/>)}
              <div style={r3}>
                <TI label="India Phone" field="indiaPhone" form={personalForm} setForm={setPersonalForm}/>
                <TI label="UAE Personal" field="uaePhone" form={personalForm} setForm={setPersonalForm}/>
                <TI label="UAE Company" field="companyPhone" form={personalForm} setForm={setPersonalForm}/>
              </div>
              <div style={r2}>
                <TI label="Personal Email" field="personalEmail" form={personalForm} setForm={setPersonalForm}/>
                <TI label="Company Email" field="companyEmail" form={personalForm} setForm={setPersonalForm}/>
              </div>
              <div style={r2}>
                <TI label="Emergency Contact" field="emergencyContactPerson" form={personalForm} setForm={setPersonalForm}/>
                <TI label="Emergency Phone" field="emergencyContactNumber" form={personalForm} setForm={setPersonalForm}/>
              </div>
              {secHdr('Address', <MapPin size={12}/>)}
              <F label="Current Address"><textarea style={{...inp, minHeight:60, resize:'vertical'}} value={personalForm.currentAddress||''} onChange={e => setPersonalForm(p=>({...p,currentAddress:e.target.value}))}/></F>
              <F label="Permanent Address"><textarea style={{...inp, minHeight:60, resize:'vertical'}} value={personalForm.permanentAddress||''} onChange={e => setPersonalForm(p=>({...p,permanentAddress:e.target.value}))}/></F>
            </div>
          )}
        </div>
      )}

      {/* ── EMPLOYMENT HISTORY ── */}
      {activeTab === 'employment' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button className="btn-primary" onClick={openAddEH} style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
              <Plus size={13}/> Add Previous Company
            </button>
          </div>
          {emp.employmentHistory.map((eh, idx) => (
            <div key={eh.id} style={{ display:'flex', gap:16 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:40, flexShrink:0 }}>
                <div style={{ width:14, height:14, borderRadius:'50%', background:'#3b82f6', border:'2px solid #1e3a5f', flexShrink:0, marginTop:8 }}/>
                {idx < emp.employmentHistory.length - 1 && <div style={{ width:2, flex:1, background:'rgba(59,130,246,0.2)', marginTop:4 }}/>}
              </div>
              <div className="glass-card" style={{ flex:1, padding:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>{eh.company}</div>
                    <div style={{ fontSize:12, color:'#60a5fa' }}>{eh.designation} · {eh.department}</div>
                    <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{eh.joiningDate} → {eh.leavingDate} &nbsp;({eh.experience})</div>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span className="badge badge-blue" style={{ fontSize:10 }}>{eh.industry}</span>
                    <span className="badge badge-gray" style={{ fontSize:10 }}>{eh.country}</span>
                    <button style={iconBtn('59,130,246')} onClick={() => openEditEH(eh)}><Edit size={11}/> Edit</button>
                    {isAdmin && <button style={iconBtn('239,68,68')} onClick={() => deleteEH(eh.id)}><Trash2 size={11}/> Delete</button>}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <InfoBox label="Employment Type" value={eh.employmentType}/>
                  <InfoBox label="Reporting Manager" value={eh.reportingManager}/>
                  <InfoBox label="Reason for Leaving" value={eh.reasonLeaving}/>
                  {eh.salary && <InfoBox label="Last Salary" value={eh.salary}/>}
                </div>
                {eh.responsibilities && <div style={{ marginTop:8, background:'#F8FAFC', borderRadius:8, padding:'10px 14px' }}><div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>Main Responsibilities</div><div style={{ fontSize:12, color:'#94a3b8', lineHeight:1.6 }}>{eh.responsibilities}</div></div>}
                {eh.projects && <div style={{ marginTop:8, background:'#F8FAFC', borderRadius:8, padding:'10px 14px' }}><div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>Projects Handled</div><div style={{ fontSize:12, color:'#94a3b8' }}>{eh.projects}</div></div>}
              </div>
            </div>
          ))}
          <div style={{ display:'flex', gap:16 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:40, flexShrink:0 }}>
              <div style={{ width:14, height:14, borderRadius:'50%', background:'#22c55e', border:'2px solid #14532d', flexShrink:0, marginTop:8, boxShadow:'0 0 8px #22c55e' }}/>
            </div>
            <div className="glass-card" style={{ flex:1, padding:16, border:'1px solid rgba(34,197,94,0.3)' }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#22c55e' }}>Current Company</div>
              <div style={{ fontSize:12, color:'#60a5fa' }}>{emp.designation} · {emp.department}</div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{emp.joiningDate} → Present</div>
            </div>
          </div>
          {showEHModal && (
            <Modal title={editingEHId ? 'Edit Employment Record' : 'Add Previous Company'} onClose={() => setShowEHModal(false)} onSave={saveEH}>
              <div style={r2}><TI label="Company Name" field="company" form={ehForm} setForm={setEhForm}/><TI label="Industry" field="industry" form={ehForm} setForm={setEhForm}/></div>
              <div style={r2}><TI label="Country" field="country" form={ehForm} setForm={setEhForm}/><TI label="Designation" field="designation" form={ehForm} setForm={setEhForm}/></div>
              <div style={r2}><TI label="Department" field="department" form={ehForm} setForm={setEhForm}/>
                <F label="Employment Type"><select style={inp} value={ehForm.employmentType||''} onChange={e=>setEhForm(p=>({...p,employmentType:e.target.value}))}><option value="">Select</option><option>Permanent</option><option>Contract</option><option>Part-time</option></select></F>
              </div>
              <div style={r2}>
                <F label="Joining Date"><input type="date" style={inp} value={ehForm.joiningDate||''} onChange={e => {
                  const joiningDate = e.target.value;
                  const leaving = ehForm.leavingDate || '';
                  const experience = joiningDate && leaving ? (() => {
                    const ms = new Date(leaving).getTime() - new Date(joiningDate).getTime();
                    const yrs = Math.floor(ms / 31536000000);
                    const mos = Math.floor((ms % 31536000000) / (31536000000 / 12));
                    return yrs > 0 ? `${yrs} Year${yrs!==1?'s':''} ${mos} Month${mos!==1?'s':''}` : `${mos} Month${mos!==1?'s':''}`;
                  })() : (ehForm.experience || '');
                  setEhForm((p: any) => ({ ...p, joiningDate, experience }));
                }}/></F>
                <F label="Relieving Date"><input type="date" style={inp} value={ehForm.leavingDate||''} min={ehForm.joiningDate||''} onChange={e => {
                  const leavingDate = e.target.value;
                  const joining = ehForm.joiningDate || '';
                  const experience = joining && leavingDate ? (() => {
                    const ms = new Date(leavingDate).getTime() - new Date(joining).getTime();
                    const yrs = Math.floor(ms / 31536000000);
                    const mos = Math.floor((ms % 31536000000) / (31536000000 / 12));
                    return yrs > 0 ? `${yrs} Year${yrs!==1?'s':''} ${mos} Month${mos!==1?'s':''}` : `${mos} Month${mos!==1?'s':''}`;
                  })() : (ehForm.experience || '');
                  setEhForm((p: any) => ({ ...p, leavingDate, experience }));
                }}/></F>
              </div>
              <div style={r2}>
                <F label="Total Experience (calculated)">
                  <input style={{...inp, color:'#60a5fa', fontWeight:600}} readOnly value={ehForm.experience || '—'}/>
                </F>
                <TI label="Last Salary (Optional)" field="salary" form={ehForm} setForm={setEhForm}/>
              </div>
              <TI label="Reporting Manager" field="reportingManager" form={ehForm} setForm={setEhForm}/>
              <TI label="Reason for Leaving" field="reasonLeaving" form={ehForm} setForm={setEhForm}/>
              <F label="Main Responsibilities"><textarea style={{...inp,minHeight:60,resize:'vertical'}} value={ehForm.responsibilities||''} onChange={e=>setEhForm(p=>({...p,responsibilities:e.target.value}))}/></F>
              <F label="Projects Handled"><textarea style={{...inp,minHeight:50,resize:'vertical'}} value={ehForm.projects||''} onChange={e=>setEhForm(p=>({...p,projects:e.target.value}))}/></F>
            </Modal>
          )}
        </div>
      )}

      {/* ── EDUCATION ── */}
      {activeTab === 'education' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button className="btn-primary" onClick={openAddEd} style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
              <Plus size={13}/> Add Education
            </button>
          </div>
          {emp.education.map(ed => (
            <div key={ed.id} className="glass-card" style={{ padding:16, borderLeft:'3px solid #3b82f6' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>{ed.degree} — {ed.course}</div>
                  <div style={{ fontSize:12, color:'#60a5fa' }}>{ed.specialization}</div>
                  <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{ed.institution} · {ed.university}</div>
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
                  <div style={{ textAlign:'right', marginRight:8 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#22c55e' }}>{ed.grade}</div>
                    <div style={{ fontSize:11, color:'#64748b' }}>{ed.passingYear} · {ed.duration}</div>
                  </div>
                  <button style={iconBtn('59,130,246')} onClick={() => openEditEd(ed)}><Edit size={11}/> Edit</button>
                  {isAdmin && <button style={iconBtn('239,68,68')} onClick={() => deleteEd(ed.id)}><Trash2 size={11}/> Delete</button>}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                <InfoBox label="Country" value={ed.country}/>
                <InfoBox label="Passing Year" value={ed.passingYear}/>
                <InfoBox label="Duration" value={ed.duration}/>
                <InfoBox label="Grade / %" value={ed.grade}/>
              </div>
            </div>
          ))}
          {emp.education.length === 0 && <div style={{ textAlign:'center', padding:40, color:'#475569', fontSize:13 }}>No education records. Click "Add Education" to add.</div>}
          {showEdModal && (
            <Modal title={editingEdId ? 'Edit Education' : 'Add Education'} onClose={() => setShowEdModal(false)} onSave={saveEd}>
              <div style={r2}>
                <F label="Degree"><select style={inp} value={edForm.degree||''} onChange={e=>setEdForm(p=>({...p,degree:e.target.value}))}>
                  <option value="">Select</option><option>Diploma</option><option>B.E</option><option>B.Tech</option><option>M.Tech</option><option>MBA</option><option>MSc</option><option>ITI</option><option>Polytechnic</option><option>PhD</option><option>Other</option>
                </select></F>
                <TI label="Course Name" field="course" form={edForm} setForm={setEdForm}/>
              </div>
              <div style={r2}><TI label="Specialization" field="specialization" form={edForm} setForm={setEdForm}/><TI label="Institution" field="institution" form={edForm} setForm={setEdForm}/></div>
              <div style={r2}><TI label="University / Board" field="university" form={edForm} setForm={setEdForm}/><TI label="Country" field="country" form={edForm} setForm={setEdForm}/></div>
              <div style={r3}><TI label="Grade / CGPA / %" field="grade" form={edForm} setForm={setEdForm}/><TI label="Passing Year" field="passingYear" form={edForm} setForm={setEdForm}/><TI label="Duration" field="duration" form={edForm} setForm={setEdForm}/></div>
            </Modal>
          )}
        </div>
      )}

      {/* ── QUALIFICATIONS ── */}
      {activeTab === 'qualif' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', gap:12, fontSize:11 }}>
              {[{ label:'Valid', color:'#22c55e' }, { label:'Expiring ≤60d', color:'#f59e0b' }, { label:'Expired', color:'#ef4444' }].map(s => (
                <div key={s.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:s.color }}/><span style={{ color:'#64748b' }}>{s.label}</span>
                </div>
              ))}
            </div>
            <button className="btn-primary" onClick={openAddQual} style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
              <Plus size={13}/> Add Qualification
            </button>
          </div>
          {emp.qualifications.map(q => {
            const cs = certStatus(q.expiryDate);
            const cc = CERT_COLOR[cs];
            return (
              <div key={q.id} className="glass-card" style={{ padding:16, borderLeft:`3px solid ${cc}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>{q.courseName}</div>
                    <div style={{ fontSize:11, color:'#64748b' }}>{q.category} · {q.institute}</div>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ fontSize:11, fontWeight:600, color:cc, background:cc+'20', padding:'3px 10px', borderRadius:20, border:`1px solid ${cc}40`, whiteSpace:'nowrap' }}>{CERT_LABEL[cs]}</span>
                    <button style={iconBtn('59,130,246')} onClick={() => openEditQual(q)}><Edit size={11}/> Edit</button>
                    {isAdmin && <button style={iconBtn('239,68,68')} onClick={() => deleteQual(q.id)}><Trash2 size={11}/> Delete</button>}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                  <InfoBox label="Certificate No." value={q.certificateNo}/>
                  <InfoBox label="Completion Date" value={q.completionDate}/>
                  <InfoBox label="Expiry Date" value={q.expiryDate}/>
                  <InfoBox label="Training Hours" value={q.hours + ' hrs'}/>
                  <InfoBox label="Trainer" value={q.trainerName}/>
                  <InfoBox label="Result" value={q.result}/>
                  <InfoBox label="Start Date" value={q.startDate}/>
                  {q.remarks && <InfoBox label="Remarks" value={q.remarks}/>}
                </div>
              </div>
            );
          })}
          {emp.qualifications.length === 0 && <div style={{ textAlign:'center', padding:40, color:'#475569', fontSize:13 }}>No qualifications. Click "Add Qualification" to add.</div>}
          {showQualModal && (
            <Modal title={editingQualId ? 'Edit Qualification' : 'Add Qualification / Certificate'} onClose={() => setShowQualModal(false)} onSave={saveQual}>
              <div style={r2}><TI label="Course Name" field="courseName" form={qualForm} setForm={setQualForm}/>
                <F label="Category"><select style={inp} value={qualForm.category||''} onChange={e=>setQualForm(p=>({...p,category:e.target.value}))}>
                  <option value="">Select Category</option>
                  {['PLC','VFD','SCADA','HMI','Electrical Maintenance','Instrumentation','Automation','Robotics','KUKA Robot','ABB Robot','FANUC Robot','Siemens TIA Portal','WinCC','AutoCAD Electrical','EPLAN','SAP PM','CMMS','Predictive Maintenance','Thermography','Vibration Analysis','Condition Monitoring','Power System','Transformer Maintenance','DG Maintenance','ISO 9001','ISO 14001','ISO 45001','Six Sigma','Lean Manufacturing','Fire Safety','First Aid','Arc Flash Safety','Electrical Safety','Lockout Tagout (LOTO)','Networking / IT'].map(c => <option key={c} value={c}>{c}</option>)}
                </select></F>
              </div>
              <div style={r2}><TI label="Training Institute" field="institute" form={qualForm} setForm={setQualForm}/><TI label="Certificate Number" field="certificateNo" form={qualForm} setForm={setQualForm}/></div>
              <div style={r3}><TI label="Start Date" field="startDate" form={qualForm} setForm={setQualForm} type="date"/><TI label="Completion Date" field="completionDate" form={qualForm} setForm={setQualForm} type="date"/><TI label="Expiry Date" field="expiryDate" form={qualForm} setForm={setQualForm} type="date"/></div>
              <div style={r3}><TI label="Trainer Name" field="trainerName" form={qualForm} setForm={setQualForm}/><TI label="Training Hours" field="hours" form={qualForm} setForm={setQualForm}/><TI label="Result" field="result" form={qualForm} setForm={setQualForm}/></div>
              <F label="Remarks"><textarea style={{...inp,minHeight:50,resize:'vertical'}} value={qualForm.remarks||''} onChange={e=>setQualForm(p=>({...p,remarks:e.target.value}))}/></F>
            </Modal>
          )}
        </div>
      )}

      {/* ── RESUME ── */}
      {activeTab === 'documents' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button className="btn-primary" style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }} onClick={() => fileRef.current?.click()}>
              <Upload size={13}/> Upload Resume
            </button>
            <input ref={fileRef} type="file" style={{ display:'none' }} onChange={handleFileSelect}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {emp.documents.map(doc => {
              const cs = certStatus(doc.expiryDate);
              const cc = CERT_COLOR[cs];
              return (
                <div key={doc.id} className="glass-card" style={{ padding:14, display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:40, height:44, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <FileText size={18} color="#60a5fa"/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#111827', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{doc.name}</div>
                    <div style={{ fontSize:10, color:'#64748b', marginTop:2 }}>{doc.type} · {doc.size}</div>
                    <div style={{ fontSize:10, color:'#475569' }}>Uploaded: {doc.uploadDate}</div>
                    {doc.expiryDate && (
                      <span style={{ fontSize:10, fontWeight:600, color:cc, background:cc+'20', padding:'1px 6px', borderRadius:10, marginTop:2, display:'inline-block' }}>
                        {CERT_LABEL[cs]} · {doc.expiryDate}
                      </span>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    {doc.dataUrl && (
                      <button
                        style={iconBtn('59,130,246')}
                        title="View document"
                        onClick={() => {
                          const win = window.open('', '_blank');
                          if (win) {
                            if (doc.dataUrl!.startsWith('data:image/')) {
                              win.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${doc.dataUrl}" style="max-width:100%;max-height:100vh;object-fit:contain"/></body></html>`);
                            } else {
                              win.document.write(`<html><body style="margin:0;height:100vh"><embed src="${doc.dataUrl}" type="application/pdf" width="100%" height="100%"/></body></html>`);
                            }
                          }
                        }}
                      >
                        <Eye size={11}/>
                      </button>
                    )}
                    <button style={iconBtn('239,68,68')} onClick={() => deleteDoc(doc.id)}><Trash2 size={11}/></button>
                  </div>
                </div>
              );
            })}
          </div>
          {emp.documents.length === 0 && <div style={{ textAlign:'center', padding:40, color:'#475569', fontSize:13 }}>No resume uploaded yet. Click "Upload Resume" to add.</div>}
          {showDocModal && (
            <Modal title="Upload Resume" onClose={() => { setShowDocModal(false); setPendingFile(null); }} onSave={saveDoc}>
              <div style={{ fontSize:12, color:'#94a3b8', background:'rgba(59,130,246,0.08)', padding:'8px 12px', borderRadius:8 }}>
                File selected: <strong>{pendingFile?.name}</strong> ({pendingFile ? `${Math.round(pendingFile.size/1024)} KB` : ''})
              </div>
              <TI label="Document Name" field="name" form={docForm} setForm={setDocForm}/>
              <F label="Document Type"><select style={inp} value={docForm.type||''} onChange={e=>setDocForm(p=>({...p,type:e.target.value}))}>
                <option value="">Select Type</option>
                {['Resume','CV','Updated Resume','Other'].map(t => <option key={t} value={t}>{t}</option>)}
              </select></F>
            </Modal>
          )}
        </div>
      )}

      {/* ── LEAVE HISTORY ── */}
      {activeTab === 'leaves' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button className="btn-primary" onClick={openAddLeave} style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
              <Plus size={13}/> Add Leave Record
            </button>
          </div>
          <div className="glass-card" style={{ overflow:'auto', padding:0 }}>
            <table className="data-table">
              <thead><tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th>Approved By</th><th style={{ width:90 }}>Actions</th></tr></thead>
              <tbody>
                {emp.leaves.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontWeight:500, color:'#111827' }}>{l.type}</td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{l.from}</td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{l.to}</td>
                    <td style={{ fontSize:12, color:'#94a3b8', fontWeight:600 }}>{l.days}</td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{l.reason}</td>
                    <td>
                      <span style={{ fontSize:11, fontWeight:600, color:l.status==='approved'?'#22c55e':l.status==='rejected'?'#ef4444':'#f59e0b', background:(l.status==='approved'?'#22c55e':l.status==='rejected'?'#ef4444':'#f59e0b')+'20', padding:'2px 8px', borderRadius:20, textTransform:'capitalize' }}>
                        {l.status}
                      </span>
                    </td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{l.approvedBy||'—'}</td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        <button style={iconBtn('59,130,246')} onClick={() => openEditLeave(l)}><Edit size={11}/></button>
                        <button style={iconBtn('239,68,68')} onClick={() => deleteLeave(l.id)}><Trash2 size={11}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {emp.leaves.length === 0 && <div style={{ textAlign:'center', padding:40, color:'#475569', fontSize:13 }}>No leave records.</div>}
          </div>
          {showLeaveModal && (
            <Modal title={editingLeaveId ? 'Edit Leave Record' : 'Add Leave Record'} onClose={() => setShowLeaveModal(false)} onSave={saveLeave}>
              <F label="Leave Type"><select style={inp} value={leaveForm.type||''} onChange={e=>setLeaveForm(p=>({...p,type:e.target.value}))}>
                <option value="">Select Type</option>
                {['Annual Leave','Sick Leave','Emergency Leave','Casual Leave','Unpaid Leave','Maternity Leave','Paternity Leave','Compensatory Leave'].map(t => <option key={t} value={t}>{t}</option>)}
              </select></F>
              <div style={r2}>
                <F label="From Date"><input type="date" style={inp} value={leaveForm.from||''} onChange={e => {
                  const from = e.target.value;
                  const to = leaveForm.to || '';
                  const days = from && to ? Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1) : (leaveForm.days || 0);
                  setLeaveForm((p: any) => ({ ...p, from, days }));
                }}/></F>
                <F label="To Date"><input type="date" style={inp} value={leaveForm.to||''} min={leaveForm.from||''} onChange={e => {
                  const to = e.target.value;
                  const from = leaveForm.from || '';
                  const days = from && to ? Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1) : (leaveForm.days || 0);
                  setLeaveForm((p: any) => ({ ...p, to, days }));
                }}/></F>
              </div>
              <F label="Number of Days">
                <input style={{...inp, color:'#60a5fa', fontWeight:600}} readOnly value={leaveForm.days ? `${leaveForm.days} day${leaveForm.days !== 1 ? 's' : ''}` : '—'}/>
              </F>
              <TI label="Reason" field="reason" form={leaveForm} setForm={setLeaveForm}/>
              <div style={r2}>
                <F label="Status"><select style={inp} value={leaveForm.status||'pending'} onChange={e=>setLeaveForm(p=>({...p,status:e.target.value as any}))}>
                  <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
                </select></F>
                <F label="Approved By"><select style={inp} value={leaveForm.approvedBy||''} onChange={e=>setLeaveForm(p=>({...p,approvedBy:e.target.value}))}>
                  <option value="">Select Approver</option>
                  {employees
                    .filter(e => e.status === 'active' && /manager|deputy|supervisor|head|hod|director|lead/i.test(e.designation))
                    .sort((a,b) => a.name.localeCompare(b.name))
                    .map(e => <option key={e.id} value={e.name}>{e.name} — {e.designation}</option>)
                  }
                </select></F>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* ── TRAINING ── */}
      {activeTab === 'training' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button className="btn-primary" onClick={openAddTrain} style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
              <Plus size={13}/> Add Training
            </button>
          </div>
          <div className="glass-card" style={{ overflow:'auto', padding:0 }}>
            <table className="data-table">
              <thead><tr><th>Training Name</th><th>Type</th><th>Mode</th><th>Trainer</th><th>Date</th><th>Duration</th><th>Result</th><th style={{ width:90 }}>Actions</th></tr></thead>
              <tbody>
                {emp.training.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight:500, color:'#111827' }}>{t.name}</td>
                    <td><span className="badge badge-blue" style={{ fontSize:10 }}>{t.type}</span></td>
                    <td><span className={`badge ${t.mode==='Internal'?'badge-gray':'badge-blue'}`} style={{ fontSize:10 }}>{t.mode}</span></td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{t.trainer}</td>
                    <td style={{ fontSize:12, color:'#64748b' }}>{t.date}</td>
                    <td style={{ fontSize:12, color:'#94a3b8' }}>{t.duration}</td>
                    <td><span style={{ fontSize:11, color:'#22c55e', fontWeight:600 }}>{t.result}</span></td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        <button style={iconBtn('59,130,246')} onClick={() => openEditTrain(t)}><Edit size={11}/></button>
                        {isAdmin && <button style={iconBtn('239,68,68')} onClick={() => deleteTrain(t.id)}><Trash2 size={11}/></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {emp.training.length === 0 && <div style={{ textAlign:'center', padding:40, color:'#475569', fontSize:13 }}>No training records.</div>}
          </div>
          {showTrainModal && (
            <Modal title={editingTrainId ? 'Edit Training Record' : 'Add Training Record'} onClose={() => setShowTrainModal(false)} onSave={saveTrain}>
              <div style={r2}><TI label="Training Name" field="name" form={trainForm} setForm={setTrainForm}/><TI label="Training Type" field="type" form={trainForm} setForm={setTrainForm}/></div>
              <div style={r2}>
                <F label="Mode"><select style={inp} value={trainForm.mode||'Internal'} onChange={e=>setTrainForm(p=>({...p,mode:e.target.value as any}))}><option>Internal</option><option>External</option></select></F>
                <TI label="Trainer" field="trainer" form={trainForm} setForm={setTrainForm}/>
              </div>
              <div style={r3}><TI label="Date" field="date" form={trainForm} setForm={setTrainForm} type="date"/><TI label="Duration" field="duration" form={trainForm} setForm={setTrainForm}/><TI label="Result" field="result" form={trainForm} setForm={setTrainForm}/></div>
              <F label="Remarks"><textarea style={{...inp,minHeight:50,resize:'vertical'}} value={trainForm.remarks||''} onChange={e=>setTrainForm(p=>({...p,remarks:e.target.value}))}/></F>
            </Modal>
          )}
        </div>
      )}

      {/* ── PROMOTIONS & SALARY ── */}
      {activeTab === 'promotions' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button className="btn-primary" onClick={openAddProm} style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
              <Plus size={13}/> Add Promotion / Increment
            </button>
          </div>
          {emp.promotions.length === 0 && (
            <div style={{ textAlign:'center', padding:40, color:'#475569', fontSize:13 }}>No promotion records yet.</div>
          )}
          {emp.promotions.map((p, idx) => (
            <div key={p.id} style={{ display:'flex', gap:16 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:40, flexShrink:0 }}>
                <div style={{ width:14, height:14, borderRadius:'50%', background:'#22c55e', border:'2px solid #14532d', flexShrink:0, marginTop:8 }}/>
                {idx < emp.promotions.length - 1 && <div style={{ width:2, flex:1, background:'rgba(34,197,94,0.2)', marginTop:4 }}/>}
              </div>
              <div className="glass-card" style={{ flex:1, padding:16, borderLeft:'3px solid #22c55e' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>{p.prevDesignation} → {p.newDesignation}</div>
                    <div style={{ fontSize:12, color:'#64748b' }}>Effective: {p.effectiveDate}</div>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'#22c55e', background:'rgba(34,197,94,0.1)', padding:'4px 12px', borderRadius:20 }}>+{p.incrementPct}% Increment</span>
                    <button style={iconBtn('59,130,246')} onClick={() => openEditProm(p)}><Edit size={11}/> Edit</button>
                    {isAdmin && <button style={iconBtn('239,68,68')} onClick={() => deleteProm(p.id)}><Trash2 size={11}/> Delete</button>}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  <InfoBox label="Previous Grade" value={p.prevGrade}/>
                  <InfoBox label="New Grade" value={p.newGrade}/>
                  <InfoBox label="Approved By" value={p.approvedBy}/>
                  <InfoBox label="Previous Salary" value={p.prevSalary}/>
                  <InfoBox label="New Salary" value={p.newSalary}/>
                  <InfoBox label="Reason" value={p.reason}/>
                </div>
              </div>
            </div>
          ))}
          {showPromModal && (
            <Modal title={editingPromId ? 'Edit Promotion / Salary Change' : 'Add Promotion / Salary Change'} onClose={() => setShowPromModal(false)} onSave={saveProm}>
              <TI label="Effective Date" field="effectiveDate" form={promForm} setForm={setPromForm} type="date"/>
              <div style={r2}><TI label="Previous Designation" field="prevDesignation" form={promForm} setForm={setPromForm}/><TI label="New Designation" field="newDesignation" form={promForm} setForm={setPromForm}/></div>
              <div style={r2}><TI label="Previous Grade" field="prevGrade" form={promForm} setForm={setPromForm}/><TI label="New Grade" field="newGrade" form={promForm} setForm={setPromForm}/></div>
              <div style={r3}><TI label="Previous Salary" field="prevSalary" form={promForm} setForm={setPromForm}/><TI label="New Salary" field="newSalary" form={promForm} setForm={setPromForm}/><TI label="Increment %" field="incrementPct" form={promForm} setForm={setPromForm}/></div>
              <div style={r2}><TI label="Promotion Reason" field="reason" form={promForm} setForm={setPromForm}/><TI label="Approved By" field="approvedBy" form={promForm} setForm={setPromForm}/></div>
            </Modal>
          )}
        </div>
      )}
    </div>
  );
}

