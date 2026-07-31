import { useState } from 'react';
import { Plus, Search, Download, Eye, Edit, CheckCircle, Clock, AlertTriangle, Wrench } from 'lucide-react';
import { mockWorkOrders } from '../data/mockData';
import type { WorkOrder } from '../types';

const STATUS_CLASS: Record<string, string> = { open: 'badge-blue', assigned: 'badge-purple', 'in-progress': 'badge-warning', completed: 'badge-success', closed: 'badge-gray' };
const PRIORITY_CLASS: Record<string, string> = { critical: 'badge-danger', high: 'badge-warning', medium: 'badge-blue', low: 'badge-gray' };
const TYPE_ICON: Record<string, string> = { corrective: '🔧', preventive: '📋', predictive: '📊', project: '🏗️' };

export default function WorkOrders() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const filtered = mockWorkOrders.filter(wo => {
    const s = search.toLowerCase();
    const matchSearch = !s || wo.title.toLowerCase().includes(s) || wo.woNumber.toLowerCase().includes(s) || (wo.machineName ?? '').toLowerCase().includes(s);
    const matchStatus = filterStatus === 'all' || wo.status === filterStatus;
    const matchType = filterType === 'all' || wo.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const stats = {
    total: mockWorkOrders.length,
    open: mockWorkOrders.filter(w => w.status === 'open').length,
    inProgress: mockWorkOrders.filter(w => w.status === 'in-progress' || w.status === 'assigned').length,
    completed: mockWorkOrders.filter(w => w.status === 'completed' || w.status === 'closed').length,
    overdue: mockWorkOrders.filter(w => new Date(w.dueDate) < new Date() && w.status !== 'completed' && w.status !== 'closed').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          { label: 'Total WO', value: stats.total, color: '#3b82f6' },
          { label: 'Open', value: stats.open, color: '#60a5fa' },
          { label: 'In Progress', value: stats.inProgress, color: '#f59e0b' },
          { label: 'Completed', value: stats.completed, color: '#22c55e' },
          { label: 'Overdue', value: stats.overdue, color: '#ef4444' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search WO number, title, machine..." className="input-dark" style={{ paddingLeft: 30 }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-dark" style={{ width: 140 }}>
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="assigned">Assigned</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="closed">Closed</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-dark" style={{ width: 140 }}>
          <option value="all">All Types</option>
          <option value="corrective">Corrective</option>
          <option value="preventive">Preventive</option>
          <option value="predictive">Predictive</option>
          <option value="project">Project</option>
        </select>
        <button className="btn-secondary" style={{ fontSize: 12 }}><Download size={13} /> Export</button>
        <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ fontSize: 12 }}>
          <Plus size={13} /> Create WO
        </button>
      </div>

      {/* Work Orders Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(wo => {
          const isOverdue = new Date(wo.dueDate) < new Date() && wo.status !== 'completed' && wo.status !== 'closed';
          const daysLeft = Math.ceil((new Date(wo.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return (
            <div key={wo.id} className="glass-card" style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setSelected(wo)}>
              <div style={{ fontSize: 24, flexShrink: 0 }}>{TYPE_ICON[wo.type]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#60a5fa', marginRight: 8 }}>{wo.woNumber}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{wo.title}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <span className={`badge ${PRIORITY_CLASS[wo.priority]}`}>{wo.priority}</span>
                    <span className={`badge ${STATUS_CLASS[wo.status]}`}>{wo.status}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{wo.description}</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#475569', flexWrap: 'wrap' }}>
                  {wo.machineName && <span>Machine: <span style={{ color: '#94a3b8' }}>{wo.machineName}</span></span>}
                  <span>Assigned: <span style={{ color: '#94a3b8' }}>{wo.assignedTo}</span></span>
                  <span>Est: <span style={{ color: '#94a3b8' }}>{wo.estimatedHours}h</span></span>
                  {wo.actualHours && <span>Actual: <span style={{ color: '#22c55e' }}>{wo.actualHours}h</span></span>}
                  <span style={{ color: isOverdue ? '#ef4444' : daysLeft <= 2 ? '#f59e0b' : '#475569' }}>
                    Due: {new Date(wo.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    {isOverdue ? ' (Overdue)' : ` (${daysLeft}d)`}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={e => { e.stopPropagation(); setSelected(wo); }} className="btn-secondary" style={{ padding: '5px 10px', fontSize: 11 }}><Eye size={12} /></button>
                <button onClick={e => e.stopPropagation()} className="btn-secondary" style={{ padding: '5px 10px', fontSize: 11 }}><Edit size={12} /></button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#475569' }}>No work orders found</div>
        )}
      </div>

      {/* View Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{selected.woNumber} — {selected.title}</div>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>{selected.type} Maintenance</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className={`badge ${PRIORITY_CLASS[selected.priority]}`}>{selected.priority}</span>
                <span className={`badge ${STATUS_CLASS[selected.status]}`}>{selected.status}</span>
              </div>
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Description</div>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>{selected.description}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Assigned To', value: selected.assignedTo },
                  { label: 'Supervisor', value: selected.supervisor ?? '—' },
                  { label: 'Due Date', value: new Date(selected.dueDate).toLocaleDateString('en-IN') },
                  { label: 'Created', value: new Date(selected.createdAt).toLocaleDateString('en-IN') },
                  { label: 'Est. Hours', value: `${selected.estimatedHours}h` },
                  { label: 'Actual Hours', value: selected.actualHours ? `${selected.actualHours}h` : 'Pending' },
                ].map(f => (
                  <div key={f.label} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{f.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-primary" style={{ fontSize: 12 }}><CheckCircle size={12} /> Mark Complete</button>
                <button className="btn-secondary" style={{ fontSize: 12 }}><Edit size={12} /> Edit</button>
                <button className="btn-secondary" style={{ fontSize: 12 }}><Download size={12} /> PDF</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create WO Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>Create Work Order</div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'WO Title', placeholder: 'Work order title', gridCol: true },
                { label: 'Type', type: 'select', options: ['Corrective', 'Preventive', 'Predictive', 'Project'] },
                { label: 'Priority', type: 'select', options: ['Critical', 'High', 'Medium', 'Low'] },
                { label: 'Machine / Equipment', type: 'select', options: ['CNC Machining Center', 'Air Compressor', 'Hydraulic Press'] },
                { label: 'Assign Technician', type: 'select', options: ['Rajan S', 'Murugan K', 'Selvam R', 'Arun P'] },
                { label: 'Supervisor', type: 'select', options: ['Kumar V', 'Prasad M', 'Kannan R'] },
                { label: 'Due Date', type: 'date' },
                { label: 'Estimated Hours', type: 'number' },
                { label: 'Description', type: 'textarea', gridCol: true },
              ].map(f => (
                <div key={f.label} style={{ gridColumn: (f as any).gridCol ? '1/-1' : undefined }}>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select className="input-dark">
                      <option>Select {f.label}</option>
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
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Create Work Order</button>
                <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
