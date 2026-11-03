import React, { useState, useRef, useEffect } from 'react';
import { Users, UserCheck, Calendar, Plus, Edit, X, Save, Phone, Camera, MapPin, Trash2, FileDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEmployees } from '../context/EmployeeContext';

interface Employee {
  id: string; empId: string; name: string; role: string; department: string;
  shift: string; status: string; skill: string; experience: number;
  indiaPhone: string; uaePhone: string; uaeCompanyPhone: string;
  designation: string; email: string; dateOfJoining: string; nationality: string;
  photo?: string; address?: string; countryOfOrigin?: string;
}

interface MatrixEmployee {
  id: string; name: string; empId: string; position: string;
  experience: number; isNA: boolean;
  // E&I technical skills
  electricalSafety: number; motorTroubleshooting: number; vfdProgramming: number;
  plcAutomation: number; calibration: number; servoDrive: number;
  industrialNetworking: number; maintenanceMgmt: number; panelTroubleshoot: number;
  // IT skills
  networkAdmin: number; serverMgmt: number; softwareSupport: number;
  cybersecurity: number; erpMms: number; dbMgmt: number;
  hwSupport: number; cloudBackup: number; itHelpdesk: number;
}
interface PosGroup { position: string; slots: number; }

const EI_POSITIONS: PosGroup[] = [
  { position:'Shift Engineer',          slots:4 },
  { position:'Junior Engineer',         slots:3 },
  { position:'Technician',              slots:5 },
  { position:'Automation Engineer',     slots:1 },
  { position:'General Shift Engineer',  slots:1 },
];

const IT_POSITIONS: PosGroup[] = [
  { position:'IT Engineer', slots:1 },
];

const ALL_POSITIONS = [...EI_POSITIONS, ...IT_POSITIONS];

const MSKILLS: { key: keyof MatrixEmployee; label: string }[] = [
  { key:'electricalSafety',     label:'Electrical Safety' },
  { key:'motorTroubleshooting', label:'Motor Troubleshooting' },
  { key:'vfdProgramming',       label:'VFD Programming' },
  { key:'plcAutomation',        label:'PLC / Automation' },
  { key:'calibration',          label:'Calibration of Instrument' },
  { key:'servoDrive',           label:'Servo drive systems' },
  { key:'industrialNetworking', label:'Industrial networking' },
  { key:'maintenanceMgmt',      label:'Maintenance Management' },
  { key:'panelTroubleshoot',    label:'Panel Troubleshoot' },
];

const IT_SKILLS: { key: keyof MatrixEmployee; label: string }[] = [
  { key:'networkAdmin',     label:'Network Administration' },
  { key:'serverMgmt',      label:'Server Management' },
  { key:'softwareSupport', label:'Software Support' },
  { key:'cybersecurity',   label:'Cybersecurity' },
  { key:'erpMms',          label:'ERP / MMS Systems' },
  { key:'dbMgmt',          label:'Database Management' },
  { key:'hwSupport',       label:'Hardware Support' },
  { key:'cloudBackup',     label:'Cloud & Backup' },
  { key:'itHelpdesk',      label:'IT Helpdesk' },
];

const EI_ZERO = { electricalSafety:0, motorTroubleshooting:0, vfdProgramming:0, plcAutomation:0, calibration:0, servoDrive:0, industrialNetworking:0, maintenanceMgmt:0, panelTroubleshoot:0 };
const IT_ZERO = { networkAdmin:0, serverMgmt:0, softwareSupport:0, cybersecurity:0, erpMms:0, dbMgmt:0, hwSupport:0, cloudBackup:0, itHelpdesk:0 };

const initialMatrix: MatrixEmployee[] = [
  { id:'m1', name:'Mr. Praveen Kumar',    empId:'GT026', position:'Shift Engineer',        experience:14, isNA:false, electricalSafety:5, motorTroubleshooting:5, vfdProgramming:5, plcAutomation:4, calibration:5, servoDrive:4, industrialNetworking:4, maintenanceMgmt:5, panelTroubleshoot:5, ...IT_ZERO },
  { id:'m2', name:'Mr. HariKrishna',      empId:'GT051', position:'Shift Engineer',        experience:13, isNA:false, electricalSafety:5, motorTroubleshooting:4, vfdProgramming:4, plcAutomation:4, calibration:3, servoDrive:3, industrialNetworking:3, maintenanceMgmt:4, panelTroubleshoot:5, ...IT_ZERO },
  { id:'m3', name:'Mr. Arun',             empId:'GT062', position:'Shift Engineer',        experience:10, isNA:false, electricalSafety:5, motorTroubleshooting:4, vfdProgramming:4, plcAutomation:4, calibration:3, servoDrive:3, industrialNetworking:3, maintenanceMgmt:4, panelTroubleshoot:5, ...IT_ZERO },
  { id:'m4', name:'Mr. Mohit S Talaviya', empId:'GT035', position:'Junior Engineer',       experience:5,  isNA:false, electricalSafety:4, motorTroubleshooting:3, vfdProgramming:2, plcAutomation:2, calibration:3, servoDrive:2, industrialNetworking:2, maintenanceMgmt:3, panelTroubleshoot:3, ...IT_ZERO },
  { id:'m5', name:'Mr. Vivek Singh',      empId:'GT033', position:'Junior Engineer',       experience:4,  isNA:false, electricalSafety:4, motorTroubleshooting:3, vfdProgramming:2, plcAutomation:2, calibration:3, servoDrive:2, industrialNetworking:2, maintenanceMgmt:3, panelTroubleshoot:3, ...IT_ZERO },
  { id:'m6', name:'Mr. Ankat',            empId:'GT074', position:'Junior Engineer',       experience:3,  isNA:false, electricalSafety:4, motorTroubleshooting:3, vfdProgramming:2, plcAutomation:2, calibration:3, servoDrive:2, industrialNetworking:2, maintenanceMgmt:3, panelTroubleshoot:3, ...IT_ZERO },
  { id:'m7', name:'Mr. Ravi Kannan',      empId:'GT046', position:'Technician',            experience:8,  isNA:false, electricalSafety:3, motorTroubleshooting:3, vfdProgramming:3, plcAutomation:2, calibration:2, servoDrive:2, industrialNetworking:2, maintenanceMgmt:3, panelTroubleshoot:3, ...IT_ZERO },
  { id:'m8', name:'Mr. Krishna',          empId:'GT053', position:'Technician',            experience:4,  isNA:false, electricalSafety:3, motorTroubleshooting:3, vfdProgramming:3, plcAutomation:2, calibration:2, servoDrive:2, industrialNetworking:2, maintenanceMgmt:3, panelTroubleshoot:3, ...IT_ZERO },
  { id:'m9', name:'Mr. Casetro',          empId:'GT069', position:'IT Engineer',           experience:20, isNA:false, ...EI_ZERO, networkAdmin:4, serverMgmt:4, softwareSupport:5, cybersecurity:3, erpMms:5, dbMgmt:4, hwSupport:4, cloudBackup:3, itHelpdesk:5 },
];

