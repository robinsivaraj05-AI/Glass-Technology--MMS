import { useState } from 'react';
import { Plus, Search, Download, AlertTriangle, Package, TrendingDown, ArrowUpRight, ArrowDownLeft, QrCode } from 'lucide-react';
import { mockSpares } from '../data/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function SpareParts() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [tab, setTab] = useState<'inventory' | 'issue' | 'purchase'>('inventory');
  const [showCreate, setShowCreate] = useState(false);

  const categories = ['all', ...Array.from(new Set(mockSpares.map(s => s.category)))];
  const filtered = mockSpares.filter(s => {
    const t = search.toLowerCase();
    const matchSearch = !t || s.name.toLowerCase().includes(t) || s.code.toLowerCase().includes(t);
    const matchCat = category === 'all' || s.category === category;
    return matchSearch && matchCat;
  });

  const lowStock = mockSpares.filter(s => s.currentStock <= s.minStock);
  const totalValue = mockSpares.reduce((a, s) => a + s.totalValue, 0);
  const criticalSpares = mockSpares.filter(s => s.isCritical).length;

  const categoryValues = Array.from(new Set(mockSpares.map(s => s.category))).map(cat => ({
    name: cat,
    value: mockSpares.filter(s => s.category === cat).reduce((a, s) => a + s.totalValue, 0),
    count: mockSpares.filter(s => s.category === cat).length,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Items', value: mockSpares.length, icon: <Package size={18} />, color: '#3b82f6' },
          { label: 'Low Stock Alert', value: lowStock.length, icon: <AlertTriangle size={18} />, color: '#ef4444' },
          { label: 'Critical Spares', value: criticalSpares, icon: <AlertTriangle size={18} />, color: '#f59e0b' },
          { label: 'Total Stock Value', value: `₹${(totalValue / 100000).toFixed(1)}L`, icon: <Package size={18} />, color: '#22c55e' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ color: s.color }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Low Stock Alerts */}
      {lowStock.length > 0 && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>Low Stock Alert:</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {lowStock.map(s => (
              <span key={s.id} style={{ fontSize: 11, padding: '2px 10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, color: '#f87171' }}>
                {s.name} ({s.currentStock}/{s.minStock})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
        {[
          { key: 'inventory', label: 'Inventory' },
          { key: 'issue', label: 'Issue / Return' },
          { key: 'purchase', label: 'Purchase Request' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            style={{
              padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: tab === t.key ? '#3b82f6' : 'none',
              color: tab === t.key ? 'white' : '#64748b',
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'inventory' && (
        <>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search spare code, name..." className="input-dark" style={{ paddingLeft: 30 }} />
            </div>
            <select value={category} onChange={e => setCategory(e.target.value)} className="input-dark" style={{ width: 160 }}>
              {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
            </select>
            <button className="btn-secondary" style={{ fontSize: 12 }}><Download size={13} /> Export</button>
            <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ fontSize: 12 }}>
              <Plus size={13} /> Add Item
            </button>
          </div>

          {/* Table */}
          <div className="glass-card" style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th><th>Item Name</th><th>Category</th><th>Unit</th>
                  <th>Stock</th><th>Min/Max</th><th>Location</th><th>Supplier</th>
                  <th>Unit Price</th><th>Total Value</th><th>Critical</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const isLow = s.currentStock <= s.minStock;
                  return (
                    <tr key={s.id}>
                      <td style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: 11 }}>{s.code}</td>
                      <td style={{ fontWeight: 600, color: '#374151' }}>{s.name}</td>
                      <td><span className="badge badge-gray" style={{ fontSize: 10 }}>{s.category}</span></td>
                      <td style={{ color: '#94a3b8', fontSize: 12 }}>{s.unit}</td>
                      <td>
                        <span style={{ fontSize: 14, fontWeight: 700, color: isLow ? '#ef4444' : '#22c55e' }}>{s.currentStock}</span>
                        {isLow && <AlertTriangle size={11} style={{ color: '#ef4444', marginLeft: 4 }} />}
                      </td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>{s.minStock} / {s.maxStock}</td>
                      <td style={{ fontSize: 12, color: '#94a3b8' }}>{s.location}</td>
                      <td style={{ fontSize: 12, color: '#94a3b8' }}>{s.supplier}</td>
                      <td style={{ color: '#1e293b', fontSize: 12 }}>₹{s.unitPrice.toLocaleString()}</td>
                      <td style={{ color: '#22c55e', fontSize: 12 }}>₹{s.totalValue.toLocaleString()}</td>
                      <td>{s.isCritical ? <span className="badge badge-danger" style={{ fontSize: 10 }}>Critical</span> : <span className="badge badge-gray" style={{ fontSize: 10 }}>Normal</span>}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 10 }}><ArrowDownLeft size={11} /> Issue</button>
                          <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 10 }}><QrCode size={11} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'issue' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ArrowDownLeft size={16} style={{ color: '#ef4444' }} /> Issue Material
            </div>
            {[
              { label: 'Select Spare Part', type: 'select', options: mockSpares.map(s => `${s.code} - ${s.name}`) },
              { label: 'Quantity', type: 'number' },
              { label: 'Work Order / Breakdown No', type: 'text' },
              { label: 'Machine / Equipment', type: 'text' },
              { label: 'Issued To (Technician)', type: 'text' },
              { label: 'Remarks', type: 'textarea' },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>{f.label}</label>
                {f.type === 'select' ? (
                  <select className="input-dark">
                    <option>Select item...</option>
                    {f.options!.slice(0,5).map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }} />
                ) : (
                  <input type={f.type} className="input-dark" />
                )}
              </div>
            ))}
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Issue Material</button>
          </div>
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ArrowUpRight size={16} style={{ color: '#22c55e' }} /> Return Material
            </div>
            {[
              { label: 'Spare Part', type: 'select', options: mockSpares.map(s => `${s.code} - ${s.name}`) },
              { label: 'Quantity Returned', type: 'number' },
              { label: 'Condition', type: 'select', options: ['Good', 'Damaged', 'Scrap'] },
              { label: 'Original Issue Ref', type: 'text' },
              { label: 'Reason for Return', type: 'textarea' },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>{f.label}</label>
                {f.type === 'select' ? (
                  <select className="input-dark">
                    <option>Select...</option>
                    {f.options!.slice(0,5).map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }} />
                ) : (
                  <input type={f.type} className="input-dark" />
                )}
              </div>
            ))}
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Process Return</button>
          </div>
        </div>
      )}

      {tab === 'purchase' && (
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 20 }}>Create Purchase Request</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { label: 'Spare Part Name', placeholder: 'Name or code of spare part' },
              { label: 'Quantity Required', type: 'number' },
              { label: 'Preferred Supplier', placeholder: 'Supplier name' },
              { label: 'Expected Unit Price (₹)', type: 'number' },
              { label: 'Required By Date', type: 'date' },
              { label: 'Priority', type: 'select', options: ['Critical', 'High', 'Medium', 'Low'] },
              { label: 'Purpose / Justification', type: 'textarea', gridCol: true },
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
              <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Submit Purchase Request</button>
              <button className="btn-secondary">Save as Draft</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Value Chart */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 16 }}>Stock Value by Category</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={categoryValues}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
            <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Value']} contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="value" fill="#3b82f6" radius={[4,4,0,0]} opacity={0.8} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

