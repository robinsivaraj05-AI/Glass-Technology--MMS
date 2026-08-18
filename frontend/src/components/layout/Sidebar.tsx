import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Wrench, AlertTriangle, ClipboardList, Package,
  Zap, BarChart3, Users, Settings, Shield, BookOpen, Database,
  TrendingUp, Calendar, Bell, ChevronRight,
  Cpu, FlaskConical, HardDrive, Activity, FileText, DollarSign,
  GraduationCap, Building, Gauge, Menu, X, Network, CalendarCheck,
  Briefcase, Truck, Fuel, ShoppingCart,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: { label: string; path: string; icon?: React.ReactNode }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard',    icon: <LayoutDashboard size={16} />, path: '/dashboard' },
  {
    label: 'Maintenance',  icon: <Wrench size={16} />,
    children: [
      { label: 'Preventive PM',  path: '/pm',           icon: <Calendar size={14} /> },
      { label: 'Breakdown',      path: '/breakdowns',   icon: <AlertTriangle size={14} /> },
      { label: 'Work Orders',    path: '/work-orders',  icon: <ClipboardList size={14} /> },
      { label: 'Predictive',     path: '/predictive',   icon: <Activity size={14} /> },
      { label: 'Job Tracker',    path: '/job-tracker',  icon: <Bell size={14} /> },
    ],
  },
  {
    label: 'Assets',       icon: <HardDrive size={16} />,
    children: [
      { label: 'Asset Management', path: '/assets',      icon: <Database size={14} /> },
      { label: 'Master Data',      path: '/machines',    icon: <Cpu size={14} /> },
      { label: 'Calibration',      path: '/calibration', icon: <FlaskConical size={14} /> },
      { label: 'AMC Management',   path: '/amc',         icon: <FileText size={14} /> },
    ],
  },
  { label: 'Spare Parts',  icon: <Package size={16} />, path: '/spare-parts' },
  {
    label: 'Energy',       icon: <Zap size={16} />,
    children: [
      { label: 'Energy Dashboard',  path: '/energy',  icon: <Gauge size={14} /> },
      { label: 'Utility Monitoring',path: '/utility', icon: <Activity size={14} /> },
    ],
  },
  { label: 'Projects',     icon: <Building size={16} />, path: '/projects' },
  {
    label: 'Safety',       icon: <Shield size={16} />,
    children: [
      { label: 'Safety Module', path: '/safety',   icon: <Shield size={14} /> },
      { label: 'Shutdown Plan', path: '/shutdown', icon: <Calendar size={14} /> },
    ],
  },
  {
    label: 'Employees',    icon: <Users size={16} />,
    children: [
      { label: 'Employee Profile',  path: '/employees',         icon: <Users size={14} />         },
      { label: 'Attendance',        path: '/attendance',        icon: <CalendarCheck size={14} /> },
      { label: 'Org Chart',         path: '/org-chart',         icon: <Network size={14} />       },
      { label: 'E&I Team Summary',  path: '/org-chart/summary', icon: <BarChart3 size={14} />     },
      { label: 'Shift & Skills',    path: '/manpower',          icon: <Calendar size={14} />      },
      { label: 'Training',          path: '/training',          icon: <GraduationCap size={14} /> },
    ],
  },
  {
    label: 'Outsource',    icon: <Briefcase size={16} />,
    children: [
      { label: 'Contract Master', path: '/contractor/contracts', icon: <FileText size={14} /> },
      { label: 'Work Entry',      path: '/contractor/entry',     icon: <ClipboardList size={14} /> },
      { label: 'Cost Report',     path: '/contractor/report',    icon: <DollarSign size={14} /> },
    ],
  },
  {
    label: 'Rental Equip.', icon: <Truck size={16} />,
    children: [
      { label: 'Equipment Master', path: '/rental/equipment',   icon: <Wrench size={14} /> },
      { label: 'Work Entry',       path: '/rental/entry',       icon: <ClipboardList size={14} /> },
      { label: 'Accessories',      path: '/rental/accessories', icon: <Fuel size={14} /> },
      { label: 'Cost Report',      path: '/rental/report',      icon: <DollarSign size={14} /> },
    ],
  },
  {
    label: 'Purchase',     icon: <ShoppingCart size={16} />,
    children: [
      { label: 'RFQ Management',      path: '/purchase/rfq',      icon: <FileText size={14} /> },
      { label: 'PO Follow-up',        path: '/purchase/po',       icon: <ClipboardList size={14} /> },
      { label: 'E&I Purchase Status', path: '/purchase/followup', icon: <BarChart3 size={14} /> },
      { label: 'Purchase Costing',    path: '/purchase/costing',  icon: <TrendingUp size={14} /> },
    ],
  },
  {
    label: 'Finance',      icon: <DollarSign size={16} />,
    children: [
      { label: 'Budget',         path: '/budget',                icon: <TrendingUp size={14} /> },
      { label: 'Vendors',        path: '/vendors',               icon: <Building size={14} /> },
      { label: 'E&I Costing',    path: '/finance/costing',       icon: <BarChart3 size={14} /> },
      { label: 'E&I PUR Report', path: '/finance/ei-pur-report', icon: <FileText size={14} /> },
    ],
  },
  {
    label: 'ISO & Audit',  icon: <BookOpen size={16} />,
    children: [
      { label: 'ISO Documentation', path: '/iso',     icon: <FileText size={14} /> },
      { label: 'Quality Module',    path: '/quality', icon: <BarChart3 size={14} /> },
    ],
  },
  { label: 'Daily Logbook', icon: <BookOpen size={16} />,  path: '/logbook' },
  { label: 'Reports',       icon: <BarChart3 size={16} />, path: '/reports' },
  { label: 'Notifications', icon: <Bell size={16} />,      path: '/notifications' },
  { label: 'Settings',      icon: <Settings size={16} />,  path: '/settings' },
];

