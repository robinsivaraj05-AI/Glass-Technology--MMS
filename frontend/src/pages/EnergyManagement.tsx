import { useState } from 'react';
import { Zap, TrendingUp, TrendingDown, Activity, Gauge, Download } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { mockEnergyData, departmentEnergyData } from '../data/mockData';

const hourlyData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i.toString().padStart(2,'0')}:00`,
  consumption: 150 + Math.random() * 200 + (i >= 6 && i <= 22 ? 100 : 0),
  demand: 400 + Math.random() * 100 + (i >= 8 && i <= 18 ? 50 : 0),
}));

const machineEnergyData = [
  { name: 'CNC Center',    kwh: 2850, cost: 19950 },
  { name: 'Inj. Moulding', kwh: 2400, cost: 16800 },
  { name: 'Compressor',    kwh: 1950, cost: 13650 },
  { name: 'HVAC',          kwh: 1680, cost: 11760 },
  { name: 'Laser Cutter',  kwh: 1400, cost: 9800  },
  { name: 'Conveyors',     kwh: 890,  cost: 6230  },
];

const utilityData = [
  { label: 'Electricity',     value: 145000, unit: 'kWh', cost: 1015000, trend: '+5.1%', up: true, icon: '⚡', color: '#3b82f6' },
  { label: 'DG Consumption',  value: 1200,   unit: 'Ltrs',cost: 96000,   trend: '-8%',   up: false, icon: '🔧', color: '#f59e0b' },
  { label: 'Water',           value: 4500,   unit: 'KL',  cost: 22500,   trend: '+2%',   up: true,  icon: '💧', color: '#06b6d4' },
  { label: 'Compressed Air',  value: 52000,  unit: 'Nm³', cost: 36400,   trend: '-3%',   up: false, icon: '💨', color: '#22c55e' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0d0d1a', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
      <div style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, display: 'flex', gap: 12, justifyContent: 'space-between' }}>
          <span>{p.name}:</span><span style={{ fontWeight: 600 }}>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function EnergyManagement() {
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly'>('monthly');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'This Month kWh', value: '1,45,000', sub: '↑ 5.1% vs last month', color: '#3b82f6', icon: <Zap size={18} /> },
          { label: 'Energy Cost', value: '₹10.15L', sub: '@₹7.00/kWh avg', color: '#ef4444', icon: <TrendingUp size={18} /> },
          { label: 'Power Factor', value: '0.94', sub: 'Monthly average', color: '#22c55e', icon: <Activity size={18} /> },
          { label: 'Max Demand', value: '498 kVA', sub: 'Peak this month', color: '#f59e0b', icon: <Gauge size={18} /> },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ color: s.color }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{s.label}</div>
              <div style={{ fontSize: 10, color: s.color, marginTop: 2 }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Period Toggle */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
        {(['daily', 'monthly', 'yearly'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
            background: period === p ? '#3b82f6' : 'none', color: period === p ? 'white' : '#64748b', textTransform: 'capitalize',
          }}>{p}</button>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
                {period === 'daily' ? 'Hourly Load Profile — Today' : 'Monthly Consumption Trend — 2026'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>kWh consumption</div>
            </div>
            <button className="btn-secondary" style={{ fontSize: 11 }}><Download size={12} /> Export</button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            {period === 'daily' ? (
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="conGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="consumption" name="kWh" stroke="#3b82f6" strokeWidth={2} fill="url(#conGrad)" />
                <Area type="monotone" dataKey="demand" name="Demand(kVA)" stroke="#8b5cf6" strokeWidth={1.5} fill="none" strokeDasharray="4 2" />
              </AreaChart>
            ) : (
              <AreaChart data={mockEnergyData}>
                <defs>
                  <linearGradient id="conGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="consumption" name="kWh" stroke="#3b82f6" strokeWidth={2} fill="url(#conGrad2)" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Department-wise Energy</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={departmentEnergyData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" nameKey="name">
                {departmentEnergyData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {departmentEnergyData.map(d => (
              <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: d.fill }} />
                  <span style={{ color: '#94a3b8' }}>{d.name}</span>
                </div>
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>Machine-wise Consumption</div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>Top consumers this month</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={machineEnergyData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={100} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="kwh" name="kWh" fill="#3b82f6" radius={[0,4,4,0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>Power Factor Trend</div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>Monthly average power factor</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={mockEnergyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0.88, 1.0]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="powerFactor" name="Power Factor" stroke="#22c55e" strokeWidth={2.5} dot={{ fill: '#22c55e', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Utility Monitoring */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Utility Monitoring — This Month</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {utilityData.map(u => (
            <div key={u.label} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>{u.icon}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{u.label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: u.color }}>{u.value.toLocaleString()}<span style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginLeft: 4 }}>{u.unit}</span></div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Cost: ₹{u.cost.toLocaleString()}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, color: u.up ? '#ef4444' : '#22c55e' }}>
                {u.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {u.trend} vs last month
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
