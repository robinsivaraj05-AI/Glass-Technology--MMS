import { useState, useEffect, useCallback } from 'react';
import { Users, Clock, DollarSign, TrendingUp, Calendar, Activity, BarChart2, AlertCircle } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import toast from 'react-hot-toast';

interface DashboardData {
  totalEntries:     number;
  todayPersons:     number;
  monthPersons:     number;
  yearPersons:      number;
  monthHours:       number;
  monthOT:          number;
  yearHours:        number;
  monthCost:        number;
  yearCost:         number;
  monthlyCostTrend: { _id: { year: number; month: number }; totalCost: number; totalPersons: number; totalHours: number; totalOT: number }[];
  workTypeBreakdown: { _id: string; count: number; cost: number }[];
  contractorCost:    { _id: string; cost: number; persons: number }[];
}

interface Contract {
  _id: string; contractName: string; contractorCompany: string;
  contractType: string; startDate: string; endDate: string;
  contractValue: number; status: string;
}

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PIE_COLORS = ['#3b82f6','#0f766e','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#84cc16','#f97316'];

const currency = (n: number) => {
  if (n >= 1_00_000) return `AED ${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1000)     return `AED ${(n / 1000).toFixed(0)}K`;
  return `AED ${n.toLocaleString('en-AE')}`;
};
const fullCurrency = (n: number) => `AED ${n.toLocaleString('en-AE')}`;

async function apiFetch(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

// KPI Card
function KpiCard({ icon, label, value, sub, color, bg }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string; bg: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function ContractorDashboard() {
  const [data,      setData]      = useState<DashboardData | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, clist] = await Promise.all([
        apiFetch('/api/outsource/dashboard'),
        apiFetch('/api/contracts?status=Active'),
      ]);
      setData(dash);
      setContracts(clist);
    } catch { toast.error('Failed to load dashboard'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#94a3b8' }}>
      Loading dashboard…
    </div>
  );

  if (!data) return null;

  // Prepare chart data
  const trendData = data.monthlyCostTrend.map(m => ({
    name: `${MONTHS[m._id.month]} '${String(m._id.year).slice(2)}`,
    cost: m.totalCost,
    persons: m.totalPersons,
  }));

  const pieData = data.workTypeBreakdown.map(w => ({ name: w._id || 'Other', value: w.count, cost: w.cost }));

  const barData = data.contractorCost.map(c => ({ name: c._id.length > 16 ? c._id.slice(0, 16) + '…' : c._id, cost: c.cost, persons: c.persons }));

  const now = new Date();

  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
    padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  };
  const secTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 };

  return (
    <div style={{ padding: '20px 24px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart2 size={20} color="#fff"/>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Contractor Dashboard</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Live overview of outsource workforce & costs</p>
        </div>
        <button onClick={load} style={{ marginLeft: 'auto', padding: '7px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Activity size={13}/> Refresh
        </button>
      </div>

      {/* KPI Row 1 — Today & Month people */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        <KpiCard icon={<Users size={20} color="#1e40af"/>} label="Today's Persons" value={data.todayPersons} sub="Currently on site" color="#1e40af" bg="#dbeafe"/>
        <KpiCard icon={<Users size={20} color="#0f766e"/>} label="Month Persons" value={data.monthPersons} sub={`${now.toLocaleString('default',{month:'long'})} ${now.getFullYear()}`} color="#0f766e" bg="#ccfbf1"/>
        <KpiCard icon={<Clock size={20} color="#7c3aed"/>} label="Month Hours" value={data.monthHours.toLocaleString()} sub={`OT: ${data.monthOT} hrs`} color="#7c3aed" bg="#ede9fe"/>
        <KpiCard icon={<TrendingUp size={20} color="#d97706"/>} label="Year Persons" value={data.yearPersons.toLocaleString()} sub={`FY ${now.getFullYear()}`} color="#d97706" bg="#fef3c7"/>
      </div>

      {/* KPI Row 2 — Costs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <KpiCard icon={<DollarSign size={20} color="#dc2626"/>} label="Month Cost" value={currency(data.monthCost)} sub={fullCurrency(data.monthCost)} color="#dc2626" bg="#fee2e2"/>
        <KpiCard icon={<DollarSign size={20} color="#0f766e"/>} label="Year Cost" value={currency(data.yearCost)} sub={fullCurrency(data.yearCost)} color="#0f766e" bg="#ccfbf1"/>
        <KpiCard icon={<Calendar size={20} color="#475569"/>} label="Total Entries" value={data.totalEntries.toLocaleString()} sub="Work records in system" color="#475569" bg="#f1f5f9"/>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Monthly Cost Trend */}
        <div style={cardStyle}>
          <div style={secTitle}><TrendingUp size={15} color="#1e40af"/> Monthly Cost Trend (Last 12 months)</div>
          {trendData.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => currency(v)} tick={{ fontSize: 10 }}/>
                <Tooltip formatter={(v: number) => fullCurrency(v)} contentStyle={{ fontSize: 12 }}/>
                <Line type="monotone" dataKey="cost" name="Cost" stroke="#1e40af" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }}/>
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Work Type Breakdown */}
        <div style={cardStyle}>
          <div style={secTitle}><Activity size={15} color="#7c3aed"/> Work Type Breakdown (This Year)</div>
          {pieData.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>No data yet</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ResponsiveContainer width={180} height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [v, name]} contentStyle={{ fontSize: 11 }}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {pieData.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }}/>
                    <div style={{ fontSize: 11, flex: 1, color: '#475569' }}>{d.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>{d.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contractor Cost Bar */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={secTitle}><BarChart2 size={15} color="#0f766e"/> Top Contractors by Cost (This Year)</div>
        {barData.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', paddingTop: 24 }}>No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end"/>
              <YAxis tickFormatter={v => currency(v)} tick={{ fontSize: 10 }}/>
              <Tooltip formatter={(v: number) => fullCurrency(v)} contentStyle={{ fontSize: 12 }}/>
              <Legend wrapperStyle={{ fontSize: 11 }}/>
              <Bar dataKey="cost" name="Cost" fill="#0f766e" radius={[4, 4, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Active Contracts Table */}
      <div style={cardStyle}>
        <div style={secTitle}><AlertCircle size={15} color="#d97706"/> Active Contracts ({contracts.length})</div>
        {contracts.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', paddingTop: 20 }}>No active contracts</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Contract Name', 'Company', 'Type', 'Start', 'End', 'Value', 'Days Left'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c, i) => {
                  const end  = new Date(c.endDate);
                  const diff = Math.ceil((end.getTime() - now.getTime()) / 86400000);
                  const daysColor = diff < 30 ? '#dc2626' : diff < 90 ? '#d97706' : '#15803d';
                  return (
                    <tr key={c._id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{c.contractName}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: '#475569' }}>{c.contractorCompany}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: '#64748b' }}>{c.contractType}</td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(c.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(c.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: '#1e40af' }}>
                        {c.contractValue ? `AED ${c.contractValue.toLocaleString('en-AE')}` : '—'}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: daysColor, background: daysColor + '18', padding: '2px 8px', borderRadius: 12 }}>
                          {diff > 0 ? `${diff}d` : 'Expired'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
