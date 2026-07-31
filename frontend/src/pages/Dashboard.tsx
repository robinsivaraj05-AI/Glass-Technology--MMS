import { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  AlertTriangle, CheckCircle, Clock, Zap, TrendingUp, TrendingDown,
  Users, Package, Activity, Wrench, DollarSign, BarChart3,
  Calendar, Bell, ThermometerSun, Wind, Gauge
} from 'lucide-react';
import {
  mockKPIs, mockBreakdowns, mockPMSchedules, mockMachines, mockEnergyData,
  monthlyBreakdowns, pmComplianceData, topBreakdownMachines, departmentEnergyData, shiftInfo
} from '../data/mockData';
import { useAuth } from '../context/AuthContext';

function KPICard({ title, value, unit, icon, color, trend, trendVal, subtitle }: any) {
  const colorMap: Record<string, string> = { blue: 'kpi-blue', green: 'kpi-green', orange: 'kpi-orange', red: 'kpi-red', purple: 'kpi-purple', cyan: 'kpi-cyan' };
  const colorClass = colorMap[color] ?? 'kpi-blue';
  return (
    <div className={`glass-card kpi-card ${colorClass}`} style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{title}</div>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: `rgba(${color === 'blue' ? '59,130,246' : color === 'green' ? '34,197,94' : color === 'orange' ? '245,158,11' : color === 'red' ? '239,68,68' : color === 'purple' ? '139,92,246' : '6,182,212'}, 0.15)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: color === 'blue' ? '#60a5fa' : color === 'green' ? '#4ade80' : color === 'orange' ? '#fbbf24' : color === 'red' ? '#f87171' : color === 'purple' ? '#a78bfa' : '#22d3ee',
        }}>
          {icon}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: '#f1f5f9', lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontSize: 13, color: '#64748b' }}>{unit}</span>}
      </div>
      {subtitle && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{subtitle}</div>}
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
          {trend === 'up' ? <TrendingUp size={11} style={{ color: '#4ade80' }} /> : <TrendingDown size={11} style={{ color: '#f87171' }} />}
          <span style={{ fontSize: 11, color: trend === 'up' ? '#4ade80' : '#f87171' }}>{trendVal} vs last month</span>
        </div>
      )}
    </div>
  );
}

function StatusBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: '#94a3b8' }}>{label}</span>
        <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{value}<span style={{ color: '#475569', fontSize: 10 }}>/{max}</span></span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0d0d1a', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
      <div style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{p.name}:</span><span style={{ fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'energy' | 'breakdowns'>('overview');

  const todayBreakdowns = mockBreakdowns.filter(b => b.status === 'open' || b.status === 'in-progress');
  const overduepm = mockPMSchedules.filter(p => p.status === 'overdue');
  const criticalMachines = mockMachines.filter(m => m.status === 'breakdown').length;
  const runningMachines = mockMachines.filter(m => m.status === 'running').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Welcome Banner */}
      <div style={{
        padding: '18px 24px',
        background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(99,102,241,0.08))',
        border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name.split(' ')[0]} 👋
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
            {new Date().toLocaleDateString('en-AE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · {shiftInfo.current} · {shiftInfo.supervisor}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {todayBreakdowns.length > 0 && (
            <div style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} style={{ color: '#ef4444' }} />
              <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{todayBreakdowns.length} Active Breakdowns</span>
            </div>
          )}
          {overduepm.length > 0 && (
            <div style={{ padding: '8px 14px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>{overduepm.length} PM Overdue</span>
            </div>
          )}
        </div>
      </div>

      {/* Top KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
        <KPICard title="OEE" value={mockKPIs.oee} unit="%" icon={<Gauge size={16} />} color="blue" trend="up" trendVal="+2.1%" subtitle="Overall Equipment Effectiveness" />
        <KPICard title="MTBF" value={mockKPIs.mtbf} unit="hrs" icon={<Activity size={16} />} color="green" trend="up" trendVal="+12h" subtitle="Mean Time Between Failures" />
        <KPICard title="MTTR" value={mockKPIs.mttr} unit="hrs" icon={<Clock size={16} />} color="orange" trend="up" trendVal="-0.5h" subtitle="Mean Time To Repair" />
        <KPICard title="PM Compliance" value={mockKPIs.pmCompliance} unit="%" icon={<CheckCircle size={16} />} color="green" trend="up" trendVal="+1.4%" subtitle="Preventive PM completion rate" />
        <KPICard title="El. Availability" value={mockKPIs.electricalAvailability} unit="%" icon={<Zap size={16} />} color="blue" subtitle="Electrical system uptime" />
        <KPICard title="Inst. Availability" value={mockKPIs.instrumentationAvailability} unit="%" icon={<BarChart3 size={16} />} color="purple" subtitle="Instrumentation uptime" />
        <KPICard title="Power Factor" value={mockKPIs.powerFactor} icon={<TrendingUp size={16} />} color="cyan" trend="up" trendVal="+0.02" subtitle="Average power factor" />
        <KPICard title="Budget Used" value={mockKPIs.budgetUtilization} unit="%" icon={<DollarSign size={16} />} color="orange" subtitle="Annual budget utilization" />
      </div>

      {/* Status Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Active Breakdowns', value: todayBreakdowns.length, icon: <AlertTriangle size={20} />, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
          { label: 'PM Due Today', value: overduepm.length + 2, icon: <Calendar size={20} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
          { label: 'Running Machines', value: `${runningMachines}/${mockMachines.length}`, icon: <Activity size={20} />, color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)' },
          { label: 'Open Work Orders', value: 7, icon: <Wrench size={20} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${s.border}`, background: s.bg }}>
            <div style={{ color: s.color }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: s.color }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
        {(['overview', 'energy', 'breakdowns'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: activeTab === tab ? '#3b82f6' : 'none',
              color: activeTab === tab ? 'white' : '#64748b',
              transition: 'all 0.2s',
              textTransform: 'capitalize',
            }}
          >
            {tab === 'overview' ? 'Overview' : tab === 'energy' ? 'Energy' : 'Breakdowns'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          {/* PM Compliance Chart */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>PM Compliance Trend</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Planned vs Completed maintenance</div>
              </div>
              <span className="badge badge-success">94.6% YTD</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pmComplianceData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
                <Bar dataKey="planned" name="Planned" fill="rgba(99,102,241,0.5)" radius={[4,4,0,0]} />
                <Bar dataKey="completed" name="Completed" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Machine Status */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>Machine Status</div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>Real-time equipment status</div>
            <StatusBar label="Running" value={runningMachines} max={mockMachines.length} color="#22c55e" />
            <StatusBar label="Breakdown" value={criticalMachines} max={mockMachines.length} color="#ef4444" />
            <StatusBar label="Maintenance" value={1} max={mockMachines.length} color="#f59e0b" />
            <StatusBar label="Idle" value={1} max={mockMachines.length} color="#64748b" />
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Shift Manpower</div>
              <StatusBar label="Technicians" value={shiftInfo.technicians} max={8} color="#3b82f6" />
              <StatusBar label="Total Staff" value={shiftInfo.totalMen} max={16} color="#8b5cf6" />
            </div>
          </div>

          {/* OEE + KPI Gauges Row */}
          <div className="glass-card" style={{ padding: 20, gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Top 8 Breakdown Machines — YTD</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topBreakdownMachines} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={130} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="breakdowns" name="Breakdowns" fill="#ef4444" radius={[0,4,4,0]} opacity={0.8} />
                <Bar dataKey="downtime" name="Downtime (h)" fill="#f59e0b" radius={[0,4,4,0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'energy' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>Monthly Energy Consumption</div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>kWh consumption trend — 2026</div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mockEnergyData}>
                <defs>
                  <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="consumption" name="kWh" stroke="#3b82f6" strokeWidth={2} fill="url(#energyGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Department-wise Energy</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={departmentEnergyData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                  {departmentEnergyData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {departmentEnergyData.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: d.fill }} />
                  <span style={{ color: '#94a3b8' }}>{d.name} ({d.value}%)</span>
                </div>
              ))}
            </div>
          </div>
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Power Factor Trend</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={mockEnergyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0.88, 1]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="powerFactor" name="PF" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 12 }}>Energy KPIs</div>
            {[
              { label: 'This Month', value: '1,45,000 kWh', sub: '↑ 5.1% vs last month', color: '#f59e0b' },
              { label: 'Energy Cost', value: 'AED 10.15 L', sub: '@ AED 7.00/kWh avg', color: '#ef4444' },
              { label: 'Max Demand', value: '498 kVA', sub: 'Peak this month', color: '#3b82f6' },
              { label: 'Power Factor', value: '0.94', sub: 'Monthly average', color: '#22c55e' },
              { label: 'DG Running', value: '18 hrs', sub: 'This month', color: '#8b5cf6' },
            ].map(k => (
              <div key={k.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>{k.label}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: '#334155' }}>{k.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'breakdowns' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Monthly Breakdown Trend</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyBreakdowns}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" name="Breakdowns" fill="#ef4444" radius={[4,4,0,0]} opacity={0.8} />
                <Bar dataKey="resolved" name="Resolved" fill="#22c55e" radius={[4,4,0,0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 12 }}>Active Breakdowns</div>
            {mockBreakdowns.filter(b => b.status !== 'closed').slice(0,4).map(b => (
              <div key={b.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{b.machineName}</span>
                  <span className={`badge ${b.priority === 'critical' ? 'badge-danger' : b.priority === 'high' ? 'badge-warning' : 'badge-blue'}`}>{b.priority}</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{b.problem.slice(0, 50)}...</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 10, color: '#475569' }}>
                  <span>DT: {b.downtime}h</span>
                  <span>{b.assignedTo || 'Unassigned'}</span>
                  <span className={`badge ${b.status === 'open' ? 'badge-danger' : 'badge-warning'}`}>{b.status}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="glass-card" style={{ padding: 20, gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Recent Breakdowns</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket No</th><th>Machine</th><th>Problem</th><th>Priority</th>
                  <th>Downtime</th><th>Cost</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {mockBreakdowns.map(b => (
                  <tr key={b.id}>
                    <td style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: 12 }}>{b.ticketNo}</td>
                    <td>{b.machineName}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#94a3b8' }}>{b.problem}</td>
                    <td><span className={`badge ${b.priority === 'critical' ? 'badge-danger' : b.priority === 'high' ? 'badge-warning' : 'badge-blue'}`}>{b.priority}</span></td>
                    <td style={{ color: '#f59e0b' }}>{b.downtime}h</td>
                    <td style={{ color: '#22c55e' }}>AED {(b.cost ?? 0).toLocaleString()}</td>
                    <td><span className={`badge ${b.status === 'closed' ? 'badge-success' : b.status === 'resolved' ? 'badge-blue' : 'badge-danger'}`}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
