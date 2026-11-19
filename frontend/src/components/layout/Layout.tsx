import { useState } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../context/AuthContext';

export default function Layout() {
  const { isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F0F4F8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #1E40AF, #3B82F6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(59,130,246,0.3)',
          }}>⚡</div>
          <div style={{ color: '#6B7280', fontSize: 14, fontWeight: 500 }}>Loading MMS...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F0F4F8' }}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(p => !p)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header />
        {user?.mustChangePassword && (
          <div role="status" style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 24px', background:'#fef3c7', borderBottom:'1px solid #fde68a', color:'#92400e', fontSize:13 }}>
            <span>🔒 You are still using an initial password. Please change it to keep the system secure.</span>
            <button onClick={() => navigate('/settings', { state: { tab: 'security' } })}
              style={{ marginLeft:'auto', padding:'4px 12px', borderRadius:6, border:'1px solid #d97706', background:'#fff', color:'#92400e', fontWeight:600, fontSize:12, cursor:'pointer' }}>
              Change password
            </button>
          </div>
        )}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          background: '#F0F4F8',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