function ratingBg(r: number): string {
  if (r >= 5) return '#16a34a';
  if (r === 4) return '#86efac';
  if (r === 3) return '#fca5a5';
  if (r === 2) return '#fecdd3';
  if (r === 1) return '#ef4444';
  return 'transparent';
}
function ratingTxt(r: number): string {
  return (r >= 5 || r === 1) ? 'white' : '#7f1d1d';
}
function getAvg(row: MatrixEmployee): number {
  const vals = MSKILLS.map(s => row[s.key] as number);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}
function getITAvg(row: MatrixEmployee): number {
  const vals = IT_SKILLS.map(s => row[s.key] as number);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}
const emptyMatrix: MatrixEmployee = {
  id:'', name:'', empId:'', position:'Shift Engineer', experience:0, isNA:false,
  electricalSafety:3, motorTroubleshooting:3, vfdProgramming:3, plcAutomation:3,
  calibration:3, servoDrive:3, industrialNetworking:3, maintenanceMgmt:3, panelTroubleshoot:3,
  networkAdmin:3, serverMgmt:3, softwareSupport:3, cybersecurity:3, erpMms:3, dbMgmt:3, hwSupport:3, cloudBackup:3, itHelpdesk:3,
};

const SHIFT_LABELS: Record<string, string> = {
  A: 'A Shift  (06:00 – 14:00)',
  B: 'B Shift  (14:00 – 22:00)',
  C: 'C Shift  (22:00 – 06:00)',
  G: 'General  (09:00 – 17:00)',
};
const SHIFT_ORDER = ['A', 'B', 'C', 'G'];

const STATUS_COLOR: Record<string,string> = { present:'#22c55e', leave:'#f59e0b', absent:'#ef4444' };
const DEPT_COLOR:  Record<string,string>  = { 'Electrical & Instrumentation':'#3b82f6', IT:'#8b5cf6' };

function guessRole(designation: string): string {
  const d = designation.toLowerCase();
  if (d.includes('it') || d.includes('network')) return 'IT Engineer';
  if (d.includes('manager')) return 'Manager';
  if (d.includes('engineer')) return 'Engineer';
  if (d.includes('supervisor')) return 'Supervisor';
  if (d.includes('tech')) return 'Technician';
  if (d.includes('helper') || d.includes('assist')) return 'Helper';
  return 'Technician';
}

function mapStatus(s: string): string {
  if (s === 'active') return 'present';
  if (s === 'on_leave') return 'leave';
  return 'absent';
}

const emptyEmp: Employee = {
  id:'', empId:'', name:'', role:'Technician', department:'Electrical & Instrumentation', shift:'A',
  status:'present', skill:'', experience:0,
  indiaPhone:'', uaePhone:'', uaeCompanyPhone:'',
  designation:'', email:'', dateOfJoining:'', nationality:'Indian',
  photo:'', address:'', countryOfOrigin:'India',
};

