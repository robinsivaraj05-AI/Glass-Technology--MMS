import { useState } from 'react';
import { Download, BarChart3, FileText, TrendingUp, Calendar } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { monthlyBreakdowns, pmComplianceData, mockKPIs, departmentEnergyData } from '../data/mockData';

const REPORT_TYPES = [
  { id: 'monthly', label: 'Monthly Maintenance Report', icon: '📋', color: '#3b82f6', desc: 'Complete maintenance summary for the month' },
  { id: 'breakdown', label: 'Breakdown Analysis Report', icon: '⚠️', color: '#ef4444', desc: 'Detailed breakdown statistics and RCA' },
  { id: 'pm', label: 'PM Compliance Report', icon: '✅', color: '#22c55e', desc: 'Preventive maintenance completion report' },
  { id: 'energy', label: 'Energy Consumption Report', icon: '⚡', color: '#f59e0b', desc: 'Electricity, DG, and utility usage report' },
  { id: 'kpi', label: 'KPI Dashboard Report', icon: '📊', color: '#8b5cf6', desc: 'Key performance indicators and trends' },
  { id: 'cost', label: 'Maintenance Cost Report', icon: '💰', color: '#06b6d4', desc: 'Cost analysis by machine, department' },
  { id: 'spare', label: 'Spare Parts Report', icon: '🔩', color: '#f59e0b', desc: 'Inventory, consumption, and purchase report' },
  { id: 'calibration', label: 'Calibration Status Report', icon: '🔬', color: '#22c55e', desc: 'Instrument calibration compliance report' },
  { id: 'safety', label: 'Safety & Incident Report', icon: '🦺', color: '#ef4444', desc: 'Incidents, near misses, and LOTO report' },
  { id: 'yearly', label: 'Annual Performance Report', icon: '📅', color: '#6366f1', desc: 'Complete yearly performance summary' },
];

const kpiData = [
  { name: 'OEE', value: mockKPIs.oee, target: 90, unit: '%', color: '#3b82f6' },
  { name: 'MTBF', value: mockKPIs.mtbf, target: 160, unit: 'h', color: '#22c55e' },
  { name: 'MTTR', value: mockKPIs.mttr, target: 3, unit: 'h', color: '#f59e0b' },
  { name: 'PM Compliance', value: mockKPIs.pmCompliance, target: 95, unit: '%', color: '#22c55e' },
  { name: 'Power Factor', value: mockKPIs.powerFactor * 100, target: 95, unit: '', color: '#06b6d4' },
  { name: 'El. Availability', value: mockKPIs.electricalAvailability, target: 99, unit: '%', color: '#8b5cf6' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0d0d1a', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
      <div style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color ?? '#f1f5f9', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{p.name}:</span><span style={{ fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('2026-07-01');
  const [dateTo, setDateTo] = useState('2026-07-25');
  const [format, setFormat] = useState<'pdf' | 'excel' | 'word'>('pdf');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Reports & Analytics</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Generate, download and share maintenance reports</div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {kpiData.map(k => {
          const aboveTarget = k.name === 'MTTR' ? k.value <= k.target : k.value >= k.target;
          return (
            <div key={k.name} className="glass-card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>{k.name}</span>
                <span style={{ fontSize: 10, color: aboveTarget ? '#22c55e' : '#ef4444', background: aboveTarget ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '1px 8px', borderRadius: 10 }}>
                  {aboveTarget ? 'On Target' : 'Below Target'}
                </span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}{k.unit}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Target: {k.target}{k.unit}</div>
              <div className="progress-bar" style={{ marginTop: 8 }}>
                <div className="progress-fill" style={{ width: `${Math.min((k.name === 'MTTR' ? (k.target / k.value) : (k.value / k.target)) * 100, 100)}%`, background: aboveTarget ? '#22c55e' : '#ef4444' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>Breakdowns MTD</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={monthlyBreakdowns}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Breakdowns" fill="#ef4444" radius={[3,3,0,0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>PM Compliance Trend</div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={pmComplianceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis domain={[85, 100]} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="compliance" name="Compliance%" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>Dept Energy Split</div>
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie data={departmentEnergyData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" nameKey="name">
                {departmentEnergyData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Generate Report */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 16 }}>Generate Report</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-dark" style={{ width: 150 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-dark" style={{ width: 150 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Format</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['pdf', 'excel', 'word'] as const).map(f => (
                <button key={f} onClick={() => setFormat(f)} style={{
                  padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                  background: format === f ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                  color: format === f ? 'white' : '#64748b', textTransform: 'uppercase',
                }}>{f}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {REPORT_TYPES.map(r => (
            <div
              key={r.id}
              onClick={() => setSelectedReport(r.id)}
              style={{
                padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                background: selectedReport === r.id ? `${r.color}15` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${selectedReport === r.id ? r.color + '50' : 'rgba(255,255,255,0.06)'}`,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{r.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{r.label}</div>
                  <div style={{ fontSize: 10, color: '#475569' }}>{r.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {selectedReport && (
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="btn-primary" style={{ fontSize: 12 }}>
              <Download size={13} /> Generate {format.toUpperCase()} Report
            </button>
            <button className="btn-secondary" style={{ fontSize: 12 }}>
              <Calendar size={13} /> Schedule Auto Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

