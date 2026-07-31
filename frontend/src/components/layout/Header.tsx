import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Bell, Search, LogOut, User, Settings, ChevronDown,
  Sun, Moon, Maximize2, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { mockNotifications } from '../../data/mockData';

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/pm': 'Preventive Maintenance',
  '/breakdowns': 'Breakdown Maintenance',
  '/work-orders': 'Work Orders',
  '/predictive': 'Predictive Maintenance',
  '/assets': 'Asset Management',
  '/machines': 'Machine Master Data',
  '/calibration': 'Calibration Management',
  '/spare-parts': 'Spare Parts Inventory',
  '/energy': 'Energy Management',
  '/utility': 'Utility Monitoring',
  '/projects': 'Project Management',
  '/safety': 'Safety Module',
  '/shutdown': 'Shutdown Planning',
  '/manpower': 'Manpower Management',
  '/training': 'Training Management',
  '/budget': 'Budget Management',
  '/vendors': 'Vendor Management',
  '/iso': 'ISO Documentation',
  '/quality': 'Quality Module',
  '/logbook': 'Daily Logbook',
  '/reports': 'Reports & Analytics',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
};

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [time, setTime] = useState(new Date());
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unread = mockNotifications.filter(n => !n.read).length;
  const currentPage = BREADCRUMB_MAP[location.pathname] ?? 'Dashboard';

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const roleLabel = user?.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '';
  const roleColor: Record<string, string> = {
    manager: '#ef4444', deputy_manager: '#3b82f6',
    shift_engineer: '#22c55e', guest: '#64748b',
  };

  return (
    <header style={{
      background: 'rgba(5,5,10,0.95)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(20px)',
      padding: '0 24px',
      height: 60,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      position: 'sticky',
      top: 0,
      zIndex: 30,
    }}>
      {/* Logo + Breadcrumb */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <img src="/logo-dark.svg" alt="Glass Technology" style={{ height: 32, width: 'auto', flexShrink: 0 }} />
        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 1 }}>E&I Maintenance Management System</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentPage}</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', width: 240 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
        <input
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          placeholder="Search assets, WO, spare parts..."
          className="input-dark"
          style={{ paddingLeft: 32, fontSize: 12, height: 34 }}
        />
      </div>

      {/* Time */}
      <div style={{ textAlign: 'right', fontSize: 11, color: '#475569', lineHeight: 1.4, minWidth: 80 }}>
        <div style={{ color: '#94a3b8', fontWeight: 500 }}>
          {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div>{time.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
      </div>

      {/* Refresh */}
      <button
        style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 6, borderRadius: 6 }}
        onClick={() => window.location.reload()}
        title="Refresh"
      >
        <RefreshCw size={15} />
      </button>

      {/* Notifications */}
      <div ref={notifRef} style={{ position: 'relative' }}>
        <button
          onClick={() => { setShowNotif(!showNotif); setShowProfile(false); }}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, cursor: 'pointer', padding: '6px 10px',
            display: 'flex', alignItems: 'center', gap: 6, position: 'relative',
            color: '#94a3b8',
          }}
        >
          <Bell size={15} />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: '#ef4444', color: 'white',
              width: 16, height: 16, borderRadius: '50%',
              fontSize: 9, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{unread}</span>
          )}
        </button>
        {showNotif && (
          <div style={{
            position: 'absolute', right: 0, top: '110%',
            width: 340, background: '#0d0d1a',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            zIndex: 100,
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>Notifications</span>
              <span className="badge badge-blue">{unread} new</span>
            </div>
            {mockNotifications.slice(0, 5).map(n => (
              <div key={n.id} style={{
                padding: '10px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: n.read ? 'transparent' : 'rgba(59,130,246,0.04)',
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                    background: n.priority === 'critical' ? '#ef4444' : n.priority === 'high' ? '#f59e0b' : '#3b82f6',
                  }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{n.message}</div>
                    <div style={{ fontSize: 10, color: '#334155', marginTop: 4 }}>
                      {new Date(n.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ padding: '10px 16px', textAlign: 'center' }}>
              <button onClick={() => { navigate('/notifications'); setShowNotif(false); }} className="btn-secondary" style={{ width: '100%', fontSize: 12, justifyContent: 'center' }}>
                View All Notifications
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Profile */}
      <div ref={profileRef} style={{ position: 'relative' }}>
        <button
          onClick={() => { setShowProfile(!showProfile); setShowNotif(false); }}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, cursor: 'pointer', padding: '5px 10px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600, color: 'white', flexShrink: 0,
          }}>
            {user?.name.split(' ').map(n => n[0]).join('').slice(0,2)}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{user?.name.split(' ')[0]}</div>
            <div style={{ fontSize: 10, color: roleColor[user?.role ?? 'guest'] ?? '#64748b', textTransform: 'capitalize' }}>{roleLabel}</div>
          </div>
          <ChevronDown size={12} style={{ color: '#475569' }} />
        </button>
        {showProfile && (
          <div style={{
            position: 'absolute', right: 0, top: '110%',
            width: 220, background: '#0d0d1a',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            zIndex: 100,
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{user?.email}</div>
              <div style={{ fontSize: 10, marginTop: 4, color: roleColor[user?.role ?? 'guest'] }}>{roleLabel}</div>
            </div>
            {[
              { label: 'My Profile', icon: <User size={13} />, path: '/settings' },
              { label: 'Settings', icon: <Settings size={13} />, path: '/settings' },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => { navigate(item.path); setShowProfile(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseOut={e => (e.currentTarget.style.background = 'none')}
              >
                {item.icon} {item.label}
              </button>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={logout}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                onMouseOut={e => (e.currentTarget.style.background = 'none')}
              >
                <LogOut size={13} /> Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
