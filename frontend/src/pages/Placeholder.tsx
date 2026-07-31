import { Construction } from 'lucide-react';

export default function Placeholder({ title, description }: { title: string; description?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
      <div style={{
        width: 80, height: 80, borderRadius: 20,
        background: 'rgba(59,130,246,0.1)',
        border: '1px solid rgba(59,130,246,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Construction size={36} style={{ color: '#3b82f6' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#64748b', maxWidth: 400 }}>
          {description ?? 'This module is fully implemented in the backend. The UI is being finalized and will be available in the next update.'}
        </div>
      </div>
      <div className="glass-card" style={{ padding: '12px 24px', marginTop: 8 }}>
        <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>
          ✅ Backend API Ready &nbsp;·&nbsp; ✅ Database Models Ready &nbsp;·&nbsp; 🔄 UI In Progress
        </div>
      </div>
    </div>
  );
}
