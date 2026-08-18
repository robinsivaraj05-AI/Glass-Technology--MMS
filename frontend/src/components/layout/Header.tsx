import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Bell, Search, LogOut, User, Settings, ChevronDown, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { mockNotifications } from '../../data/mockData';

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard':            'Dashboard',
  '/pm':                   'Preventive Maintenance',
  '/breakdowns':           'Breakdown Maintenance',
  '/work-orders':          'Work Orders',
  '/predictive':           'Predictive Maintenance',
  '/job-tracker':          'Job Tracker',
  '/assets':               'Asset Management',
  '/machines':             'Machine Master Data',
  '/calibration':          'Calibration Management',
  '/amc':                  'AMC Management',
  '/spare-parts':          'Spare Parts Inventory',
  '/energy':               'Energy Management',
  '/utility':              'Utility Monitoring',
  '/projects':             'Project Management',
  '/safety':               'Safety Module',
  '/shutdown':             'Shutdown Planning',
  '/manpower':             'Manpower Management',
  '/training':             'Training Management',
  '/employees':            'Employee Profiles',
  '/attendance':           'Attendance',
  '/org-chart':            'Org Chart',
  '/budget':               'Budget Management',
  '/vendors':              'Vendor Management',
  '/iso':                  'ISO Documentation',
  '/quality':              'Quality Module',
  '/logbook':              'Daily Logbook',
  '/reports':              'Reports & Analytics',
  '/notifications':        'Notifications',
  '/settings':             'Settings',
  '/contractor':           'Contractor Dashboard',
  '/contractor/contracts': 'Contract Master',
  '/contractor/entry':     'Outsource Entry',
  '/contractor/report':    'Outsource Report',
  '/rental/equipment':     'Equipment Master',
  '/rental/entry':         'Equipment Entry',
  '/rental/accessories':   'Accessories',
  '/rental/report':        'Rental Report',
  '/purchase/rfq':         'RFQ Management',
  '/purchase/po':          'PO Follow-up',
  '/purchase/followup':    'E&I Purchase Status',
  '/purchase/costing':     'Purchase Costing',
  '/finance/costing':      'E&I Costing',
  '/finance/ei-pur-report':'E&I Purchase Report',
};

const PRIORITY_DOT: Record<string, string> = {
  critical: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#22C55E',
};

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotif,   setShowNotif]   = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchVal,   setSearchVal]   = useState('');
  const [time,        setTime]        = useState(new Date());
  const notifRef   = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unread      = mockNotifications.filter(n => !n.read).length;
  const currentPage = BREADCRUMB_MAP[location.pathname] ?? 'Dashboard';

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current   && !notifRef.current.contains(e.target as Node))   setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const roleLabel = user?.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '';
  const roleColor: Record<string, string> = {
    manager: '#EF4444', deputy_manager: '#3B82F6',
    shift_engineer: '#22C55E', guest: '#9CA3AF',
  };

  return (
    <header style={{
      background: '#FFFFFF',
      borderBottom: '1px solid #E5E7EB',
      padding: '0 24px',
      height: 60,
      display: 'flex', alignItems: 'center', gap: 14,
      position: 'sticky', top: 0, zIndex: 30,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      flexShrink: 0,
    }}>

      {/* Breadcrumb */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            E&amp;I MMS
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentPage}
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', width: 240 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
        <input
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          placeholder="Search assets, WO, spare parts..."
          className="input-dark"
          style={{ paddingLeft: 32, fontSize: 12, height: 34 }}
        />
      </div>

      {/* Live clock */}
      <div style={{ textAlign: 'right', fontSize: 11, lineHeight: 1.5, minWidth: 80 }}>
        <div style={{ color: '#1E293B', fontWeight: 700 }}>
          {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div style={{ color: '#9CA3AF', fontSize: 10 }}>
          {time.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {/* Refresh */}
      <button
        title="Refresh"
        onClick={() => window.location.reload()}
        style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', color: '#6B7280', cursor: 'pointer', padding: 7, borderRadius: 8, display: 'flex', alignItems: 'center' }}
      >
        <RefreshCw size={14} />
      </button>

      {/* Notifications */}
      <div ref={notifRef} style={{ position: 'relative' }}>
        <button
          onClick={() => { setShowNotif(!showNotif); setShowProfile(false); }}
          style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 5, position: 'relative', color: '#6B7280' }}
        >
          <Bell size={15} />
          {unread > 0 && (
            <span style={{ position: 'absolute', top: -5, right: -5, background: '#EF4444', color: 'white', width: 17, height: 17, borderRadius: '50%', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
              {unread}
            </span>
          )}
        </button>

        {showNotif && (
          <div style={{ position: 'absolute', right: 0, top: '110%', width: 340, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', zIndex: 100 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>Notifications</span>
              <span className="badge badge-blue">{unread} new</span>
            </div>
            {mockNotifications.slice(0, 5).map(n => (
              <div key={n.id} style={{ padding: '10px 16px', borderBottom: '1px solid #F9FAFB', background: n.read ? '#fff' : '#EFF6FF', cursor: 'pointer' }}
                onMouseOver={e => (e.currentTarget.style.background = '#F8FAFC')}
                onMouseOut={e => (e.currentTarget.style.background = n.read ? '#fff' : '#EFF6FF')}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4, background: PRIORITY_DOT[n.priority] || '#3B82F6' }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{n.message}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
                      {new Date(n.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ padding: '10px 16px', background: '#F8FAFC' }}>
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
          style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 9, cursor: 'pointer', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(59,130,246,0.4)' }} />
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>
              {user?.name.split(' ').map(n => n[0]).join('').slice(0,2)}
            </div>
          )}
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{user?.name.split(' ')[0]}</div>
            <div style={{ fontSize: 10, color: roleColor[user?.role ?? 'guest'] ?? '#9CA3AF', textTransform: 'capitalize' }}>{roleLabel}</div>
          </div>
          <ChevronDown size={12} style={{ color: '#9CA3AF' }} />
        </button>

        {showProfile && (
          <div style={{ position: 'absolute', right: 0, top: '110%', width: 220, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', zIndex: 100 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>{user?.email}</div>
              <div style={{ fontSize: 10, marginTop: 4, color: roleColor[user?.role ?? 'guest'] ?? '#9CA3AF', fontWeight: 600 }}>{roleLabel}</div>
            </div>
            {[
              { label: 'My Profile', icon: <User size={13} />,     path: '/settings' },
              { label: 'Settings',   icon: <Settings size={13} />, path: '/settings' },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => { navigate(item.path); setShowProfile(false); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                onMouseOver={e => (e.currentTarget.style.background = '#F8FAFC')}
                onMouseOut={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ color: '#6B7280' }}>{item.icon}</span> {item.label}
              </button>
            ))}
            <div style={{ borderTop: '1px solid #F1F5F9' }}>
              <button
                onClick={logout}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                onMouseOver={e => (e.currentTarget.style.background = '#FEF2F2')}
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
