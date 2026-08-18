import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Download, Upload, FileText, CheckCircle, XCircle, AlertTriangle,
  X, ArrowLeft, Users, RefreshCw, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { FullEmployee } from '../data/employeeData';
import { useEmployees } from '../context/EmployeeContext';

// ─── Column definitions ───────────────────────────────────────────────────────

interface ColDef {
  header: string;
  field: string;
  required: boolean;
  valid?: string[];
  isDate?: boolean;
  isEmail?: boolean;
  isNumber?: boolean;
  sample: string;
  hint?: string;
}

const COLUMNS: ColDef[] = [
  { header: 'Employee ID',              field: 'empId',                   required: false, sample: 'EMP-099',                  hint: 'Leave blank for new. Fill to update existing.' },
  { header: 'Full Name',                field: 'name',                    required: true,  sample: 'John Smith' },
  { header: 'Designation',              field: 'designation',             required: true,  sample: 'Electrical Technician' },
  { header: 'Department',               field: 'department',              required: true,  sample: 'Electrical & Instrumentation',
    valid: ['Electrical & Instrumentation', 'IT', 'Electrical & Instrumentation, IT', 'Mechanical', 'Production', 'Safety', 'HR', 'Finance', 'Administration'] },
  { header: 'Section',                  field: 'section',                 required: false, sample: 'Electrical' },
  { header: 'Reporting Manager',        field: 'reportingManager',        required: false, sample: 'Rajesh Kumar' },
  { header: 'Employee Type',            field: 'employeeType',            required: false, sample: 'Permanent',
    valid: ['Permanent', 'Contract', 'Part-time', 'Intern'] },
  { header: 'Grade',                    field: 'grade',                   required: false, sample: 'G3' },
  { header: 'Nationality',              field: 'nationality',             required: true,  sample: 'Indian' },
  { header: 'Date of Birth',            field: 'dateOfBirth',             required: false, sample: '1990-01-15', isDate: true,   hint: 'Format: YYYY-MM-DD' },
  { header: 'Gender',                   field: 'gender',                  required: true,  sample: 'Male',        valid: ['Male', 'Female', 'Other'] },
  { header: 'Blood Group',              field: 'bloodGroup',              required: false, sample: 'O+',
    valid: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
  { header: 'Marital Status',           field: 'maritalStatus',           required: false, sample: 'Single',
    valid: ['Single', 'Married', 'Divorced', 'Widowed'] },
  { header: 'India Phone',              field: 'indiaPhone',              required: false, sample: '+91-9876543210' },
  { header: 'UAE Phone',                field: 'uaePhone',                required: true,  sample: '+971-501234567' },
  { header: 'Company Phone',            field: 'companyPhone',            required: false, sample: '+971-43210000' },
  { header: 'Personal Email',           field: 'personalEmail',           required: false, sample: 'john.smith@gmail.com',     isEmail: true },
  { header: 'Company Email',            field: 'companyEmail',            required: false, sample: 'john.smith@company.ae',    isEmail: true },
  { header: 'Joining Date',             field: 'joiningDate',             required: true,  sample: '2020-06-01',               isDate: true,  hint: 'Format: YYYY-MM-DD' },
  { header: 'Years of Experience',      field: 'yearsOfExperience',       required: true,  sample: '5',                        isNumber: true },
  { header: 'Emirates ID',              field: 'emiratesId',              required: false, sample: '784-1990-1234567-8' },
  { header: 'Passport No.',             field: 'passportNo',              required: false, sample: 'A1234567' },
  { header: 'Visa Expiry',              field: 'visaExpiry',              required: false, sample: '2025-12-31',               isDate: true,  hint: 'Format: YYYY-MM-DD' },
  { header: 'Passport Expiry',          field: 'passportExpiry',          required: false, sample: '2028-06-30',               isDate: true,  hint: 'Format: YYYY-MM-DD' },
  { header: 'Emergency Contact Person', field: 'emergencyContactPerson',  required: false, sample: 'Mary Smith' },
  { header: 'Emergency Contact Number', field: 'emergencyContactNumber',  required: false, sample: '+91-9876543211' },
  { header: 'Current Address',          field: 'currentAddress',          required: false, sample: 'Dubai, UAE' },
  { header: 'Permanent Address',        field: 'permanentAddress',        required: false, sample: 'Chennai, Tamil Nadu, India' },
  { header: 'Status',                  field: 'status',                  required: false, sample: 'active',
    valid: ['active', 'on_leave', 'suspended', 'not_joined'],
    hint: 'active | on_leave | suspended | not_joined. Defaults to active.' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldError { field: string; message: string; }

interface ParsedRow {
  rowNum: number;
  data: Partial<FullEmployee>;
  errors: FieldError[];
  isValid: boolean;
  mode: 'create' | 'update';
}

interface ParseResult {
  rows: ParsedRow[];
  validRows: ParsedRow[];
  errorRows: ParsedRow[];
}

interface ImportResult {
  created: number;
  updated: number;
  failed: number;
  total: number;
  errors: { empId?: string; error: string }[];
}

// ─── Validation ───────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE  = /^\d{4}-\d{2}-\d{2}$/;

function validateRow(
  raw: Record<string, string>,
  existingEmpIds: Set<string>,
): { data: Partial<FullEmployee>; errors: FieldError[]; mode: 'create' | 'update' } {
  const errors: FieldError[] = [];
  const data: Record<string, any> = {};

  for (const col of COLUMNS) {
    const value = (raw[col.header] ?? '').toString().trim();

    if (col.required && !value) {
      errors.push({ field: col.header, message: `Required field is empty` });
      continue;
    }

    if (!value) {
      data[col.field] = col.isNumber ? 0 : '';
      continue;
    }

    if (col.valid && !col.valid.includes(value)) {
      errors.push({ field: col.header, message: `"${value}" is not valid. Allowed: ${col.valid.join(', ')}` });
      continue;
    }

    if (col.isDate && !DATE_RE.test(value)) {
      errors.push({ field: col.header, message: `Must be YYYY-MM-DD format (got "${value}")` });
      continue;
    }

    if (col.isEmail && !EMAIL_RE.test(value)) {
      errors.push({ field: col.header, message: `"${value}" is not a valid email address` });
      continue;
    }

    if (col.isNumber) {
      const n = Number(value);
      if (isNaN(n) || n < 0) {
        errors.push({ field: col.header, message: `Must be a number ≥ 0 (got "${value}")` });
        continue;
      }
      data[col.field] = n;
      continue;
    }

    data[col.field] = value;
  }

  const mode: 'create' | 'update' = data.empId && existingEmpIds.has(data.empId as string)
    ? 'update' : 'create';

  return { data: data as Partial<FullEmployee>, errors, mode };
}

// ─── Template download ────────────────────────────────────────────────────────

function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Employee Data (headers + sample row)
  const headers   = COLUMNS.map(c => c.header);
  const sampleRow = COLUMNS.map(c => c.sample);

  const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
  ws['!cols'] = COLUMNS.map(c => ({ wch: Math.max(c.header.length + 4, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Employee Data');

  // Sheet 2: Instructions
  const instrData: string[][] = [
    ['EMPLOYEE MASTER UPLOAD — INSTRUCTIONS'],
    [''],
    ['HOW TO USE:'],
    ['1. Row 1 has column headers — DO NOT modify them.'],
    ['2. Row 2 has sample data — DELETE it before uploading.'],
    ['3. Add your employee data from row 3 onwards.'],
    ['4. Date columns must use YYYY-MM-DD format (e.g. 2024-01-15).'],
    ['5. Leave "Employee ID" blank for new employees.'],
    ['6. Fill "Employee ID" to update an existing employee record.'],
    ['7. Fields marked * are mandatory — upload will fail for rows missing them.'],
    [''],
    ['FIELD REFERENCE:'],
    ['Column', 'Required', 'Valid Values / Format', 'Notes'],
    ...COLUMNS.map(c => [
      c.header + (c.required ? ' *' : ''),
      c.required ? 'Yes' : 'No',
      c.valid
        ? c.valid.join(' | ')
        : c.isDate
          ? 'YYYY-MM-DD'
          : c.isEmail
            ? 'Valid email address'
            : c.isNumber
              ? 'Whole number ≥ 0'
              : 'Free text',
      c.hint || '',
    ]),
  ];

  const instrWs = XLSX.utils.aoa_to_sheet(instrData);
  instrWs['!cols'] = [{ wch: 32 }, { wch: 10 }, { wch: 70 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, instrWs, 'Instructions');

  XLSX.writeFile(wb, 'Employee_Master_Template.xlsx');
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#374151', fontSize: 13, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' };

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmployeeBulkUpload({ onClose }: { onClose: () => void }) {
  const { employees, refetch } = useEmployees();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase]             = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [isDragOver, setIsDragOver]   = useState(false);
  const [fileName, setFileName]       = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showValidList, setShowValidList] = useState(false);

  const existingEmpIds = new Set(employees.map(e => e.empId));

  const processFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert('Please upload an Excel file (.xlsx or .xls)');
      return;
    }
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const bytes = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(bytes, { type: 'array', dateNF: 'yyyy-mm-dd' });
        const ws = wb.Sheets[wb.SheetNames[0]];

        const rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
          raw: false,
          dateNF: 'yyyy-mm-dd',
          defval: '',
        });

        // Drop sample row (detected if Full Name === sample value)
        const dataRows = rawRows.filter(r => {
          const n = (r['Full Name'] || '').trim();
          return n !== '' && n !== 'John Smith';
        });

        if (dataRows.length === 0) {
          alert('No employee data found in the file. Make sure rows start after the header (and delete the sample row).');
          return;
        }

        const parsedRows: ParsedRow[] = dataRows.map((raw, idx) => {
          const { data, errors, mode } = validateRow(raw, existingEmpIds);
          return { rowNum: idx + 1, data, errors, isValid: errors.length === 0, mode };
        });

        const validRows = parsedRows.filter(r => r.isValid);
        const errorRows = parsedRows.filter(r => !r.isValid);

        setParseResult({ rows: parsedRows, validRows, errorRows });
        setPhase('preview');
      } catch {
        alert('Failed to read the Excel file. Please ensure it is a valid .xlsx file downloaded from the template.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [existingEmpIds]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const importRecords = async () => {
    if (!parseResult?.validRows.length) return;
    setPhase('importing');

    const payload = parseResult.validRows.map(r => r.data);

    try {
      const res = await fetch('/api/employees/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result: ImportResult = await res.json();
      setImportResult(result);
      await refetch();
    } catch {
      setImportResult({
        created: 0, updated: 0,
        failed: parseResult.validRows.length,
        total: parseResult.validRows.length,
        errors: [{ error: 'Network error — could not reach the server' }],
      });
    }
    setPhase('done');
  };

  const reset = () => {
    setPhase('upload');
    setFileName('');
    setParseResult(null);
    setImportResult(null);
    setShowValidList(false);
  };

  // ── UI ──────────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 20 }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: 960, maxHeight: '92vh', overflowY: 'auto', padding: 28, position: 'relative' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} color="#3b82f6" /> Employee Master Data Upload
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
              Download the template → Fill offline → Upload to import bulk employee records
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20}/></button>
        </div>

        {/* ── PHASE: UPLOAD ── */}
        {phase === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Step cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              {/* Step 1: Download template */}
              <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>1</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Download Template</div>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, marginBottom: 16 }}>
                  Download the Excel template with all required columns and a sample row. Fill in your employee data and save the file.
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
                  Template includes {COLUMNS.filter(c => c.required).length} required fields and {COLUMNS.filter(c => !c.required).length} optional fields across {COLUMNS.length} columns.
                </div>
                <button className="btn-primary" onClick={downloadTemplate} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Download size={13}/> Download Employee_Master_Template.xlsx
                </button>
              </div>

              {/* Step 2: Upload */}
              <div style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>2</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Upload Filled Template</div>
                </div>
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragOver ? '#22c55e' : 'rgba(34,197,94,0.35)'}`,
                    borderRadius: 10, padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
                    background: isDragOver ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.2s',
                  }}>
                  <Upload size={28} color={isDragOver ? '#22c55e' : '#475569'} style={{ marginBottom: 8 }}/>
                  <div style={{ fontSize: 13, color: isDragOver ? '#22c55e' : '#94a3b8' }}>
                    {isDragOver ? 'Drop your file here' : 'Drag & drop or click to browse'}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>.xlsx or .xls files only</div>
                </div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileInput}/>
              </div>
            </div>

            {/* Field reference */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>Required Fields (marked *)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {COLUMNS.filter(c => c.required).map(c => (
                  <span key={c.header} style={{ fontSize: 11, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', padding: '3px 10px', borderRadius: 20 }}>
                    {c.header} *
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 10 }}>
                ℹ️ Leave "Employee ID" blank to create new employees. Fill it to update existing records.
              </div>
            </div>
          </div>
        )}

        {/* ── PHASE: PREVIEW ── */}
        {phase === 'preview' && parseResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* File info + back */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={reset} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <ArrowLeft size={14}/> Back
              </button>
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }}/>
              <FileText size={13} color="#64748b"/>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{fileName}</span>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              {[
                { label: 'Total Rows', value: parseResult.rows.length,     color: '#3b82f6' },
                { label: 'Valid',      value: parseResult.validRows.length, color: '#22c55e' },
                { label: 'Errors',     value: parseResult.errorRows.length, color: '#ef4444' },
                { label: 'New',        value: parseResult.validRows.filter(r => r.mode === 'create').length,  color: '#8b5cf6' },
                { label: 'Updates',    value: parseResult.validRows.filter(r => r.mode === 'update').length,  color: '#f59e0b' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${s.color}25`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Error report */}
            {parseResult.errorRows.length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
                  <XCircle size={14} color="#ef4444"/>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
                    Error Report — {parseResult.errorRows.length} row{parseResult.errorRows.length > 1 ? 's' : ''} with issues
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(239,68,68,0.06)' }}>
                        {['Row #', 'Employee Name', 'Field with Error', 'Error Description'].map(h => (
                          <th key={h} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.errorRows.flatMap(row =>
                        row.errors.map((err, ei) => (
                          <tr key={`${row.rowNum}-${ei}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            {ei === 0 && (
                              <td rowSpan={row.errors.length} style={{ padding: '8px 14px', fontSize: 12, color: '#f59e0b', fontWeight: 700, verticalAlign: 'top' }}>
                                Row {row.rowNum}
                              </td>
                            )}
                            {ei === 0 && (
                              <td rowSpan={row.errors.length} style={{ padding: '8px 14px', fontSize: 12, color: '#374151', verticalAlign: 'top' }}>
                                {(row.data.name as string) || '—'}
                              </td>
                            )}
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#fca5a5', fontWeight: 500 }}>{err.field}</td>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#94a3b8' }}>{err.message}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Valid records preview (collapsible) */}
            {parseResult.validRows.length > 0 && (
              <div style={{ border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, overflow: 'hidden' }}>
                <button
                  onClick={() => setShowValidList(v => !v)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(34,197,94,0.04)', border: 'none', cursor: 'pointer', borderBottom: showValidList ? '1px solid rgba(34,197,94,0.15)' : 'none' }}>
                  <CheckCircle size={14} color="#22c55e"/>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#22c55e', flex: 1, textAlign: 'left' }}>
                    {parseResult.validRows.length} Valid Record{parseResult.validRows.length > 1 ? 's' : ''} ready to import
                  </span>
                  {showValidList ? <ChevronDown size={14} color="#64748b"/> : <ChevronRight size={14} color="#64748b"/>}
                </button>
                {showValidList && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                          {['Row #', 'Name', 'Designation', 'Department', 'UAE Phone', 'Company Email', 'Joining Date', 'Action'].map(h => (
                            <th key={h} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parseResult.validRows.map(row => (
                          <tr key={row.rowNum} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#64748b' }}>{row.rowNum}</td>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#374151', fontWeight: 500 }}>{row.data.name as string}</td>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#94a3b8' }}>{row.data.designation as string}</td>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#94a3b8' }}>{row.data.department as string}</td>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#94a3b8' }}>{row.data.uaePhone as string}</td>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#94a3b8' }}>{row.data.companyEmail as string}</td>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#94a3b8' }}>{row.data.joiningDate as string}</td>
                            <td style={{ padding: '8px 14px' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                                color: row.mode === 'update' ? '#f59e0b' : '#8b5cf6',
                                background: row.mode === 'update' ? 'rgba(245,158,11,0.12)' : 'rgba(139,92,246,0.12)',
                              }}>
                                {row.mode === 'update' ? '♻ Update' : '＋ New'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* No valid records */}
            {parseResult.validRows.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', background: 'rgba(239,68,68,0.04)', borderRadius: 10, border: '1px dashed rgba(239,68,68,0.25)' }}>
                <AlertTriangle size={28} color="#ef4444" style={{ marginBottom: 8 }}/>
                <div style={{ fontSize: 14, color: '#ef4444', fontWeight: 600 }}>No valid records to import</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Fix the errors above and re-upload the file.</div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 12, color: '#475569' }}>
                {parseResult.errorRows.length > 0
                  ? `${parseResult.errorRows.length} row(s) with errors will be skipped`
                  : 'All rows passed validation'}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-secondary" onClick={reset} style={{ fontSize: 12 }}>Re-upload</button>
                {parseResult.validRows.length > 0 && (
                  <button className="btn-primary" onClick={importRecords} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Upload size={13}/> Import {parseResult.validRows.length} Valid Record{parseResult.validRows.length > 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PHASE: IMPORTING ── */}
        {phase === 'importing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 16 }}>
            <div style={{ width: 44, height: 44, border: '3px solid rgba(59,130,246,0.3)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }}/>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Importing employee records…</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Creating and updating records in the database. Please wait.</div>
          </div>
        )}

        {/* ── PHASE: DONE ── */}
        {phase === 'done' && importResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ textAlign: 'center', paddingTop: 8 }}>
              <CheckCircle size={44} color="#22c55e" style={{ marginBottom: 12 }}/>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1e293b' }}>Import Complete</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Employee records have been processed successfully.</div>
            </div>

            {/* Result summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Total Processed', value: importResult.total,   color: '#3b82f6',  bg: 'rgba(59,130,246,0.1)' },
                { label: 'Created',          value: importResult.created, color: '#22c55e',  bg: 'rgba(34,197,94,0.1)' },
                { label: 'Updated',          value: importResult.updated, color: '#f59e0b',  bg: 'rgba(245,158,11,0.1)' },
                { label: 'Failed',           value: importResult.failed,  color: '#ef4444',  bg: 'rgba(239,68,68,0.1)' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 12, padding: '18px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Backend errors (if any) */}
            {importResult.errors.length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={13}/> Import Errors
                </div>
                {importResult.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#94a3b8', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {e.empId && <span style={{ color: '#f59e0b', marginRight: 8 }}>{e.empId}</span>}{e.error}
                  </div>
                ))}
              </div>
            )}

            {importResult.created === 0 && importResult.updated === 0 && (
              <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                No records were imported. Check the error details above.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', paddingTop: 8 }}>
              <button className="btn-secondary" onClick={reset} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={13}/> Upload Another File
              </button>
              <button className="btn-primary" onClick={onClose} style={{ fontSize: 12 }}>
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

