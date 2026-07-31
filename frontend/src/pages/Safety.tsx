import { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, FileText, Plus, Lock, Search } from 'lucide-react';

const permits = [
  { id: '1', permitNo: 'PTW-2026-089', type: 'LOTO', machine: 'HT Panel A', location: 'Substation 1', issuedTo: 'Rajan Selvam', issuedBy: 'Rajesh Kumar', startTime: '2026-07-25T08:00:00', endTime: '2026-07-25T14:00:00', status: 'active', riskLevel: 'high' },
  { id: '2', permitNo: 'PTW-2026-088', type: 'Hot Work', machine: 'Boiler Area', location: 'Utility Block', issuedTo: 'Kumar Velu', issuedBy: 'Rajesh Kumar', startTime: '2026-07-24T10:00:00', endTime: '2026-07-24T15:00:00', status: 'closed', riskLevel: 'medium' },
  { id: '3', permitNo: 'PTW-2026-087', type: 'Confined Space', machine: 'Cooling Tower', location: 'Cooling Area', issuedTo: 'Murugan Kumar', issuedBy: 'Arun Selvam', startTime: '2026-07-23T07:00:00', endTime: '2026-07-23T12:00:00', status: 'closed', riskLevel: 'critical' },
  { id: '4', permitNo: 'PTW-2026-090', type: 'Height Work', machine: 'Roof Lighting', location: 'Shed A', issuedTo: 'Prasad Murugan', issuedBy: 'Rajan Pandian', startTime: '2026-07-26T06:00:00', endTime: '2026-07-26T12:00:00', status: 'pending', riskLevel: 'high' },
];

const incidents = [
  { id: '1', incNo: 'INC-2026-012', type: 'Near Miss', description: 'Oil spill on walkway near compressor room — slipping hazard', reportedBy: 'Kannan Raja', date: '2026-07-24', severity: 'low', status: 'closed', corrective: 'Cleaned immediately, non-slip mat added' },
  { id: '2', incNo: 'INC-2026-011', type: 'Unsafe Condition', description: 'Exposed electrical cables near production Line 3', reportedBy: 'Selvam Rajan', date: '2026-07-22', severity: 'medium', status: 'open', corrective: 'Temporary insulation applied, permanent fix in progress' },
  { id: '3', incNo: 'INC-2026-010', type: 'Near Miss', description: 'Crane load swinging near workers — workers moved away in time', reportedBy: 'Prasad Murugan', date: '2026-07-20', severity: 'high', status: 'open', corrective: 'Refresher training on crane safety, exclusion zone marked' },
];

