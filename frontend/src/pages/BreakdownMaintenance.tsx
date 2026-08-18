import { useState } from 'react';
import { Plus, Search, AlertTriangle, Clock, CheckCircle, XCircle, Eye, Edit, Download, Filter } from 'lucide-react';
import { mockBreakdowns } from '../data/mockData';
import type { Breakdown } from '../types';

const PRIORITY_CLASS: Record<string, string> = { critical: 'badge-danger', high: 'badge-warning', medium: 'badge-blue', low: 'badge-gray' };
const STATUS_CLASS: Record<string, string> = { open: 'badge-danger', 'in-progress': 'badge-warning', resolved: 'badge-blue', closed: 'badge-success' };

function BreakdownRow({ b, onView }: { b: Breakdown; onView: (b: Breakdown) => void }) {
  return (
    <tr>
      <td style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: 12 }}>{b.ticketNo}</td>
      <td>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{b.machineName}</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>{new Date(b.reportedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
      </td>
      <td style={{ maxWidth: 200 }}>
        <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.problem}</div>
      </td>
      <td><span className={`badge ${PRIORITY_CLASS[b.priority]}`}>{b.priority}</span></td>
      <td style={{ color: '#f59e0b', fontWeight: 600 }}>{b.downtime}h</td>
      <td style={{ fontSize: 12, color: '#94a3b8' }}>{b.assignedTo ?? '—'}</td>
      <td style={{ color: '#22c55e', fontSize: 12 }}>₹{(b.cost ?? 0).toLocaleString()}</td>
      <td><span className={`badge ${STATUS_CLASS[b.status]}`}>{b.status}</span></td>
      <td>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onView(b)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}><Eye size={11} /></button>
          <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}><Edit size={11} /></button>
        </div>
      </td>
    </tr>
  );
}

export default function BreakdownMaintenance() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Breakdown | null>(null);

  const filtered = mockBreakdowns.filter(b => {
    const s = search.toLowerCase();
    const matchSearch = !s || b.machineName.toLowerCase().includes(s) || b.ticketNo.toLowerCase().includes(s) || b.problem.toLowerCase().includes(s);
    const matchStatus = filterStatus === 'all' || b.status === filterStatus;
    const matchPriority = filterPriority === 'all' || b.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  const totalDowntime = mockBreakdowns.reduce((a, b) => a + b.downtime, 0);
  const totalCost = mockBreakdowns.reduce((a, b) => a + (b.cost ?? 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Breakdowns', value: mockBreakdowns.length, icon: <AlertTriangle size={18} />, color: '#ef4444' },
          { label: 'Open / Active', value: mockBreakdowns.filter(b => b.status === 'open' || b.status === 'in-progress').length, icon: <XCircle size={18} />, color: '#f59e0b' },
          { label: 'Resolved', value: mockBreakdowns.filter(b => b.status === 'resolved').length, icon: <CheckCircle size={18} />, color: '#22c55e' },
          { label: 'Total Downtime', value: `${totalDowntime}h`, icon: <Clock size={18} />, color: '#3b82f6' },
          { label: 'Total Cost', value: `₹${(totalCost / 1000).toFixed(0)}K`, icon: <AlertTriangle size={18} />, color: '#8b5cf6' },
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

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ticket, machine, problem..." className="input-dark" style={{ paddingLeft: 30 }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-dark" style={{ width: 130 }}>
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="input-dark" style={{ width: 130 }}>
          <option value="all">All Priority</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button className="btn-secondary" style={{ fontSize: 12 }}><Download size={13} /> Export</button>
        <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ fontSize: 12 }}>
          <Plus size={13} /> Report Breakdown
        </button>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticket No</th><th>Machine</th><th>Problem</th><th>Priority</th>
              <th>Downtime</th><th>Assigned To</th><th>Cost</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => <BreakdownRow key={b.id} b={b} onView={setSelected} />)}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#475569' }}>No breakdowns found</div>
        )}
      </div>

      {/* View Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{selected.ticketNo}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{selected.machineName}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge ${PRIORITY_CLASS[selected.priority]}`}>{selected.priority}</span>
                <span className={`badge ${STATUS_CLASS[selected.status]}`}>{selected.status}</span>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
              </div>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Reported By', value: selected.reportedBy },
                  { label: 'Assigned To', value: selected.assignedTo ?? 'Unassigned' },
                  { label: 'Reported At', value: new Date(selected.reportedAt).toLocaleString('en-IN') },
                  { label: 'Resolved At', value: selected.resolvedAt ? new Date(selected.resolvedAt).toLocaleString('en-IN') : 'Pending' },
                  { label: 'Downtime', value: `${selected.downtime} hours` },
                  { label: 'Cost', value: `₹${(selected.cost ?? 0).toLocaleString()}` },
                ].map(f => (
                  <div key={f.label} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{f.label}</div>
                    <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{f.value}</div>
                  </div>
                ))}
              </div>
              {[
                { label: 'Problem Description', value: selected.problem },
                { label: 'Root Cause', value: selected.rootCause ?? 'Under investigation' },
                { label: 'Action Taken', value: selected.actionTaken ?? 'In progress' },
              ].map(f => (
                <div key={f.label} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{f.label}</div>
                  <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>{f.value}</div>
                </div>
              ))}
              {selected.sparesUsed && selected.sparesUsed.length > 0 && (
                <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Spare Parts Used</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selected.sparesUsed.map(s => (
                      <span key={s} className="badge badge-blue">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Report Breakdown</div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Machine</label>
                  <select className="input-dark">
                    <option>Select Machine</option>
                    <option>CNC Machining Center</option>
                    <option>Hydraulic Press</option>
                    <option>Air Compressor</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Priority</label>
                  <select className="input-dark">
                    <option>Select Priority</option>
                    <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Problem Description</label>
                  <textarea className="input-dark" rows={3} placeholder="Describe the problem in detail..." style={{ resize: 'vertical' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Assign Technician</label>
                  <select className="input-dark">
                    <option>Select Technician</option>
                    <option>Rajan S</option><option>Murugan K</option><option>Arun P</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Estimated Downtime (hrs)</label>
                  <input type="number" className="input-dark" placeholder="0.0" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Upload Photos / Video</label>
                  <div style={{ border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 8, padding: '20px', textAlign: 'center', cursor: 'pointer', color: '#475569', fontSize: 12 }}>
                    Click to upload or drag & drop files here
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Create Breakdown Ticket</button>
                <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

