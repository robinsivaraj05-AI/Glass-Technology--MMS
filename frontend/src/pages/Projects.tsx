import { useState, useEffect } from 'react';
import { Plus, Search, Download, Edit, TrendingUp, Trash2, AlertTriangle } from 'lucide-react';
import { mockProjects } from '../data/mockData';
import type { Project } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEmployees } from '../context/EmployeeContext';

const EMPTY_FORM = {
  name: '', type: 'electrical', priority: 'high', projectManager: '',
  budget: '', startDate: '', endDate: '', status: 'planning', description: '',
  teamMembers: [] as string[],
};

const STATUS_CLASS: Record<string, string> = { planning: 'badge-blue', 'in-progress': 'badge-warning', 'on-hold': 'badge-gray', completed: 'badge-success' };
const TYPE_ICON: Record<string, string> = { electrical: '⚡', automation: '🤖', 'energy-saving': '🌱', capex: '🏗️', opex: '⚙️' };

function ProjectCard({ p, onView, onDelete }: { p: Project; onView: (p: Project) => void; onDelete: (p: Project) => void }) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`badge ${STATUS_CLASS[p.status]}`}>{p.status}</span>
          <button
            onClick={e => { e.stopPropagation(); onDelete(p); }}
            title="Delete project"
            style={{
              background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6,
              color: '#ef4444', cursor: 'pointer', padding: '3px 6px', display: 'flex',
              alignItems: 'center', lineHeight: 1,
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
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
  const { employees } = useEmployees();
  const activeEmployees = employees.filter(e => e.status !== 'resigned');
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const stored = localStorage.getItem('mms_projects');
      return stored ? JSON.parse(stored) : mockProjects;
    } catch {
      return mockProjects;
    }
  });

  useEffect(() => {
    localStorage.setItem('mms_projects', JSON.stringify(projects));
  }, [projects]);
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType]     = useState('all');
  const [selected, setSelected]         = useState<Project | null>(null);
  const [showCreate, setShowCreate]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [form, setForm]                 = useState({ ...EMPTY_FORM });

  const setField = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  const handleCreate = () => {
    if (!form.name.trim()) return;
    const year = new Date().getFullYear();
    const projectNo = `PRJ-${year}-${String(projects.length + 1).padStart(3, '0')}`;
    const newProject: Project = {
      id: Date.now().toString(),
      projectNo,
      name: form.name.trim(),
      type: form.type as Project['type'],
      status: form.status as Project['status'],
      priority: form.priority as Project['priority'],
      budget: Number(form.budget) || 0,
      spent: 0,
      progress: 0,
      startDate: form.startDate || new Date().toISOString().split('T')[0],
      endDate: form.endDate || new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
      projectManager: form.projectManager,
      teamMembers: form.teamMembers,
      description: form.description.trim(),
    };
    setProjects(prev => [...prev, newProject]);
    setShowCreate(false);
    setForm({ ...EMPTY_FORM });
  };

  const filtered = projects.filter(p => {
    const s = search.toLowerCase();
    const matchSearch = !s || p.name.toLowerCase().includes(s) || p.projectNo.toLowerCase().includes(s);
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchType = filterType === 'all' || p.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const handleDelete = (p: Project) => setDeleteTarget(p);
  const confirmDelete = () => {
    if (!deleteTarget) return;
    setProjects(prev => prev.filter(p => p.id !== deleteTarget.id));
    if (selected?.id === deleteTarget.id) setSelected(null);
    setDeleteTarget(null);
  };

  const totalBudget = projects.reduce((a, p) => a + p.budget, 0);
  const totalSpent  = projects.reduce((a, p) => a + p.spent, 0);

  const budgetData = projects.map(p => ({ name: p.name.slice(0, 20) + '...', budget: p.budget / 100000, spent: p.spent / 100000 }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Projects', value: projects.length, color: '#3b82f6' },
          { label: 'In Progress', value: projects.filter(p => p.status === 'in-progress').length, color: '#f59e0b' },
          { label: 'Completed', value: projects.filter(p => p.status === 'completed').length, color: '#22c55e' },
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
        {filtered.map(p => <ProjectCard key={p.id} p={p} onView={setSelected} onDelete={handleDelete} />)}
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
              {selected.teamMembers && selected.teamMembers.length > 0 && (
                <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Team Members</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selected.teamMembers.map(m => (
                      <span key={m} style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 20, padding: '2px 10px', fontSize: 11, color: '#93c5fd' }}>{m}</span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-primary" style={{ fontSize: 12 }}><Edit size={12} /> Edit Project</button>
                <button className="btn-secondary" style={{ fontSize: 12 }}><TrendingUp size={12} /> Gantt Chart</button>
                <button className="btn-secondary" style={{ fontSize: 12 }}><Download size={12} /> Report</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.06)' }}>
              <AlertTriangle size={16} color="#ef4444" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>Delete Project</span>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 6px' }}>
                Are you sure you want to delete:
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', margin: '0 0 4px' }}>
                {deleteTarget.name}
              </p>
              <p style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', margin: '0 0 20px' }}>
                {deleteTarget.projectNo}
              </p>
              <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 20px' }}>
                This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={confirmDelete}
                  style={{ flex: 1, padding: '9px 0', background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Trash2 size={13} /> Yes, Delete
                </button>
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => { setShowCreate(false); setForm({ ...EMPTY_FORM }); }}>
          <div className="modal-content" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>Create New Project</div>
              <button onClick={() => { setShowCreate(false); setForm({ ...EMPTY_FORM }); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              {/* Project Name — full width */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Project Name *</label>
                <input
                  type="text" placeholder="Full project name" className="input-dark"
                  value={form.name} onChange={e => setField('name', e.target.value)}
                />
              </div>

              {/* Project Type */}
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Project Type</label>
                <select className="input-dark" value={form.type} onChange={e => setField('type', e.target.value)}>
                  <option value="electrical">Electrical</option>
                  <option value="automation">Automation</option>
                  <option value="energy-saving">Energy Saving</option>
                  <option value="capex">CAPEX</option>
                  <option value="opex">OPEX</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Priority</label>
                <select className="input-dark" value={form.priority} onChange={e => setField('priority', e.target.value)}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Project Manager — employee dropdown */}
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Project Manager</label>
                <select className="input-dark" value={form.projectManager} onChange={e => setField('projectManager', e.target.value)}>
                  <option value="">— Select Employee —</option>
                  {activeEmployees.map(e => (
                    <option key={e.id} value={e.name}>{e.name}{e.designation ? ` — ${e.designation}` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Budget */}
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Budget (₹)</label>
                <input
                  type="number" placeholder="0" className="input-dark"
                  value={form.budget} onChange={e => setField('budget', e.target.value)}
                />
              </div>

              {/* Start Date */}
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Start Date</label>
                <input
                  type="date" className="input-dark"
                  value={form.startDate} onChange={e => setField('startDate', e.target.value)}
                />
              </div>

              {/* End Date */}
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>End Date</label>
                <input
                  type="date" className="input-dark"
                  value={form.endDate} onChange={e => setField('endDate', e.target.value)}
                />
              </div>

              {/* Status */}
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Status</label>
                <select className="input-dark" value={form.status} onChange={e => setField('status', e.target.value)}>
                  <option value="planning">Planning</option>
                  <option value="in-progress">In Progress</option>
                  <option value="on-hold">On Hold</option>
                </select>
              </div>

              {/* Team Members — full width */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Additional Team Members</label>
                <select
                  className="input-dark"
                  value=""
                  onChange={e => {
                    const name = e.target.value;
                    if (name && !form.teamMembers.includes(name))
                      setForm(p => ({ ...p, teamMembers: [...p.teamMembers, name] }));
                  }}
                >
                  <option value="">— Add member —</option>
                  {activeEmployees
                    .filter(e => e.name !== form.projectManager && !form.teamMembers.includes(e.name))
                    .map(e => <option key={e.id} value={e.name}>{e.name}{e.designation ? ` — ${e.designation}` : ''}</option>)
                  }
                </select>
                {form.teamMembers.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {form.teamMembers.map(name => (
                      <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#93c5fd' }}>
                        {name}
                        <button
                          onClick={() => setForm(p => ({ ...p, teamMembers: p.teamMembers.filter(m => m !== name) }))}
                          style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Description — full width */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Description</label>
                <textarea
                  className="input-dark" rows={3} style={{ resize: 'vertical' }}
                  placeholder="Brief project description..."
                  value={form.description} onChange={e => setField('description', e.target.value)}
                />
              </div>

              {/* Actions */}
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
                <button
                  onClick={handleCreate}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center', opacity: form.name.trim() ? 1 : 0.5 }}
                >
                  <Plus size={13} /> Create Project
                </button>
                <button onClick={() => { setShowCreate(false); setForm({ ...EMPTY_FORM }); }} className="btn-secondary">Cancel</button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