export default function Manpower() {
  const { user } = useAuth();
  const canEditSkills = user?.role === 'manager' || user?.role === 'deputy_manager';

  const { employees: contextEmployees, loading: empLoading } = useEmployees();
  const [employees, setEmployees]       = useState<Employee[]>([]);
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current || contextEmployees.length === 0) return;
    seeded.current = true;
    setEmployees(
      contextEmployees
        .filter(e => e.status !== 'resigned' && e.status !== 'not_joined')
        .map(e => ({
          id: e.id,
          empId: e.empId,
          name: e.name,
          role: guessRole(e.designation),
          department: e.department,
          shift: 'G',
          status: mapStatus(e.status),
          skill: (e.skills || []).map(s => s.name).join(', '),
          experience: e.yearsOfExperience || 0,
          indiaPhone: e.indiaPhone || '',
          uaePhone: e.uaePhone || '',
          uaeCompanyPhone: e.companyPhone || '',
          designation: e.designation,
          email: e.companyEmail || e.personalEmail || '',
          dateOfJoining: e.joiningDate || '',
          nationality: e.nationality || 'Indian',
          photo: e.photo || '',
          address: e.currentAddress || '',
          countryOfOrigin: e.nationality || 'India',
        }))
    );
  }, [contextEmployees]);
  const [matrix, setMatrix]             = useState<MatrixEmployee[]>(initialMatrix);
  const [matrixModal, setMatrixModal]   = useState<null|'add'|'edit'>(null);
  const [matrixForm, setMatrixForm]     = useState<MatrixEmployee>(emptyMatrix);
  const [matrixSaved, setMatrixSaved]   = useState(false);
  const [tab, setTab]                   = useState<'shift'|'skills'>('shift');
  const [modal, setModal]               = useState<null|'add'|'edit'>(null);
  const [form, setForm]                 = useState<Employee>(emptyEmp);
  const [viewEmp, setViewEmp]           = useState<Employee|null>(null);
  const [saved, setSaved]               = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const stats = {
    total:   employees.length,
    present: employees.filter(e => e.status === 'present').length,
    onLeave: employees.filter(e => e.status === 'leave').length,
    absent:  employees.filter(e => e.status === 'absent').length,
  };

  const openAdd = () => {
    setForm({ ...emptyEmp, id: String(Date.now()), empId: `EMP-${String(employees.length + 10).padStart(3,'0')}` });
    setModal('add'); setSaved(false);
  };
  const openEdit = (e: Employee) => { setForm({ ...e }); setModal('edit'); setSaved(false); };

  const handleSave = () => {
    if (!form.name.trim() || !form.empId.trim()) return;
    if (modal === 'add') setEmployees(prev => [...prev, form]);
    else setEmployees(prev => prev.map(e => e.id === form.id ? form : e));
    setSaved(true);
    setTimeout(() => { setModal(null); setSaved(false); }, 800);
  };

  const set = (field: keyof Employee, val: string|number) =>
    setForm(prev => ({ ...prev, [field]: val }));

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => set('photo', reader.result as string);
    reader.readAsDataURL(file);
  };

  const openMatrixAdd = () => { setMatrixForm({ ...emptyMatrix, id: String(Date.now()) }); setMatrixModal('add'); setMatrixSaved(false); };
  const openMatrixEdit = (r: MatrixEmployee) => { setMatrixForm({ ...r }); setMatrixModal('edit'); setMatrixSaved(false); };
  const deleteMatrixRow = (id: string) => { if (window.confirm('Remove this employee from the skill matrix?')) setMatrix(prev => prev.filter(r => r.id !== id)); };
  const handleMatrixSave = () => {
    if (!matrixForm.name.trim()) return;
    if (matrixModal === 'add') setMatrix(prev => [...prev, matrixForm]);
    else setMatrix(prev => prev.map(r => r.id === matrixForm.id ? matrixForm : r));
    setMatrixSaved(true);
    setTimeout(() => { setMatrixModal(null); setMatrixSaved(false); }, 800);
  };
  const setMF = (field: keyof MatrixEmployee, val: string|number|boolean) =>
    setMatrixForm(prev => ({ ...prev, [field]: val }));

  const handleMatrixPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    const today = new Date();
    const yr = today.getFullYear();
    const ds = today.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

    // ── E&I Section ──
    doc.setFillColor(30, 58, 138); doc.rect(0, 0, 297, 16, 'F');
    doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
    doc.text('E & I Skill Matrix', 148.5, 10, { align:'center' });
    doc.setFontSize(8); doc.text(`${yr}  |  ${ds}`, 291, 10, { align:'right' });

    const head = [['Sl.No','Name','Emp ID','Position','Exp',...MSKILLS.map(s=>s.label),'Avg']];
    const body: (string|number)[][] = [];
    EI_POSITIONS.forEach(pg => {
      const emps = matrix.filter(r => r.position === pg.position);
      emps.forEach((row, i) => {
        body.push([i+1, row.name, row.empId, row.position, row.experience,
          ...MSKILLS.map(s => (row[s.key] as number)), getAvg(row)]);
      });
      for (let i = 0; i < Math.max(0, pg.slots - emps.length); i++)
        body.push([emps.length+i+1, pg.position, '', '', '', ...MSKILLS.map(()=>''), '']);
      body.push(['','','','','',...MSKILLS.map(()=>''),'']);
    });

    const C: Record<number,[number,number,number]> = {
      5:[22,163,74], 4:[134,239,172], 3:[252,165,165], 2:[254,205,211], 1:[239,68,68],
    };
    autoTable(doc, {
      startY:19, head, body,
      styles:{ fontSize:6.5, cellPadding:[1.5,1], halign:'center', valign:'middle' },
      headStyles:{ fillColor:[30,58,138], textColor:255, fontStyle:'bold', fontSize:6.5 },
      columnStyles:{ 0:{cellWidth:7}, 1:{cellWidth:30,halign:'left'}, 2:{cellWidth:12}, 3:{cellWidth:26,halign:'left'}, 4:{cellWidth:8} },
      didParseCell(data) {
        const v = Number(data.cell.raw);
        if (!isNaN(v) && v>=1 && v<=5 && data.section!=='head') {
          data.cell.styles.fillColor = C[v];
          data.cell.styles.textColor = (v===4||v===3||v===2) ? [127,29,29] : [255,255,255];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      theme:'grid',
    });

    // ── IT Section ──
    const itY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFillColor(30, 27, 75); doc.rect(0, itY - 8, 297, 10, 'F');
    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
    doc.text('IT Skills Matrix', 148.5, itY - 2, { align:'center' });

    const itHead = [['Sl.No','Name','Emp ID','Position','Exp',...IT_SKILLS.map(s=>s.label),'Avg']];
    const itBody: (string|number)[][] = [];
    IT_POSITIONS.forEach(pg => {
      const emps = matrix.filter(r => r.position === pg.position);
      emps.forEach((row, i) => {
        itBody.push([i+1, row.name, row.empId, row.position, row.experience,
          ...IT_SKILLS.map(s => (row[s.key] as number)), getITAvg(row)]);
      });
      for (let i = 0; i < Math.max(0, pg.slots - emps.length); i++)
        itBody.push([emps.length+i+1, pg.position, '', '', '', ...IT_SKILLS.map(()=>''), '']);
    });
    autoTable(doc, {
      startY: itY + 2, head: itHead, body: itBody,
      styles:{ fontSize:6.5, cellPadding:[1.5,1], halign:'center', valign:'middle' },
      headStyles:{ fillColor:[30,27,75], textColor:255, fontStyle:'bold', fontSize:6.5 },
      columnStyles:{ 0:{cellWidth:7}, 1:{cellWidth:30,halign:'left'}, 2:{cellWidth:12}, 3:{cellWidth:26,halign:'left'}, 4:{cellWidth:8} },
      didParseCell(data) {
        const v = Number(data.cell.raw);
        if (!isNaN(v) && v>=1 && v<=5 && data.section!=='head') {
          data.cell.styles.fillColor = C[v];
          data.cell.styles.textColor = (v===4||v===3||v===2) ? [127,29,29] : [255,255,255];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      theme:'grid',
    });

    doc.save(`EI_IT_Skill_Matrix_${yr}.pdf`);
  };

  const inp: React.CSSProperties = {
    width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
    borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box',
  };
  const lbl: React.CSSProperties = { fontSize:11, color:'#64748b', marginBottom:4, display:'block', fontWeight:500 };
  const r2:  React.CSSProperties = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 };
  const sec: React.CSSProperties = { fontSize:11, color:'#3b82f6', fontWeight:600, textTransform:'uppercase', letterSpacing:1, marginTop:6, display:'flex', alignItems:'center', gap:6 };

  const Avatar = ({ emp, size=30 }: { emp: Employee; size?: number }) =>
    emp.photo ? (
      <img src={emp.photo} alt={emp.name} style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
    ) : (
      <div style={{ width:size, height:size, borderRadius:'50%', background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.4, fontWeight:700, color:'white', flexShrink:0 }}>
        {emp.name.split(' ').map((n:string) => n[0]).join('')}
      </div>
    );

  // ── Skill table block (reused for E&I and IT) ──
  const renderSkillTable = (
    positions: PosGroup[],
    skills: { key: keyof MatrixEmployee; label: string }[],
    avgFn: (r: MatrixEmployee) => number,
    headerTitle: string,
    headerSubtitle: string,
    headerColor: string,
    subColor: string,
  ) => (
    <div style={{ overflowX:'auto', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1200 }}>
        <thead>
          <tr>
            <th colSpan={5} style={{ background:headerColor, color:'white', padding:'8px 12px', fontSize:14, fontWeight:700, textAlign:'center', borderRight:'2px solid rgba(255,255,255,0.15)' }}>
              {headerTitle}
            </th>
            <th colSpan={skills.length} style={{ background:headerColor, color:subColor, padding:'8px 12px', fontSize:11, fontWeight:600, textAlign:'center', borderRight:'2px solid rgba(255,255,255,0.15)' }}>
              {headerSubtitle}
            </th>
            <th style={{ background:'#ca8a04', color:'white', padding:'8px', fontSize:12, fontWeight:700, textAlign:'center', borderRight:'2px solid rgba(255,255,255,0.15)' }}>
              {new Date().getFullYear()}
            </th>
            <th style={{ background:'#ef4444', color:'white', padding:'8px', fontSize:10, fontWeight:700, textAlign:'center' }}>
              {new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
            </th>
          </tr>
          <tr>
            {['Sl.No','Name','Emp ID','Position','Exp'].map(h => (
              <th key={h} style={{ background:'#166534', color:'white', padding:'7px 8px', fontSize:10, fontWeight:700, textAlign:'center', borderRight:'1px solid rgba(255,255,255,0.15)', whiteSpace:'nowrap', minWidth: h==='Name'?140:h==='Position'?120:undefined }}>
                {h}
              </th>
            ))}
            {skills.map(s => {
              const idx = s.label.indexOf(' ');
              const top = idx > -1 ? s.label.slice(0, idx) : s.label;
              const bot = idx > -1 ? s.label.slice(idx + 1) : '';
              return (
                <th key={s.key} style={{ background:'#166534', color:'white', padding:'6px 4px', fontSize:9, fontWeight:700, textAlign:'center', borderRight:'1px solid rgba(255,255,255,0.15)', minWidth:72, lineHeight:1.4 }}>
                  <span style={{ display:'block' }}>{top}</span>
                  <span style={{ display:'block' }}>{bot}</span>
                </th>
              );
            })}
            <th style={{ background:'#166534', color:'white', padding:'7px 8px', fontSize:10, fontWeight:700, textAlign:'center', borderRight:'1px solid rgba(255,255,255,0.15)' }}>Avg</th>
            <th style={{ background:'#1e293b', color:'#64748b', padding:'7px 6px', fontSize:10, textAlign:'center', minWidth:68 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {positions.map(pg => {
            const emps = matrix.filter(r => r.position === pg.position);
            const vacancies = Math.max(0, pg.slots - emps.length);
            const totalCols = 5 + skills.length + 2;
            return (
              <React.Fragment key={pg.position}>
                {emps.map((row, i) => {
                  const avg = avgFn(row);
                  return (
                    <tr key={row.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ textAlign:'center', fontSize:11, padding:'5px 6px', color:'#94a3b8' }}>{i+1}</td>
                      <td style={{ fontSize:12, padding:'5px 10px', color:'#0f172a', fontWeight:700, whiteSpace:'nowrap', background:'rgba(255,255,255,0.92)' }}>{row.name}</td>
                      <td style={{ fontSize:10, padding:'5px 6px', color:'#60a5fa', textAlign:'center', fontFamily:'monospace' }}>{row.empId}</td>
                      <td style={{ fontSize:10, padding:'5px 8px', color:'#94a3b8' }}>{row.position}</td>
                      <td style={{ textAlign:'center', fontSize:11, padding:'5px 6px', color:'#e2e8f0', fontWeight:600 }}>{row.experience}</td>
                      {skills.map(s => {
                        const v = row[s.key] as number;
                        return (
                          <td key={s.key} style={{ textAlign:'center', padding:'4px 2px', background:ratingBg(v), color:ratingTxt(v), fontSize:12, fontWeight:700, borderLeft:'1px solid rgba(255,255,255,0.06)' }}>
                            {v}
                          </td>
                        );
                      })}
                      <td style={{ textAlign:'center', padding:'4px 2px', background:ratingBg(avg), color:ratingTxt(avg), fontSize:12, fontWeight:700, borderLeft:'1px solid rgba(255,255,255,0.06)' }}>
                        {avg}
                      </td>
                      <td style={{ textAlign:'center', padding:'4px 6px' }}>
                        <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                          <button onClick={() => openMatrixEdit(row)} title="Edit" style={{ background:'none',border:'none',cursor:'pointer',color:'#60a5fa',padding:'2px 4px' }}><Edit size={13}/></button>
                          <button onClick={() => deleteMatrixRow(row.id)} title="Delete" style={{ background:'none',border:'none',cursor:'pointer',color:'#ef4444',padding:'2px 4px' }}><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {Array.from({ length: vacancies }).map((_, i) => (
                  <tr key={`vac-${pg.position}-${i}`} style={{ background:'rgba(239,68,68,0.06)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ textAlign:'center', fontSize:11, padding:'5px 6px', color:'#475569' }}>{emps.length+i+1}</td>
                    <td style={{ fontSize:11, padding:'5px 10px', color:'#ef4444', fontWeight:500, fontStyle:'italic' }}>{pg.position}</td>
                    <td style={{ fontSize:10, padding:'5px 6px', color:'#334155', textAlign:'center', fontFamily:'monospace' }}>—</td>
                    <td style={{ fontSize:10, padding:'5px 8px', color:'#334155' }}>— vacancy —</td>
                    <td style={{ textAlign:'center', fontSize:10, padding:'5px 6px', color:'#334155' }}>—</td>
                    {skills.map(s => (
                      <td key={s.key} style={{ textAlign:'center', padding:'4px 2px', color:'rgba(255,255,255,0.25)', fontSize:11, fontStyle:'italic', borderLeft:'1px solid rgba(255,255,255,0.04)', fontWeight:400 }}>
                        Nil
                      </td>
                    ))}
                    <td style={{ textAlign:'center', padding:'4px 2px', color:'rgba(255,255,255,0.25)', fontSize:11, fontStyle:'italic', borderLeft:'1px solid rgba(255,255,255,0.04)' }}>Nil</td>
                    <td style={{ textAlign:'center', padding:'4px 6px' }}/>
                  </tr>
                ))}
                <tr><td colSpan={totalCols} style={{ height:8, background:'rgba(255,255,255,0.015)' }}/></tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          { label:'Total Staff',   value: stats.total, color:'#3b82f6', icon:<Users size={18}/> },
          { label:'Present Today', value: stats.present,   color:'#22c55e', icon:<UserCheck size={18}/> },
          { label:'On Leave',      value: stats.onLeave,   color:'#f59e0b', icon:<Calendar size={18}/> },
          { label:'Absent',        value: stats.absent,    color:'#ef4444', icon:<Users size={18}/> },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ color:s.color }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:24, fontWeight:700, color:'#f1f5f9' }}>{s.value}</div>
              <div style={{ fontSize:11, color:'#64748b' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,0.03)', padding:4, borderRadius:10, border:'1px solid rgba(255,255,255,0.06)', width:'fit-content' }}>
        {[
          { key:'shift',  label:'Shift Planning' },
          { key:'skills', label:'Skill Matrix' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{
            padding:'7px 18px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight:500,
            background: tab === t.key ? '#3b82f6' : 'none', color: tab === t.key ? 'white' : '#64748b',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── SHIFT PLANNING ── */}
      {tab === 'shift' && (() => {
        const shiftGroups = SHIFT_ORDER.map(key => {
          const emps = employees.filter(e => e.shift === key);
          const engineers   = emps.filter(e => e.role === 'Engineer' || e.role === 'IT Engineer');
          const supervisors = emps.filter(e => e.role === 'Supervisor');
          const technicians = emps.filter(e => e.role === 'Technician');
          const helpers     = emps.filter(e => e.role === 'Helper');
          return { key, label: SHIFT_LABELS[key], emps, engineers, supervisors, technicians, helpers };
        }).filter(g => g.emps.length > 0);

        const ROLE_COLORS: Record<string,string> = {
          Engineer:'#3b82f6', 'IT Engineer':'#8b5cf6',
          Supervisor:'#22c55e', Technician:'#f59e0b', Helper:'#64748b',
        };

        return (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="glass-card" style={{ padding:'12px 18px', display:'flex', gap:24, alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ fontSize:12, color:'#60a5fa', fontWeight:600, textTransform:'uppercase', letterSpacing:1 }}>
                Shift Distribution — {employees.length} staff across {shiftGroups.length} shift{shiftGroups.length !== 1 ? 's' : ''}
              </div>
              {shiftGroups.map(g => (
                <div key={g.key} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#3b82f6' }}/>
                  <span style={{ color:'#94a3b8' }}>{g.key} Shift:</span>
                  <span style={{ color:'#f1f5f9', fontWeight:700 }}>{g.emps.length}</span>
                </div>
              ))}
            </div>

            {shiftGroups.map(g => (
              <div key={g.key} className="glass-card" style={{ padding:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#f1f5f9' }}>{g.label}</div>
                  <span className="badge badge-blue">{g.emps.length} staff</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 }}>
                  {[
                    { label:'Engineers',   count: g.engineers.length,   color:'#3b82f6' },
                    { label:'Supervisors', count: g.supervisors.length, color:'#22c55e' },
                    { label:'Technicians', count: g.technicians.length, color:'#f59e0b' },
                    { label:'Helpers',     count: g.helpers.length,     color:'#64748b' },
                  ].map(r => (
                    <div key={r.label} style={{ textAlign:'center', padding:'8px 4px', background:'rgba(255,255,255,0.03)', borderRadius:8 }}>
                      <div style={{ fontSize:22, fontWeight:700, color:r.color }}>{r.count}</div>
                      <div style={{ fontSize:11, color:'#64748b' }}>{r.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {g.emps.map(emp => (
                    <div key={emp.id} onClick={() => setViewEmp(emp)} style={{
                      display:'flex', alignItems:'center', gap:8, cursor:'pointer',
                      background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                      borderRadius:8, padding:'6px 10px', minWidth:180, transition:'background 0.15s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background='rgba(59,130,246,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.background='rgba(255,255,255,0.04)')}
                    >
                      <Avatar emp={emp} size={28}/>
                      <div style={{ overflow:'hidden' }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'#e2e8f0', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{emp.name}</div>
                        <div style={{ fontSize:10, color: ROLE_COLORS[emp.role] || '#64748b' }}>{emp.designation || emp.role}</div>
                      </div>
                      <div style={{ marginLeft:'auto', flexShrink:0 }}>
                        <div style={{ width:7, height:7, borderRadius:'50%', background: STATUS_COLOR[emp.status] ?? '#64748b' }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {shiftGroups.length === 0 && (
              <div className="glass-card" style={{ padding:40, textAlign:'center', color:'#475569', fontSize:13 }}>
                {empLoading ? 'Loading employees…' : 'No employees assigned to shifts yet. Use Edit to assign shifts.'}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── SKILL MATRIX ── */}
      {tab === 'skills' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Toolbar */}
          <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:8 }}>
            <button onClick={handleMatrixPDF} style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:8,border:'1.5px solid #ef4444',background:'none',color:'#ef4444',cursor:'pointer',fontSize:12,fontWeight:500 }}>
              <FileDown size={14}/> PDF Export
            </button>
            <button onClick={openMatrixAdd} style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:8,border:'none',background:'#3b82f6',color:'white',cursor:'pointer',fontSize:12,fontWeight:600 }}>
              <Plus size={14}/> Add Employee
            </button>
          </div>

          {/* E&I Matrix Table */}
          {renderSkillTable(
            EI_POSITIONS, MSKILLS, getAvg,
            'E & I — Skill Matrix',
            'Technical Skills (Rating 1–5)',
            '#1e3a5f', '#86efac',
          )}

          {/* IT Matrix Table */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8 }}>
            <div style={{ flex:1, height:1, background:'rgba(139,92,246,0.3)' }}/>
            <span style={{ fontSize:11, color:'#a78bfa', fontWeight:600, textTransform:'uppercase', letterSpacing:1.5 }}>IT Department</span>
            <div style={{ flex:1, height:1, background:'rgba(139,92,246,0.3)' }}/>
          </div>
          {renderSkillTable(
            IT_POSITIONS, IT_SKILLS, getITAvg,
            'IT — Skill Matrix',
            'IT Technical Skills (Rating 1–5)',
            '#1e1b4b', '#c4b5fd',
          )}

          {/* Rating Scale Legend */}
          <div className="glass-card" style={{ padding:'14px 20px' }}>
            <div style={{ fontSize:11, color:'#60a5fa', fontWeight:600, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>
              Rating Scale — Skill Proficiency Levels
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
              {[
                { r:5, title:'Expert',       desc:'Fully autonomous. Can handle complex scenarios and mentor others.' },
                { r:4, title:'Advanced',     desc:'Works independently with strong competency and minimal guidance.' },
                { r:3, title:'Intermediate', desc:'Performs tasks with occasional guidance; growing confidence.' },
                { r:2, title:'Basic',        desc:'Can perform simple tasks under close supervision.' },
                { r:1, title:'Beginner',     desc:'Awareness level only; requires full support and guidance.' },
              ].map(({ r, title, desc }) => (
                <div key={r} style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'10px 12px', borderTop:`3px solid ${ratingBg(r)}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <div style={{ width:28, height:28, borderRadius:6, background:ratingBg(r), display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:ratingTxt(r), flexShrink:0 }}>
                      {r}
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, color:'#e2e8f0' }}>{title}</span>
                  </div>
                  <p style={{ margin:0, fontSize:10, color:'#64748b', lineHeight:1.5 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MATRIX CRUD MODAL ── */}
      {matrixModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20 }}>
          <div className="glass-card" style={{ width:'100%',maxWidth:680,maxHeight:'92vh',overflowY:'auto',padding:24,position:'relative' }}>
            <button onClick={() => setMatrixModal(null)} style={{ position:'absolute',top:16,right:16,background:'none',border:'none',color:'#64748b',cursor:'pointer' }}><X size={18}/></button>
            <h3 style={{ margin:'0 0 20px',fontSize:15,fontWeight:700,color:'#f1f5f9' }}>
              {matrixModal === 'add' ? 'Add Employee to Skill Matrix' : 'Edit Skill Matrix Entry'}
            </h3>

            <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                <div>
                  <label style={lbl}>Full Name *</label>
                  <input style={inp} value={matrixForm.name} onChange={e => setMF('name',e.target.value)} placeholder="Mr. Employee Name"/>
                </div>
                <div>
                  <label style={lbl}>Employee ID</label>
                  <input style={inp} value={matrixForm.empId} onChange={e => setMF('empId',e.target.value)} placeholder="GT001"/>
                </div>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                <div>
                  <label style={lbl}>Position</label>
                  <select style={inp} value={matrixForm.position} onChange={e => setMF('position',e.target.value)}>
                    {ALL_POSITIONS.map(p => <option key={p.position}>{p.position}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Experience (years)</label>
                  <input style={inp} type="number" min={0} max={50} value={matrixForm.experience} onChange={e => setMF('experience',Number(e.target.value))}/>
                </div>
              </div>

              {/* E&I Skill ratings */}
              {matrixForm.position !== 'IT Engineer' && (
                <>
                  <div style={{ fontSize:11,color:'#3b82f6',fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginTop:4 }}>
                    E&I Skill Ratings (1 = Beginner · 5 = Expert)
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                    {MSKILLS.map(s => (
                      <div key={s.key}>
                        <label style={lbl}>{s.label}</label>
                        <div style={{ display:'flex',gap:6 }}>
                          {[1,2,3,4,5].map(v => {
                            const cur = matrixForm[s.key] as number;
                            return (
                              <button key={v} onClick={() => setMF(s.key, v)} style={{
                                width:36,height:36,borderRadius:6,border:'2px solid',fontWeight:700,fontSize:13,cursor:'pointer',
                                background: cur === v ? ratingBg(v) : 'rgba(255,255,255,0.04)',
                                color: cur === v ? ratingTxt(v) : '#64748b',
                                borderColor: cur === v ? ratingBg(v) : 'rgba(255,255,255,0.1)',
                              }}>{v}</button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* IT Skill ratings */}
              {matrixForm.position === 'IT Engineer' && (
                <>
                  <div style={{ fontSize:11,color:'#8b5cf6',fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginTop:4 }}>
                    IT Skill Ratings (1 = Beginner · 5 = Expert)
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                    {IT_SKILLS.map(s => (
                      <div key={s.key}>
                        <label style={lbl}>{s.label}</label>
                        <div style={{ display:'flex',gap:6 }}>
                          {[1,2,3,4,5].map(v => {
                            const cur = matrixForm[s.key] as number;
                            return (
                              <button key={v} onClick={() => setMF(s.key, v)} style={{
                                width:36,height:36,borderRadius:6,border:'2px solid',fontWeight:700,fontSize:13,cursor:'pointer',
                                background: cur === v ? ratingBg(v) : 'rgba(255,255,255,0.04)',
                                color: cur === v ? ratingTxt(v) : '#64748b',
                                borderColor: cur === v ? ratingBg(v) : 'rgba(255,255,255,0.1)',
                              }}>{v}</button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:6 }}>
                <button className="btn-secondary" onClick={() => setMatrixModal(null)} style={{ fontSize:13 }}>Cancel</button>
                <button onClick={handleMatrixSave} style={{
                  padding:'9px 20px',borderRadius:8,border:'none',cursor:'pointer',fontSize:13,fontWeight:600,
                  background: matrixSaved ? '#22c55e' : '#3b82f6', color:'white',
                  display:'flex',alignItems:'center',gap:6,transition:'background 0.3s',
                }}>
                  <Save size={14}/> {matrixSaved ? 'Saved!' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW DETAIL MODAL ── */}
      {viewEmp && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
          <div className="glass-card" style={{ width:'100%', maxWidth:580, maxHeight:'92vh', overflowY:'auto', padding:24, position:'relative' }}>
            <button onClick={() => setViewEmp(null)} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={18}/></button>
            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
              {viewEmp.photo ? (
                <img src={viewEmp.photo} alt={viewEmp.name} style={{ width:68, height:68, borderRadius:'50%', objectFit:'cover', border:'2px solid #3b82f6', flexShrink:0 }}/>
              ) : (
                <div style={{ width:68, height:68, borderRadius:'50%', background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700, color:'white', flexShrink:0 }}>
                  {viewEmp.name.split(' ').map((n:string) => n[0]).join('')}
                </div>
              )}
              <div>
                <div style={{ fontSize:17, fontWeight:700, color:'#f1f5f9' }}>{viewEmp.name}</div>
                <div style={{ fontSize:12, color:'#60a5fa' }}>{viewEmp.designation} · {viewEmp.empId}</div>
                <div style={{ fontSize:11, color: DEPT_COLOR[viewEmp.department]||'#64748b', marginTop:2 }}>{viewEmp.department} Department</div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              {[
                ['Role', viewEmp.role], ['Shift', viewEmp.shift+' Shift'],
                ['Status', viewEmp.status], ['Experience', viewEmp.experience+' years'],
                ['Nationality', viewEmp.nationality], ['Country of Origin', viewEmp.countryOfOrigin||'—'],
                ['Email', viewEmp.email], ['Date of Joining', viewEmp.dateOfJoining],
              ].map(([l,v]) => (
                <div key={l} style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'10px 14px' }}>
                  <div style={{ fontSize:10, color:'#64748b', marginBottom:2 }}>{l}</div>
                  <div style={{ fontSize:13, color:'#e2e8f0', fontWeight:500, textTransform: l==='Status' ? 'capitalize' : undefined }}>{v}</div>
                </div>
              ))}
            </div>
            {viewEmp.address && (
              <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'10px 14px', marginBottom:12 }}>
                <div style={{ fontSize:10, color:'#64748b', marginBottom:4, display:'flex', alignItems:'center', gap:5 }}><MapPin size={11}/> Residential Address</div>
                <div style={{ fontSize:13, color:'#e2e8f0' }}>{viewEmp.address}</div>
              </div>
            )}
            <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'12px 14px', marginBottom:12 }}>
              <div style={{ fontSize:11, color:'#64748b', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}><Phone size={12}/> Contact Numbers</div>
              {[['India Number', viewEmp.indiaPhone], ['UAE Personal Number', viewEmp.uaePhone], ['UAE Company Number', viewEmp.uaeCompanyPhone]].map(([l,v]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                  <span style={{ color:'#64748b' }}>{l}</span>
                  <span style={{ color:'#e2e8f0', fontWeight:500 }}>{v||'—'}</span>
                </div>
              ))}
            </div>
            <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'10px 14px', marginBottom:16 }}>
              <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>Skills</div>
              <div style={{ fontSize:13, color:'#e2e8f0' }}>{viewEmp.skill||'—'}</div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn-primary" onClick={() => { setViewEmp(null); openEdit(viewEmp); }} style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
                <Edit size={12}/> Edit Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT EMPLOYEE MODAL ── */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
          <div className="glass-card" style={{ width:'100%', maxWidth:640, maxHeight:'92vh', overflowY:'auto', padding:24, position:'relative' }}>
            <button onClick={() => setModal(null)} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={18}/></button>
            <h3 style={{ margin:'0 0 20px', fontSize:16, fontWeight:700, color:'#f1f5f9' }}>
              {modal === 'add' ? 'Add New Employee' : 'Edit Employee'}
            </h3>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={lbl}>Profile Photo</label>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <div onClick={() => fileRef.current?.click()} style={{
                    width:68, height:68, borderRadius:'50%', flexShrink:0,
                    background: form.photo ? 'transparent' : 'rgba(255,255,255,0.04)',
                    border:'2px dashed rgba(255,255,255,0.12)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    overflow:'hidden', cursor:'pointer',
                  }}>
                    {form.photo
                      ? <img src={form.photo} alt="preview" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                      : <Camera size={22} color="#475569"/>}
                  </div>
                  <div>
                    <button className="btn-secondary" onClick={() => fileRef.current?.click()} style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
                      <Camera size={12}/> {form.photo ? 'Change Photo' : 'Upload Photo'}
                    </button>
                    {form.photo && (
                      <button onClick={() => set('photo','')} style={{ marginTop:4, background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:11, padding:0 }}>Remove</button>
                    )}
                    <div style={{ fontSize:10, color:'#475569', marginTop:4 }}>JPG or PNG, max 2 MB</div>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhoto}/>
                </div>
              </div>
              <div style={sec}>Basic Information</div>
              <div style={r2}>
                <div><label style={lbl}>Full Name *</label><input style={inp} value={form.name} onChange={e => set('name',e.target.value)} placeholder="Employee Full Name"/></div>
                <div><label style={lbl}>Employee ID *</label><input style={inp} value={form.empId} onChange={e => set('empId',e.target.value)} placeholder="EMP-001"/></div>
              </div>
              <div style={r2}>
                <div><label style={lbl}>Designation</label><input style={inp} value={form.designation} onChange={e => set('designation',e.target.value)} placeholder="e.g. Senior Engineer"/></div>
                <div>
                  <label style={lbl}>Role</label>
                  <select style={inp} value={form.role} onChange={e => set('role',e.target.value)}>
                    <option>Manager</option><option>Deputy Manager</option><option>Engineer</option><option>IT Engineer</option><option>Supervisor</option><option>Technician</option><option>Helper</option>
                  </select>
                </div>
              </div>
              <div style={r2}>
                <div>
                  <label style={lbl}>Department</label>
                  <select style={inp} value={form.department} onChange={e => set('department',e.target.value)}>
                    <option>Electrical &amp; Instrumentation</option><option>IT</option><option>Mechanical</option><option>Civil</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Shift</label>
                  <select style={inp} value={form.shift} onChange={e => set('shift',e.target.value)}>
                    <option value="A">A Shift (06–14h)</option>
                    <option value="B">B Shift (14–22h)</option>
                    <option value="C">C Shift (22–06h)</option>
                    <option value="G">General (09–17h)</option>
                  </select>
                </div>
              </div>
              <div style={r2}>
                <div>
                  <label style={lbl}>Status</label>
                  <select style={inp} value={form.status} onChange={e => set('status',e.target.value)}>
                    <option value="present">Present</option><option value="leave">Leave</option><option value="absent">Absent</option>
                  </select>
                </div>
                <div><label style={lbl}>Experience (years)</label><input style={inp} type="number" min={0} value={form.experience} onChange={e => set('experience',Number(e.target.value))}/></div>
              </div>
              <div style={r2}>
                <div><label style={lbl}>Email</label><input style={inp} type="email" value={form.email} onChange={e => set('email',e.target.value)} placeholder="employee@mms.com"/></div>
                <div><label style={lbl}>Date of Joining</label><input style={inp} type="date" value={form.dateOfJoining} onChange={e => set('dateOfJoining',e.target.value)}/></div>
              </div>
              <div style={r2}>
                <div><label style={lbl}>Nationality</label><input style={inp} value={form.nationality} onChange={e => set('nationality',e.target.value)} placeholder="e.g. Indian"/></div>
                <div><label style={lbl}>Country of Origin</label><input style={inp} value={form.countryOfOrigin||''} onChange={e => set('countryOfOrigin',e.target.value)} placeholder="e.g. India, Philippines"/></div>
              </div>
              <div><label style={lbl}>Skills</label><input style={inp} value={form.skill} onChange={e => set('skill',e.target.value)} placeholder="PLC, SCADA, VFD..."/></div>
              <div style={sec}><MapPin size={12}/> Address</div>
              <div>
                <label style={lbl}>Residential Address</label>
                <textarea style={{ ...inp, minHeight:70, resize:'vertical' }} value={form.address||''} onChange={e => set('address',e.target.value)} placeholder="Full residential address..."/>
              </div>
              <div style={sec}><Phone size={12}/> Contact Numbers</div>
              <div><label style={lbl}>India Phone Number</label><input style={inp} value={form.indiaPhone} onChange={e => set('indiaPhone',e.target.value)} placeholder="+91 XXXXX XXXXX"/></div>
              <div><label style={lbl}>UAE Personal Number</label><input style={inp} value={form.uaePhone} onChange={e => set('uaePhone',e.target.value)} placeholder="+971 5X XXX XXXX"/></div>
              <div><label style={lbl}>UAE Company Number</label><input style={inp} value={form.uaeCompanyPhone} onChange={e => set('uaeCompanyPhone',e.target.value)} placeholder="+971 4 XXX XXXX"/></div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:6 }}>
                <button className="btn-secondary" onClick={() => setModal(null)} style={{ fontSize:13 }}>Cancel</button>
                <button onClick={handleSave} style={{
                  padding:'9px 20px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                  background: saved ? '#22c55e' : '#3b82f6', color:'white',
                  display:'flex', alignItems:'center', gap:6, transition:'background 0.3s',
                }}>
                  <Save size={14}/> {saved ? 'Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
