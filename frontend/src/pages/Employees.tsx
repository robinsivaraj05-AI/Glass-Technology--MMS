import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Users, UserCheck, UserX, UserPlus, AlertTriangle, Search, Download,
  Eye, CheckCircle, XCircle, Clock, FileText, X, Shield, Plus, Trash2, Upload,
} from 'lucide-react';
import EmployeeBulkUpload from './EmployeeBulkUpload';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type FullEmployee, type ResignationDetails } from '../data/employeeData';
import { useEmployees } from '../context/EmployeeContext';
import { apiFetch } from '../utils/api';

const STATUS_COLOR: Record<string, string> = {
  active: '#22c55e', on_leave: '#f59e0b', suspended: '#ef4444', resigned: '#64748b', not_joined: '#f97316',
};
const STATUS_LABEL: Record<string, string> = {
  active: 'Active', on_leave: 'On Leave', suspended: 'Suspended', resigned: 'Resigned', not_joined: 'Not Yet Joined',
};
const DEPT_COLOR = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444'];

const BLANK_EMP_FORM = {
  name: '', empId: '', designation: '', department: 'Electrical & Instrumentation',
  section: '', reportingManager: '', employeeType: 'Permanent', grade: '',
  nationality: 'Indian', gender: 'Male', dateOfBirth: '', bloodGroup: '',
  maritalStatus: 'Single', indiaPhone: '', uaePhone: '', companyPhone: '',
  personalEmail: '', companyEmail: '', joiningDate: '', yearsOfExperience: '',
  currentAddress: '', permanentAddress: '',
  emergencyContactPerson: '', emergencyContactNumber: '',
  emiratesId: '', passportNo: '', visaExpiry: '', passportExpiry: '',
};

const BLANK_RESIGN_FORM = {
  empId: '', resignationDate: '', noticePeriod: '30 Days', lastWorkingDate: '',
  submittedTo: '', approvedBy: '', approvalDate: '', exitInterviewDate: '',
  reason: 'Family Relocation', employeeRemarks: '', managerComments: '', hrComments: '', rootCause: '',
};

function certStatus(expiry: string): 'valid' | 'expiring' | 'expired' | 'none' {
  if (!expiry) return 'none';
  const diff = (new Date(expiry).getTime() - Date.now()) / 86400000;
  if (diff < 0) return 'expired';
  if (diff <= 60) return 'expiring';
  return 'valid';
}
function daysDiff(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}
function tenure(joinDate: string, endDate?: string): string {
  const from = new Date(joinDate);
  const to   = endDate ? new Date(endDate) : new Date();
  if (isNaN(from.getTime())) return '—';
  let years  = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years === 0) return `${months}m`;
  if (months === 0) return `${years}y`;
  return `${years}y ${months}m`;
}
function totalExp(prevYears: number, joinDate: string, endDate?: string): string {
  const from = new Date(joinDate);
  const to   = endDate ? new Date(endDate) : new Date();
  if (isNaN(from.getTime())) return `${prevYears}y`;
  let tenureY = to.getFullYear() - from.getFullYear();
  let tenureM = to.getMonth() - from.getMonth();
  if (tenureM < 0) { tenureY--; tenureM += 12; }
  const totalM = prevYears * 12 + tenureY * 12 + tenureM;
  const y = Math.floor(totalM / 12);
  const m = totalM % 12;
  return m === 0 ? `${y}y` : `${y}y ${m}m`;
}

const lbl: React.CSSProperties = { fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#1e293b', fontSize: 12, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' };

function FRow({ label, field, form, setFn, type = 'text', options }: {
  label: string; field: string; form: Record<string, any>;
  setFn: (f: string, v: string) => void; type?: string; options?: string[];
}) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      {options ? (
        <select value={form[field]} onChange={e => setFn(field, e.target.value)} style={inp}>
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={form[field]} onChange={e => setFn(field, e.target.value)} placeholder={label} style={inp} />
      )}
    </div>
  );
}