interface SidebarProps { collapsed: boolean; onToggle: () => void; }

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [openGroups, setOpenGroups] = useState<string[]>(['Maintenance']);
  const location = useLocation();
  const { user } = useAuth();

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]);
  };

  const isChildActive = (item: NavItem) =>
    item.children?.some(c => location.pathname.startsWith(c.path));

  return (
    <aside style={{
      width: collapsed ? 64 : 240,
      minWidth: collapsed ? 64 : 240,
      background: '#FFFFFF',
      borderRight: '1px solid #E5E7EB',
      height: '100vh',
      position: 'sticky', top: 0,
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.25s ease, min-width 0.25s ease',
      zIndex: 40, overflowX: 'hidden',
    }}>

      {/* Logo bar — dark blue for brand visibility */}
      <div style={{
        padding: collapsed ? '14px 10px' : '12px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
        display: 'flex', alignItems: 'center', minHeight: 64,
        background: 'linear-gradient(135deg, #1E3A5F 0%, #1E40AF 100%)',
        flexShrink: 0,
      }}>
        {collapsed ? (
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚡</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>⚡</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#FFFFFF', letterSpacing: 0.5 }}>MMS</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>E &amp; I Maintenance</div>
            </div>
          </div>
        )}
        <button onClick={onToggle} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.12)', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: 6, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {collapsed ? <Menu size={15} /> : <X size={15} />}
        </button>
      </div>

      {/* User quick info */}
      {!collapsed && user && (
        <div style={{ padding: '11px 14px', borderBottom: '1px solid #F1F5F9', background: '#FAFAFA', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: 'white',
              boxShadow: '0 2px 6px rgba(59,130,246,0.25)',
            }}>
              {user.name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
              <div style={{ fontSize: 10, color: '#3B82F6', textTransform: 'capitalize', fontWeight: 600 }}>{user.role.replace('_', ' ')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(item => {
          if (item.path) {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `sidebar-link sidebar-parent-btn ${isActive ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
                style={{ justifyContent: collapsed ? 'center' : undefined }}
              >
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          }

          const isOpen = openGroups.includes(item.label);
          const hasActiveChild = isChildActive(item);

          return (
            <div key={item.label}>
              <button
                onClick={() => !collapsed && toggleGroup(item.label)}
                className={`sidebar-link sidebar-parent-btn ${hasActiveChild && !isOpen ? 'active' : ''}`}
                style={{
                  width: '100%', textAlign: 'left', background: 'none', border: 'none',
                  justifyContent: collapsed ? 'center' : undefined,
                  ...(hasActiveChild && !isOpen ? { background: 'rgba(59,130,246,0.08)', color: '#2563EB' } : {}),
                }}
                title={collapsed ? item.label : undefined}
              >
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && (
                  <>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <span style={{ color: '#9CA3AF', transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : '' }}>
                      <ChevronRight size={13} />
                    </span>
                  </>
                )}
              </button>
              {isOpen && !collapsed && item.children && (
                <div style={{ paddingLeft: 10, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {item.children.map(child => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                      style={({ isActive }) => ({
                        fontSize: 12, padding: '7px 12px',
                        color: isActive ? '#1D4ED8' : '#6B7280',
                      })}
                    >
                      {child.icon && <span style={{ flexShrink: 0 }}>{child.icon}</span>}
                      <span>{child.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Version */}
      {!collapsed && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid #F1F5F9', fontSize: 10, color: '#9CA3AF', textAlign: 'center', background: '#FAFAFA', flexShrink: 0 }}>
          MMS v2.0.0 — E&amp;I Dept.
        </div>
      )}
    </aside>
  );
}