const STATUS_COLOR: Record<string, string> = { active: '#f59e0b', closed: '#22c55e', pending: '#3b82f6', expired: '#ef4444' };
const RISK_COLOR: Record<string, string> = { critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#22c55e' };
const SEV_COLOR: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

export default function Safety() {
  const [tab, setTab] = useState<'ptw' | 'incidents' | 'loto' | 'ppe'>('ptw');
  const [showCreate, setShowCreate] = useState(false);

  const stats = {
    activePermits: permits.filter(p => p.status === 'active').length,
    openIncidents: incidents.filter(i => i.status === 'open').length,
    nearMisses: incidents.filter(i => i.type === 'Near Miss').length,
    pendingCapa: 3,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Active Permits', value: stats.activePermits, color: '#f59e0b', icon: <Lock size={18} /> },
          { label: 'Open Incidents', value: stats.openIncidents, color: '#ef4444', icon: <AlertTriangle size={18} /> },
          { label: 'Near Misses (MTD)', value: stats.nearMisses, color: '#3b82f6', icon: <Shield size={18} /> },
          { label: 'Pending CAPA', value: stats.pendingCapa, color: '#8b5cf6', icon: <FileText size={18} /> },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ color: s.color }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Safety Banner */}
      <div style={{ padding: '12px 20px', background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(59,130,246,0.05))', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Shield size={20} style={{ color: '#22c55e', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>Safety First — Zero Accident Culture</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Report all near misses and unsafe conditions immediately. No work is so urgent that it cannot be done safely.</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>247</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>Days without LTI</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
        {[
          { key: 'ptw', label: 'Permit to Work' },
          { key: 'incidents', label: 'Incidents / Near Miss' },
          { key: 'loto', label: 'LOTO Register' },
          { key: 'ppe', label: 'PPE Checklist' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{
            padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
            background: tab === t.key ? '#3b82f6' : 'none', color: tab === t.key ? 'white' : '#64748b',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'ptw' && (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ fontSize: 12 }}>
              <Plus size={13} /> Issue Permit
            </button>
          </div>
          <div className="glass-card" style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Permit No</th><th>Type</th><th>Equipment</th><th>Issued To</th><th>Issued By</th><th>Valid Until</th><th>Risk</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {permits.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'monospace', color: '#60a5fa', fontSize: 12 }}>{p.permitNo}</td>
                    <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{p.type}</span></td>
                    <td style={{ color: '#e2e8f0', fontWeight: 600 }}>{p.machine}</td>
                    <td style={{ fontSize: 12, color: '#94a3b8' }}>{p.issuedTo}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{p.issuedBy}</td>
                    <td style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(p.endTime).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td><span style={{ fontSize: 11, color: RISK_COLOR[p.riskLevel], fontWeight: 600, textTransform: 'capitalize' }}>{p.riskLevel}</span></td>
                    <td><span className="badge" style={{ fontSize: 10, color: STATUS_COLOR[p.status], background: STATUS_COLOR[p.status] + '20', border: `1px solid ${STATUS_COLOR[p.status]}40` }}>{p.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {p.status === 'active' && <button className="btn-danger" style={{ padding: '4px 8px', fontSize: 10 }}>Close</button>}
                        <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 10 }}>View</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'incidents' && (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1 }} />
            <button className="btn-primary" style={{ fontSize: 12 }}><Plus size={13} /> Report Incident</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {incidents.map(inc => (
              <div key={inc.id} className="glass-card" style={{ padding: 16, borderLeft: `3px solid ${SEV_COLOR[inc.severity]}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#60a5fa', marginRight: 8 }}>{inc.incNo}</span>
                    <span className="badge badge-blue" style={{ fontSize: 10 }}>{inc.type}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span className="badge" style={{ fontSize: 10, color: SEV_COLOR[inc.severity], background: SEV_COLOR[inc.severity] + '20', border: `1px solid ${SEV_COLOR[inc.severity]}40` }}>
                      {inc.severity} severity
                    </span>
                    <span className={`badge ${inc.status === 'open' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: 10 }}>{inc.status}</span>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500, marginBottom: 8 }}>{inc.description}</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#475569', marginBottom: 8 }}>
                  <span>Reported by: <span style={{ color: '#94a3b8' }}>{inc.reportedBy}</span></span>
                  <span>Date: <span style={{ color: '#94a3b8' }}>{new Date(inc.date).toLocaleDateString('en-IN')}</span></span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                  <span style={{ color: '#94a3b8', fontWeight: 500 }}>Corrective Action: </span>{inc.corrective}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'loto' && (
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 20 }}>LOTO (Lockout/Tagout) Procedure</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { step: 1, title: 'Notify', desc: 'Inform all affected workers and supervisor', icon: '📢', color: '#3b82f6' },
              { step: 2, title: 'Identify Energy Sources', desc: 'Locate all energy isolation points for the equipment', icon: '🔍', color: '#8b5cf6' },
              { step: 3, title: 'Isolate Equipment', desc: 'De-energize by turning off and disconnecting all energy sources', icon: '🔌', color: '#f59e0b' },
              { step: 4, title: 'Apply Lockout', desc: 'Each technician applies their personal lock and tag', icon: '🔒', color: '#ef4444' },
              { step: 5, title: 'Verify Zero Energy', desc: 'Test to ensure all energy has been released or restrained', icon: '✅', color: '#22c55e' },
              { step: 6, title: 'Perform Maintenance', desc: 'Work can now be safely performed on the equipment', icon: '🔧', color: '#06b6d4' },
            ].map(s => (
              <div key={s.step} style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: `1px solid ${s.color}30` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 10, color: s.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Step {s.step}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{s.title}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'ppe' && (
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 20 }}>PPE Checklist — Electrical Work</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {[
              { item: 'Safety Helmet (Class E)', required: true, checked: true },
              { item: 'Insulated Gloves (Class 00/0)', required: true, checked: true },
              { item: 'Arc Flash Face Shield', required: true, checked: true },
              { item: 'Safety Shoes (Anti-static)', required: true, checked: true },
              { item: 'Arc Flash Suit / FR Clothing', required: true, checked: false },
              { item: 'Safety Goggles', required: true, checked: true },
              { item: 'Ear Protection (>85dB areas)', required: false, checked: false },
              { item: 'Fall Protection Harness (>2m height)', required: false, checked: true },
              { item: 'Insulated Tools', required: true, checked: true },
              { item: 'Voltage Tester / Multimeter', required: true, checked: true },
            ].map(ppe => (
              <div key={ppe.item} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: `1px solid ${ppe.checked ? 'rgba(34,197,94,0.2)' : ppe.required ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                <input type="checkbox" checked={ppe.checked} onChange={() => {}} style={{ width: 16, height: 16, accentColor: '#22c55e' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#e2e8f0' }}>{ppe.item}</div>
                  <div style={{ fontSize: 10, color: ppe.required ? '#ef4444' : '#64748b' }}>{ppe.required ? 'Mandatory' : 'Situational'}</div>
                </div>
                {ppe.checked ? <CheckCircle size={16} style={{ color: '#22c55e', flexShrink: 0 }} /> : <AlertTriangle size={16} style={{ color: ppe.required ? '#ef4444' : '#64748b', flexShrink: 0 }} />}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="btn-primary" style={{ fontSize: 12 }}>Submit PPE Check</button>
            <button className="btn-secondary" style={{ fontSize: 12 }}>Print Checklist</button>
          </div>
        </div>
      )}

      {/* Create Permit Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>Issue Permit to Work</div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Permit Type', type: 'select', options: ['LOTO', 'Hot Work', 'Confined Space', 'Height Work', 'Electrical Work', 'Cold Work'] },
                { label: 'Equipment / Location', placeholder: 'Equipment or area' },
                { label: 'Work to be Performed', type: 'textarea', gridCol: true },
                { label: 'Issued To', placeholder: 'Technician name' },
                { label: 'Valid From', type: 'datetime-local' },
                { label: 'Valid Until', type: 'datetime-local' },
                { label: 'Risk Level', type: 'select', options: ['Critical', 'High', 'Medium', 'Low'] },
                { label: 'PPE Required', type: 'textarea', gridCol: true },
              ].map(f => (
                <div key={f.label} style={{ gridColumn: (f as any).gridCol ? '1/-1' : undefined }}>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select className="input-dark">
                      {f.options!.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea className="input-dark" rows={2} placeholder={f.placeholder} style={{ resize: 'vertical' }} />
                  ) : (
                    <input type={f.type ?? 'text'} placeholder={f.placeholder} className="input-dark" />
                  )}
                </div>
              ))}
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Issue Permit</button>
                <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