export default function Employees() {
  const navigate = useNavigate();
  const { employees, loading, addEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const { user } = useAuth();
  const isAdmin = user?.role === 'manager';

  const location = useLocation();
  const [tab, setTab]               = useState<'directory' | 'resigned'>(
    (location.state as any)?.tab === 'resigned' ? 'resigned' : 'directory',
  );
  const [search, setSearch]         = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterNat, setFilterNat]   = useState('all');
  const [selectedResignedId, setSelectedResignedId] = useState<string | null>(null);

  // Bulk Upload modal
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // Add Employee modal
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [empForm, setEmpForm] = useState({ ...BLANK_EMP_FORM });
  const setEF = (f: string, v: string) => setEmpForm(p => ({ ...p, [f]: v }));

  // Add Resignation modal
  const [showAddResign, setShowAddResign] = useState(false);
  const [resignForm, setResignForm] = useState({ ...BLANK_RESIGN_FORM });
  const setRF = (f: string, v: string) => setResignForm(p => ({ ...p, [f]: v }));
  const [resignedDetailTab, setResignedDetailTab] = useState<'overview' | 'attendance' | 'training' | 'skills'>('overview');
  const [resignedAttRecords, setResignedAttRecords] = useState<any[]>([]);
  const [loadingResignedAtt, setLoadingResignedAtt] = useState(false);

  // Fetch real attendance records from AttendanceRecord collection when Attendance tab is open
  useEffect(() => {
    if (resignedDetailTab !== 'attendance' || !selectedResignedId) {
      setResignedAttRecords([]);
      return;
    }
    const emp = employees.find(e => e.id === selectedResignedId);
    if (!emp?.empId) return;
    setLoadingResignedAtt(true);
    apiFetch(`/api/attendance/employee/${emp.empId}`)
      .then((data: any[]) => setResignedAttRecords(Array.isArray(data) ? data : []))
      .catch(() => setResignedAttRecords([]))
      .finally(() => setLoadingResignedAtt(false));
  }, [resignedDetailTab, selectedResignedId, employees]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(59,130,246,0.3)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ color: '#64748b', fontSize: 13 }}>Loading employees from database…</div>
    </div>
  );

  // Always read live data from context so profile edits reflect immediately in the modal
  const selectedResigned = selectedResignedId
    ? (employees.find(e => e.id === selectedResignedId) ?? null)
    : null;


  const active   = employees.filter(e => e.status === 'active');
  const onLeave  = employees.filter(e => e.status === 'on_leave');
  const resigned = employees.filter(e => e.status === 'resigned');
  const newJoiners = employees.filter(e => {
    const d = new Date(e.joiningDate);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const deptDist = Array.from(
    employees.reduce((m, e) => { m.set(e.department, (m.get(e.department) || 0) + 1); return m; }, new Map<string, number>())
  ).map(([name, value]) => ({ name: name === 'Electrical & Instrumentation' ? 'E&I' : name, value }));

  const expDist = [
    { range: '0–2 yrs', count: employees.filter(e => e.yearsOfExperience <= 2).length },
    { range: '2–5 yrs', count: employees.filter(e => e.yearsOfExperience > 2 && e.yearsOfExperience <= 5).length },
    { range: '5–10 yrs', count: employees.filter(e => e.yearsOfExperience > 5 && e.yearsOfExperience <= 10).length },
    { range: '10+ yrs', count: employees.filter(e => e.yearsOfExperience > 10).length },
  ];

  const allQuals = employees.flatMap(e => e.qualifications);
  const certSummary = [
    { name: 'Valid',    value: allQuals.filter(q => certStatus(q.expiryDate) === 'valid').length,    color: '#22c55e' },
    { name: 'Expiring', value: allQuals.filter(q => certStatus(q.expiryDate) === 'expiring').length, color: '#f59e0b' },
    { name: 'Expired',  value: allQuals.filter(q => certStatus(q.expiryDate) === 'expired').length,  color: '#ef4444' },
  ];

  const resignTrend = [
    { month: 'Jan', resigned: 0 }, { month: 'Feb', resigned: 0 }, { month: 'Mar', resigned: 1 },
    { month: 'Apr', resigned: 0 }, { month: 'May', resigned: 0 }, { month: 'Jun', resigned: 0 },
    { month: 'Jul', resigned: 0 }, { month: 'Aug', resigned: 0 }, { month: 'Sep', resigned: 0 },
    { month: 'Oct', resigned: 1 }, { month: 'Nov', resigned: 0 }, { month: 'Dec', resigned: 0 },
  ];

  const visaAlerts = employees.filter(e => e.status !== 'resigned' && daysDiff(e.visaExpiry) <= 120)
    .sort((a, b) => daysDiff(a.visaExpiry) - daysDiff(b.visaExpiry));
  const certAlerts = employees.filter(e => e.status !== 'resigned').flatMap(e =>
    e.qualifications.filter(q => certStatus(q.expiryDate) !== 'none' && certStatus(q.expiryDate) !== 'valid')
      .map(q => ({ emp: e, qual: q, status: certStatus(q.expiryDate), days: daysDiff(q.expiryDate) }))
  );

  const depts = Array.from(new Set(employees.map(e => e.department)));
  const nationalities = Array.from(new Set(employees.map(e => e.nationality)));
  // Designation sort rank — lower number = higher in list
  function designationRank(d: string): number {
    const s = d.toLowerCase();
    if (s.includes('manager') && !s.includes('deputy') && !s.includes('asst')) return 0;
    if (s.includes('deputy'))          return 1;
    if (s.includes('automation'))      return 2;
    if (s.includes('general') && s.includes('shift')) return 3;
    if (s.includes('shift'))           return 4;
    if (s.includes('junior'))          return 5;
    if (s.includes('team'))            return 6;
    if (s.includes('it') || s.includes('system')) return 7;
    return 8;
  }

  const filtered = employees
    .filter(e => {
      if (e.status === 'resigned') return false;
      const t = search.toLowerCase();
      const email = e.companyEmail || e.personalEmail || '';
      const matchSearch = !t || e.name.toLowerCase().includes(t) || e.empId.toLowerCase().includes(t) ||
        email.toLowerCase().includes(t) || e.uaePhone.includes(t);
      const matchDept   = filterDept === 'all' || e.department === filterDept;
      const matchStatus = filterStatus === 'all' || e.status === filterStatus;
      const matchNat    = filterNat === 'all' || e.nationality === filterNat;
      return matchSearch && matchDept && matchStatus && matchNat;
    })
    .sort((a, b) => {
      const rankDiff = designationRank(a.designation) - designationRank(b.designation);
      if (rankDiff !== 0) return rankDiff;
      // Same designation level → sort by experience descending
      return (b.yearsOfExperience ?? 0) - (a.yearsOfExperience ?? 0);
    });

  const activeEmployees = employees.filter(e => e.status === 'active' || e.status === 'on_leave');

  // Add Employee handler
  const handleAddEmployee = () => {
    if (!empForm.name.trim() || !empForm.designation.trim()) return;
    const newId = `emp-${Date.now()}`;
    const newEmpId = empForm.empId.trim() || `EMP-${String(employees.length + 1).padStart(3, '0')}`;
    const newEmp: FullEmployee = {
      id: newId, empId: newEmpId, name: empForm.name.trim(), photo: '',
      designation: empForm.designation, department: empForm.department, section: empForm.section,
      reportingManager: empForm.reportingManager, employeeType: empForm.employeeType, grade: empForm.grade,
      nationality: empForm.nationality, dateOfBirth: empForm.dateOfBirth, gender: empForm.gender,
      bloodGroup: empForm.bloodGroup, maritalStatus: empForm.maritalStatus,
      indiaPhone: empForm.indiaPhone, uaePhone: empForm.uaePhone, companyPhone: empForm.companyPhone,
      personalEmail: empForm.personalEmail, companyEmail: empForm.companyEmail,
      currentAddress: empForm.currentAddress, permanentAddress: empForm.permanentAddress,
      emergencyContactPerson: empForm.emergencyContactPerson, emergencyContactNumber: empForm.emergencyContactNumber,
      emiratesId: empForm.emiratesId, passportNo: empForm.passportNo,
      visaExpiry: empForm.visaExpiry, passportExpiry: empForm.passportExpiry,
      joiningDate: empForm.joiningDate, yearsOfExperience: parseInt(empForm.yearsOfExperience) || 0,
      status: 'active',
      employmentHistory: [], education: [], qualifications: [], skills: [],
      documents: [], performance: [],
      attendance: { workingDays: 0, present: 0, absent: 0, leave: 0, lateEntry: 0, earlyExit: 0, overtime: 0, monthly: [] },
      leaves: [], training: [], promotions: [],
    };
    addEmployee(newEmp);
    setEmpForm({ ...BLANK_EMP_FORM });
    setShowAddEmp(false);
  };

  // Add Resignation handler
  const handleAddResignation = () => {
    if (!resignForm.empId || !resignForm.resignationDate || !resignForm.lastWorkingDate) return;
    const clearance = [
      'Company ID Card Returned', 'Laptop Returned', 'Mobile Phone Returned',
      'Uniform Returned', 'PPE Returned', 'Office Keys Returned', 'Documents Submitted',
      'Handover Completed', 'Knowledge Transfer Completed', 'Finance Clearance',
      'IT Clearance', 'HR Clearance', 'Administration Clearance',
    ].map(item => ({ item, completed: false }));

    const resigningEmp = employees.find(e => e.id === resignForm.empId);
    updateEmployee(resignForm.empId, {
      status: 'resigned',
      resignation: {
        resignationDate: resignForm.resignationDate, noticePeriod: resignForm.noticePeriod,
        lastWorkingDate: resignForm.lastWorkingDate, submittedTo: resignForm.submittedTo,
        approvedBy: resignForm.approvedBy, approvalDate: resignForm.approvalDate,
        exitInterviewDate: resignForm.exitInterviewDate, exitInterviewNotes: '',
        reason: resignForm.reason, employeeRemarks: resignForm.employeeRemarks,
        managerComments: resignForm.managerComments, hrComments: resignForm.hrComments,
        rootCause: resignForm.rootCause, lessonsLearned: '', retentionActions: '',
        clearance,
      },
    });
    if (resigningEmp) {
      // Remove from org chart positions
      if (resigningEmp.name) {
        apiFetch('/api/org-positions/clear-person', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: resigningEmp.name }),
        }).catch(() => {});
      }
      // Remove directly from attendance team roster
      if (resigningEmp.empId) {
        apiFetch(`/api/attendance/team/${resigningEmp.empId}`, {
          method: 'DELETE',
        }).catch(() => {});
      }
    }
    setResignForm({ ...BLANK_RESIGN_FORM });
    setShowAddResign(false);
  };

  // Delete resigned employee
  const handleDeleteResigned = (id: string) => {
    deleteEmployee(id);
    if (selectedResignedId === id) setSelectedResignedId(null);
  };

  const exportToExcel = () => {
    const data = filtered.map(e => ({
      'Emp ID': e.empId,
      'Name': e.name,
      'Department': e.department,
      'Designation': e.designation,
      'Nationality': e.nationality,
      'UAE Phone': e.uaePhone,
      'Email': e.companyEmail,
      'Joining Date': e.joiningDate,
      'Experience (yrs)': e.yearsOfExperience,
      'Status': STATUS_LABEL[e.status] ?? e.status,
      'Reporting Manager': e.reportingManager,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, `Employee_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Employee Directory', 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString()}   |   Total: ${filtered.length} employee(s)`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [['Emp ID', 'Name', 'Department', 'Designation', 'Nationality', 'UAE Phone', 'Email', 'Joined', 'Exp', 'Status']],
      body: filtered.map(e => [
        e.empId, e.name, e.department, e.designation, e.nationality,
        e.uaePhone, e.companyEmail, e.joiningDate,
        `${totalExp(e.yearsOfExperience, e.joiningDate)} (${tenure(e.joiningDate)})`, STATUS_LABEL[e.status] ?? e.status,
      ]),
      styles: { fontSize: 7.5 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    doc.save(`Employee_Directory_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const TABS = [
    { key: 'directory', label: 'Employee Directory' },
    { key: 'resigned',  label: 'Resigned Employees' },
  ];

  const CardStat = ({ label, value, color, icon }: any) => (
    <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ color, fontSize: 20 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#1e293b' }}>{value}</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
      </div>
    </div>
  );

  const AlertRow = ({ color, label, days, name, sub }: any) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: color + '10', borderRadius: 8, border: `1px solid ${color}30`, marginBottom: 6 }}>
      <AlertTriangle size={13} color={color} />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{name}</span>
        <span style={{ fontSize: 11, color: '#64748b' }}> — {sub}</span>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, background: color + '20', padding: '2px 8px', borderRadius: 20 }}>
        {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d left`}
      </span>
      <span style={{ fontSize: 10, color: '#475569' }}>{label}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{
            padding: '7px 20px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
            background: tab === t.key ? '#3b82f6' : 'none', color: tab === t.key ? 'white' : '#64748b',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── DIRECTORY ── */}
      {tab === 'directory' && (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, ID, email, phone..." className="input-dark" style={{ paddingLeft: 30 }} />
            </div>
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="input-dark" style={{ width: 180 }}>
              <option value="all">All Departments</option>
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-dark" style={{ width: 130 }}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="suspended">Suspended</option>
            </select>
            <select value={filterNat} onChange={e => setFilterNat(e.target.value)} className="input-dark" style={{ width: 130 }}>
              <option value="all">All Nationality</option>
              {nationalities.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button onClick={exportToExcel} className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Download size={13} /> Excel
            </button>
            <button onClick={exportToPDF} className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Download size={13} /> PDF
            </button>
            <button onClick={() => setShowBulkUpload(true)} className="btn-secondary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Upload size={13} /> Bulk Upload
            </button>
            <button onClick={() => setShowAddEmp(true)} className="btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={13} /> Add Employee
            </button>
          </div>

          <div style={{ fontSize: 11, color: '#64748b' }}>{filtered.length} employees found</div>

          <div className="glass-card" style={{ overflow: 'auto', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Emp ID</th><th>Name</th><th>Department</th>
                  <th>Designation</th><th>Manager</th><th>Mobile</th><th>Email</th>
                  <th>Joined</th><th>Exp.</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const displayEmail = e.companyEmail || e.personalEmail || '';
                  const isPersonalEmail = !e.companyEmail && !!e.personalEmail;
                  return (
                  <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/employees/${e.id}`)}>
                    <td style={{ fontFamily: 'monospace', color: '#60a5fa', fontSize: 11 }}>{e.empId}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {e.photo ? (
                          <img src={e.photo} alt={e.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(59,130,246,0.4)' }} />
                        ) : (
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                            {e.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </div>
                        )}
                        <span style={{ color: '#374151', fontSize: 13 }}>{e.name}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 11, color: '#94a3b8' }}>{e.department}</td>
                    <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{e.designation}</span></td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{e.reportingManager}</td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{e.uaePhone}</td>
                    <td style={{ fontSize: 11, color: isPersonalEmail ? '#f59e0b' : '#64748b' }} title={isPersonalEmail ? 'Personal email (no company email)' : ''}>
                      {displayEmail || '—'}
                    </td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{e.joiningDate}</td>
                    <td style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {totalExp(e.yearsOfExperience, e.joiningDate)}{' '}
                      <span style={{ color: '#64748b', fontSize: 10 }}>({tenure(e.joiningDate)})</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 10, fontWeight: 600, color: STATUS_COLOR[e.status], background: STATUS_COLOR[e.status] + '20', padding: '2px 8px', borderRadius: 20 }}>
                        {STATUS_LABEL[e.status]}
                      </span>
                    </td>
                    <td onClick={ev => ev.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <button onClick={() => navigate(`/employees/${e.id}`)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Eye size={11} /> View
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => { if (window.confirm(`Delete ${e.name}'s record permanently?`)) deleteEmployee(e.id); }}
                            style={{ padding: '4px 8px', fontSize: 11, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={11} style={{ textAlign: 'center', color: '#475569', padding: 32, fontSize: 13 }}>No employees found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── RESIGNED ── */}
      {tab === 'resigned' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setShowAddResign(true)} className="btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={13} /> Add Resignation
            </button>
          </div>

          <div className="glass-card" style={{ overflow: 'auto', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Emp ID</th><th>Name</th><th>Department</th>
                  <th>Designation</th><th>Joined</th><th>Last Day</th><th>Service</th>
                  <th>Manager</th><th>Exit Interview</th><th>Clearance</th><th>Rehire</th><th></th>
                </tr>
              </thead>
              <tbody>
                {resigned.map(e => {
                  const res = e.resignation;
                  if (!res) return null;
                  const done  = res.clearance.filter(c => c.completed).length;
                  const total = res.clearance.length || 1;
                  const pct   = Math.round((done / total) * 100);
                  const svc   = Math.round((new Date(res.lastWorkingDate).getTime() - new Date(e.joiningDate).getTime()) / 31536000000);
                  return (
                    <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => { setResignedDetailTab('overview'); setSelectedResignedId(e.id); }}>
                      <td style={{ fontFamily: 'monospace', color: '#60a5fa', fontSize: 11 }}>{e.empId}</td>
                      <td style={{ fontWeight: 600, color: '#374151' }}>{e.name}</td>
                      <td style={{ fontSize: 11, color: '#94a3b8' }}>{e.department}</td>
                      <td><span className="badge badge-gray" style={{ fontSize: 10 }}>{e.designation}</span></td>
                      <td style={{ fontSize: 11, color: '#64748b' }}>{e.joiningDate}</td>
                      <td style={{ fontSize: 11, color: '#64748b' }}>{res.lastWorkingDate}</td>
                      <td style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {totalExp(e.yearsOfExperience, e.joiningDate, res.lastWorkingDate)}{' '}
                        <span style={{ color: '#64748b', fontSize: 10 }}>({tenure(e.joiningDate, res.lastWorkingDate)})</span>
                      </td>
                      <td style={{ fontSize: 11, color: '#64748b' }}>{e.reportingManager}</td>
                      <td>
                        <span style={{ fontSize: 10, color: res.exitInterviewDate ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>
                          {res.exitInterviewDate ? 'Done' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, minWidth: 60 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#22c55e' : '#f59e0b', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 10, color: '#64748b' }}>{pct}%</span>
                        </div>
                      </td>
                      <td><span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>Eligible</span></td>
                      <td onClick={ev => ev.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => { setResignedDetailTab('overview'); setSelectedResignedId(e.id); }} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Eye size={11} /> Details
                          </button>
                          <button
                            onClick={() => { if (window.confirm(`Delete ${e.name}'s record permanently?`)) handleDeleteResigned(e.id); }}
                            style={{ padding: '4px 8px', fontSize: 11, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {resigned.length === 0 && (
                  <tr><td colSpan={12} style={{ textAlign: 'center', color: '#475569', padding: 32, fontSize: 13 }}>No resignation records</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Resignation Detail Modal */}
          {selectedResigned && selectedResigned.resignation && (() => {
            const res = selectedResigned.resignation;
            const done  = res.clearance.filter(c => c.completed).length;
            const total = res.clearance.length || 1;
            const pct   = Math.round((done / total) * 100);
            const att   = selectedResigned.attendance;
            const DETAIL_TABS = [
              { key: 'overview',    label: 'Overview' },
              { key: 'attendance',  label: 'Attendance' },
              { key: 'training',    label: 'Training' },
              { key: 'skills',      label: 'Skills & Certs' },
            ];
            return (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                <div className="glass-card" style={{ width: '100%', maxWidth: 780, maxHeight: '92vh', overflowY: 'auto', padding: 24, position: 'relative' }}>
                  <button onClick={() => setSelectedResignedId(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>

                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#64748b,#475569)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {selectedResigned.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{selectedResigned.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{selectedResigned.designation} · {selectedResigned.empId}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Last Working Day: {res.lastWorkingDate || '—'}</div>
                    </div>
                    <button onClick={() => { setSelectedResignedId(null); navigate(`/employees/${selectedResigned.id}`); }}
                      style={{ padding: '6px 12px', fontSize: 12, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 7, color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <Eye size={13} /> Full Profile
                    </button>
                    <button onClick={() => { if (window.confirm(`Delete ${selectedResigned.name}'s record permanently?`)) handleDeleteResigned(selectedResigned.id); }}
                      style={{ padding: '6px 12px', fontSize: 12, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>

                  {/* Tab bar */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
                    {DETAIL_TABS.map(t => (
                      <button key={t.key} onClick={() => setResignedDetailTab(t.key as any)} style={{
                        padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                        background: resignedDetailTab === t.key ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                        color: resignedDetailTab === t.key ? 'white' : '#94a3b8',
                      }}>{t.label}</button>
                    ))}
                  </div>

                  {/* ── OVERVIEW TAB ── */}
                  {resignedDetailTab === 'overview' && <>
                    <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Resignation Information</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                      {([
                        ['Resignation Date', res.resignationDate], ['Notice Period', res.noticePeriod],
                        ['Last Working Date', res.lastWorkingDate], ['Submitted To', res.submittedTo],
                        ['Approved By', res.approvedBy], ['Approval Date', res.approvalDate],
                        ['Exit Interview Date', res.exitInterviewDate], ['Reason', res.reason],
                      ] as [string, string][]).map(([l, v]) => (
                        <div key={l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
                          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{l}</div>
                          <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{v || '—'}</div>
                        </div>
                      ))}
                    </div>
                    {([
                      ['Employee Remarks', res.employeeRemarks],
                      ['Manager Comments', res.managerComments],
                      ['HR Comments', res.hrComments],
                      ['Root Cause Analysis', res.rootCause],
                      ['Lessons Learned', res.lessonsLearned],
                    ] as [string, string][]).map(([l, v]) => (
                      <div key={l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>{l}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>{v || '—'}</div>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 10 }}>
                      Final Clearance — {pct}% Complete
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, marginBottom: 12 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#22c55e' : '#f59e0b', borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {res.clearance.map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                          {c.completed ? <CheckCircle size={14} color="#22c55e" /> : <XCircle size={14} color="#ef4444" />}
                          <span style={{ fontSize: 12, color: c.completed ? '#94a3b8' : '#f1f5f9' }}>{c.item}</span>
                        </div>
                      ))}
                    </div>
                  </>}

                  {/* ── ATTENDANCE TAB ── */}
                  {resignedDetailTab === 'attendance' && (() => {
                    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    const WORK_CODES  = new Set(['PR','WH','SD','OD','A','B','C','RP']);
                    const LEAVE_CODES = new Set(['AL','PL','SL','CO']);

                    if (loadingResignedAtt) return (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 }}>
                        <div style={{ width: 20, height: 20, border: '2px solid rgba(59,130,246,0.3)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
                        <span style={{ color: '#64748b', fontSize: 13 }}>Loading attendance…</span>
                      </div>
                    );

                    if (!resignedAttRecords.length) return (
                      <div style={{ textAlign: 'center', color: '#475569', padding: 40, fontSize: 13 }}>No attendance records available</div>
                    );

                    // Compute totals and per-month summary from raw records
                    let totalPresent = 0, totalLeave = 0, totalWO = 0, totalNH = 0, totalDays = 0;
                    const rows = resignedAttRecords.map((rec: any) => {
                      const present = rec.entries.filter((e: any) => WORK_CODES.has(e.code)).length;
                      const leave   = rec.entries.filter((e: any) => LEAVE_CODES.has(e.code)).length;
                      const wo      = rec.entries.filter((e: any) => e.code === 'WO').length;
                      const nh      = rec.entries.filter((e: any) => e.code === 'NH').length;
                      totalPresent += present; totalLeave += leave; totalWO += wo; totalNH += nh;
                      totalDays += rec.entries.length;
                      return { year: rec.year, month: rec.month, present, leave, wo, nh, total: rec.entries.length };
                    });

                    return <>
                      {/* Summary tiles */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
                        {[
                          { label: 'Total Days Recorded', val: totalDays,    color: '#3b82f6' },
                          { label: 'Present / On Duty',   val: totalPresent, color: '#22c55e' },
                          { label: 'Leave',               val: totalLeave,   color: '#f59e0b' },
                          { label: 'Weekly Off',          val: totalWO,      color: '#94a3b8' },
                        ].map(({ label, val, color }) => (
                          <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 14px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
                            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Monthly breakdown table */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'rgba(59,130,246,0.12)' }}>
                            {['Month', 'Year', 'Present', 'Leave', 'Weekly Off', 'Holiday', 'Total'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Month' || h === 'Year' ? 'left' : 'center', color: '#93c5fd', fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r: any, i: number) => (
                            <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                              <td style={{ padding: '7px 12px', color: '#cbd5e1', fontWeight: 500 }}>{MONTH_NAMES[r.month - 1]}</td>
                              <td style={{ padding: '7px 12px', color: '#94a3b8' }}>{r.year}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'center', color: '#86efac', fontWeight: 600 }}>{r.present}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'center', color: '#fde68a' }}>{r.leave}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'center', color: '#94a3b8' }}>{r.wo}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'center', color: '#818cf8' }}>{r.nh}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'center', color: '#64748b' }}>{r.total}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: '2px solid rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.06)' }}>
                            <td colSpan={2} style={{ padding: '8px 12px', color: '#93c5fd', fontWeight: 700, fontSize: 11 }}>TOTAL</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', color: '#86efac', fontWeight: 700 }}>{totalPresent}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', color: '#fde68a', fontWeight: 700 }}>{totalLeave}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>{totalWO}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', color: '#818cf8', fontWeight: 700 }}>{totalNH}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>{totalDays}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </>;
                  })()}

                  {/* ── TRAINING TAB ── */}
                  {resignedDetailTab === 'training' && <>
                    {!selectedResigned.training || selectedResigned.training.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#475569', padding: 40, fontSize: 13 }}>No training records</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'rgba(59,130,246,0.12)' }}>
                            {['Training', 'Type', 'Mode', 'Trainer', 'Date', 'Duration', 'Result'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#93c5fd', fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedResigned.training.map((t, i) => (
                            <tr key={(t as any).id ?? i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '8px 12px', color: '#e2e8f0', fontWeight: 500 }}>{t.name}</td>
                              <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{t.type || '—'}</td>
                              <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{t.mode || '—'}</td>
                              <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{t.trainer || '—'}</td>
                              <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{t.date || '—'}</td>
                              <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{t.duration || '—'}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ color: t.result === 'Pass' ? '#22c55e' : '#f59e0b', fontWeight: 600, fontSize: 11 }}>{t.result || '—'}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>}

                  {/* ── SKILLS & CERTS TAB ── */}
                  {resignedDetailTab === 'skills' && <>
                    {selectedResigned.skills && selectedResigned.skills.length > 0 && <>
                      <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Skills & Competencies</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                        {selectedResigned.skills.map((s, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '6px 12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 500 }}>{s.name}</span>
                            {s.category && <span style={{ fontSize: 10, color: '#64748b' }}>({s.category})</span>}
                            <div style={{ display: 'flex', gap: 2 }}>
                              {[1,2,3,4,5].map(n => (
                                <div key={n} style={{ width: 8, height: 8, borderRadius: 2, background: n <= s.rating ? '#f59e0b' : '#334155' }} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>}
                    {selectedResigned.qualifications && selectedResigned.qualifications.length > 0 ? (
                      <>
                        <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Certifications & Qualifications</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: 'rgba(59,130,246,0.12)' }}>
                              {['Certificate', 'Category', 'Institute', 'Completed', 'Expiry', 'Result'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#93c5fd', fontWeight: 600 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {selectedResigned.qualifications.map((q, i) => (
                              <tr key={(q as any).id ?? i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '8px 12px', color: '#e2e8f0', fontWeight: 500 }}>{q.courseName}</td>
                                <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{q.category || '—'}</td>
                                <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{q.institute || '—'}</td>
                                <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{q.completionDate || '—'}</td>
                                <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{q.expiryDate || 'No Expiry'}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span style={{ color: q.result === 'Pass' ? '#22c55e' : '#94a3b8', fontSize: 11 }}>{q.result || '—'}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    ) : !selectedResigned.skills?.length ? (
                      <div style={{ textAlign: 'center', color: '#475569', padding: 40, fontSize: 13 }}>No skill or qualification records</div>
                    ) : null}
                  </>}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* ── BULK UPLOAD MODAL ── */}
      {showBulkUpload && <EmployeeBulkUpload onClose={() => setShowBulkUpload(false)} />}

      {/* ── ADD EMPLOYEE MODAL ── */}
      {showAddEmp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 760, maxHeight: '94vh', overflowY: 'auto', padding: 28, position: 'relative' }}>
            <button onClick={() => setShowAddEmp(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>Add New Employee</div>

            {/* Basic Info */}
            <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Basic Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
              <FRow label="Full Name *" field="name" form={empForm} setFn={setEF} />
              <FRow label="Employee ID" field="empId" form={empForm} setFn={setEF} />
              <FRow label="Department *" field="department" form={empForm} setFn={setEF} options={['Electrical & Instrumentation', 'IT']} />
              <FRow label="Designation *" field="designation" form={empForm} setFn={setEF} />
              <FRow label="Section" field="section" form={empForm} setFn={setEF} />
              <FRow label="Reporting Manager" field="reportingManager" form={empForm} setFn={setEF} />
              <FRow label="Employee Type" field="employeeType" form={empForm} setFn={setEF} options={['Permanent', 'Contract', 'Casual', 'Trainee']} />
              <FRow label="Grade" field="grade" form={empForm} setFn={setEF} />
              <FRow label="Joining Date" field="joiningDate" form={empForm} setFn={setEF} type="date" />
              <FRow label="Years of Experience" field="yearsOfExperience" form={empForm} setFn={setEF} type="number" />
              <FRow label="Nationality" field="nationality" form={empForm} setFn={setEF} options={['Indian', 'Emirati', 'Pakistani', 'Filipino', 'Bangladeshi', 'Other']} />
              <FRow label="Gender" field="gender" form={empForm} setFn={setEF} options={['Male', 'Female']} />
              <FRow label="Date of Birth" field="dateOfBirth" form={empForm} setFn={setEF} type="date" />
              <FRow label="Blood Group" field="bloodGroup" form={empForm} setFn={setEF} options={['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']} />
              <FRow label="Marital Status" field="maritalStatus" form={empForm} setFn={setEF} options={['Single', 'Married', 'Divorced', 'Widowed']} />
            </div>

            {/* Contact */}
            <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Contact Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
              <FRow label="India Phone" field="indiaPhone" form={empForm} setFn={setEF} />
              <FRow label="UAE Phone" field="uaePhone" form={empForm} setFn={setEF} />
              <FRow label="Company Phone" field="companyPhone" form={empForm} setFn={setEF} />
              <FRow label="Personal Email" field="personalEmail" form={empForm} setFn={setEF} type="email" />
              <FRow label="Company Email" field="companyEmail" form={empForm} setFn={setEF} type="email" />
            </div>

            {/* Address */}
            <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Address</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
              <FRow label="Current Address (UAE)" field="currentAddress" form={empForm} setFn={setEF} />
              <FRow label="Permanent Address (India)" field="permanentAddress" form={empForm} setFn={setEF} />
              <FRow label="Emergency Contact Person" field="emergencyContactPerson" form={empForm} setFn={setEF} />
              <FRow label="Emergency Contact Number" field="emergencyContactNumber" form={empForm} setFn={setEF} />
            </div>


            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddEmp(false)} className="btn-secondary" style={{ fontSize: 12 }}>Cancel</button>
              <button
                onClick={handleAddEmployee}
                className="btn-primary"
                style={{ fontSize: 12, opacity: (!empForm.name.trim() || !empForm.designation.trim()) ? 0.5 : 1 }}
              >
                <Plus size={13} /> Add Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD RESIGNATION MODAL ── */}
      {showAddResign && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto', padding: 28, position: 'relative' }}>
            <button onClick={() => setShowAddResign(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserX size={16} color="#ef4444" /> Add Resignation Record
            </div>

            <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Select Employee</div>
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Employee *</label>
              <select value={resignForm.empId} onChange={e => setRF('empId', e.target.value)} style={inp}>
                <option value="">— Select Employee —</option>
                {activeEmployees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.empId}) — {e.designation}</option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Resignation Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
              <FRow label="Resignation Date *" field="resignationDate" form={resignForm} setFn={setRF} type="date" />
              <FRow label="Notice Period" field="noticePeriod" form={resignForm} setFn={setRF} options={['30 Days', '60 Days', '90 Days', 'Immediate', 'Negotiated']} />
              <FRow label="Last Working Date *" field="lastWorkingDate" form={resignForm} setFn={setRF} type="date" />
              <FRow label="Reason" field="reason" form={resignForm} setFn={setRF} options={['Family Relocation', 'Better Opportunity', 'Personal Reasons', 'Contract End', 'Higher Studies', 'Health Issues', 'Salary Dispute', 'Other']} />
              <FRow label="Submitted To" field="submittedTo" form={resignForm} setFn={setRF} />
              <FRow label="Approved By" field="approvedBy" form={resignForm} setFn={setRF} />
              <FRow label="Approval Date" field="approvalDate" form={resignForm} setFn={setRF} type="date" />
              <FRow label="Exit Interview Date" field="exitInterviewDate" form={resignForm} setFn={setRF} type="date" />
            </div>

            <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Comments & Remarks</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Employee Remarks', field: 'employeeRemarks' },
                { label: 'Manager Comments', field: 'managerComments' },
                { label: 'HR Comments', field: 'hrComments' },
                { label: 'Root Cause', field: 'rootCause' },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label style={lbl}>{label}</label>
                  <textarea
                    value={(resignForm as any)[field]}
                    onChange={e => setRF(field, e.target.value)}
                    placeholder={label}
                    rows={2}
                    style={{ ...inp, resize: 'vertical' }}
                  />
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#fca5a5' }}>
              This will mark the employee as <strong>Resigned</strong> and move them out of the Active directory. A clearance checklist will be automatically created.
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddResign(false)} className="btn-secondary" style={{ fontSize: 12 }}>Cancel</button>
              <button
                onClick={handleAddResignation}
                style={{ padding: '8px 20px', fontSize: 12, background: 'rgba(239,68,68,0.8)', border: '1px solid rgba(239,68,68,0.5)', borderRadius: 8, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: (!resignForm.empId || !resignForm.resignationDate || !resignForm.lastWorkingDate) ? 0.5 : 1 }}
              >
                <UserX size={13} /> Confirm Resignation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

