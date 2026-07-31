import { useState } from 'react';
import { Plus, Search, Download, Eye, Edit, TrendingUp, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { mockProjects } from '../data/mockData';
import type { Project } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const STATUS_CLASS: Record<string, string> = { planning: 'badge-blue', 'in-progress': 'badge-warning', 'on-hold': 'badge-gray', completed: 'badge-success' };
const TYPE_ICON: Record<string, string> = { electrical: '⚡', automation: '🤖', 'energy-saving': '🌱', capex: '🏗️', opex: '⚙️' };

function ProjectCard({ p, onView }: { p: Project; onView: (p: Project) => void }) {
  const budgetPct = Math.round((p.spent / p.budget) * 100);
  const daysLeft = Math.ceil((new Date(p.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return (
    <div className="glass-card" style={{ padding: 18, cursor: 'pointer' }} onClick={() => onView(p)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>{TYPE_ICON[p.type]}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }}>{p.name}</div>
            <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>{p.projectNo}</div>
          </div>
        </div>
        <span className={`badge ${STATUS_CLASS[p.status]}`}>{p.status}</span>
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
        {p.description.slice(0, 80)}...
      </div>
      {/* Progress */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 5 }}>
          <span>Progress</span><span style={{ color: '#f1f5f9', fontWeight: 600 }}>{p.progress}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${p.progress}%`, background: p.progress === 100 ? '#22c55e' : p.progress >= 60 ? '#3b82f6' : '#f59e0b' }} />
        </div>
      </div>
      {/* Budget */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 5 }}>
          <span>Budget Utilization</span><span style={{ color: budgetPct > 90 ? '#ef4444' : '#f1f5f9', fontWeight: 600 }}>{budgetPct}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${budgetPct}%`, background: budgetPct > 90 ? '#ef4444' : '#22c55e' }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
        <span>Budget: <span style={{ color: '#f1f5f9' }}>₹{(p.budget / 100000).toFixed(1)}L</span></span>
        <span>Spent: <span style={{ color: '#f59e0b' }}>₹{(p.spent / 100000).toFixed(1)}L</span></span>
        <span style={{ color: daysLeft < 0 ? '#ef4444' : daysLeft <= 30 ? '#f59e0b' : '#22c55e' }}>
          {daysLeft < 0 ? `${Math.abs(daysLeft)}d over` : `${daysLeft}d left`}
        </span>
      </div>
    </div>
  );
}

export default function Projects() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [selected, setSelected] = useState<Project | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const filtered = mockProjects.filter(p => {
    const s = search.toLowerCase();
    const matchSearch = !s || p.name.toLowerCase().includes(s) || p.projectNo.toLowerCase().includes(s);
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchType = filterType === 'all' || p.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const totalBudget = mockProjects.reduce((a, p) => a + p.budget, 0);
  const totalSpent = mockProjects.reduce((a, p) => a + p.spent, 0);

  const budgetData = mockProjects.map(p => ({ name: p.name.slice(0, 20) + '...', budget: p.budget / 100000, spent: p.spent / 100000 }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Projects', value: mockProjects.length, color: '#3b82f6' },
          { label: 'In Progress', value: mockProjects.filter(p => p.status === 'in-progress').length, color: '#f59e0b' },
          { label: 'Completed', value: mockProjects.filter(p => p.status === 'completed').length, color: '#22c55e' },
          { label: 'Total Budget', value: `₹${(totalBudget / 100000).toFixed(0)}L`, color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Budget Summary */}
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Overall Budget</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="progress-bar" style={{ height: 10 }}>
            <div className="progress-fill" style={{ width: `${Math.round((totalSpent / totalBudget) * 100)}%`, background: 'linear-gradient(90deg, #3b82f6, #22c55e)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
          <span>Total: <strong style={{ color: '#f1f5f9' }}>₹{(totalBudget / 100000).toFixed(1)}L</strong></span>
          <span>Spent: <strong style={{ color: '#f59e0b' }}>₹{(totalSpent / 100000).toFixed(1)}L</strong></span>
          <span>Remaining: <strong style={{ color: '#22c55e' }}>₹{((totalBudget - totalSpent) / 100000).toFixed(1)}L</strong></span>
          <strong style={{ color: '#3b82f6' }}>{Math.round((totalSpent / totalBudget) * 100)}% used</strong>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search project name, number..." className="input-dark" style={{ paddingLeft: 30 }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-dark" style={{ width: 140 }}>
          <option value="all">All Status</option>
          <option value="planning">Planning</option>
          <option value="in-progress">In Progress</option>
          <option value="on-hold">On Hold</option>
          <option value="completed">Completed</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-dark" style={{ width: 150 }}>
          <option value="all">All Types</option>
          <option value="electrical">Electrical</option>
          <option value="automation">Automation</option>
          <option value="energy-saving">Energy Saving</option>
          <option value="capex">CAPEX</option>
          <option value="opex">OPEX</option>
        </select>
        <button className="btn-secondary" style={{ fontSize: 12 }}><Download size={13} /> Export</button>
        <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ fontSize: 12 }}>
          <Plus size={13} /> New Project
        </button>
      </div>

      {/* Project Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {filtered.map(p => <ProjectCard key={p.id} p={p} onView={setSelected} />)}
      </div>

      {/* Budget Chart */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Project Budget vs Spent (₹ Lakhs)</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={budgetData} margin={{ left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}L`} />
            <Tooltip formatter={(v: any) => [`₹${Number(v).toFixed(1)}L`]} contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="budget" name="Budget" fill="rgba(99,102,241,0.5)" radius={[4,4,0,0]} />
            <Bar dataKey="spent" name="Spent" fill="#3b82f6" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{selected.name}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{selected.projectNo} · {selected.projectManager}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>{selected.description}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Type', value: selected.type },
                  { label: 'Status', value: selected.status },
                  { label: 'Start Date', value: new Date(selected.startDate).toLocaleDateString('en-IN') },
                  { label: 'End Date', value: new Date(selected.endDate).toLocaleDateString('en-IN') },
                  { label: 'Budget', value: `₹${(selected.budget / 100000).toFixed(1)}L` },
                  { label: 'Spent', value: `₹${(selected.spent / 100000).toFixed(1)}L` },
                  { label: 'Progress', value: `${selected.progress}%` },
                  { label: 'Project Manager', value: selected.projectManager },
                ].map(f => (
                  <div key={f.label} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{f.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-primary" style={{ fontSize: 12 }}><Edit size={12} /> Edit Project</button>
                <button className="btn-secondary" style={{ fontSize: 12 }}><TrendingUp size={12} /> Gantt Chart</button>
                <button className="btn-secondary" style={{ fontSize: 12 }}><Download size={12} /> Report</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>Create New Project</div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Project Name', placeholder: 'Full project name', gridCol: true },
                { label: 'Project Type', type: 'select', options: ['Electrical', 'Automation', 'Energy Saving', 'CAPEX', 'OPEX'] },
                { label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'] },
                { label: 'Project Manager', placeholder: 'Responsible engineer' },
                { label: 'Budget (₹)', type: 'number', placeholder: '0' },
                { label: 'Start Date', type: 'date' },
                { label: 'End Date', type: 'date' },
                { label: 'Status', type: 'select', options: ['Planning', 'In Progress', 'On Hold'] },
                { label: 'Description', type: 'textarea', gridCol: true },
              ].map(f => (
                <div key={f.label} style={{ gridColumn: (f as any).gridCol ? '1/-1' : undefined }}>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select className="input-dark">
                      {f.options!.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea className="input-dark" rows={3} style={{ resize: 'vertical' }} />
                  ) : (
                    <input type={f.type ?? 'text'} placeholder={f.placeholder} className="input-dark" />
                  )}
                </div>
              ))}
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Create Project</button>
                <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
