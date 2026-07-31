import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const lbl: React.CSSProperties = { fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#f1f5f9', fontSize: 12, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' };

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

  const [tab, setTab]               = useState<'directory' | 'resigned'>('directory');
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
  const filtered = employees.filter(e => {
    if (e.status === 'resigned') return false;
    const t = search.toLowerCase();
    const matchSearch = !t || e.name.toLowerCase().includes(t) || e.empId.toLowerCase().includes(t) ||
      (e.companyEmail || '').toLowerCase().includes(t) || e.uaePhone.includes(t);
    const matchDept   = filterDept === 'all' || e.department === filterDept;
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchNat    = filterNat === 'all' || e.nationality === filterNat;
    return matchSearch && matchDept && matchStatus && matchNat;
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
        `${e.yearsOfExperience}y`, STATUS_LABEL[e.status] ?? e.status,
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
        <div style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9' }}>{value}</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
      </div>
    </div>
  );

  const AlertRow = ({ color, label, days, name, sub }: any) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: color + '10', borderRadius: 8, border: `1px solid ${color}30`, marginBottom: 6 }}>
      <AlertTriangle size={13} color={color} />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{name}</span>
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
                {filtered.map(e => (
                  <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/employees/${e.id}`)}>
                    <td style={{ fontFamily: 'monospace', color: '#60a5fa', fontSize: 11 }}>{e.empId}</td>
                    <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{e.name}</td>
                    <td style={{ fontSize: 11, color: '#94a3b8' }}>{e.department}</td>
                    <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{e.designation}</span></td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{e.reportingManager}</td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{e.uaePhone}</td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{e.companyEmail}</td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{e.joiningDate}</td>
                    <td style={{ fontSize: 11, color: '#94a3b8' }}>{e.yearsOfExperience} yrs</td>
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
                ))}
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
                    <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedResignedId(e.id)}>
                      <td style={{ fontFamily: 'monospace', color: '#60a5fa', fontSize: 11 }}>{e.empId}</td>
                      <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{e.name}</td>
                      <td style={{ fontSize: 11, color: '#94a3b8' }}>{e.department}</td>
                      <td><span className="badge badge-gray" style={{ fontSize: 10 }}>{e.designation}</span></td>
                      <td style={{ fontSize: 11, color: '#64748b' }}>{e.joiningDate}</td>
                      <td style={{ fontSize: 11, color: '#64748b' }}>{res.lastWorkingDate}</td>
                      <td style={{ fontSize: 11, color: '#94a3b8' }}>{svc} yrs</td>
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
                          <button onClick={() => setSelectedResignedId(e.id)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
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
            return (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                <div className="glass-card" style={{ width: '100%', maxWidth: 700, maxHeight: '92vh', overflowY: 'auto', padding: 24, position: 'relative' }}>
                  <button onClick={() => setSelectedResignedId(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#64748b,#475569)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'white' }}>
                      {selectedResigned.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{selectedResigned.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{selectedResigned.designation} · {selectedResigned.empId}</div>
                    </div>
                    <button
                      onClick={() => { setSelectedResignedId(null); navigate(`/employees/${selectedResigned.id}`); }}
                      style={{ padding: '6px 12px', fontSize: 12, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 7, color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Eye size={13} /> Full Profile
                    </button>
                    <button
                      onClick={() => { if (window.confirm(`Delete ${selectedResigned.name}'s record permanently?`)) handleDeleteResigned(selectedResigned.id); }}
                      style={{ padding: '6px 12px', fontSize: 12, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Trash2 size={13} /> Delete Record
                    </button>
                  </div>

                  <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Resignation Information</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    {[
                      ['Resignation Date', res.resignationDate], ['Notice Period', res.noticePeriod],
                      ['Last Working Date', res.lastWorkingDate], ['Submitted To', res.submittedTo],
                      ['Approved By', res.approvedBy], ['Approval Date', res.approvalDate],
                      ['Exit Interview Date', res.exitInterviewDate], ['Reason', res.reason],
                    ].map(([l, v]) => (
                      <div key={l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{l}</div>
                        <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{v || '—'}</div>
                      </div>
                    ))}
                  </div>

                  {[
                    ['Employee Remarks', res.employeeRemarks],
                    ['Manager Comments', res.managerComments],
                    ['HR Comments', res.hrComments],
                    ['Root Cause Analysis', res.rootCause],
                    ['Lessons Learned', res.lessonsLearned],
                  ].map(([l, v]) => (
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
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 20 }}>Add New Employee</div>

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
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
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
