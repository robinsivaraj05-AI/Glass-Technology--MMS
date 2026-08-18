import { useState } from 'react';
import { Plus, Search, Filter, CheckCircle, Clock, AlertTriangle, Calendar, Eye, Edit, Trash2, Download, Bell } from 'lucide-react';
import { mockPMSchedules } from '../data/mockData';
import type { PMSchedule } from '../types';

const STATUS_COLOR: Record<string, string> = {
  pending: 'badge-blue', completed: 'badge-success', overdue: 'badge-danger', 'in-progress': 'badge-warning',
};
const FREQ_COLOR: Record<string, string> = {
  daily: '#22c55e', weekly: '#3b82f6', monthly: '#f59e0b', quarterly: '#8b5cf6', 'half-yearly': '#ef4444', yearly: '#06b6d4',
};

function PMCard({ pm }: { pm: PMSchedule }) {
  const daysUntil = Math.ceil((new Date(pm.nextDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return (
    <div className="glass-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{pm.machineName}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Assigned: {pm.assignedTo}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'flex-end' }}>
          <span className={`badge ${STATUS_COLOR[pm.status]}`}>{pm.status}</span>
          <span className="badge badge-gray" style={{ color: FREQ_COLOR[pm.frequency] }}>{pm.frequency}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#64748b', marginBottom: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Calendar size={11} />
          Due: {new Date(pm.nextDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
        </span>
        {pm.lastCompleted && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={11} />
            Last: {new Date(pm.lastCompleted).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          </span>
        )}
        <span style={{
          color: daysUntil < 0 ? '#ef4444' : daysUntil <= 3 ? '#f59e0b' : '#64748b',
          fontWeight: 600,
        }}>
          {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Due today' : `In ${daysUntil}d`}
        </span>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>Checklist ({pm.checklist.length} items)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {pm.checklist.slice(0, 3).map((item, i) => (
            <span key={i} style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, color: '#94a3b8' }}>
              {item}
            </span>
          ))}
          {pm.checklist.length > 3 && <span style={{ fontSize: 10, color: '#475569' }}>+{pm.checklist.length - 3} more</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary" style={{ fontSize: 11, padding: '5px 12px' }}>
          <CheckCircle size={12} /> Complete
        </button>
        <button className="btn-secondary" style={{ fontSize: 11, padding: '5px 10px' }}>
          <Eye size={12} />
        </button>
        <button className="btn-secondary" style={{ fontSize: 11, padding: '5px 10px' }}>
          <Edit size={12} />
        </button>
      </div>
    </div>
  );
}

export default function PreventiveMaintenance() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFreq, setFilterFreq] = useState('all');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [showModal, setShowModal] = useState(false);

  const filtered = mockPMSchedules.filter(p => {
    const s = search.toLowerCase();
    const matchSearch = !s || p.machineName.toLowerCase().includes(s) || p.assignedTo.toLowerCase().includes(s);
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchFreq = filterFreq === 'all' || p.frequency === filterFreq;
    return matchSearch && matchStatus && matchFreq;
  });

  const stats = {
    total: mockPMSchedules.length,
    completed: mockPMSchedules.filter(p => p.status === 'completed').length,
    overdue: mockPMSchedules.filter(p => p.status === 'overdue').length,
    pending: mockPMSchedules.filter(p => p.status === 'pending').length,
    inProgress: mockPMSchedules.filter(p => p.status === 'in-progress').length,
  };
  const compliance = Math.round((stats.completed / stats.total) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          { label: 'Total PM', value: stats.total, icon: <Calendar size={18} />, color: '#3b82f6' },
          { label: 'Completed', value: stats.completed, icon: <CheckCircle size={18} />, color: '#22c55e' },
          { label: 'In Progress', value: stats.inProgress, icon: <Clock size={18} />, color: '#f59e0b' },
          { label: 'Pending', value: stats.pending, icon: <Bell size={18} />, color: '#8b5cf6' },
          { label: 'Overdue', value: stats.overdue, icon: <AlertTriangle size={18} />, color: '#ef4444' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ color: s.color }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Compliance bar */}
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap' }}>PM Compliance</div>
        <div style={{ flex: 1 }}>
          <div className="progress-bar" style={{ height: 10 }}>
            <div className="progress-fill" style={{ width: `${compliance}%`, background: compliance >= 90 ? '#22c55e' : compliance >= 75 ? '#f59e0b' : '#ef4444' }} />
          </div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: compliance >= 90 ? '#22c55e' : '#f59e0b' }}>{compliance}%</div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search machine, technician..." className="input-dark" style={{ paddingLeft: 30 }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-dark" style={{ width: 130 }}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
        <select value={filterFreq} onChange={e => setFilterFreq(e.target.value)} className="input-dark" style={{ width: 130 }}>
          <option value="all">All Frequency</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="half-yearly">Half Yearly</option>
          <option value="yearly">Yearly</option>
        </select>
        <button className="btn-secondary" style={{ fontSize: 12 }}><Download size={13} /> Export</button>
        <button onClick={() => setShowModal(true)} className="btn-primary" style={{ fontSize: 12 }}>
          <Plus size={13} /> Create PM
        </button>
      </div>

      {/* PM Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {filtered.map(pm => <PMCard key={pm.id} pm={pm} />)}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#475569' }}>No PM schedules found matching your criteria</div>
        )}
      </div>

      {/* Create PM Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Create PM Schedule</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Machine', type: 'select', options: ['Select Machine', 'CNC Machining Center', 'Air Compressor', 'Hydraulic Press', 'Welding Robot'] },
                { label: 'Frequency', type: 'select', options: ['Select Frequency', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Half Yearly', 'Yearly'] },
                { label: 'Next Due Date', type: 'date' },
                { label: 'Assign Technician', type: 'select', options: ['Select Technician', 'Rajan S', 'Murugan K', 'Selvam R', 'Arun P', 'Prasad M'] },
                { label: 'Priority', type: 'select', options: ['Select Priority', 'Critical', 'High', 'Medium', 'Low'] },
                { label: 'Estimated Duration (hrs)', type: 'number' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select className="input-dark">
                      {f.options!.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={f.type} className="input-dark" />
                  )}
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>PM Checklist Items</label>
                <textarea className="input-dark" rows={3} placeholder="Enter checklist items (one per line)..." style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Create PM Schedule</button>
                <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

